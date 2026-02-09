
import React, { useState, useEffect, useRef } from 'react';
import { AppState, ProcessedData, FileData, Individual, SavedSession, AuthUser } from './types.ts';
import { extractDataFromImages } from './services/geminiService.ts';
import { ProcessingOverlay } from './components/ProcessingOverlay.tsx';
import { ReviewTable } from './components/ReviewTable.tsx';
import { InterviewList } from './components/InterviewList.tsx';
import { Auth } from './components/Auth.tsx';
import { supabase, saveSessionToSupabase, fetchSessionsFromSupabase, deleteSessionFromSupabase } from './services/supabaseService.ts';

const ACTIVE_SESSION_KEY = 'oral_gen_active_v6';

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [data, setData] = useState<ProcessedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedInterviews, setSavedInterviews] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  
  const isInitializing = useRef(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      } else {
        setUser(null);
        setAppState('IDLE');
        setData(null);
        setCurrentSessionId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsSyncing(true);
      setError(null);
      try {
        const remoteSessions = await fetchSessionsFromSupabase();
        setSavedInterviews(remoteSessions);
      } catch (err: any) {
        console.error("Erro Supabase:", err);
      } finally {
        setIsSyncing(false);
      }

      const savedActive = localStorage.getItem(`${ACTIVE_SESSION_KEY}_${user.id}`);
      if (savedActive) {
        try {
          const parsed = JSON.parse(savedActive);
          if (parsed && parsed.savedData && parsed.savedData.individuals) {
            setData(parsed.savedData);
            setCurrentSessionId(parsed.sessionId || null);
            setAppState('REVIEW');
          }
        } catch (e) {
          localStorage.removeItem(`${ACTIVE_SESSION_KEY}_${user.id}`);
        }
      }
      isInitializing.current = false;
    };

    loadData();
  }, [user]);

  useEffect(() => {
    if (isInitializing.current || !user) return;
    const key = `${ACTIVE_SESSION_KEY}_${user.id}`;
    if (appState === 'REVIEW' && data) {
      localStorage.setItem(key, JSON.stringify({ 
        savedData: data, 
        sessionId: currentSessionId,
        lastUpdate: new Date().toISOString()
      }));
    } else if (appState === 'IDLE') {
      localStorage.removeItem(key);
    }
  }, [data, appState, currentSessionId, user]);

  const handleLogout = async () => {
    if (window.confirm("Deseja encerrar sua sessão com segurança?")) {
      try {
        if (user) localStorage.removeItem(`${ACTIVE_SESSION_KEY}_${user.id}`);
        await supabase.auth.signOut();
        setUser(null);
        setAppState('IDLE');
        setData(null);
      } catch (err) {
        console.error("Erro logout:", err);
        setUser(null);
      }
    }
  };

  const handleSaveSession = async () => {
    if (!user || !data) return;
    setIsSyncing(true);
    setError(null);
    try {
      const sessionId = currentSessionId || crypto.randomUUID();
      const sessionToSave: SavedSession = {
        id: sessionId,
        timestamp: new Date().toISOString(),
        data: data,
        user_id: user.id
      };
      await saveSessionToSupabase(sessionToSave);
      setCurrentSessionId(sessionId);
      const remoteSessions = await fetchSessionsFromSupabase();
      setSavedInterviews(remoteSessions);
    } catch (err: any) {
      setError("Erro ao sincronizar: " + err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileName = files[0].name.split('.')[0];
    setAppState('PROCESSING');
    setProcessingProgress({ current: 0, total: files.length });
    setError(null);

    try {
      const filePromises = Array.from(files).map((file: File) => {
        return new Promise<FileData>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') resolve({ data: result.split(',')[1], mimeType: file.type });
            else reject(new Error("Falha ao ler arquivo"));
          };
          reader.onerror = () => reject(new Error("Erro na leitura do arquivo"));
          reader.readAsDataURL(file);
        });
      });
      const processedFiles = await Promise.all(filePromises);
      
      const result = await extractDataFromImages(processedFiles, (current, total) => {
        setProcessingProgress({ current, total });
      });
      
      if (!result || !result.individuals) {
        throw new Error("A IA não retornou dados válidos.");
      }

      const finalData = {
        ...result,
        metadata: {
          ...result.metadata,
          originalFilename: fileName
        },
        sourceFiles: processedFiles
      };
      
      setData(finalData);
      setCurrentSessionId(null);
      setAppState('REVIEW');
    } catch (err: any) {
      setError(err.message || "Erro durante o processamento de IA.");
      setAppState('IDLE');
    }
  };

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-8 h-16 sticky top-0 z-40 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          {appState !== 'IDLE' && (
            <button onClick={() => setAppState('IDLE')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setAppState('IDLE')}>
            <div className="bg-blue-600 p-2 rounded-lg shadow-md"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
            <div className="hidden md:block">
              <h1 className="text-sm font-black leading-tight uppercase tracking-tighter">Oral-Gen <span className="text-blue-600">V2</span></h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {isSyncing && (
            <div className="flex items-center gap-2 text-blue-600 animate-pulse">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">Sincronizando Banco</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 hidden sm:block">{user.email}</span>
            <button 
              onClick={handleLogout} 
              title="Encerrar Sessão"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm active:scale-95 group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-8 py-8 overflow-hidden flex flex-col relative">
        {appState === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            <h2 className="text-5xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Painel de <span className="text-blue-600">Trabalho</span></h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-16 max-w-sm">Sistema Inteligente para Digitalização de Formulários Genealógicos MZ11</p>
            
            <div className="grid md:grid-cols-2 gap-10 w-full max-w-4xl">
              <label className="relative group bg-white p-14 rounded-[3rem] border-4 border-slate-50 shadow-2xl hover:border-blue-500 cursor-pointer transition-all flex flex-col items-center">
                <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4-4m4 4v12" /></svg>
                </div>
                <h3 className="text-xl font-black mb-1 uppercase tracking-tight">Analisar Lote</h3>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Upload de PDF ou Fotos MZ11</p>
              </label>

              <button onClick={() => setAppState('LIST')} className="bg-white p-14 rounded-[3rem] border-4 border-slate-50 shadow-2xl hover:border-slate-300 transition-all flex flex-col items-center group">
                <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-xl font-black mb-1 uppercase tracking-tight">Meus Registros</h3>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">{savedInterviews.length} Documentos Salvos</p>
              </button>
            </div>
          </div>
        )}

        {appState === 'LIST' && (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <InterviewList 
              sessions={savedInterviews} 
              onSelect={(s) => { setData(s.data); setCurrentSessionId(s.id); setAppState('REVIEW'); }} 
              onDelete={async (id) => {
                if (window.confirm("Deseja remover este registro do banco de dados permanentemente?")) {
                  await deleteSessionFromSupabase(id);
                  setSavedInterviews(prev => prev.filter(s => s.id !== id));
                }
              }}
              onNew={() => setAppState('IDLE')}
            />
          </div>
        )}

        {appState === 'PROCESSING' && (
          <ProcessingOverlay 
            current={processingProgress.current} 
            total={processingProgress.total} 
          />
        )}
        
        {appState === 'REVIEW' && data && (
          <ReviewTable 
            data={data} 
            onUpdate={setData} 
            onSave={handleSaveSession} 
            isSaving={isSyncing}
          />
        )}

        {error && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-10 py-5 rounded-[2rem] shadow-2xl font-black uppercase tracking-widest text-[10px] z-[200] animate-bounce text-center max-w-lg border-4 border-rose-500/50">
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
