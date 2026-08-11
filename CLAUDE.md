# Breva Coffee — Project Context

Website pemesanan kopi untuk UMKM. **Vanilla HTML/CSS/JS, tanpa framework, tanpa backend server.** Supabase dipakai sebagai database + auth + storage; semua logic bisnis (ongkir, QRIS, validasi promo) jalan di browser. Tujuan desain: biaya operasional sekecil mungkin (tidak ada API berbayar wajib) supaya cocok untuk skala UMKM.

Untuk setup/deploy/schema SQL, lihat `README.md`. File ini fokus menjelaskan **cara kerja tiap fitur** dan **di mana letak kodenya**, supaya sesi berikutnya tidak perlu re-explore dari nol.

---

## Peta File

| File | Isi |
|---|---|
| `index.html` | Halaman customer: katalog, keranjang, checkout, modal QRIS, modal profil, ringkasan pesanan |
| `admin.html` | Dashboard admin: login, tab Produk/Promo/Pesanan/Pengaturan, modal form & detail |
| `js/config.js` | Semua konstanta yang wajib diedit per-toko (Supabase, WA, LocationIQ, koordinat, QRIS statis) |
| `js/catalog.js` | Seluruh logic customer-facing (~1300 baris) |
| `js/admin.js` | Seluruh logic admin-facing (~1130 baris) |
| `css/main.css` | Style bersama (variabel warna, font, modal generik) |
| `css/catalog.css` | Style khusus halaman katalog/checkout/QRIS/profile sheet |
| `css/admin.css` | Style khusus dashboard admin |

Tidak ada build step — edit langsung, refresh browser.

---

## Alur Customer (`index.html` + `js/catalog.js`)

### Step 1 — Pilih tipe pesanan
`selectOrderType()` set `orderType` ke `'pickup'` atau `'delivery'`, lalu render tanggal ambil/kirim (`renderDateChips()`). Lanjut ke katalog via `goToStep2()`.

### Step 2 — Katalog & keranjang
- `loadProducts()` ambil dari tabel `products` (hanya yang `is_visible = true` lewat RLS).
- Produk tanpa varian: tombol +/- langsung (`updateQty`). Produk dengan varian: buka bottom sheet (`openVariantSheet`) untuk pilih varian dulu baru masuk cart (`confirmVariantAdd`).
- `cart` object key-nya `productId` (produk polos) atau `productId|Var1|Var2` (produk dengan varian) — supaya kombinasi varian berbeda dianggap item cart terpisah.
- Sticky footer bawah (`syncStickyFooter`) selalu nampilin total & tombol lanjut.

### Step 3 — Checkout (`renderCheckoutStep`)
- **Kartu Profil** (`profileCard`): tap untuk buka bottom sheet (`openProfileModal`) berisi nama, WA, dan — kalau delivery — alamat + catatan alamat. Disimpan ke UI state via `saveProfile()` (tidak langsung ke DB, baru di-submit saat checkout).
- **Alamat**: autocomplete pakai LocationIQ (`onAddressInput` → debounce → `fetchAddressSuggestions` → `renderAddressSuggestions`). Pilih saran → `selectAddressSuggestion` set `_deliveryLat`/`_deliveryLng` dan trigger `autoCalcShipping()`.
- **Ongkir**: dihitung **tanpa API**, murni matematis:
  - `haversineDistance()` — jarak garis lurus toko ↔ alamat customer (pakai `STORE_LAT`/`STORE_LNG` dari config).
  - `calcShippingRate(km)` — tarif flat per tier jarak: ≤3km = Rp8.000, ≤6km = Rp15.000, ≤10km = Rp22.000, >10km = di luar jangkauan (ongkir `null`, tombol checkout diblokir).
  - Ditampilkan di `#ongkirOptions` pada halaman utama (**bukan** di dalam modal profil — keputusan desain eksplisit supaya kalkulasi ongkir tetap terlihat saat customer isi form).
- **Promo**: `validatePromoCode()` query `promo_codes` by `code` + `is_active = true`, cek `min_order`. Hasil disimpan di `activePromo`.
- **Totals**: `cartTotal()` → `getDiscountAmount()` → `cartFinalTotal()` (sudah termasuk ongkir kalau delivery).

### Pembayaran QRIS (`showQrisPayment` → modal `#qrisModal`)
- `qrisToDynamic(QRIS_STATIC, amount)` — inject nominal ke payload EMV QRIS statis toko + hitung ulang CRC16 (`crc16`). **Deterministik**: input sama selalu hasilkan string sama, sehingga QR yang sama bisa digenerate ulang kapan saja tanpa expiry dan tanpa payment gateway.
- QR dirender ke `<canvas>` pakai library `qrcodejs`. Tombol **"Simpan QR"** (`saveQrisImage`) export canvas ke PNG (`canvas.toDataURL`).
- Setelah customer klik "Konfirmasi", `confirmQrisPayment()` insert row ke `orders` (status `pending`) termasuk `qris_string` yang sudah digenerate, lalu buka `showOrderSummary()`.

### Ringkasan Pesanan (`showOrderSummary` → modal `#orderSummaryModal`)
- Tampilkan kode pesanan, rincian pengiriman (termasuk alamat toko — supaya customer tahu dikirim dari mana), rincian item & total.
- Tombol **"💬 Kirim Bukti Transfer via WA"** (`sendWhatsAppProof`) buka `_ossWaUrl` (link `wa.me` yang sudah disiapkan saat konfirmasi).
- Tombol **"📷 Tampilkan QR lagi"** (`reshowQris`) — pakai `_ossQrisString`/`_ossQrisAmount` (diisi di `showOrderSummary`, direset di `closeOrderSummary`) untuk render ulang QR yang sama persis, buka lagi modal QRIS. Berguna kalau customer sudah menutup layar QR sebelum sempat bayar.

### State module-level penting di `catalog.js`
```
cart               // isi keranjang
orderType          // 'pickup' | 'delivery'
activePromo        // kode promo yang sedang aktif
_selectedShipping  // { price, label } hasil autoCalcShipping
_deliveryLat/Lng   // koordinat hasil pilih alamat
_qrisPendingOrder  // snapshot order sebelum dikonfirmasi (dipakai showQrisPayment → confirmQrisPayment)
_ossWaUrl          // link WA admin, diisi setelah insert order sukses
_ossQrisString     // QRIS string untuk reshowQris()
_ossQrisAmount     // nominal untuk reshowQris()
```

---

## Alur Admin (`admin.html` + `js/admin.js`)

Login via Supabase Auth (`handleLogin`/`checkAuth`) — hanya user yang dibuat manual di Supabase Dashboard yang bisa masuk (lihat README §1 "Buat Akun Admin").

### Tab Produk
CRUD standar ke tabel `products`. Upload foto ke bucket `product-images` (`saveProduct` → `supabaseClient.storage`). Varian dikelola lewat UI builder (`addVariantGroup`/`addVariantOption` → `getVariantsFromForm()` serialize ke JSON, `populateVariantGroups()` deserialize saat edit).

### Tab Promo
CRUD ke `promo_codes`. Tipe diskon `percent` atau `flat`, opsional `min_order` dan `expires_at`.

### Tab Pesanan
- `loadOrders()` ambil semua row `orders` (RLS: hanya `authenticated` boleh SELECT — customer tidak bisa lihat pesanan orang lain).
- Filter status: `pending` (default) → `confirmed` → `done`, atau `cancelled` (`filterOrders`).
- `openOrderDetail(orderId)` buka modal detail (`renderOrderDetailHTML`) dengan aksi:
  - **✅ Konfirmasi / ✅ Selesai / ❌ Batalkan** → `changeOrderStatus()` update kolom `status`.
  - **🖨️ Print Label** (`openPrintLabel`) → render `#printLabel` tersembunyi lalu `window.print()`.
  - **📤 WA Customer** (`sendOrderSummaryToWA`) → generate ringkasan pesanan (item, total, alamat, status saat ini) dan buka `wa.me/{customer_wa}` terisi otomatis — dipakai kalau customer tanya status pesanan via chat, admin tinggal klik kirim tanpa ngetik ulang manual.

### Tab Pengaturan
Form tunggal yang upsert ke tabel `settings` (row `id = 1`): nama/ikon/logo brand, alamat & jam toko, link Maps, banner katalog (judul/subjudul/foto), link Instagram/TikTok. Upload logo & foto banner juga lewat bucket `product-images`.

`js/catalog.js` (`loadSettings`/`applyBrandSettings`) baca tabel ini saat halaman customer dibuka dan override nilai default dari `config.js` — jadi admin bisa ganti branding tanpa sentuh kode. Kalau tabel `settings` belum dibuat/kosong, fallback ke `config.js` secara silent (tidak error).

---

## Keputusan Desain / "Kenapa begini"

- **Tidak ada backend server.** Semua kalkulasi (ongkir, QRIS) sengaja dibuat client-side supaya tidak ada biaya API per-transaksi. Konsekuensi: kalau nanti mau integrasi API berbayar yang butuh secret key (mis. Biteship untuk ongkir real, payment gateway resmi), **wajib** tambah proxy layer (Supabase Edge Function) — jangan taruh secret key di JS frontend.
- **Ongkir = Haversine + tarif flat per tier**, bukan API. Sengaja, karena toko hanya melayani radius terbatas (≤10km) dan tidak butuh akurasi rute jalan sungguhan.
- **Maps hanya link share statis** (`STORE_MAPS_URL`), bukan Maps JavaScript API — supaya tidak kena biaya Google Maps API.
- **LocationIQ dipakai khusus untuk autocomplete alamat** (bukan hitung jarak) — tier gratisnya cukup untuk skala UMKM.
- **QRIS statis → dinamis dilakukan di browser** (`qrisToDynamic`), bukan lewat payment gateway (Midtrans/Xendit dkk) — supaya tidak ada biaya transaksi. Trade-off: tidak ada konfirmasi pembayaran otomatis, admin harus verifikasi manual dari bukti transfer yang dikirim via WA (makanya alur selalu diarahkan ke `wa.me` setelah "bayar").
- **Ongkir kalkulasi ditaruh di luar modal profil** (bukan di dalamnya) — permintaan eksplisit supaya customer tetap lihat estimasi ongkir sambil isi data di halaman utama, modal profil murni untuk data diri + alamat.
- **`orders` RLS insert-only untuk anon** — customer tidak pernah butuh SELECT dari tabel ini (semua state pesanan di-track di JS memory sampai konfirmasi), jadi tidak dibuka read access sama sekali demi privasi data pelanggan lain.
