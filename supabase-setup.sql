-- ================================================================
-- BREVA COFFEE — SETUP LENGKAP
-- Jalankan SEKALI di Supabase SQL Editor
-- ================================================================


-- ----------------------------------------------------------------
-- 1. EXTENSION (sudah aktif di Supabase, ini untuk jaga-jaga)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ----------------------------------------------------------------
-- 2. TABEL PRODUCTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  price         INTEGER     NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_new        BOOLEAN     NOT NULL DEFAULT false,
  is_bestseller BOOLEAN     NOT NULL DEFAULT false,
  is_visible    BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Pengunjung hanya bisa baca produk yang tampil (is_visible = true)
CREATE POLICY "Public read visible products"
  ON products FOR SELECT TO anon
  USING (is_visible = true);

-- Admin bisa baca SEMUA produk (termasuk yang disembunyikan)
CREATE POLICY "Admin read all products"
  ON products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin update products"
  ON products FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admin delete products"
  ON products FOR DELETE TO authenticated
  USING (true);


-- ----------------------------------------------------------------
-- 3. STORAGE BUCKET (foto produk)
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Siapapun bisa lihat foto (public)
CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Hanya admin yang bisa upload foto
CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Hanya admin yang bisa hapus foto
CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- Hanya admin yang bisa update file
CREATE POLICY "Admin update images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');


-- ----------------------------------------------------------------
-- 4. BUAT AKUN ADMIN
--    Email    : admin@brevacafe.com
--    Password : admin123   ← ganti setelah pertama login!
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_uid UUID := gen_random_uuid();
BEGIN
  -- Hanya buat kalau email belum ada
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@brevacafe.com') THEN

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      'admin@brevacafe.com',
      crypt('admin123', gen_salt('bf')),
      now(),                                               -- langsung confirmed, tidak perlu verifikasi email
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '', '', '', ''
    );

    -- Identity record diperlukan agar login email/password bisa bekerja
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_uid,
      v_uid,
      'admin@brevacafe.com',
      jsonb_build_object(
        'sub',            v_uid::text,
        'email',          'admin@brevacafe.com',
        'email_verified', true,
        'provider',       'email'
      ),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Akun admin berhasil dibuat: admin@brevacafe.com';
  ELSE
    RAISE NOTICE 'Akun admin sudah ada, dilewati.';
  END IF;
END $$;


-- ----------------------------------------------------------------
-- 5. VERIFIKASI — cek hasil setup
-- ----------------------------------------------------------------
SELECT 'products table'   AS item, COUNT(*)::text AS info FROM products
UNION ALL
SELECT 'storage bucket',   COALESCE((SELECT name FROM storage.buckets WHERE id = 'product-images'), 'TIDAK ADA')
UNION ALL
SELECT 'admin user',       COALESCE((SELECT email FROM auth.users WHERE email = 'admin@brevacafe.com'), 'TIDAK ADA');
