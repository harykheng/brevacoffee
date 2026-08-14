-- Storage bucket `product-images`: dipakai untuk foto produk, logo brand, dan
-- foto banner katalog (semua lewat satu bucket yang sama, dibedakan lewat
-- prefix filename — lihat shared/lib/products.js & shared/lib/settings.js).
-- Bucket dibuat langsung public=true di sini (setara centang "Public bucket" di
-- dashboard), jadi tidak perlu policy SELECT terpisah untuk anon.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
