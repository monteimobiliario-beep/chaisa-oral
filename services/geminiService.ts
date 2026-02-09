
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedData, FileData, Individual } from "../types";

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 10000;
const QUOTA_RETRY_DELAY = 62000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processDocumentBatch = async (
  files: FileData[],
  attempt = 1
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contentParts = files.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data }
  }));

  const prompt = `Você é um perito em transcrição de genealogia para o formulário MZ11. 
O documento possui 3 páginas com 25 linhas cada (Total 75 registros).

REGRAS DE EXTRAÇÃO RELACIONAL (CRÍTICO):
1. RIN (Record Identification Number): Identifique o número da linha de 1 a 75.
2. CÓDIGOS DE RELAÇÃO (Coluna eBuild):
   - C<n>: Cônjuge do RIN <n>. Ex: "C1 Tereza" (Tereza é esposa do RIN 1).
   - F<n>,<m>: Filho do casal formado por RIN <n> e RIN <m>. Ex: "F1,2 Paulo" (Paulo é filho de 1 e 2).
   - P<k>: Progenitor do RIN <k>. Ex: "P5 Manuel" (Manuel é pai/mãe de 5).
3. TRATAMENTO DE DADOS AUSENTES:
   - Se um campo (data, local, nome) estiver vazio no papel, deixe-o VAZIO (string vazia ""). 
   - NÃO insira palavras como "null", "desconhecido" ou "não informado".
4. LOCAIS (Ditto Marks): Se houver aspas (") na coluna de local, use o local da linha imediatamente anterior.
5. TOTALIDADE: Extraia todos os nomes de todas as páginas enviadas.

Retorne JSON estrito com o campo 'individuals'.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          { text: prompt },
          ...contentParts
        ] 
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
                  rin: { type: Type.NUMBER },
                  fullName: { type: Type.STRING },
                  relation: { type: Type.STRING },
                  sex: { type: Type.STRING },
                  birthDate: { type: Type.STRING },
                  birthPlace: { type: Type.STRING },
                  deathDate: { type: Type.STRING },
                  deathPlace: { type: Type.STRING },
                  page: { type: Type.NUMBER }
                },
                required: ["fullName"]
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA não retornou resposta.");
    return JSON.parse(text);

  } catch (e: any) {
    const errorMsg = e.message || String(e);
    if (attempt < MAX_RETRIES) {
      const delay = errorMsg.includes("429") ? QUOTA_RETRY_DELAY : BASE_RETRY_DELAY;
      await sleep(delay);
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

  try {
    const result = await processDocumentBatch(files);
    
    if (!result.individuals || result.individuals.length === 0) {
      throw new Error("Nenhum dado encontrado.");
    }

    let lastBPlace = "";
    let lastDPlace = "";

    const processed = result.individuals.map((ind: any, idx: number) => {
      let bPlace = (ind.birthPlace || "").trim();
      if (bPlace === '"' || bPlace.toLowerCase() === 'ditto') bPlace = lastBPlace;
      else if (bPlace) lastBPlace = bPlace;

      let dPlace = (ind.deathPlace || "").trim();
      if (dPlace === '"' || dPlace.toLowerCase() === 'ditto') dPlace = lastDPlace;
      else if (dPlace) lastDPlace = dPlace;

      return {
        id: `ind-${idx}-${Date.now()}`,
        rin: ind.rin || (idx + 1),
        fullName: (ind.fullName || "").trim(),
        relation: (ind.relation || "").trim(),
        birthDate: (ind.birthDate || "").trim(),
        birthPlace: bPlace,
        deathDate: (ind.deathDate || "").trim(),
        deathPlace: dPlace,
        sex: (ind.sex || "").trim(), 
        page: ind.page || (Math.floor(idx / 25) + 1),
        row: (idx % 25) + 1,
        confidence: 0.99,
        isDitto: ind.birthPlace === '"' || ind.deathPlace === '"'
      };
    });

    return {
      metadata: {
        interviewId: `MZ11-${Date.now().toString().slice(-4)}`,
        intervieweeName: processed[0]?.fullName || "",
        interviewDate: new Date().toLocaleDateString(),
        interviewPlace: "",
        intervieweeRin: "1",
        totalNames: processed.length
      },
      individuals: processed.sort((a: any, b: any) => a.rin - b.rin)
    };
  } catch (err: any) {
    throw new Error(`Erro na extração: ${err.message}`);
  }
};
