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
  backend: 'supabase',
  supabase: {
    url: 'https://ozjltqxazkufaauelfpk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amx0cXhhemt1ZmFhdWVsZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDc5NzYsImV4cCI6MjEwODYyMzk3Nn0.nmMu7kz80ViRRGh64RugjsR6huP8IsKHGmRdtJ3qznM',
    refereeFunction: 'super-processor', // името на Edge Function на сървъра-съдия
    empiresFunction: 'empires', // Edge Function на Evil Empires (supabase/functions/empires)
    empiresPush: 'BD8j6lrUgz-lOFH8w8dUc1QOnATRvdQBpVRZWzZknyC0Ip2Uhqn89cqZElfVFJ0y5MGrAT-ylZmd4oZ0O-AcGNQ', // публичен VAPID ключ за известията
  },
};
