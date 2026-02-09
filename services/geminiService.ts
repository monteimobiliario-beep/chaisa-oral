
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
    throw new Error("API Key não encontrada. Verifique a configuração.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const contentParts = files.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data }
  }));

  const prompt = `Você é um especialista em transcrição do formulário genealógico MZ11.
O documento possui 3 PÁGINAS contendo uma tabela repetida (RIN 1-25, 26-50, 51-75).

REGRAS DE EXTRAÇÃO:
1. COLUNA EBUILD: Transcreva exatamente o código de relação (ex: C1, F2,3, P10). É o dado mais importante.
2. DITTO MARKS ("): Se houver aspas (") na coluna de local, repita o local da linha anterior.
3. RIN: Mantenha a numeração exata da linha.
4. ESTRUTURA: Retorne um JSON com a chave 'individuals'.

MAPEAMENTO:
- Pág 1 -> RIN 1 a 25
- Pág 2 -> RIN 26 a 50
- Pág 3 -> RIN 51 a 75`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Melhor modelo para raciocínio em tabelas complexas
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
                required: ["fullName", "rin"]
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
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
  
  if (!result.individuals) throw new Error("Falha na extração de dados.");

  let lastBPlace = "";
  let lastDPlace = "";

  const processed = result.individuals.map((ind: any, idx: number) => {
    let bPlace = (ind.birthPlace || "").trim();
    if (bPlace === '"' || bPlace.toLowerCase() === 'ditto') bPlace = lastBPlace;
    else if (bPlace) lastBPlace = bPlace;

    let dPlace = (ind.deathPlace || "").trim();
    if (dPlace === '"' || dPlace.toLowerCase() === 'ditto') dPlace = lastDPlace;
    else if (dPlace) lastDPlace = dPlace;

    const rin = ind.rin || (idx + 1);
    return {
      ...ind,
      id: `ind-${rin}-${Date.now()}`,
      rin,
      birthPlace: bPlace,
      deathPlace: dPlace,
      page: ind.page || Math.floor((rin - 1) / 25) + 1,
      confidence: 0.95
    };
  });

  return {
    metadata: {
      interviewId: `MZ11-${Date.now().toString().slice(-4)}`,
      intervieweeName: processed[0]?.fullName || "Principal",
      interviewDate: new Date().toLocaleDateString(),
      interviewPlace: "",
      intervieweeRin: "1",
      totalNames: processed.length
    },
    individuals: processed
  };
};
