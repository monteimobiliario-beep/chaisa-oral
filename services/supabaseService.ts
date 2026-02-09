
import { createClient } from '@supabase/supabase-js';
import { SavedSession } from '../types.ts';

const SUPABASE_URL = 'https://jnqnkjwjwafdsvclxxzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AIfImrkSGLM3pFzdOuGINg_uzdny4_m';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY = 4000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isNetworkError = 
      errorMessage.toLowerCase().includes("failed to fetch") || 
      errorMessage.toLowerCase().includes("network error") ||
      errorMessage.toLowerCase().includes("load failed");
    
    if (retries > 0 && isNetworkError) {
      const delay = BASE_RETRY_DELAY * (MAX_RETRIES - retries + 1);
      console.warn(`Supabase Network Error: Retrying in ${delay/1000}s... (${retries} left)`);
      await sleep(delay);
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

export const saveSessionToSupabase = async (session: SavedSession) => {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from('sessions')
      .upsert({
        id: session.id,
        timestamp: session.timestamp,
        data: session.data,
        user_id: user.id
      });
    
    if (error) throw error;
    return data;
  });
};

export const fetchSessionsFromSupabase = async (): Promise<SavedSession[]> => {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      data: item.data,
      user_id: item.user_id
    }));
  });
};

export const deleteSessionFromSupabase = async (id: string) => {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
  });
};
