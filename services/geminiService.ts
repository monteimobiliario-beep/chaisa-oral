
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

  const prompt = `Você é um especialista em transcrição de genealogia focado no formulário Oral-Gen MZ11.
O documento consiste em 3 PÁGINAS contendo uma tabela repetida com 25 linhas cada (Total de 75 registros possíveis).

O QUE PROCURAR E COMO EXTRAIR:
1. MAPEAMENTO DE PÁGINAS:
   - Página 1: Linhas (RIN) 1 a 25.
   - Página 2: Linhas (RIN) 26 a 50.
   - Página 3: Linhas (RIN) 51 a 75.
   - Ignore cabeçalhos repetidos em cada página, mas use-os para alinhar as colunas.

2. COLUNAS DA TABELA:
   - RIN: Número identificador da linha.
   - eBuild (Relação): Códigos como C<n> (Cônjuge de n), F<n>,<m> (Filho de n e m), P<k> (Progenitor de k).
   - Nome Completo: O nome da pessoa.
   - Sexo: M ou F.
   - Nascimento (Data e Local): Extraia ambos. Se houver aspas (") no local, repita o local da linha de cima.
   - Falecimento (Data e Local): Extraia se disponível.

3. REGRAS CRÍTICAS:
   - Preserve a numeração exata (RIN). Se a linha 32 está na página 2, ela deve ter RIN 32.
   - DITTO MARKS: Aspas (") significam repetição do dado imediatamente acima na mesma coluna.
   - FORMATO: Retorne apenas o JSON estruturado conforme o esquema.

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
      throw new Error("Nenhum dado encontrado no formulário.");
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

      // Garantir o RIN correto baseado na posição se a IA falhar na detecção numérica
      const calculatedRin = ind.rin || (idx + 1);

      return {
        id: `ind-${idx}-${Date.now()}`,
        rin: calculatedRin,
        fullName: (ind.fullName || "").trim(),
        relation: (ind.relation || "").trim(),
        birthDate: (ind.birthDate || "").trim(),
        birthPlace: bPlace,
        deathDate: (ind.deathDate || "").trim(),
        deathPlace: dPlace,
        sex: (ind.sex || "").trim(), 
        page: ind.page || (Math.floor((calculatedRin - 1) / 25) + 1),
        row: ((calculatedRin - 1) % 25) + 1,
        confidence: 0.99,
        isDitto: ind.birthPlace === '"' || ind.deathPlace === '"'
      };
    });

    return {
      metadata: {
        interviewId: `MZ11-${Date.now().toString().slice(-4)}`,
        intervieweeName: processed[0]?.fullName || "Entrevistado Principal",
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