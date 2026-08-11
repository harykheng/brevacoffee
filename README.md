# Breva Coffee — Setup Guide

Website e-commerce sederhana untuk brand kopi Breva. Stack: HTML + CSS + Vanilla JS, Supabase (database + auth + storage), deploy ke Vercel/Netlify. Tanpa backend server — semua logic (ongkir, QRIS, dsb) jalan di browser.

**Fitur utama:**
- Katalog produk dengan varian (ukuran, suhu, dll) dan badge (New/Terlaris)
- Checkout Pickup & Delivery, dengan alamat autocomplete (LocationIQ) dan ongkir otomatis berdasarkan jarak dari toko
- Kode promo (persen / nominal, minimum order, tanggal expired)
- Pembayaran QRIS dinamis — nominal digenerate langsung di browser dari QRIS statis toko, tanpa payment gateway/API berbayar
- Konfirmasi pesanan otomatis terkirim ke WhatsApp admin, tersimpan di database sebagai status `pending`
- Dashboard admin: kelola produk, promo, pesanan (ubah status, print label, kirim ringkasan ke WA customer), dan pengaturan brand/toko

---

## 1. Setup Supabase

### Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Isi nama project, database password, pilih region terdekat (Singapore)
3. Tunggu project selesai dibuat (~2 menit)

### Buat Tabel

Di sidebar Supabase, buka **SQL Editor** → klik **New Query**, paste SQL di bawah ini satu per satu (atau sekaligus) lalu klik **Run**.

#### `products` — Daftar produk

```sql
CREATE TABLE products (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT,
  price         INTEGER     NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_new        BOOLEAN     NOT NULL DEFAULT false,
  is_bestseller BOOLEAN     NOT NULL DEFAULT false,
  is_visible    BOOLEAN     NOT NULL DEFAULT true,
  variants      JSONB       DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read visible products"
  ON products FOR SELECT TO anon USING (is_visible = true);

CREATE POLICY "Admin read all products"
  ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin update products"
  ON products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin delete products"
  ON products FOR DELETE TO authenticated USING (true);
```

> `variants` menyimpan array grup varian, misalnya `[{ "name": "Ukuran", "options": [{ "label": "S", "extraPrice": 0 }, { "label": "L", "extraPrice": 5000 }] }]`. Diisi lewat form admin, opsional.

#### `promo_codes` — Kode promo

```sql
CREATE TABLE promo_codes (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT        NOT NULL UNIQUE,
  discount_type  TEXT        NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value INTEGER     NOT NULL CHECK (discount_value > 0),
  min_order      INTEGER     NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Customer hanya bisa baca promo yang aktif (untuk validasi kode saat checkout)
CREATE POLICY "Public read active promo"
  ON promo_codes FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Admin full access promo"
  ON promo_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

#### `settings` — Pengaturan brand & toko (single row, id selalu 1)

```sql
CREATE TABLE settings (
  id               INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name       TEXT,
  brand_icon       TEXT,
  logo_url         TEXT,
  store_address    TEXT,
  store_hours      TEXT,
  store_maps_url   TEXT,
  banner_title     TEXT,
  banner_subtitle  TEXT,
  banner_image_url TEXT,
  instagram_url    TEXT,
  tiktok_url       TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings"
  ON settings FOR SELECT TO anon USING (true);

CREATE POLICY "Admin full access settings"
  ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> Kalau tabel ini belum dibuat / kosong, website otomatis fallback ke nilai default di `js/config.js` — jadi tidak wajib diisi langsung, tapi disarankan agar admin bisa ganti dari dashboard tanpa edit kode.

#### `orders` — Pesanan masuk

```sql
CREATE TABLE orders (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number      TEXT        NOT NULL UNIQUE,
  customer_name     TEXT        NOT NULL,
  customer_wa       TEXT        NOT NULL,
  order_type        TEXT        NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  order_date        DATE        NOT NULL,
  order_date_label  TEXT,
  delivery_address  TEXT,
  note              TEXT,
  items             JSONB       NOT NULL,
  subtotal          INTEGER     NOT NULL,
  promo_code        TEXT,
  discount_amount   INTEGER     NOT NULL DEFAULT 0,
  shipping_cost     INTEGER,
  shipping_label    TEXT,
  total             INTEGER     NOT NULL,
  qris_string       TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Customer (anon) hanya bisa MEMBUAT pesanan, tidak bisa membaca pesanan siapapun
-- (mencegah orang lain mengintip nama/nomor WA/alamat customer lain)
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT TO anon WITH CHECK (true);

-- Admin (login) bisa baca & ubah semua pesanan
CREATE POLICY "Admin full access orders"
  ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> `qris_string` menyimpan QRIS dinamis (hasil generate dari QRIS statis toko + nominal) supaya admin/customer bisa menampilkan ulang QR-nya kapan saja lewat tombol "Tampilkan QR lagi" — ini bukan kredensial rahasia, aman disimpan apa adanya.

### Buat Storage Bucket untuk Foto

1. Di sidebar Supabase, buka **Storage** → **New bucket**
2. Nama bucket: `product-images`
3. Centang **Public bucket** (agar foto bisa dilihat pengunjung)
4. Klik **Create bucket**

Bucket ini dipakai untuk foto produk, logo brand, dan foto banner katalog. Tambahkan policy upload via **SQL Editor**:

```sql
CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
```

### Buat Akun Admin

1. Di sidebar Supabase, buka **Authentication** → **Users**
2. Klik **Add user** → **Create new user**
3. Isi email dan password yang akan dipakai untuk login ke `/admin.html`

---

## 2. Konfigurasi Website

Buka file `js/config.js` dan sesuaikan:

```javascript
// Wajib diisi
const SUPABASE_URL      = 'https://XXXXXXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
const ADMIN_WHATSAPP    = '6281234567890';   // format: 62 + nomor tanpa angka 0 di depan

// Default brand/toko — bisa dioverride dari Admin > Pengaturan setelah tabel `settings` dibuat
const STORE_NAME     = 'Breva Coffee';
const STORE_ADDRESS  = 'Jl. Contoh No.1, Kota...';
const STORE_MAPS_URL = 'https://maps.google.com/...';   // link share Google Maps, bukan API

// Autocomplete alamat pengiriman (LocationIQ, gratis untuk skala UMKM)
// Daftar di https://locationiq.com untuk dapat API key
const LOCATIONIQ_KEY = 'pk.xxxxxxxxxxxxxxxxxxxx';

// Koordinat toko — dipakai untuk hitung ongkir berdasarkan jarak (rumus Haversine, tanpa API berbayar)
const STORE_LAT = -6.2308;
const STORE_LNG = 106.6480;

// QRIS statis merchant — dari bank/GoPay/OVO/QRIS toko, biasanya di stiker QRIS fisik.
// Nominal dinamis digenerate otomatis di browser saat checkout, tidak butuh payment gateway.
const QRIS_STATIC = '00020101021126610014COM...';
```

**Cara dapat URL & Anon Key Supabase:**
Supabase Dashboard → **Project Settings** → **API** → salin **Project URL** dan **anon public** key.

---

## 3. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → login dengan GitHub
2. Klik **Add New** → **Project** → pilih repository ini
3. Biarkan semua setting default (tidak ada build command)
4. Klik **Deploy** — selesai!

**Alternatif Netlify:**
1. [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Pilih repo, kosongkan *Build command* dan *Publish directory*
3. Klik **Deploy site**

---

## 4. Struktur File

```
brevacoffee/
├── index.html        ← Halaman katalog publik (customer): produk, keranjang, checkout, QRIS
├── admin.html         ← Dashboard admin (butuh login): produk, promo, pesanan, pengaturan
├── css/
│   ├── main.css       ← Style bersama (warna, font, animasi, modal umum)
│   ├── catalog.css    ← Style halaman katalog, checkout, QRIS, profile sheet
│   └── admin.css       ← Style dashboard admin
├── js/
│   ├── config.js       ← ⚠️ Edit ini dulu! Supabase, WA admin, toko, LocationIQ, QRIS
│   ├── catalog.js       ← Logic katalog, keranjang, ongkir, promo, checkout, pembayaran QRIS
│   └── admin.js         ← Logic login, CRUD produk/promo, pengaturan, kelola pesanan
└── README.md
```

---

## 5. Alur Pemesanan (Customer)

1. Pilih produk & varian di katalog → masuk keranjang
2. Pilih tipe pesanan: **Pickup** (ambil di toko) atau **Delivery**
3. Kalau Delivery: isi profil (nama, WhatsApp) lewat kartu profil yang membuka bottom sheet — alamat diisi dengan autocomplete LocationIQ, plus catatan alamat opsional
4. Ongkir dihitung otomatis berdasarkan jarak alamat ke toko (tidak ada biaya API tambahan)
5. Bisa pakai kode promo (persen/nominal, dicek minimum order & masa berlaku)
6. Konfirmasi pesanan → QRIS dinamis digenerate langsung di browser sesuai total akhir, bisa disimpan sebagai gambar (tombol "Simpan QR")
7. Setelah bayar, customer konfirmasi → pesanan tersimpan ke database dengan status `pending`, dan link WhatsApp ke admin terbuka otomatis untuk kirim bukti bayar
8. Di ringkasan pesanan, ada tombol **"Tampilkan QR lagi"** kalau customer perlu lihat ulang QR-nya

QRIS di sini **tidak ada masa kedaluwarsa** — karena digenerate secara deterministik dari QRIS statis + nominal (bukan dari payment gateway), QR yang sama selalu bisa dibuat ulang kapan saja dari nominal yang sama.

---

## 6. Panduan Admin

### Akses Dashboard
Buka: `namawebsite.vercel.app/admin.html` → login dengan email + password.

### Tab Produk
Klik **+ Tambah Produk** → isi nama, deskripsi, harga, upload foto, atur varian (opsional), badge & visibilitas → **Simpan Produk**.
Untuk stok habis sementara: edit produk → matikan toggle **"Tampilkan di Katalog"** → data tidak terhapus, cuma disembunyikan.

### Tab Promo
Klik **+ Tambah Promo** → isi kode, tipe diskon (persen/nominal), minimum order, tanggal berlaku (opsional), status aktif → **Simpan Promo**.

### Tab Pesanan
Daftar pesanan masuk, bisa difilter per status: **Menunggu** (pending) → **Diproses** (confirmed) → **Selesai** (done), atau **Dibatalkan**.
Klik **📋 Detail** pada satu pesanan untuk:
- Lihat rincian lengkap (item, ongkir, diskon, alamat, catatan)
- **✅ Konfirmasi** / **✅ Selesai** / **❌ Batalkan** — ubah status pesanan
- **🖨️ Print Label** — cetak label pengiriman/pickup
- **📤 WA Customer** — kirim ringkasan pesanan (item, total, alamat, status) langsung ke WhatsApp customer, berguna kalau mereka tanya-tanya soal pesanannya

### Tab Pengaturan
Ubah nama brand, ikon/logo, alamat & jam operasional toko, link Google Maps, banner katalog (judul, subjudul, foto), dan link Instagram/TikTok — semua tersimpan di tabel `settings` dan langsung berlaku di katalog tanpa perlu edit kode.

### Ganti Nomor WhatsApp Admin
Ubah `ADMIN_WHATSAPP` di `js/config.js`.
Format: `62` + nomor tanpa `0` di depan.
Contoh: `08123456789` → tulis `628123456789`

---

## 7. Catatan Keamanan

- Supabase URL dan anon key ada di kode JS — ini **normal** untuk static site. Anon key hanya boleh baca data publik.
- Row Level Security (RLS) memastikan:
  - Produk: publik hanya baca yang `is_visible = true`; tambah/edit/hapus hanya admin login.
  - Promo: publik hanya baca kode yang `is_active = true`; kelola penuh hanya admin.
  - Settings: publik boleh baca (untuk tampilan katalog); ubah hanya admin.
  - Orders: publik **hanya bisa membuat** pesanan (insert), **tidak bisa membaca** pesanan siapapun — mencegah kebocoran data pelanggan lain. Baca/ubah status hanya admin login.
- LocationIQ API key di kode frontend juga normal (tier gratis, dipakai untuk autocomplete alamat saja) — kalau mau lebih aman, batasi domain yang boleh pakai key tersebut di dashboard LocationIQ.
- Jangan pernah taruh **Service Role key** Supabase di kode frontend.
