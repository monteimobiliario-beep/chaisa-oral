
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
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  
  const isInitializing = useRef(true);

  useEffect(() => {
    // Verifica se a chave API está disponível no ambiente ou via diálogo
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
        console.error("Erro Supabase:", err);
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
    if (window.confirm("Deseja encerrar sua sessão?")) {
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
      setError("Erro ao sincronizar: " + err.message);
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
      setError(err.message || "Erro durante o processamento.");
      setAppState('IDLE');
    }
  };

  if (!user) return <Auth />;

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3.5rem] p-12 text-center shadow-2xl">
          <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">Ativação de IA</h2>
          <p className="text-slate-500 text-sm font-bold mb-8">O sistema requer uma Chave API válida para processar os formulários MZ11.</p>
          <button 
            onClick={handleSelectApiKey}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-3xl shadow-xl transition-all uppercase tracking-widest text-xs"
          >
            Configurar Chave API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-8 h-16 sticky top-0 z-40 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          {appState !== 'IDLE' && (
            <button onClick={() => setAppState('IDLE')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="text-sm font-black uppercase tracking-tighter">Oral-Gen <span className="text-blue-600">V2.1</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {isSyncing && <span className="text-[9px] font-black text-blue-600 uppercase animate-pulse">Sincronizando...</span>}
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-hidden flex flex-col relative">
        {appState === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-10">
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">Painel Genealógico</h2>
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
              <label className="bg-white p-12 rounded-[3rem] border-4 border-slate-100 shadow-xl hover:border-blue-500 cursor-pointer transition-all flex flex-col items-center group">
                <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase">Novo Formulário</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Extrair dados MZ11 (75 RINs)</p>
              </label>
              <button onClick={() => setAppState('LIST')} className="bg-white p-12 rounded-[3rem] border-4 border-slate-100 shadow-xl hover:border-slate-300 transition-all flex flex-col items-center group">
                <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase">Minhas Listas</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Registros Salvos no Supabase</p>
              </button>
            </div>
          </div>
        )}

        {appState === 'LIST' && (
          <InterviewList 
            sessions={savedInterviews} 
            onSelect={(s) => { setData(s.data); setCurrentSessionId(s.id); setAppState('REVIEW'); }} 
            onDelete={async (id) => { if (window.confirm("Remover permanentemente?")) await deleteSessionFromSupabase(id); }}
            onNew={() => setAppState('IDLE')}
          />
        )}

        {appState === 'PROCESSING' && <ProcessingOverlay />}
        
        {appState === 'REVIEW' && data && (
          <ReviewTable data={data} onUpdate={setData} onSave={handleSaveSession} isSaving={isSyncing} />
        )}

        {error && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold text-sm z-50 animate-bounce">
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
