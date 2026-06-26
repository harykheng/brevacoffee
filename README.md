# Breva Coffee — Setup Guide

Website e-commerce sederhana untuk brand kopi Breva. Stack: HTML + CSS + Vanilla JS, Supabase (database + auth + storage), deploy ke Vercel/Netlify.

---

## 1. Setup Supabase

### Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Isi nama project, database password, pilih region terdekat (Singapore)
3. Tunggu project selesai dibuat (~2 menit)

### Buat Tabel `products`

Di sidebar Supabase, buka **SQL Editor** → klik **New Query**, paste SQL ini lalu klik **Run**:

```sql
-- Buat tabel produk
CREATE TABLE products (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  price         INTEGER     NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_new        BOOLEAN     NOT NULL DEFAULT false,
  is_bestseller BOOLEAN     NOT NULL DEFAULT false,
  is_visible    BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aktifkan Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Pengunjung (anon) hanya bisa baca produk yang tampil
CREATE POLICY "Public read visible products"
  ON products FOR SELECT
  TO anon
  USING (is_visible = true);

-- Admin (logged in) bisa baca semua produk
CREATE POLICY "Admin read all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Admin bisa tambah produk
CREATE POLICY "Admin insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin bisa edit produk
CREATE POLICY "Admin update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true);

-- Admin bisa hapus produk
CREATE POLICY "Admin delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);
```

### Buat Storage Bucket untuk Foto Produk

1. Di sidebar Supabase, buka **Storage** → **New bucket**
2. Nama bucket: `product-images`
3. Centang **Public bucket** (agar foto bisa dilihat pengunjung)
4. Klik **Create bucket**

Kemudian tambahkan policy upload untuk admin via **SQL Editor**:

```sql
-- Upload foto (hanya admin/authenticated)
CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Hapus foto lama
CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
```

### Buat Akun Admin

1. Di sidebar Supabase, buka **Authentication** → **Users**
2. Klik **Add user** → **Create new user**
3. Isi email dan password yang akan dipakai untuk login ke `/admin.html`

---

## 2. Konfigurasi Website

Buka file `js/config.js` dan ubah tiga baris ini:

```javascript
const SUPABASE_URL      = 'https://XXXXXXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
const ADMIN_WHATSAPP    = '6281234567890';   // format: 62 + nomor tanpa angka 0 di depan
```

**Cara dapat URL & Anon Key:**
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
├── index.html        ← Halaman katalog publik (customer)
├── admin.html        ← Dashboard admin (butuh login)
├── css/
│   ├── main.css      ← Style bersama (warna, font, animasi, modal)
│   ├── catalog.css   ← Style halaman katalog
│   └── admin.css     ← Style dashboard admin
├── js/
│   ├── config.js     ← ⚠️ Edit ini dulu! Supabase URL + WA admin
│   ├── catalog.js    ← Logic katalog, keranjang, checkout WA
│   └── admin.js      ← Logic login, CRUD produk, upload foto
└── README.md
```

---

## 5. Panduan Admin (untuk Adik)

### Akses Dashboard
Buka: `namawebsite.vercel.app/admin.html` → login dengan email + password.

### Tambah Produk
Klik **+ Tambah Produk** → isi nama, harga, upload foto → atur badge dan visibilitas → **Simpan Produk**.

### Sembunyikan Produk Sementara (stok habis)
Edit produk → matikan toggle **"Tampilkan di Katalog"** → Simpan. Produk hilang dari katalog tapi data tidak terhapus.

### Ganti Nomor WhatsApp Admin
Ubah `ADMIN_WHATSAPP` di `js/config.js`.
Format: `62` + nomor tanpa `0` di depan.
Contoh: `08123456789` → tulis `628123456789`

---

## 6. Catatan Keamanan

- Supabase URL dan anon key ada di kode JS — ini **normal** untuk static site. Anon key hanya boleh baca data publik.
- Row Level Security (RLS) memastikan hanya user yang login yang bisa menambah/edit/hapus produk.
- Jangan pernah taruh **Service Role key** di kode frontend.
