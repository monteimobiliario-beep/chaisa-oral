
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const email = emailInput.trim();

    if (!email.includes('@') || !email.includes('.')) {
      setMessage({ type: 'error', text: 'Por favor, insira um formato de e-mail válido.' });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
        });
        
        if (error) throw error;
        
        if (data.session) {
          setMessage({ type: 'success', text: `Bem-vindo! Login efetuado com sucesso.` });
        } else {
          setMessage({ type: 'success', text: `Conta criada! Por favor, faça login.` });
          setIsSignUp(false); 
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error("Erro Auth:", error);
      let errorMsg = error.message || 'Erro na autenticação';
      
      if (errorMsg.toLowerCase().includes('failed to fetch')) {
        errorMsg = 'Erro de conexão: Não foi possível conectar ao servidor de autenticação. Verifique seu Wi-Fi ou se há algum bloqueador de rede ativo.';
      } else if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'E-mail ou senha incorretos.';
      } else if (errorMsg.includes('User already registered')) {
        errorMsg = 'E-mail já cadastrado.';
        setIsSignUp(false);
      }
      
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] p-12 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
        
        <div className="flex flex-col items-center mb-10 text-center relative z-10">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Oral-Gen</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            {isSignUp ? 'Nova Conta de Operador' : 'Portal de Acesso'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white outline-none rounded-2xl px-6 py-4 font-bold text-slate-800 transition-all placeholder:text-slate-300"
              placeholder="exemplo@gmail.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>

          <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white outline-none rounded-2xl px-6 py-4 font-bold text-slate-800 transition-all placeholder:text-slate-300 pr-14"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-blue-500 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                )}
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl text-xs font-bold animate-in fade-in slide-in-from-top-1 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white font-black py-5 rounded-3xl shadow-xl transition-all uppercase tracking-widest text-xs disabled:opacity-50 active:scale-[0.98] ${
              isSignUp ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {loading ? 'Conectando...' : isSignUp ? 'Criar Cadastro' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10 border-t border-slate-50 pt-6">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors px-4 py-2 bg-blue-50 rounded-xl"
          >
            {isSignUp ? '← Já tenho conta, entrar' : '+ Criar acesso para novo operador'}
          </button>
        </div>
      </div>
    </div>
  );
};
