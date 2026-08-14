-- Settings: pengaturan brand & toko, single row (id selalu 1). Publik boleh baca
-- (dipakai buat render katalog); ubah cuma admin. Kalau row ini kosong/belum
-- pernah di-upsert, frontend fallback ke env var VITE_* (lihat shared/lib/config.js).

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
