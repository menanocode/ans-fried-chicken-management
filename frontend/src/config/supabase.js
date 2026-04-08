import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.warn(
    '⚠️ Supabase belum dikonfigurasi!\n' +
    '1. Buat project di https://supabase.com\n' +
    '2. Copy URL & anon key dari Settings > API\n' +
    '3. Buat file frontend/.env dengan:\n' +
    '   VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
    '   VITE_SUPABASE_ANON_KEY=eyJ...'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key'
);

export const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL');

