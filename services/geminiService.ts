
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedData, FileData, Individual } from "../types";

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 10000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processDocumentBatch = async (
  files: FileData[],
  attempt = 1
): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não encontrada. Verifique se o ambiente está configurado.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const contentParts = files.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data }
  }));

  const prompt = `Você é um transcritor especializado em genealogia para o formulário Oral-Gen MZ11.
Este documento geralmente possui 3 PÁGINAS, cada uma com uma tabela de 25 linhas (Total: 75 registros).

REGRAS DE EXTRAÇÃO OBRIGATÓRIAS:
1. COLUNA 'eBuild' (Relacionamento): Esta é a coluna mais importante. Transcreva exatamente os códigos:
   - C<n> : Cônjuge do RIN <n>
   - F<n>,<m> : Filho dos RINs <n> e <m>
   - P<k> : Progenitor do RIN <k>
   - Se houver qualquer outro código, transcreva-o exatamente como está.

2. MAPEAMENTO DE RIN (Numeração das Linhas):
   - Página 1: RIN 1 a 25.
   - Página 2: RIN 26 a 50.
   - Página 3: RIN 51 a 75.
   - Verifique o número da linha impresso no formulário para garantir que o 'rin' no JSON seja exato.

3. TRATAMENTO DE ASPAS ("): 
   - Se encontrar aspas (") nas colunas de 'Local de Nascimento' ou 'Local de Falecimento', repita o valor da linha imediatamente superior.

4. ESTRUTURA DE DADOS:
   - Retorne um objeto JSON contendo um array 'individuals'.
   - Cada indivíduo deve ter: rin (número), fullName (texto), relation (o código eBuild), sex (M/F), birthDate, birthPlace, deathDate, deathPlace.

5. QUALIDADE:
   - Se um nome estiver riscado, não o transcreva.
   - Se a linha estiver em branco, pule-a.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Modelo superior para tarefas complexas de transcrição tabular
      contents: { 
        parts: [{ text: prompt }, ...contentParts] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            individuals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rin: { type: Type.NUMBER, description: "O número RIN da linha (1-75)" },
                  fullName: { type: Type.STRING },
                  relation: { type: Type.STRING, description: "O código da coluna eBuild" },
                  sex: { type: Type.STRING },
                  birthDate: { type: Type.STRING },
                  birthPlace: { type: Type.STRING },
                  deathDate: { type: Type.STRING },
                  deathPlace: { type: Type.STRING },
                  page: { type: Type.NUMBER }
                },
                required: ["fullName", "rin"]
              }
            }
          }
        }
      }
    });

    const jsonResponse = JSON.parse(response.text || "{}");
    return jsonResponse;
  } catch (e: any) {
    if (attempt < MAX_RETRIES) {
      await sleep(BASE_RETRY_DELAY);
      return processDocumentBatch(files, attempt + 1);
    }
    throw e;
  }
};

export const extractDataFromImages = async (
  files: FileData[], 
  onProgress?: (current: number, total: number) => void
): Promise<ProcessedData> => {
  if (onProgress) onProgress(1, 1);
  const result = await processDocumentBatch(files);
  
  if (!result.individuals || result.individuals.length === 0) {
    throw new Error("Nenhum registro foi extraído. Verifique se as imagens do formulário MZ11 estão nítidas.");
  }

  let lastBPlace = "";
  let lastDPlace = "";

  const processed = result.individuals.map((ind: any, idx: number) => {
    // Lógica para tratar ditto marks (")
    let bPlace = (ind.birthPlace || "").trim();
    if (bPlace === '"' || bPlace.toLowerCase().includes('ditto')) {
      bPlace = lastBPlace;
    } else if (bPlace) {
      lastBPlace = bPlace;
    }

    let dPlace = (ind.deathPlace || "").trim();
    if (dPlace === '"' || dPlace.toLowerCase().includes('ditto')) {
      dPlace = lastDPlace;
    } else if (dPlace) {
      lastDPlace = dPlace;
    }

    const rinValue = ind.rin || (idx + 1);
    return {
      ...ind,
      id: `ind-${rinValue}-${Date.now()}-${idx}`,
      rin: rinValue,
      birthPlace: bPlace,
      deathPlace: dPlace,
      page: ind.page || Math.floor((rinValue - 1) / 25) + 1,
      row: ((rinValue - 1) % 25) + 1,
      confidence: 0.98,
      isDitto: ind.birthPlace === '"' || ind.deathPlace === '"'
    };
  });

  return {
    metadata: {
      interviewId: `MZ11-${Date.now().toString().slice(-4)}`,
      intervieweeName: processed[0]?.fullName || "Entrevistado Principal",
      interviewDate: new Date().toLocaleDateString('pt-BR'),
      interviewPlace: "",
      intervieweeRin: "1",
      totalNames: processed.length
    },
    individuals: processed.sort((a: any, b: any) => a.rin - b.rin)
  };
};
