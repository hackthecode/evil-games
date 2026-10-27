import { CONFIG } from '../../config.js';
import { createLocalStore } from './local.js';
import { createSupabaseStore } from './supabase.js';

const useSupabase = CONFIG.backend === 'supabase' && CONFIG.supabase.url && CONFIG.supabase.anonKey;

export const store = useSupabase ? createSupabaseStore(CONFIG.supabase) : createLocalStore();
