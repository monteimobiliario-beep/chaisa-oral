
import React from 'react';

interface ProcessingOverlayProps {
  current?: number;
  total?: number;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ current = 0, total = 0 }) => {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="bg-white p-16 rounded-[4rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] flex flex-col items-center max-w-xl w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 via-indigo-400 to-blue-600 animate-shimmer"></div>
        
        <div className="relative mb-12">
          <div className="w-32 h-32 border-[8px] border-slate-50 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter text-center leading-none">
          Lendo Documento <br/><span className="text-blue-600">Integralmente</span>
        </h2>
        
        <p className="text-slate-500 text-center mb-12 leading-relaxed font-bold text-lg">
          O Oral-Gen está processando todas as páginas para extrair os 75 registros e reconstruir as relações de parentesco.
        </p>

        <div className="w-full flex items-center gap-4 bg-blue-50 p-6 rounded-3xl border border-blue-100">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0">
            <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Status da Extração</span>
            <span className="text-sm font-black text-slate-700">Mapeando RINs e localizando aspas (")</span>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Conectada • Lote MZ11 em análise</span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 3s infinite linear;
        }
      `}</style>
    </div>
  );
};
