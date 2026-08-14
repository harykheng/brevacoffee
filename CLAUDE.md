# Breva Coffee — Project Context

Website pemesanan kopi untuk UMKM. **React + Vite**, dua aplikasi terpisah dalam satu repo (Vite multi-page app): katalog customer di `/`, dashboard admin di `/admin/`. Supabase dipakai sebagai database + auth + storage; hampir semua logic bisnis (QRIS, validasi promo) jalan di browser. Satu pengecualian: cek ongkir real-time (Biteship) lewat 1 Supabase Edge Function kecil, karena API key Biteship secret dan tidak boleh nempel di frontend — lihat bagian "Ongkir" di bawah. Tujuan desain: biaya operasional sekecil mungkin supaya cocok untuk skala UMKM.

Untuk setup/deploy/schema SQL, lihat `README.md`. File ini fokus menjelaskan **cara kerja tiap fitur** dan **di mana letak kodenya**, supaya sesi berikutnya tidak perlu re-explore dari nol.

Repo ini dulu vanilla HTML/CSS/JS (lihat git history sebelum commit rewrite React), full-rewrite jadi React karena logic-nya sudah terlalu kompleks untuk dikelola manual lewat DOM manipulation (`catalog.js`/`admin.js` masing-masing >1000 baris). Business logic-nya (QRIS EMV, Haversine, dsb) dipindah apa adanya (bukan ditulis ulang) — kalau ada keraguan soal behavior yang "benar", cek `src/shared/lib/` dulu, itu port langsung dari kode lama.

---

## Peta File

| Path | Isi |
|---|---|
| `index.html` / `admin/index.html` | Vite entry point kedua aplikasi (root div + script module) |
| `vite.config.js` | Config Vite, dua entry point (`main` = customer, `admin` = admin) |
| `src/customer/` | Aplikasi React customer: `App.jsx` (step switcher + modal orchestration), `CartContext.jsx` (state global order flow via `useReducer`), `components/`, `hooks/useShipping.js` |
| `src/admin/` | Aplikasi React admin: `App.jsx` (tab shell), `AuthContext.jsx` (Supabase Auth session), `components/` |
| `src/shared/lib/` | Pure functions dipakai kedua app: `qris.js` (crc16/qrisToDynamic), `shipping.js` (Haversine), `cart.js` (cart math), `format.js`, `whatsapp.js` (message builder), `config.js` (baca env var `VITE_*`), `supabaseClient.js`, `products.js`/`promos.js`/`orders.js`/`settings.js` (mutation functions ke Supabase) |
| `src/shared/hooks/` | `useProducts`, `usePromos`, `useOrders`, `useSettings` — data-fetching hooks dipakai kedua app |
| `src/shared/components/` | `Modal.jsx` (shell generik modal admin), `Toast.jsx` (+ `useToast()`), `ConfirmDialog.jsx` (+ `useConfirmDialog()`) |
| `css/main.css` / `catalog.css` / `admin.css` | Style — **tidak diubah dari versi vanilla**, di-import apa adanya sebagai global stylesheet, semua class name sama persis |
| `supabase/functions/check-shipping/index.ts` | Edge Function (Deno) — proxy ke Biteship Rates API, satu-satunya kode yang jalan di server bukan browser |
| `wrangler.jsonc` | Config Cloudflare — deklarasi deploy static-assets-only (`assets.directory: "./dist"`, tanpa Worker script). Lihat "Kenapa begini" untuk alasannya. |

Build via Vite (`npm run dev` / `npm run build`) — beda dari versi vanilla dulu yang tanpa build step sama sekali. Live deploy project ini ada di **Cloudflare** — detail troubleshooting deploy (Vite version, Workers vs Pages, env var) ada di README §8.

---

## Alur Customer (`src/customer/`)

State global order flow ada di `CartContext.jsx` (`useReducer`), diakses lewat `useCart()` di komponen manapun di dalam `<CartProvider>`. Field penting: `step` (1/2/3), `orderType`, `cart` (key = `productId` atau `productId|Var1|Var2` untuk kombinasi varian), `activePromo`, `selectedShipping`, `profile`, `note`, plus `shippingStatus`/`shippingOptions`/`shippingStaticKm` untuk hasil cek ongkir.

### Step 1 — `OrderTypeStep.jsx`
Pilih pickup/delivery + tanggal (chip 7 hari dari `buildDateChips()` di `shared/lib/format.js`). Dispatch `SELECT_ORDER_TYPE`/`SET_DATE`, lanjut lewat `SET_STEP`.

### Step 2 — `CatalogStep.jsx` + `ProductCard.jsx` + `VariantSheet.jsx`
- `useProducts({ onlyVisible: true })` ambil dari tabel `products` (RLS sudah filter `is_visible=true` juga, filter di query cuma optimisasi).
- Produk tanpa varian: qty stepper langsung (dispatch `SET_CART_QTY`). Produk dengan varian: buka `VariantSheet` (state lokal `selected`/`qty`, konfirm dispatch `ADD_TO_CART` dengan `cartKey` gabungan label varian).
- Cart math (`cartCount`, `cartTotal`, `getDiscountAmount`, `cartFinalTotal`, `getProductCartQty`) semua pure function di `shared/lib/cart.js` — dipanggil dengan `state.cart` sebagai parameter, bukan baca state global langsung.

### Step 3 — `CheckoutStep.jsx`
- **Kartu Profil**: tap buka `ProfileModal` (di-render selalu di `App.jsx`, toggle via `isOpen` prop — bukan mount/unmount, supaya form state persist antar buka-tutup).
- **Alamat**: `AddressAutocomplete.jsx` — LocationIQ REST API lewat `fetch` biasa, state lokal (results/debounce timer), lapor koordinat ke parent (`ProfileModal`) lewat `onCoordsChange`. **Tidak pernah** trigger cek ongkir sendiri.
- **Ongkir**: `useShipping().calculate(lat, lng, weightGrams, orderValue)` dipanggil **cuma sekali**, dari handler save di `ProfileModal.jsx` — bukan dari `useEffect` yang watch perubahan alamat (itu justru bug yang mau dihindari, lihat "Kenapa begini" di bawah). Hasilnya dispatch ke `CartContext` (`SET_SHIPPING_OPTIONS`/`SET_SHIPPING_STATIC`/`SET_SHIPPING_UNAVAILABLE`), ditampilkan `OngkirOptions.jsx` yang render di `CheckoutStep` (bukan di dalam modal profil).
  - `useShipping.js` cuma punya SATU jalur: `checkBiteshipRatesViaEdgeFunction()` → `supabase.functions.invoke('check-shipping')`. Tidak ada jalur "panggil Biteship langsung dari browser" di kode React ini sama sekali (versi vanilla sempat punya jalur testing seperti itu, sengaja tidak diikutkan saat rewrite).
  - **Fallback**: kalau Edge Function gagal/error/kosong, otomatis `haversineDistance()` + `calcShippingRate(km)` dari `shared/lib/shipping.js` (≤3km=Rp8rb, ≤6km=Rp15rb, ≤10km=Rp22rb, >10km=`SET_SHIPPING_UNAVAILABLE`).
  - **Loading state**: selama `calculate()` berjalan, `ProfileModal.jsx` set `saving=true` yang me-render `ShippingLoadingOverlay.jsx` — overlay full-screen (scooter + cangkir kopi animasi CSS) via `createPortal` ke `document.body` (bukan nested di dalam `.profile-overlay`, supaya klik di overlay tidak ke-bubble ke handler `onClose` backdrop modal profil). Style-nya di `css/catalog.css` bagian `SHIPPING LOADING OVERLAY`.
- **Promo**: `fetchActivePromoByCode()` (`shared/lib/promos.js`) query `promo_codes` by `code` + `is_active=true`, cek `min_order`. Hasil dispatch `APPLY_PROMO`.

### Pembayaran QRIS — `QrisModal.jsx`
- Snapshot order (`pendingOrder`) dibuat di `App.jsx`'s `handleSubmitQris()` — bukan di dalam `QrisModal` sendiri, supaya validasi profil bisa jalan sebelum modal kebuka.
- `qrisToDynamic(QRIS_STATIC, amount)` dari `shared/lib/qris.js` — inject nominal ke payload EMV + hitung ulang CRC16. **Deterministik**: input sama selalu hasilkan string sama, QR bisa digenerate ulang kapan saja tanpa expiry.
- QR dirender ke `<canvas>` pakai package `qrcode` (`QRCode.toCanvas()`, bukan `qrcodejs` versi lama yang gak ada npm package resminya). Tombol "Simpan QR" export canvas ke PNG (`canvas.toDataURL`).
- Konfirmasi → `insertOrder()` (`shared/lib/orders.js`) insert row `orders` (status `pending`, termasuk `qris_string`) → `onConfirmed` callback ke `App.jsx` → buka `OrderSummaryModal`.

### Ringkasan Pesanan — `OrderSummaryModal.jsx`
- Kode pesanan, rincian pengiriman (termasuk alamat toko), item & total.
- "Kirim Bukti Transfer via WA" buka `order.waUrl` (link `wa.me` dibangun di `QrisModal` pakai `buildQrisConfirmMessage()` dari `shared/lib/whatsapp.js`), lalu dispatch `RESET_ORDER` (reset penuh state balik ke step 1).
- "Tampilkan QR lagi" (`onReshowQris`) — App.jsx pindahkan order dari `confirmedOrder` balik ke `pendingOrder`, `QrisModal` render ulang QR dari `qris_string` yang sama persis.

---

## Alur Admin (`src/admin/`)

`AuthContext.jsx` wrap Supabase Auth session (`supabase.auth.getSession()` + `onAuthStateChange`). `App.jsx` render `LoginScreen` kalau `session` null, `Dashboard` kalau ada session — hanya user yang dibuat manual di Supabase Dashboard yang bisa masuk (lihat README §1 "Buat Akun Admin").

### Tab Dashboard — `DashboardTab.jsx`
Tab default saat login. Semua angka dihitung client-side di `useMemo` dari `useOrders()` (tidak ada tabel/agregasi baru di Supabase) — hanya status `confirmed`/`done` dihitung sebagai "revenue" (`REVENUE_STATUSES`), `pending` sengaja dikecualikan karena itu pesanan yang QRIS-nya sudah digenerate tapi bukti transfernya belum diverifikasi admin, jadi belum tentu valid; `cancelled` juga dikecualikan. Kartu: pendapatan/pesanan/item terjual hari ini, omset bulan berjalan. Chart batang 7 hari terakhir dan daftar produk terlaris bulan ini dibangun pure CSS/JS (tanpa charting library, konsisten dengan prinsip "no new deps kalau bisa dihindari") — data qty/revenue per produk diambil dari field `nm`/`qty`/`sub` di `orders.items` (shape yang sama dipakai `cartSnapshot()`, lihat `shared/lib/cart.js`).

### Tab Produk — `ProductsTab.jsx` + `ProductFormModal.jsx`
CRUD ke tabel `products` lewat `saveProduct()`/`deleteProduct()` (`shared/lib/products.js`, termasuk upload foto ke bucket `product-images`). Varian dikelola sebagai array-of-objects local state (`variantGroups`) di form, diserialize ke JSON pas submit — beda dari versi vanilla yang scrape dari DOM langsung, tapi hasil akhirnya (shape JSON di kolom `variants`) sama persis.

### Tab Promo — `PromoTab.jsx` + `PromoFormModal.jsx`
CRUD ke `promo_codes` lewat `savePromo()`/`deletePromo()`. Tipe diskon `percent` atau `flat`, opsional `min_order` dan `expires_at`.

### Tab Pesanan — `OrdersTab.jsx` + `OrderDetailModal.jsx` + `PrintLabel.jsx`
- `useOrders()` ambil semua row `orders` (RLS: hanya `authenticated` boleh SELECT), filter client-side pesanan `pending` yang sudah lewat 24 jam (disembunyikan dari list, bukan dihapus).
- Filter status via tab: `pending` (default) → `confirmed` → `done`, atau `cancelled`.
- `OrderDetailModal` aksi: **Konfirmasi/Selesai/Batalkan** → `updateOrderStatus()`; **Print Label** → `window.print()` (lihat catatan portal di bawah); **WA Customer** → `buildAdminOrderSummaryMessage()` (`shared/lib/whatsapp.js`) buka `wa.me/{customer_wa}` terisi otomatis.
- **`PrintLabel.jsx` pakai React Portal** (`createPortal`) ke `#printLabel`, sebuah `<div>` yang sengaja ditaruh sebagai **direct child `<body>`** di `admin/index.html` (bukan di dalam `#root`) — karena CSS `@media print` di `admin.css` pakai selector `body > *:not(#printLabel)` buat nyembunyiin semua elemen lain saat print. Kalau `#printLabel` dipindah ke dalam tree React normal (nested di `#root`), print CSS-nya rusak karena `#root` sendiri bakal ke-hide duluan.

### Tab Pengaturan — `SettingsTab.jsx`
Form yang upsert ke tabel `settings` (row `id=1`) lewat `saveSettings()` (`shared/lib/settings.js`): nama/ikon/logo brand, alamat & jam toko, link Maps, banner katalog, link Instagram/TikTok. Upload logo & banner lewat bucket `product-images`.

`useSettings()` (hook yang sama dipakai kedua app) di-consume `src/customer/App.jsx` buat baca `settings` sekali di top level dan diteruskan sebagai prop `settings` ke tiap step — bukan tiap komponen manggil `useSettings()` sendiri-sendiri, supaya gak double-fetch row yang sama. Kalau tabel `settings` belum dibuat/kosong, hook fail silent dan komponen fallback ke `config.js` (`shared/lib/config.js`, baca env var `VITE_*`).

---

## Keputusan Desain / "Kenapa begini"

- **Full-rewrite dari vanilla JS ke React** — alasannya business logic (ongkir Biteship+fallback, QRIS, autocomplete alamat, admin CRUD 4 tab) sudah terlalu banyak untuk dikelola lewat manual DOM manipulation di file 1000+ baris. Vite dipilih (bukan Next.js) supaya tetap static site, tanpa SSR, tanpa backend baru selain Edge Function yang sudah ada — deploy tetap ke Vercel/Netlify seperti biasa, cuma build command-nya berubah dari "tidak ada" jadi `vite build`.
- **Vite multi-page app (dua entry point), bukan satu SPA + React Router** — customer dan admin nyaris tidak share UI (cuma shell modal/button generik), dan auth model-nya beda total. Dua entry terpisah bikin bundle lebih kecil (admin gak pernah download kode checkout/QRIS, customer gak pernah download kode dashboard) dan URL structure-nya persis kayak dulu (`/` dan `/admin/`), tanpa perlu routing library.
- **State management: `useReducer` + Context, bukan Zustand/Redux** — state customer (cart, orderType, promo, shipping, profile) itu banyak tapi gak kompleks (gak ada server-cache invalidation, gak ada butuh time-travel debugging), cukup satu `CartContext` per app-lifetime. Admin malah gak butuh state global sama sekali — tiap tab (`ProductsTab`, `PromoTab`, dst) punya state lokal sendiri-sendiri, cuma `AuthContext` yang global.
- **CSS tidak ditulis ulang** — 3 file CSS lama (`main.css`/`catalog.css`/`admin.css`, total ~2900 baris) di-import apa adanya sebagai global stylesheet, semua class name JSX match 1:1 sama markup lama. Rewrite ke CSS Modules/Tailwind cuma nambah risiko di rewrite yang sudah besar, tanpa manfaat fungsional — tujuan rewrite ini JS-nya, bukan tampilannya.
- **Client-side by default, backend hanya kalau benar-benar wajib.** QRIS dan promo sengaja dibuat client-side supaya tidak ada biaya API per-transaksi. Ongkir jadi pengecualian: Biteship butuh secret key yang tidak bisa dibatasi per-domain, jadi **wajib** proxy — itu alasan Edge Function `check-shipping` ada. Kode React di rewrite ini **cuma punya satu jalur** (Edge Function) — jalur testing "panggil Biteship langsung dari browser" yang sempat ada di versi vanilla (`checkBiteshipRatesDirect`, `BITESHIP_TEST_API_KEY`) sengaja **tidak diikutkan** saat rewrite, karena itu situasi transisi sementara, bukan pola yang mau dipertahankan.
- **Debounced single-ongkir-check-on-save dipertahankan ketat** — `useShipping().calculate()` cuma pernah dipanggil dari satu tempat (`ProfileModal`'s save handler), bukan dari `useEffect` yang watch perubahan alamat/koordinat. Godaan paling gampang pas port ke React adalah nulis `useEffect(() => { calculate(...) }, [address])` yang kelihatan lebih "React-idiomatic" — itu salah, karena bakal manggil Biteship berkali-kali tiap customer ngetik/ganti alamat. Kalau nanti refactor bagian ini, pertahankan kontrak "sekali pas Simpan" itu.
- **Ongkir dicoba Biteship dulu (real-time, akurat per kurir), baru fallback ke Haversine + tarif flat per tier** kalau Biteship/Edge Function gagal. Percobaan integrasi Biteship yang lebih awal (lihat git history sebelum rewrite React) sempat beberapa kali direvert karena API key-nya ditaruh langsung di kode frontend — pola itu tidak dipakai lagi.
- **Maps hanya link share statis**, bukan Maps JavaScript API — supaya tidak kena biaya Google Maps API.
- **LocationIQ dipakai khusus untuk autocomplete alamat** (bukan hitung jarak) — tier gratisnya cukup untuk skala UMKM. Sempat dicoba diganti ke GrabMaps (via Amazon Location Service) karena dikira datanya lebih akurat untuk Indonesia, tapi dibalikin lagi — datanya LocationIQ ternyata sudah cukup lengkap, masalahnya cuma di list autocomplete yang tidak selalu muncul (bukan masalah kelengkapan data).
- **QRIS statis → dinamis dilakukan di browser**, bukan lewat payment gateway (Midtrans/Xendit dkk) — supaya tidak ada biaya transaksi. Trade-off: tidak ada konfirmasi pembayaran otomatis, admin harus verifikasi manual dari bukti transfer yang dikirim via WA.
- **Ongkir kalkulasi ditaruh di luar modal profil** (bukan di dalamnya) — permintaan eksplisit supaya customer tetap lihat estimasi ongkir sambil isi data di halaman utama, modal profil murni untuk data diri + alamat.
- **`orders` RLS insert-only untuk anon** — customer tidak pernah butuh SELECT dari tabel ini (semua state pesanan di-track di React state sampai konfirmasi), jadi tidak dibuka read access sama sekali demi privasi data pelanggan lain.
- **Vite 8 wajib** (bukan Vite 5 dari scaffold awal) — Cloudflare's Workers deploy flow butuh Vite ≥6 supaya bisa auto-configure project; di-upgrade pertengahan sesi rewrite (`vite` 5.4.21→8.2.1, `@vitejs/plugin-react` 4.3.2→6.0.5), termasuk ganti `__dirname` jadi `import.meta.dirname` di `vite.config.js` (deprecation di Vite 8).
- **`wrangler.jsonc` ada karena Cloudflare dashboard sekarang default ke alur "Workers"**, bukan lagi form "Pages" terpisah — alur Workers otomatis coba parse `vite.config.js` buat auto-detect config, dan gagal karena config multi-entry (customer+admin) project ini tidak dikenali plugin Vite Wrangler. `wrangler.jsonc` mendeklarasikan deploy sebagai static-assets-only (`assets.directory: "./dist"`, tanpa Worker script), supaya Wrangler skip parsing `vite.config.js` sama sekali. Kalau nanti Cloudflare balikin alur Pages klasik, file ini masih aman dibiarkan (opsional, tapi tidak mengganggu).
- **Skema RLS kanonik di README bisa drift dari yang live di Supabase** — pernah kejadian tabel `orders` di production cuma punya policy admin (ALL), **tanpa** `"Public insert orders"` untuk `anon`, jadi semua checkout customer gagal `42501 new row violates row-level security policy` meskipun kode frontend dan `.env` sudah benar. Kalau ada laporan bug "gagal insert"/"401" yang tidak masuk akal dari sisi kode, curigai dulu RLS drift — diagnosis lewat `SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = '<table>';` di SQL Editor, bandingkan ke `CREATE POLICY` canonical di README §1, baru simpulkan itu bug kode atau schema yang belum disinkron.
- **Paste secret (Biteship key, dsb) ke textarea dashboard bisa menyisipkan newline literal tanpa terlihat** — gejalanya Edge Function selalu gagal dengan `TypeError: Invalid header value`, bukan error auth biasa. Kalau debug Edge Function/API key issue, ini salah satu hal pertama yang perlu dicurigai sebelum menduga kodenya salah.
