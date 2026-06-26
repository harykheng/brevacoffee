// ================================================
// KONFIGURASI BREVA — Edit bagian ini
// ================================================

// Supabase credentials
// Dapatkan dari: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://ftuxnxrbydnfrpdyisht.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dXhueHJieWRuZnJwZHlpc2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjkzNTIsImV4cCI6MjA5ODA0NTM1Mn0.qK-9J90EoHO_c1VsU5BZ_KV4QbeoFP_1qRK-QMfCGnE';

// Nomor WhatsApp admin (format: 62xxxxxxxxx, tanpa + atau spasi)
const ADMIN_WHATSAPP = '62881025030603';

// Nama toko (tampil di pesan WhatsApp)
const STORE_NAME = 'Breva Coffee';

// Info toko untuk halaman pickup
const STORE_ADDRESS    = 'Alam Sutera, Jl. Jalur Sutera Bar. No.Kav.19B, RT.002/RW.003, Panunggangan Tim., Kec. Pinang, Kota Tangerang, Banten 15143';
const STORE_MAPS_URL   = 'https://share.google/0wIemWDWjEzPHAI8p';
const STORE_OPEN_HOURS = 'Senin – Minggu, 08.00 – 21.00 WIB';

// Teks banner di halaman katalog
const BANNER_TITLE    = 'Ada yang baru nih! ✨';
const BANNER_SUBTITLE = 'Cek semua menu terbaru Breva Coffee';

// Social media (isi dengan URL akun kamu)
const INSTAGRAM_URL = 'https://instagram.com/brevacoffee';
const TIKTOK_URL    = 'https://tiktok.com/@brevacoffee';

// ================================================
// INIT SUPABASE CLIENT
// ================================================
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
