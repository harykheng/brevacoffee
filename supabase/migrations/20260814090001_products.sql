-- Products: daftar menu, dengan varian (ukuran/suhu/dll) dan badge (New/Terlaris).
-- Publik cuma boleh baca produk yang is_visible = true; CRUD penuh cuma admin (authenticated).

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

COMMENT ON COLUMN products.variants IS
  'Array grup varian, misal [{ "name": "Ukuran", "options": [{ "label": "S", "extraPrice": 0 }, { "label": "L", "extraPrice": 5000 }] }]. Diisi lewat form admin, opsional.';

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
