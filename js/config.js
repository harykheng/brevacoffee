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
const STORE_ADDRESS    = 'Jl. Contoh No. 1, Jakarta Selatan 12345';
const STORE_MAPS_URL   = 'https://maps.google.com/?q=Breva+Coffee';
const STORE_OPEN_HOURS = 'Senin – Minggu, 08.00 – 21.00 WIB';

// ================================================
// INIT SUPABASE CLIENT
// ================================================
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
