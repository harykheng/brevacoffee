-- Promo codes: kode diskon persen/nominal, opsional minimum order + tanggal expired.
-- Publik cuma boleh baca kode yang is_active = true (buat validasi saat checkout);
-- CRUD penuh cuma admin.

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

CREATE POLICY "Public read active promo"
  ON promo_codes FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Admin full access promo"
  ON promo_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);
