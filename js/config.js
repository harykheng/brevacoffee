// ================================================
// KONFIGURASI BREVA — Edit bagian ini
// ================================================

// Supabase credentials
// Dapatkan dari: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// Nomor WhatsApp admin (format: 62xxxxxxxxx, tanpa + atau spasi)
const ADMIN_WHATSAPP = '6281234567890';

// Nama toko (tampil di pesan WhatsApp)
const STORE_NAME = 'Breva Coffee';

// Info toko untuk halaman pickup
const STORE_ADDRESS    = 'Jl. Contoh No. 1, Jakarta Selatan 12345';
const STORE_MAPS_URL   = 'https://maps.google.com/?q=Breva+Coffee';
const STORE_OPEN_HOURS = 'Senin – Minggu, 08.00 – 21.00 WIB';

// ================================================
// INIT SUPABASE CLIENT
// ================================================
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
