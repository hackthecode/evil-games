// Конфигурация на портала.
//
// backend: 'local'    – акаунтите и статистиката се пазят в браузъра (localStorage).
//                        Работи веднага, без сървър. Класацията показва играчите
//                        регистрирани на това устройство/браузър.
// backend: 'supabase' – акаунтите и статистиката се пазят в Supabase (безплатен план).
//                        Класацията е обща за всички играчи по света.
//                        Виж README.md -> „Онлайн акаунти със Supabase“.
export const CONFIG = {
  appName: 'Evil Games',
  backend: 'local',
  supabase: {
    url: '',      // напр. 'https://abcdxyz.supabase.co'
    anonKey: '',  // публичният "anon" ключ от Project Settings -> API
  },
};
