import { CONFIG } from '../../config.js';
import { createLocalStore } from './local.js';
import { createSupabaseStore } from './supabase.js';

// При разработка на компютъра: localStorage „eg.devLocal“ = '1' на localhost → локален режим,
// за да не се създават тестови акаунти в истинската база.
const devLocal = ['localhost', '127.0.0.1'].includes(location.hostname) && (() => {
  try { return localStorage.getItem('eg.devLocal') === '1'; } catch { return false; }
})();
const useSupabase = !devLocal && CONFIG.backend === 'supabase' && CONFIG.supabase.url && CONFIG.supabase.anonKey;

export const store = useSupabase ? createSupabaseStore(CONFIG.supabase) : createLocalStore();
