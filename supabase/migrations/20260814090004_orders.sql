-- Orders: pesanan masuk. Customer (anon) cuma bisa INSERT, tidak pernah SELECT —
-- mencegah orang lain mengintip nama/nomor WA/alamat customer lain. Admin
-- (authenticated) baca & ubah semua pesanan.
--
-- NB: "Public insert orders" di bawah ini WAJIB ada, atau checkout customer akan
-- gagal dengan 42501 "new row violates row-level security policy". Produksi
-- project asal template ini pernah kehilangan policy ini gara-gara live schema-nya
-- sempat drift dari SQL kanonik (lihat README §9 Troubleshooting) — jangan sampai
-- kejadian lagi di project baru yang pakai template ini.

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

COMMENT ON COLUMN orders.qris_string IS
  'QRIS dinamis (hasil generate dari QRIS statis toko + nominal) supaya QR bisa ditampilkan ulang kapan saja lewat tombol "Tampilkan QR lagi" — bukan kredensial rahasia, aman disimpan apa adanya.';

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert orders"
  ON orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Admin full access orders"
  ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
