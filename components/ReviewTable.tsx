
import React, { useState, useEffect, useCallback } from 'react';
import { Individual, ProcessedData } from '../types.ts';
import { generateGEDCOM } from '../services/gedcomService.ts';

interface ReviewTableProps {
  data: ProcessedData;
  onUpdate: (updatedData: ProcessedData) => void;
  onSave: () => Promise<void>;
  isSaving?: boolean;
}

export const ReviewTable: React.FC<ReviewTableProps> = ({ data, onUpdate, onSave, isSaving }) => {
  const [isListening, setIsListening] = useState<string | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!data || !data.individuals || data.individuals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] shadow-xl border border-slate-100 p-12 text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Erro de Carregamento</h3>
        <p className="text-slate-500 font-medium max-w-sm">Os dados extraídos não puderam ser processados corretamente. Tente reenviar o documento.</p>
      </div>
    );
  }

  const updateIndividual = (id: string, field: keyof Individual, value: any) => {
    const updatedIndividuals = data.individuals.map(ind => 
      ind.id === id ? { ...ind, [field]: value } : ind
    );
    onUpdate({ ...data, individuals: updatedIndividuals });
  };

  const handleSave = async () => {
    try {
      await onSave();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
    }
  };

  const sourceFiles = data.sourceFiles || [];

  const nextFile = useCallback(() => {
    if (sourceFiles.length > 0) {
      setActiveFileIndex((prev) => (prev + 1) % sourceFiles.length);
    }
  }, [sourceFiles.length]);

  const prevFile = useCallback(() => {
    if (sourceFiles.length > 0) {
      setActiveFileIndex((prev) => (prev - 1 + sourceFiles.length) % sourceFiles.length);
    }
  }, [sourceFiles.length]);

  const startVoiceInput = (id: string, field: keyof Individual) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta entrada de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.start();
    setIsListening(`${id}-${field}`);
    recognition.onresult = (event: any) => {
      updateIndividual(id, field, event.results[0][0].transcript);
      setIsListening(null);
    };
    recognition.onerror = () => setIsListening(null);
    recognition.onend = () => setIsListening(null);
  };

  const uniquePages = Array.from(new Set(data.individuals.map(ind => ind.page || 1))).sort((a: number, b: number) => a - b);
  
  return (
    <div className="flex h-[calc(100vh-160px)] gap-6 animate-in fade-in duration-500">
      <aside className="w-[45%] bg-white border border-slate-200 rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden">
        <header className="px-8 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-widest leading-none">Original MZ11</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Arquivo {activeFileIndex + 1} de {sourceFiles.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={prevFile} disabled={sourceFiles.length <= 1} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextFile} disabled={sourceFiles.length <= 1} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </header>
        <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden relative">
          {sourceFiles.length > 0 ? (
            sourceFiles[activeFileIndex].mimeType === 'application/pdf' ? (
              <iframe 
                src={`data:application/pdf;base64,${sourceFiles[activeFileIndex].data}#toolbar=0&navpanes=0`} 
                className="w-full h-full rounded-2xl border-none shadow-inner"
                title="Visualizador PDF"
              />
            ) : (
              <div className="w-full h-full overflow-auto custom-scrollbar flex items-center justify-center">
                <img 
                  src={`data:${sourceFiles[activeFileIndex].mimeType};base64,${sourceFiles[activeFileIndex].data}`} 
                  className="max-w-none w-full object-contain drop-shadow-2xl rounded-sm"
                  alt="Documento original"
                />
              </div>
            )
          ) : (
            <div className="text-slate-300 flex flex-col items-center">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-[10px] font-black uppercase tracking-widest">Nenhum anexo encontrado</span>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar flex flex-col">
        <section className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 z-30 shadow-sm shrink-0">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none">
              {data.metadata?.originalFilename || 'Revisão de Dados'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Lote Ativo</span>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confira os dados com o original à esquerda</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={`px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg active:scale-95 ${
                saveSuccess ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              } disabled:opacity-50`}
            >
              {isSaving ? 'Gravando' : saveSuccess ? '✓ Salvo' : 'Salvar Revisão'}
            </button>
            <button 
              onClick={() => {
                const gedcom = generateGEDCOM(data);
                const blob = new Blob([gedcom], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `MZ11_${data.metadata?.originalFilename || 'export'}.ged`;
                link.click();
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95"
            >
              Gerar GEDCOM
            </button>
          </div>
        </section>

        <div className="space-y-8 pb-10">
          {uniquePages.map((pageNum) => (
            <section key={pageNum} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-slate-50 px-8 py-3 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="bg-white text-blue-600 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-xs border border-blue-50">P{pageNum}</span>
                  <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Registros da Página {pageNum}</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <thead className="bg-white border-b">
                    <tr className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                      <th className="px-6 py-4 w-16 text-center border-r">RIN</th>
                      <th className="px-4 py-4 w-20 text-center text-blue-600">eBuild</th>
                      <th className="px-6 py-4 text-left">Nome Completo</th>
                      <th className="px-4 py-4 w-12 text-center">Sex</th>
                      <th className="px-6 py-4 text-left border-l bg-slate-50/20">Datas e Locais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.individuals
                      .filter(ind => (ind.page || 1) === pageNum)
                      .sort((a, b) => a.rin - b.rin)
                      .map((ind) => (
                        <tr key={ind.id} className="hover:bg-blue-50/10 transition-colors group">
                          <td className="px-6 py-3 text-center text-[10px] font-black text-slate-300 border-r">{ind.rin}</td>
                          <td className="px-3 py-3">
                            <input 
                              type="text" 
                              value={ind.relation || ''} 
                              onChange={e => updateIndividual(ind.id, 'relation', e.target.value.toUpperCase())}
                              className="w-full text-center text-[10px] font-black text-blue-600 border border-transparent focus:border-blue-100 rounded-lg p-1.5 bg-slate-50/50 uppercase transition-all"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={ind.fullName || ''} 
                                onChange={e => updateIndividual(ind.id, 'fullName', e.target.value)}
                                className="w-full text-xs font-black text-slate-800 border-none bg-transparent focus:ring-0 p-0"
                              />
                              <button onClick={() => startVoiceInput(ind.id, 'fullName')} className={`p-1.5 rounded-lg text-slate-200 hover:text-blue-600 hover:bg-blue-50 transition-all ${isListening === `${ind.id}-fullName` ? 'animate-pulse text-blue-600 bg-blue-50' : ''}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input 
                              type="text" 
                              value={ind.sex || ''} 
                              onChange={e => updateIndividual(ind.id, 'sex', e.target.value.toUpperCase())}
                              className="w-full text-center text-[9px] font-black text-slate-400 border border-transparent focus:border-blue-100 rounded-lg p-1 bg-transparent uppercase"
                              maxLength={1}
                            />
                          </td>
                          <td className="px-6 py-3 border-l">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-slate-300 w-4">N:</span>
                                <input type="text" value={ind.birthDate} onChange={e => updateIndividual(ind.id, 'birthDate', e.target.value)} className="font-bold text-slate-700 p-0 border-none bg-transparent focus:ring-0 text-[10px] w-20" placeholder="Data" />
                                <input type="text" value={ind.birthPlace} onChange={e => updateIndividual(ind.id, 'birthPlace', e.target.value)} className={`p-0 border-none bg-transparent focus:ring-0 text-[10px] flex-1 ${ind.isDitto ? 'text-blue-500 italic' : 'text-slate-400'}`} placeholder="Local" />
                              </div>
                              <div className="flex items-center gap-2 opacity-60">
                                <span className="text-[8px] font-black text-slate-300 w-4">Ó:</span>
                                <input type="text" value={ind.deathDate} onChange={e => updateIndividual(ind.id, 'deathDate', e.target.value)} className="font-bold text-slate-700 p-0 border-none bg-transparent focus:ring-0 text-[10px] w-20" placeholder="Data" />
                                <input type="text" value={ind.deathPlace} onChange={e => updateIndividual(ind.id, 'deathPlace', e.target.value)} className="text-slate-400 p-0 border-none bg-transparent focus:ring-0 text-[10px] flex-1" placeholder="Local" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
};
