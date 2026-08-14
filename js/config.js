// ================================================
// KONFIGURASI BREVA — Edit bagian ini
// ================================================

// Supabase credentials
// Dapatkan dari: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://ftuxnxrbydnfrpdyisht.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dXhueHJieWRuZnJwZHlpc2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjkzNTIsImV4cCI6MjA5ODA0NTM1Mn0.qK-9J90EoHO_c1VsU5BZ_KV4QbeoFP_1qRK-QMfCGnE';

// Nomor WhatsApp admin (format: 62xxxxxxxxx, tanpa + atau spasi)
const ADMIN_WHATSAPP = '6281292567788';

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

// GrabMaps via Amazon Location Service — autocomplete alamat pengiriman
// Key dibatasi per-domain (client restriction) di AWS console, aman ditaruh di frontend
const AWS_PLACES_API_KEY = 'v1.public.eyJqdGkiOiIxMGQxY2JiYS02ZDI5LTRmNDAtOTYwZC1kODQ4ODJkMTViNWQifRzIHZWmUEouq7Nxm1Jc4iVz82uKV6L_OdAvJ_dhAKHACuo6YCmqs2kr0O734EViPr5jiqEdruyFOLXN5Hwdq2PZhmmij4f4C8LWgh40TI_c_VaL9ZEJg8EuKURaWFvjl_ulIPLEAWi2dLQ8-bFa4afKkEZtt2HTlRISR0ZBCDWrTxAA8ZdRpdewvHK9pE4wMkttakaEXCtgC6AWwqj8x_sIcuxT-aK86pdEOANSEtL87f9gPj_2zN7Y7L2jBOpHgGWpECj907NNx_0rCQrmcrVLEP72QPb7YCnH1pPe9SlBtbJ5ZS-u6bvIdZ5Rw_0LaynsPRMrjOyd8s63LK-yfxY.MzRjYzZmZGUtZmY3NC00NDZiLWJiMTktNTc4YjUxYTFlOGZi';
const AWS_PLACES_REGION  = 'ap-southeast-1';

// Koordinat toko (untuk kalkulasi ongkir berdasarkan jarak)
// Verifikasi di: https://maps.google.com/?q=-6.2308,106.6480
const STORE_LAT = -6.2308;
const STORE_LNG = 106.6480;

// Ongkir real-time via Biteship (GoSend/GrabExpress).
// Berat per pesanan dipakai buat estimasi tarif kurir (produk tidak per-item nimbang gram).
const DEFAULT_ITEM_WEIGHT_G = 300;

// ⚠️ SEMENTARA — TESTING ONLY, KEY INI PUBLIK DI BROWSER ⚠️
// Ini key TEST Biteship, dipanggil langsung dari browser biar bisa cepat dites
// tanpa deploy Supabase Edge Function dulu. WAJIB dihapus dari sini dan pindah
// ke Edge Function (supabase/functions/check-shipping, sudah ada kodenya)
// SEBELUM ganti ke key `biteship_live_...` — key live itu bisa dipakai orang
// lain bikin pesanan/quota atas nama akun Biteship kamu kalau ke-expose.
const BITESHIP_TEST_API_KEY = 'biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiYnJldmEiLCJ1c2VySWQiOiI2ODY3YTM5YWEwNDNhZTAwMTM3ODU4Y2MiLCJpYXQiOjE3ODY2OTUwMjd9.zpxBPB0lGBBNyV_QetIQfzLXuYPfpYv2Hsg9D2GgsM4';

// QRIS statis merchant (dari bank/GoPay/OVO — ganti dengan QRIS Breva Coffee asli)
const QRIS_STATIC = '00020101021126610014COM.GO-JEK.WWW01189360091432449962000210G2449962000303UMI51440014ID.CO.QRIS.WWW0215ID10243329840860303UMI5204597753033605802ID5925Oraiste Beauty House, BTC6014KOTA TANGERANG61051512262070703A0163049B66';

// ================================================
// INIT SUPABASE CLIENT
// ================================================
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
