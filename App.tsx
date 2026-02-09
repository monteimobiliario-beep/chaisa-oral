
import React, { useState, useEffect, useRef } from 'react';
import { AppState, ProcessedData, FileData, SavedSession, AuthUser } from './types.ts';
import { extractDataFromImages } from './services/geminiService.ts';
import { ProcessingOverlay } from './components/ProcessingOverlay.tsx';
import { ReviewTable } from './components/ReviewTable.tsx';
import { InterviewList } from './components/InterviewList.tsx';
import { Auth } from './components/Auth.tsx';
import { supabase, saveSessionToSupabase, fetchSessionsFromSupabase, deleteSessionFromSupabase } from './services/supabaseService.ts';

const ACTIVE_SESSION_KEY = 'oral_gen_active_v7';

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [data, setData] = useState<ProcessedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedInterviews, setSavedInterviews] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  
  const isInitializing = useRef(true);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey || !!process.env.API_KEY);
      } else {
        setHasApiKey(!!process.env.API_KEY);
      }
    };
    checkApiKey();

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
      try {
        const remoteSessions = await fetchSessionsFromSupabase();
        setSavedInterviews(remoteSessions);
      } catch (err: any) {
        console.error("Supabase Error:", err);
      } finally {
        setIsSyncing(false);
      }

      const savedActive = localStorage.getItem(`${ACTIVE_SESSION_KEY}_${user.id}`);
      if (savedActive) {
        try {
          const parsed = JSON.parse(savedActive);
          if (parsed?.savedData?.individuals) {
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

  const handleSelectApiKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Deseja sair do sistema?")) {
      try {
        if (user) localStorage.removeItem(`${ACTIVE_SESSION_KEY}_${user.id}`);
        await supabase.auth.signOut();
        setUser(null);
        setAppState('IDLE');
      } catch (err) {
        setUser(null);
      }
    }
  };

  const handleSaveSession = async () => {
    if (!user || !data) return;
    setIsSyncing(true);
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
      setError("Erro de sincronização: " + err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
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
          reader.readAsDataURL(file);
        });
      });
      const processedFiles = await Promise.all(filePromises);
      
      const result = await extractDataFromImages(processedFiles, (current, total) => {
        setProcessingProgress({ current, total });
      });
      
      setData({
        ...result,
        metadata: { ...result.metadata, originalFilename: files[0].name.split('.')[0] },
        sourceFiles: processedFiles
      });
      setCurrentSessionId(null);
      setAppState('REVIEW');
    } catch (err: any) {
      setError(err.message || "Erro no processamento de IA.");
      setAppState('IDLE');
    }
  };

  if (!user) return <Auth />;

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3.5rem] p-12 text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">Ativação de IA</h2>
          <p className="text-slate-500 text-sm font-bold mb-8">Para processar os formulários MZ11, é necessário configurar uma chave API Gemini.</p>
          <button 
            onClick={handleSelectApiKey}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-3xl shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95"
          >
            Configurar Chave API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-8 h-16 sticky top-0 z-40 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          {appState !== 'IDLE' && (
            <button onClick={() => setAppState('IDLE')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
            <h1 className="text-sm font-black uppercase tracking-tighter">Oral-Gen <span className="text-blue-600">MZ11</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {isSyncing && <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Sincronizando</span>}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 hidden sm:block">{user.email}</span>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {appState === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <h2 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter uppercase text-center">Gestão <span className="text-blue-600">Genealógica</span></h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mb-16 text-center">Processamento Inteligente de Formulários de Campo</p>
            
            <div className="grid md:grid-cols-2 gap-10 w-full max-w-4xl">
              <label className="relative bg-white p-14 rounded-[4rem] border-4 border-slate-50 shadow-2xl hover:border-blue-500 cursor-pointer transition-all flex flex-col items-center group">
                <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4-4m4 4v12" /></svg>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Analisar Lote</h3>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-2">MZ11 (75 RINs / 3 Páginas)</p>
              </label>

              <button onClick={() => setAppState('LIST')} className="bg-white p-14 rounded-[4rem] border-4 border-slate-50 shadow-2xl hover:border-slate-300 transition-all flex flex-col items-center group">
                <div className="w-20 h-20 bg-slate-50 text-slate-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Meus Arquivos</h3>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-2">Consultar Histórico Salvo</p>
              </button>
            </div>
          </div>
        )}

        {appState === 'LIST' && (
          <div className="h-full overflow-y-auto px-8 py-8 custom-scrollbar">
            <InterviewList 
              sessions={savedInterviews} 
              onSelect={(s) => { setData(s.data); setCurrentSessionId(s.id); setAppState('REVIEW'); }} 
              onDelete={async (id) => { if (window.confirm("Excluir permanentemente?")) await deleteSessionFromSupabase(id); }}
              onNew={() => setAppState('IDLE')}
            />
          </div>
        )}

        {appState === 'PROCESSING' && <ProcessingOverlay />}
        
        {appState === 'REVIEW' && data && (
          <div className="h-full px-8 py-8 overflow-hidden">
            <ReviewTable data={data} onUpdate={setData} onSave={handleSaveSession} isSaving={isSyncing} />
          </div>
        )}

        {error && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-10 py-5 rounded-[2rem] shadow-2xl font-black uppercase tracking-widest text-[10px] z-[200] animate-bounce border-4 border-rose-500/50">
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
