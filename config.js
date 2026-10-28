// Portal configuration.
//
// backend: 'local'    – accounts and statistics are kept in the browser (localStorage).
//                        Works right away, without a server. The ranking shows the players
//                        registered on this device/browser.
// backend: 'supabase' – accounts and statistics are kept in Supabase (free plan).
//                        The ranking is shared by all players worldwide.
//                        See README.md -> "Online accounts with Supabase".
export const CONFIG = {
  appName: 'Evil Games',
  backend: 'supabase',
  supabase: {
    url: 'https://ozjltqxazkufaauelfpk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amx0cXhhemt1ZmFhdWVsZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDc5NzYsImV4cCI6MjEwODYyMzk3Nn0.nmMu7kz80ViRRGh64RugjsR6huP8IsKHGmRdtJ3qznM',
    refereeFunction: 'super-processor', // the name of the referee server's Edge Function
    empiresFunction: 'empires', // the Evil Empires Edge Function (supabase/functions/empires)
    empiresPush: 'BD8j6lrUgz-lOFH8w8dUc1QOnATRvdQBpVRZWzZknyC0Ip2Uhqn89cqZElfVFJ0y5MGrAT-ylZmd4oZ0O-AcGNQ', // public VAPID key for notifications
  },
};
