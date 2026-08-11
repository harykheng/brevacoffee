// ================================================
// BREVA COFFEE — CATALOG PAGE (3-step flow)
// ================================================

// ---- STATE ----
let orderType         = null;   // 'pickup' | 'delivery'
let selectedDate      = null;   // 'YYYY-MM-DD'
let selectedDateLabel = null;   // human-readable label
let products          = [];
let cart              = {};     // key: productId OR 'productId|Var1|Var2'
let productsLoaded    = false;
let appSettings       = null;   // loaded from settings table

// variant sheet state
let pendingProduct  = null;
let pendingVariants = {};       // { groupName: { label, price } }
let pendingQty      = 1;

// promo state
let activePromo = null;         // { code, discount_type, discount_value, min_order }

// delivery state
let _deliveryLat      = null;
let _deliveryLng      = null;
let _acResults        = [];   // LocationIQ autocomplete results
let _selectedShipping = null; // { price, label } | null

// ---- HELPERS ----
const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(price);
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${escapeHTML(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast-out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 3200);
}

// ================================================================
// SETTINGS
// ================================================================

async function loadSettings() {
  try {
    const { data } = await supabaseClient
      .from('settings').select('*').eq('id', 1).single();
    if (data) { appSettings = data; applyBrandSettings(); }
  } catch (_) {
    // settings table not created yet — use config.js defaults silently
  }
}

function applyBrandSettings() {
  if (!appSettings) return;

  const name = appSettings.brand_name || STORE_NAME;
  document.querySelectorAll('.brand-name-text').forEach(el => el.textContent = name);
  document.title = name;

  if (appSettings.logo_url) {
    document.querySelectorAll('.brand-icon-logo').forEach(el => {
      el.src = appSettings.logo_url;
      el.alt = name;
      el.style.display = '';
    });
    document.querySelectorAll('.brand-icon-emoji').forEach(el => el.style.display = 'none');
  } else if (appSettings.brand_icon) {
    document.querySelectorAll('.brand-icon-emoji').forEach(el => el.textContent = appSettings.brand_icon);
  }

  // Banner image
  if (appSettings.banner_image_url) {
    const bgImg = document.getElementById('bannerBgImg');
    if (bgImg) { bgImg.src = appSettings.banner_image_url; bgImg.style.display = ''; }
  }

  // Social media links
  if (appSettings.instagram_url)
    document.querySelectorAll('.footer-ig').forEach(el => { el.href = appSettings.instagram_url; });
  if (appSettings.tiktok_url)
    document.querySelectorAll('.footer-tt').forEach(el => { el.href = appSettings.tiktok_url; });
}

// ================================================================
// STEP 1 — ORDER TYPE & DATE
// ================================================================

function selectOrderType(card) {
  document.querySelectorAll('.order-type-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  orderType = card.dataset.type;

  const addrCard = document.getElementById('pickupAddressCard');
  if (orderType === 'pickup') {
    document.getElementById('pickupAddr').textContent  = appSettings?.store_address  || STORE_ADDRESS;
    document.getElementById('pickupHours').textContent = appSettings?.store_hours    || STORE_OPEN_HOURS;
    document.getElementById('pickupMapsLink').href     = appSettings?.store_maps_url || STORE_MAPS_URL;
    addrCard.classList.add('visible');
  } else {
    addrCard.classList.remove('visible');
  }

  document.getElementById('dateSectionLabel').textContent =
    orderType === 'pickup' ? 'Pilih Tanggal Pickup' : 'Pilih Tanggal Delivery';
  document.getElementById('dateSection').classList.add('visible');

  checkStep1Ready();
}

function renderDateChips() {
  const wrap  = document.getElementById('dateChips');
  wrap.innerHTML = '';
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d       = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const chip    = document.createElement('div');

    if (i === 0 || i === 1) {
      const label = i === 0 ? 'Hari ini' : 'Besok';
      chip.className     = `date-chip ${i === 0 ? 'chip-today' : 'chip-tomorrow'}`;
      chip.dataset.label = `${label}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      chip.innerHTML = `
        <span class="dc-label">${label}</span>
        <span class="dc-sublabel">${d.getDate()} ${MONTHS[d.getMonth()]}</span>`;
    } else {
      chip.className     = 'date-chip';
      chip.dataset.label = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      chip.innerHTML = `
        <span class="dc-day">${DAYS[d.getDay()]}</span>
        <span class="dc-date">${d.getDate()}</span>
        <span class="dc-month">${MONTHS[d.getMonth()]}</span>`;
    }

    chip.dataset.value = dateStr;
    chip.addEventListener('click', () => selectDate(chip));
    wrap.appendChild(chip);
  }
}

function selectDate(chip) {
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  selectedDate      = chip.dataset.value;
  selectedDateLabel = chip.dataset.label;
  checkStep1Ready();
}

function checkStep1Ready() {
  document.getElementById('btnNext').disabled = !(orderType && selectedDate);
}

// ================================================================
// STEP 2 — CATALOG
// ================================================================

function goToStep2() {
  if (!orderType || !selectedDate) return;

  // Populate order info strip
  document.getElementById('oisType').textContent = orderType === 'pickup' ? '🏠 Pickup' : '🛵 Delivery';
  document.getElementById('oisDate').textContent  = selectedDateLabel;

  // Populate banner (use DB settings if loaded, else config.js defaults)
  document.getElementById('bannerTitle').textContent = appSettings?.banner_title    || BANNER_TITLE;
  document.getElementById('bannerSub').textContent   = appSettings?.banner_subtitle || BANNER_SUBTITLE;

  // Switch step
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  window.scrollTo(0, 0);

  if (!productsLoaded) {
    loadProducts();
    productsLoaded = true;
  }

  syncStickyFooter();
}

function goBack() {
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  window.scrollTo(0, 0);
}

// ================================================================
// LOAD & RENDER PRODUCTS
// ================================================================

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Memuat menu...</span></div>';

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    products = data || [];
    grid.innerHTML = '';

    if (!products.length) {
      grid.innerHTML = `
        <div class="catalog-empty">
          <span class="catalog-empty-icon">☕</span>
          <h3>Menu segera hadir!</h3>
          <p>Produk sedang kami siapkan.</p>
        </div>`;
      return;
    }

    products.forEach((p, i) => grid.appendChild(buildProductCard(p, i)));

  } catch (err) {
    console.error(err);
    grid.innerHTML = `
      <div class="catalog-error">
        <span class="catalog-error-icon">😔</span>
        <h3>Gagal memuat menu</h3>
        <p>Coba refresh halaman ini ya!</p>
      </div>`;
  }
}

function buildProductCard(product, index) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.id = product.id;
  card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;

  const hasVariants = product.variants && product.variants.length > 0;
  const qty = hasVariants ? getProductCartQty(product.id) : (cart[product.id]?.qty || 0);

  let badgeHTML = '';
  if (product.is_bestseller) badgeHTML = '<div class="product-badge badge-bestseller">⭐ Terlaris</div>';
  else if (product.is_new)   badgeHTML = '<div class="product-badge badge-new">✨ New</div>';

  const imgHTML = product.image_url
    ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const phHTML = `<span class="product-image-placeholder" ${product.image_url ? 'style="display:none"' : ''}>☕</span>`;

  const controlsHTML = hasVariants
    ? `<div class="product-controls">
        <button class="btn-pick-variant" data-id="${product.id}" onclick="openVariantSheet('${product.id}')">
          <span class="vbadge" id="vbadge-${product.id}" style="display:${qty > 0 ? 'flex' : 'none'}">${qty}</span>
          Pilih
        </button>
       </div>`
    : `<div class="product-controls">
        <button class="qty-btn minus${qty === 0 ? ' minus-disabled' : ''}"
          onclick="updateQty('${product.id}',-1,this)" aria-label="Kurangi">−</button>
        <span class="qty-display" id="qty-${product.id}">${qty}</span>
        <button class="qty-btn plus" onclick="updateQty('${product.id}',1,this)" aria-label="Tambah">+</button>
       </div>`;

  const descHTML = product.description
    ? `<div class="product-desc">${escapeHTML(product.description)}</div>` : '';

  card.innerHTML = `
    ${badgeHTML}
    <div class="product-image-wrap">${imgHTML}${phHTML}</div>
    <div class="product-info">
      <div class="product-name">${escapeHTML(product.name)}</div>
      ${descHTML}
      <div class="product-price">${formatPrice(product.price)}</div>
    </div>
    ${controlsHTML}`;

  return card;
}

function refreshCard(productId) {
  const card    = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (!card) return;
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const delay = card.style.animationDelay;
  const idx   = Array.from(card.parentNode.children).indexOf(card);
  const fresh = buildProductCard(product, idx);
  fresh.style.animationDelay = delay;
  fresh.style.animation = 'none';
  card.replaceWith(fresh);
}

// ================================================================
// CART
// ================================================================

function updateQty(productId, delta, btn) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const prev = cart[productId]?.qty || 0;
  const next = Math.max(0, prev + delta);

  if (next === 0) delete cart[productId];
  else cart[productId] = { product, qty: next };

  if (btn) {
    btn.classList.add('bounce');
    btn.addEventListener('animationend', () => btn.classList.remove('bounce'), { once: true });
  }

  refreshCard(productId);
  syncStickyFooter();
}

function cartCount() { return Object.values(cart).reduce((s, { qty }) => s + qty, 0); }
function cartTotal() {
  return Object.values(cart).reduce((s, { product, qty, extraPrice = 0 }) => s + (product.price + extraPrice) * qty, 0);
}
function getDiscountAmount() {
  if (!activePromo) return 0;
  const raw = cartTotal();
  if (activePromo.discount_type === 'percent')
    return Math.round(raw * activePromo.discount_value / 100);
  return Math.min(activePromo.discount_value, raw);
}
function cartFinalTotal() {
  return Math.max(0, cartTotal() - getDiscountAmount() + (_selectedShipping?.price || 0));
}

function getProductCartQty(productId) {
  return Object.entries(cart)
    .filter(([k]) => k === productId || k.startsWith(productId + '|'))
    .reduce((s, [, v]) => s + v.qty, 0);
}

function syncStickyFooter() {
  const count  = cartCount();
  const footer = document.getElementById('catalogFooter');
  document.getElementById('csfQty').textContent   = `${count} item`;
  document.getElementById('csfTotal').textContent = formatPrice(cartTotal());

  if (count > 0) {
    footer.classList.add('visible');
  } else {
    footer.classList.remove('visible');
  }
}

// ================================================================
// STEP 3 — CHECKOUT
// ================================================================

function goToStep3() {
  if (!cartCount()) return;

  renderCheckoutStep();

  document.getElementById('step2').classList.remove('active');
  document.getElementById('step3').classList.add('active');
  window.scrollTo(0, 0);

  setTimeout(() => document.getElementById('customerName').focus(), 100);
}

function goBackFromCheckout() {
  document.getElementById('step3').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  window.scrollTo(0, 0);
  const locBtn = document.getElementById('btnUseLocation');
  if (locBtn) locBtn.querySelector('.btn-loc-text').textContent = 'Gunakan Lokasi Saya';
  // Reset promo
  activePromo = null;
  document.getElementById('promoCodeInput').value     = '';
  document.getElementById('promoResult').style.display = 'none';
  // Reset ongkir
  _selectedShipping = null;
  const ongkirBox = document.getElementById('ongkirOptions');
  if (ongkirBox) ongkirBox.innerHTML = '';
}

function renderCheckoutStep() {
  // Date & type
  document.getElementById('coDate').textContent = selectedDateLabel || '-';

  if (orderType === 'pickup') {
    document.getElementById('coTypeIcon').textContent  = '🏠';
    document.getElementById('coTypeValue').textContent = 'Pickup';

    document.getElementById('coPickupAddr').textContent = appSettings?.store_address  || STORE_ADDRESS;
    const mapsLink = document.getElementById('coMapsLink');
    mapsLink.href = appSettings?.store_maps_url || STORE_MAPS_URL;
    document.getElementById('coPickupCard').style.display  = 'block';
    document.getElementById('coDeliveryInput').style.display = 'none';
  } else {
    document.getElementById('coTypeIcon').textContent  = '🛵';
    document.getElementById('coTypeValue').textContent = 'Delivery';

    document.getElementById('coPickupCard').style.display  = 'none';
    document.getElementById('coDeliveryInput').style.display = 'block';
    document.getElementById('coFromName').textContent = appSettings?.store_name    || STORE_NAME;
    document.getElementById('coFromAddr').textContent = appSettings?.store_address || STORE_ADDRESS;
  }

  // Items list
  const list = document.getElementById('coItemsList');
  list.innerHTML = Object.entries(cart).map(([key, { product, qty, variantLabels, extraPrice = 0 }]) => {
    const unitPrice = product.price + extraPrice;
    const img = product.image_url
      ? `<img class="co-item-img" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const ph = `<div class="co-item-img co-item-img-ph" ${product.image_url ? 'style="display:none"' : ''}>☕</div>`;
    const variantStr = variantLabels?.length
      ? `<div class="co-item-variants">${variantLabels.map(escapeHTML).join(' · ')}</div>` : '';
    return `
      <div class="co-item">
        ${img}${ph}
        <div class="co-item-info">
          <div class="co-item-name">${escapeHTML(product.name)}</div>
          ${variantStr}
          <div class="co-item-qty">× ${qty}</div>
        </div>
        <div class="co-item-price">${formatPrice(unitPrice * qty)}</div>
        <button class="co-item-del" onclick="removeCartItem('${escapeHTML(key)}')" aria-label="Hapus">✕</button>
      </div>`;
  }).join('');

  renderCheckoutTotals();
}

function renderCheckoutTotals() {
  const discount = getDiscountAmount();
  const discRow  = document.getElementById('coDiscountRow');
  if (discount > 0) {
    discRow.style.display = '';
    document.getElementById('coDiscountAmount').textContent = `−${formatPrice(discount)}`;
  } else {
    discRow.style.display = 'none';
  }

  const shipRow = document.getElementById('coShippingRow');
  if (shipRow) {
    if (_selectedShipping && orderType === 'delivery') {
      shipRow.style.display = '';
      document.getElementById('coShippingAmount').textContent = formatPrice(_selectedShipping.price);
    } else {
      shipRow.style.display = 'none';
    }
  }

  document.getElementById('coTotalAmount').textContent = formatPrice(cartFinalTotal());
}

// ================================================================
// VARIANT SHEET
// ================================================================

function openVariantSheet(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  pendingProduct  = product;
  pendingVariants = {};
  pendingQty      = 1;

  // Header
  const img = document.getElementById('vsImg');
  const ph  = document.getElementById('vsImgPh');
  if (product.image_url) {
    img.src = product.image_url; img.alt = product.name;
    img.style.display = ''; ph.style.display = 'none';
  } else {
    img.style.display = 'none'; ph.style.display = '';
  }
  document.getElementById('vsName').textContent     = product.name;
  document.getElementById('vsQtyDisplay').textContent = '1';

  // Build variant groups
  const body = document.getElementById('vsBody');
  body.innerHTML = '';
  (product.variants || []).forEach(group => {
    const sec = document.createElement('div');
    sec.className = 'vs-group';
    sec.innerHTML = `<div class="vs-group-name">${escapeHTML(group.name)}</div>
      <div class="vs-chips" data-group="${escapeHTML(group.name)}"></div>`;
    const chips = sec.querySelector('.vs-chips');
    group.options.forEach(opt => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'vs-chip';
      chip.textContent = opt.label + (opt.price > 0 ? ` +${formatPrice(opt.price)}` : '');
      chip.dataset.label = opt.label;
      chip.dataset.price = opt.price || 0;
      chip.onclick = () => selectVariantChip(chip, group.name);
      chips.appendChild(chip);
    });
    body.appendChild(sec);
  });

  updateVsTotal();
  document.getElementById('variantOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeVariantSheet() {
  document.getElementById('variantOverlay').classList.remove('active');
  document.body.style.overflow = '';
  pendingProduct  = null;
  pendingVariants = {};
  pendingQty      = 1;
}

function selectVariantChip(chip, groupName) {
  chip.closest('.vs-chips').querySelectorAll('.vs-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  pendingVariants[groupName] = { label: chip.dataset.label, price: parseInt(chip.dataset.price, 10) || 0 };
  updateVsTotal();
}

function changeVsQty(delta) {
  pendingQty = Math.max(1, Math.min(20, pendingQty + delta));
  document.getElementById('vsQtyDisplay').textContent = pendingQty;
  updateVsTotal();
}

function updateVsTotal() {
  if (!pendingProduct) return;
  const extra = Object.values(pendingVariants).reduce((s, v) => s + v.price, 0);
  const total = (pendingProduct.price + extra) * pendingQty;
  document.getElementById('vsPrice').textContent      = formatPrice(pendingProduct.price);
  document.getElementById('vsTotalPrice').textContent = formatPrice(total);
}

function confirmVariantAdd() {
  if (!pendingProduct) return;
  const groups = pendingProduct.variants || [];
  for (const g of groups) {
    if (!pendingVariants[g.name]) {
      showToast(`Pilih ${g.name} dulu ya!`, 'error');
      return;
    }
  }

  const variantLabels = groups.map(g => pendingVariants[g.name].label);
  const cartKey  = variantLabels.length ? `${pendingProduct.id}|${variantLabels.join('|')}` : pendingProduct.id;
  const extraPrice = Object.values(pendingVariants).reduce((s, v) => s + v.price, 0);

  if (cart[cartKey]) cart[cartKey].qty += pendingQty;
  else cart[cartKey] = { product: pendingProduct, qty: pendingQty, variantLabels, extraPrice };

  const pid = pendingProduct.id;
  closeVariantSheet();
  syncStickyFooter();
  updateVariantBadge(pid);

  const btn = document.querySelector(`.btn-pick-variant[data-id="${pid}"]`);
  if (btn) { btn.classList.add('bounce'); btn.addEventListener('animationend', () => btn.classList.remove('bounce'), { once: true }); }
}

function updateVariantBadge(productId) {
  const badge = document.getElementById(`vbadge-${productId}`);
  if (!badge) return;
  const qty = getProductCartQty(productId);
  badge.textContent    = qty;
  badge.style.display  = qty > 0 ? 'flex' : 'none';
}

function removeCartItem(cartKey) {
  const productId = cartKey.split('|')[0];
  delete cart[cartKey];
  renderCheckoutStep();
  syncStickyFooter();
  updateVariantBadge(productId);
  if (!cartCount()) {
    goBackFromCheckout();
    showToast('Keranjang kosong. Tambah produk dulu ya!', 'info');
  }
}

// ================================================================
// PROMO CODE
// ================================================================

async function validatePromoCode() {
  const input = document.getElementById('promoCodeInput');
  const code  = input.value.trim().toUpperCase();
  if (!code) { showToast('Masukkan kode promo dulu ya!', 'error'); return; }

  const btn = document.querySelector('.promo-apply-btn');
  btn.textContent = '...';
  btn.disabled    = true;

  try {
    const { data, error } = await supabaseClient
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    const raw = cartTotal();

    if (error || !data) {
      showPromoResult('error', `Kode "${code}" tidak valid atau sudah tidak aktif.`);
      activePromo = null;
    } else if (data.min_order > 0 && raw < data.min_order) {
      showPromoResult('error', `Min. order ${formatPrice(data.min_order)} untuk pakai kode ini.`);
      activePromo = null;
    } else {
      activePromo = data;
      const discount = getDiscountAmount();
      const label    = data.discount_type === 'percent'
        ? `${data.discount_value}%` : formatPrice(data.discount_value);
      showPromoResult('success', `Yeay! Diskon ${label} berhasil diterapkan 🎉`);
    }
  } catch {
    showPromoResult('error', 'Gagal cek kode. Coba lagi ya!');
    activePromo = null;
  } finally {
    btn.textContent = 'Pakai';
    btn.disabled    = false;
    renderCheckoutTotals();
  }
}

function showPromoResult(type, msg) {
  const el = document.getElementById('promoResult');
  el.style.display = 'flex';
  if (type === 'success') {
    el.innerHTML = `<span class="promo-ok">✅ ${escapeHTML(msg)}</span><button class="promo-remove-btn" onclick="removePromo()">Hapus</button>`;
  } else {
    el.innerHTML = `<span class="promo-err">❌ ${escapeHTML(msg)}</span>`;
  }
}

function removePromo() {
  activePromo = null;
  document.getElementById('promoCodeInput').value    = '';
  document.getElementById('promoResult').style.display = 'none';
  renderCheckoutTotals();
}

// ================================================================
// GEOLOCATION — delivery address
// ================================================================

async function useMyLocation() {
  const btn      = document.getElementById('btnUseLocation');
  const textarea = document.getElementById('customerAddress');
  const verify   = document.getElementById('addressMapsVerify');

  if (!navigator.geolocation) {
    showToast('Browser kamu tidak mendukung GPS', 'error');
    return;
  }

  btn.disabled = true;
  btn.querySelector('.btn-loc-text').textContent = 'Mendeteksi lokasi...';

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;

      // Show maps verify link immediately
      verify.href = `https://maps.google.com/?q=${lat},${lng}`;
      verify.style.display = 'inline-flex';

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'id', 'User-Agent': 'BrevaCoffee/1.0' } }
        );
        const data = await res.json();

        const addr = data.address || {};
        const parts = [
          addr.road && (addr.house_number ? `${addr.road} No.${addr.house_number}` : addr.road),
          addr.suburb || addr.neighbourhood || addr.village,
          addr.city_district || addr.county,
          addr.city || addr.town || addr.municipality,
        ].filter(Boolean);

        textarea.value = parts.join(', ');
        showToast('Lokasi berhasil dideteksi! Cek dan edit jika perlu.', 'success');
      } catch {
        textarea.value = `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        showToast('Lokasi terdeteksi. Silakan edit alamat lengkapnya ya.', 'info');
      }

      // Store coords and auto-calculate shipping
      _deliveryLat = lat;
      _deliveryLng = lng;
      autoCalcShipping();

      btn.querySelector('.btn-loc-text').textContent = 'Perbarui Lokasi';
      btn.disabled = false;
    },
    (err) => {
      btn.querySelector('.btn-loc-text').textContent = 'Gunakan Lokasi Saya';
      btn.disabled = false;

      const msg = err.code === 1
        ? 'Izin lokasi ditolak. Aktifkan di pengaturan browser.'
        : 'Gagal mendapatkan lokasi. Coba lagi ya!';
      showToast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ================================================================
// LOCATIONIQ AUTOCOMPLETE — delivery address
// ================================================================

let _acTimer = null;

function onAddressInput(textarea) {
  _deliveryLat      = null;
  _deliveryLng      = null;
  _selectedShipping = null;
  const ongkirBox = document.getElementById('ongkirOptions');
  if (ongkirBox) ongkirBox.innerHTML = '';
  renderCheckoutTotals();

  const q = textarea.value;
  clearTimeout(_acTimer);
  if (q.length < 3) { hideAddressSuggestions(); return; }
  _acTimer = setTimeout(() => fetchAddressSuggestions(q), 350);
}

async function fetchAddressSuggestions(q) {
  try {
    const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=5&dedupe=1&accept-language=id&countrycodes=id`;
    const res  = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    renderAddressSuggestions(data);
  } catch { /* silent — user can still type manually */ }
}

function renderAddressSuggestions(results) {
  _acResults    = results || [];
  const box     = document.getElementById('addressSuggestions');
  if (!_acResults.length) { hideAddressSuggestions(); return; }

  box.innerHTML = _acResults.map((r, i) => {
    const label = escapeHTML(r.display_name || r.display_place || '');
    return `<div class="address-suggestion-item" onmousedown="selectAddressSuggestion(${i})">${label}</div>`;
  }).join('');
  box.style.display = 'block';
}

function selectAddressSuggestion(index) {
  const r = _acResults[index];
  if (!r) return;
  const textarea   = document.getElementById('customerAddress');
  textarea.value   = r.display_name || r.display_place || '';
  _deliveryLat     = parseFloat(r.lat);
  _deliveryLng     = parseFloat(r.lon);
  hideAddressSuggestions();
  textarea.focus();
  autoCalcShipping();
}

function hideAddressSuggestions() {
  const box = document.getElementById('addressSuggestions');
  if (box) box.style.display = 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.address-autocomplete-wrap')) hideAddressSuggestions();
});

async function onAddressBlur(textarea) {
  const q = textarea.value.trim();
  if (!q || q.length < 5) return;
  if (_deliveryLat && _deliveryLng) {
    autoCalcShipping();
    return;
  }
  // Geocode manually-typed address via LocationIQ
  try {
    const url  = `https://api.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=1&format=json&countrycodes=id&accept-language=id`;
    const res  = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.length) return;
    _deliveryLat = parseFloat(data[0].lat);
    _deliveryLng = parseFloat(data[0].lon);
    autoCalcShipping();
  } catch { /* silent — user can still proceed without ongkir */ }
}

// ================================================================
// STATIC ONGKIR — distance-based flat rate
// ================================================================

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcShippingRate(km) {
  if (km <= 3)  return 8000;
  if (km <= 6)  return 15000;
  if (km <= 10) return 22000;
  return null; // di luar jangkauan
}

function autoCalcShipping() {
  const box = document.getElementById('ongkirOptions');
  if (!box || !_deliveryLat || !_deliveryLng) return;

  const km    = haversineDistance(STORE_LAT, STORE_LNG, _deliveryLat, _deliveryLng);
  const price = calcShippingRate(km);

  if (price === null) {
    _selectedShipping = null;
    box.innerHTML = `
      <div class="ongkir-unavailable">
        <span>😔</span>
        <div>
          <strong>Di luar jangkauan delivery</strong>
          <div>${km.toFixed(1)} km dari toko — maks. 10 km</div>
        </div>
      </div>`;
    renderCheckoutTotals();
    return;
  }

  _selectedShipping = { price, label: `Flat Rate (${km.toFixed(1)} km)` };

  box.innerHTML = `
    <div class="ongkir-static-result">
      <div class="ongkir-left">
        <div class="ongkir-courier">Ongkos Kirim</div>
        <div class="ongkir-eta">${km.toFixed(1)} km dari toko</div>
      </div>
      <div class="ongkir-price">${formatPrice(price)}</div>
    </div>`;

  renderCheckoutTotals();
}

async function submitOrder() {
  const name    = document.getElementById('customerName').value.trim();
  const wa      = document.getElementById('customerWA').value.trim();
  const note    = document.getElementById('customerNote').value.trim();
  const address = orderType === 'delivery'
    ? document.getElementById('customerAddress').value.trim()
    : '';

  if (!name) {
    showToast('Masukkan nama kamu dulu ya!', 'error');
    document.getElementById('customerName').focus();
    return;
  }
  if (!wa) {
    showToast('Nomor WhatsApp wajib diisi!', 'error');
    document.getElementById('customerWA').focus();
    return;
  }
  if (orderType === 'delivery' && !address) {
    showToast('Masukkan alamat pengiriman dulu ya!', 'error');
    document.getElementById('customerAddress').focus();
    return;
  }

  const sendBtn  = document.querySelector('.btn-wa-send');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Mengirim...'; }

  const rawTotal   = cartTotal();
  const discount   = getDiscountAmount();
  const finalTotal = cartFinalTotal();
  const typeLabel  = orderType === 'pickup' ? 'Pickup' : 'Delivery';
  const orderNum   = `BRV-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  // Build clean WA message — no admin links, order number for cross-reference
  let msg = `Halo *${STORE_NAME}*! 😊\n\n`;
  msg += `*Pesanan #${orderNum}:*\n`;
  Object.entries(cart).forEach(([, { product, qty, variantLabels, extraPrice = 0 }], i) => {
    const unitPrice  = product.price + extraPrice;
    const variantStr = variantLabels?.length ? ` (${variantLabels.join(', ')})` : '';
    msg += `${i + 1}. ${product.name}${variantStr} ×${qty} — ${formatPrice(unitPrice * qty)}\n`;
  });
  if (discount > 0) {
    msg += `\nSubtotal: ${formatPrice(rawTotal)}\n`;
    msg += `Diskon (${activePromo.code}): −${formatPrice(discount)}\n`;
    msg += `*Total: ${formatPrice(finalTotal)}*\n\n`;
  } else {
    msg += `\n*Total: ${formatPrice(finalTotal)}*\n\n`;
  }
  msg += `---\n`;
  msg += `Nama: ${name}\n`;
  msg += `WhatsApp: ${wa}\n`;
  msg += `Tipe: ${typeLabel}\n`;
  msg += `Tanggal: ${selectedDateLabel}\n`;
  if (orderType === 'delivery') msg += `Alamat: ${address}\n`;
  if (note) msg += `Catatan: ${note}\n`;

  try {
    // Save to DB as pending — only becomes confirmed after admin confirms from dashboard
    const { error } = await supabaseClient.from('orders').insert({
      order_number:    orderNum,
      customer_name:   name,
      customer_wa:     wa,
      order_type:      orderType,
      order_date:      selectedDate,
      order_date_label: selectedDateLabel,
      delivery_address: orderType === 'delivery' ? address : null,
      note:            note || null,
      items: Object.entries(cart).map(([, { product, qty, variantLabels, extraPrice = 0 }]) => ({
        nm: product.name, qty, vl: variantLabels || [],
        up: product.price + (extraPrice || 0),
        sub: (product.price + (extraPrice || 0)) * qty,
      })),
      subtotal:        rawTotal,
      promo_code:      activePromo?.code || null,
      discount_amount: discount,
      total:           finalTotal,
      status:          'pending',
    });
    if (error) throw error;

    // Open WA only after order is successfully recorded
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

    // Reset
    cart = {};
    activePromo = null;
    products.forEach(p => {
      if (p.variants?.length) updateVariantBadge(p.id);
      else refreshCard(p.id);
    });
    syncStickyFooter();
    document.getElementById('customerName').value = '';
    document.getElementById('customerWA').value   = '';
    document.getElementById('customerNote').value = '';
    if (orderType === 'delivery') {
      document.getElementById('customerAddress').value = '';
      const verify = document.getElementById('addressMapsVerify');
      if (verify) { verify.style.display = 'none'; verify.href = '#'; }
      const locBtn = document.getElementById('btnUseLocation');
      if (locBtn) locBtn.querySelector('.btn-loc-text').textContent = 'Gunakan Lokasi Saya';
    }
    document.getElementById('step3').classList.remove('active');
    document.getElementById('step1').classList.add('active');
    window.scrollTo(0, 0);
    showToast('Pesanan terkirim! Tunggu konfirmasi kami ya 🎉', 'success');

  } catch (err) {
    console.error('Submit order error:', err);
    showToast('Gagal mengirim pesanan. Coba lagi ya!', 'error');
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Bayar via QRIS 💳'; }
  }
}

// ================================================================
// QRIS DINAMIS
// ================================================================

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function qrisToDynamic(staticQris, amount) {
  // Remove the 4-char CRC value at the end (keep "6304" for recalculation)
  let data = staticQris.slice(0, -4);
  // Change Point of Initiation Method: 11 (static) → 12 (dynamic)
  data = data.replace('010211', '010212');
  // Insert Transaction Amount field (tag 54) before Country Code (tag 5802)
  const amountStr = String(amount);
  data = data.replace('5802ID', `54${String(amountStr.length).padStart(2, '0')}${amountStr}5802ID`);
  // Recalculate CRC — data already ends with '6304' tag+length
  return data + crc16(data);
}

// Shared state for QRIS flow
let _qrisPendingOrder = null;

function showQrisPayment() {
  const name    = document.getElementById('customerName').value.trim();
  const wa      = document.getElementById('customerWA').value.trim();
  const note    = document.getElementById('customerNote').value.trim();
  const address = orderType === 'delivery'
    ? document.getElementById('customerAddress').value.trim() : '';
  const addressNote = orderType === 'delivery'
    ? (document.getElementById('customerAddressNote')?.value.trim() || '') : '';

  if (!name) { showToast('Isi detail pemesan dulu ya!', 'error'); openProfileModal(); return; }
  if (!wa)   { showToast('Nomor WhatsApp wajib diisi!', 'error'); openProfileModal(); return; }
  if (orderType === 'delivery' && !address) {
    showToast('Masukkan alamat pengiriman dulu ya!', 'error');
    document.getElementById('customerAddress').focus(); return;
  }
  const rawTotal     = cartTotal();
  const discount     = getDiscountAmount();
  const shippingCost = _selectedShipping?.price || 0;
  const finalTotal   = cartFinalTotal();
  const orderNum     = `BRV-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  // Store order data for use when customer confirms
  _qrisPendingOrder = {
    orderNum, name, wa, note, address, addressNote,
    rawTotal, discount, shippingCost,
    shippingLabel: _selectedShipping?.label || null,
    finalTotal,
    promoCode: activePromo?.code || null,
    cartSnapshot: Object.entries(cart).map(([, { product, qty, variantLabels, extraPrice = 0 }]) => ({
      nm: product.name, qty, vl: variantLabels || [],
      up: product.price + (extraPrice || 0),
      sub: (product.price + (extraPrice || 0)) * qty,
    })),
    cartRef: { ...cart },
  };

  // Show amount
  document.getElementById('qrisAmountText').textContent = formatPrice(finalTotal);

  // Generate dynamic QRIS and render to canvas
  try {
    const dynamicQris = qrisToDynamic(QRIS_STATIC, finalTotal);
    const qrEl = document.getElementById('qrisQR');
    qrEl.innerHTML = '';
    new QRCode(qrEl, {
      text: dynamicQris,
      width: 220, height: 220,
      colorDark: '#1a1a1a', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (e) {
    console.error('QRIS generate error:', e);
    showToast('Gagal generate QR code', 'error');
    return;
  }

  const modal = document.getElementById('qrisModal');
  modal.style.display = 'flex';
  modal.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

// ── Profile modal ──────────────────────────────────────────────
function openProfileModal() {
  document.getElementById('profileModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('customerName').focus(), 100);
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
  document.body.style.overflow = '';
}

function saveProfile() {
  const name = document.getElementById('customerName').value.trim();
  const wa   = document.getElementById('customerWA').value.trim();
  if (!name) { showToast('Nama wajib diisi!', 'error'); document.getElementById('customerName').focus(); return; }
  if (!wa)   { showToast('Nomor WhatsApp wajib diisi!', 'error'); document.getElementById('customerWA').focus(); return; }
  const card = document.getElementById('profileCard');
  document.getElementById('profileCardName').textContent = name;
  document.getElementById('profileCardSub').textContent  = wa;
  card.classList.add('is-filled');
  closeProfileModal();
}
// ───────────────────────────────────────────────────────────────

function saveQrisImage() {
  const canvas = document.querySelector('#qrisQR canvas');
  if (!canvas) { showToast('QR belum siap', 'error'); return; }
  const link = document.createElement('a');
  link.download = `QRIS-BrevaCoffee-${_qrisPendingOrder?.orderNum || 'payment'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function goBackFromQris() {
  document.getElementById('qrisModal').style.display = 'none';
  document.body.style.overflow = '';
  _qrisPendingOrder = null;
}

// WA URL stored after order saved, used by sendWhatsAppProof()
let _ossWaUrl = null;

async function confirmQrisPayment() {
  if (!_qrisPendingOrder) return;
  const o   = _qrisPendingOrder;
  const btn = document.getElementById('btnQrisConfirm');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  const typeLabel = orderType === 'pickup' ? 'Pickup' : 'Delivery';

  let msg = `Halo *${STORE_NAME}*! 😊\n\n`;
  msg += `✅ Saya sudah bayar via QRIS untuk pesanan berikut:\n\n`;
  msg += `*Pesanan #${o.orderNum}:*\n`;
  o.cartSnapshot.forEach((it, i) => {
    const v = it.vl?.length ? ` (${it.vl.join(', ')})` : '';
    msg += `${i + 1}. ${it.nm}${v} ×${it.qty} — ${formatPrice(it.sub)}\n`;
  });
  msg += `\nSubtotal: ${formatPrice(o.rawTotal)}\n`;
  if (o.discount > 0) {
    msg += `Diskon (${o.promoCode}): −${formatPrice(o.discount)}\n`;
  }
  if (o.shippingCost > 0) {
    msg += `Ongkir (${o.shippingLabel}): ${formatPrice(o.shippingCost)}\n`;
  }
  msg += `*Total: ${formatPrice(o.finalTotal)}*\n\n`;
  msg += `---\n`;
  msg += `Nama: ${o.name}\n`;
  msg += `WhatsApp: ${o.wa}\n`;
  msg += `Tipe: ${typeLabel}\n`;
  msg += `Tanggal: ${selectedDateLabel}\n`;
  if (orderType === 'delivery') {
    msg += `Alamat: ${o.address}\n`;
    if (o.addressNote) msg += `Catatan alamat: ${o.addressNote}\n`;
    if (o.shippingLabel) msg += `Kurir: ${o.shippingLabel}\n`;
  }
  if (o.note) msg += `Catatan: ${o.note}\n`;

  try {
    const { error } = await supabaseClient.from('orders').insert({
      order_number:     o.orderNum,
      customer_name:    o.name,
      customer_wa:      o.wa,
      order_type:       orderType,
      order_date:       selectedDate,
      order_date_label: selectedDateLabel,
      delivery_address: orderType === 'delivery' ? o.address : null,
      note:             o.note || null,
      items:            o.cartSnapshot,
      subtotal:         o.rawTotal,
      promo_code:       o.promoCode,
      discount_amount:  o.discount,
      shipping_cost:    o.shippingCost || null,
      shipping_label:   o.shippingLabel || null,
      total:            o.finalTotal,
      status:           'pending',
    });
    if (error) throw error;

    _ossWaUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
    document.getElementById('qrisModal').style.display = 'none';
    document.body.style.overflow = '';
    showOrderSummary(o);

  } catch (err) {
    console.error('Confirm QRIS error:', err);
    showToast('Gagal menyimpan pesanan. Coba lagi ya!', 'error');
    btn.disabled    = false;
    btn.textContent = 'Konfirmasi Pesanan';
  }
}

function showOrderSummary(o) {
  // Subtitle
  document.getElementById('ossSubtitle').innerHTML =
    `Pesanan <strong>#${escapeHTML(o.orderNum)}</strong> belum kami proses sampai kamu kirim <strong>foto bukti pembayaran QRIS</strong> via WhatsApp.`;

  // Code
  document.getElementById('ossCode').textContent = o.orderNum;

  // Delivery / Pickup section
  const deliverySection = document.getElementById('ossDeliverySection');
  const deliveryHeader  = document.getElementById('ossDeliveryHeader');
  if (orderType === 'delivery' && o.address) {
    deliverySection.style.display = '';
    deliveryHeader.innerHTML = '<span>🛵</span> PENGIRIMAN';
    const storeMapsLink = STORE_MAPS_URL
      ? `<a href="${escapeHTML(STORE_MAPS_URL)}" target="_blank" rel="noopener" style="color:#a05230;word-break:break-all">${escapeHTML(STORE_ADDRESS)}</a>`
      : escapeHTML(STORE_ADDRESS);
    const rows = [
      ['Dari',     null, storeMapsLink],
      ['Penerima', o.name],
      ['Telepon',  o.wa],
      ['Alamat',   o.address],
      ...(o.addressNote ? [['Catatan alamat', o.addressNote]] : []),
      ...(o.shippingLabel ? [['Kurir', o.shippingLabel]] : []),
      ['Tanggal',  selectedDateLabel],
    ];
    document.getElementById('ossDeliveryRows').innerHTML = rows.map(([label, val, rawHtml]) =>
      `<div class="oss-row">
        <span class="oss-row-label">${escapeHTML(label)}</span>
        <span class="oss-row-value">${rawHtml ?? escapeHTML(val || '')}</span>
      </div>`
    ).join('');
  } else if (orderType === 'pickup') {
    deliverySection.style.display = '';
    deliveryHeader.innerHTML = '<span>🏠</span> LOKASI PICKUP';
    const mapsLink = STORE_MAPS_URL
      ? `<a href="${escapeHTML(STORE_MAPS_URL)}" target="_blank" rel="noopener" style="color:#a05230;word-break:break-all">${escapeHTML(STORE_ADDRESS)}</a>`
      : escapeHTML(STORE_ADDRESS);
    document.getElementById('ossDeliveryRows').innerHTML = `
      <div class="oss-row">
        <span class="oss-row-label">Toko</span>
        <span class="oss-row-value">${escapeHTML(STORE_NAME)}</span>
      </div>
      <div class="oss-row">
        <span class="oss-row-label">Alamat</span>
        <span class="oss-row-value">${mapsLink}</span>
      </div>
      <div class="oss-row">
        <span class="oss-row-label">Jam Buka</span>
        <span class="oss-row-value">${escapeHTML(STORE_OPEN_HOURS)}</span>
      </div>
      <div class="oss-row">
        <span class="oss-row-label">Tanggal</span>
        <span class="oss-row-value">${escapeHTML(selectedDateLabel)}</span>
      </div>`;
  } else {
    deliverySection.style.display = 'none';
  }

  // Items
  document.getElementById('ossItems').innerHTML = o.cartSnapshot.map(it => {
    const varHTML = it.vl?.length
      ? it.vl.map(v => `<div class="oss-item-var">— ${escapeHTML(v)}</div>`).join('')
      : `<div class="oss-item-meta">× ${it.qty}</div>`;
    return `
      <div class="oss-item">
        <div class="oss-item-left">
          <div class="oss-item-name">${escapeHTML(it.nm)}</div>
          ${varHTML}
        </div>
        <div class="oss-item-price">${formatPrice(it.sub)}</div>
      </div>`;
  }).join('');

  // Totals
  let totalsHTML = '<div class="oss-totals">';
  if (o.discount > 0 || o.shippingCost > 0) {
    totalsHTML += `<div class="oss-total-line"><span>Subtotal</span><span>${formatPrice(o.rawTotal)}</span></div>`;
    if (o.discount > 0)
      totalsHTML += `<div class="oss-total-line"><span>Diskon</span><span>−${formatPrice(o.discount)}</span></div>`;
    if (o.shippingCost > 0)
      totalsHTML += `<div class="oss-total-line"><span>Ongkir</span><span>${formatPrice(o.shippingCost)}</span></div>`;
  }
  totalsHTML += `<div class="oss-grand-total"><span>Total</span><span>${formatPrice(o.finalTotal)}</span></div>`;
  totalsHTML += '</div>';
  document.getElementById('ossTotals').innerHTML = totalsHTML;

  document.getElementById('orderSummaryModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function sendWhatsAppProof() {
  if (_ossWaUrl) window.open(_ossWaUrl, '_blank');
  closeOrderSummary();
  showToast('Pesanan dikonfirmasi! Kirim bukti bayar via WA ya 🎉', 'success');
}

function closeOrderSummary() {
  document.getElementById('orderSummaryModal').style.display = 'none';
  document.body.style.overflow = '';
  _ossWaUrl = null;

  // Reset all state
  cart = {};
  activePromo = null;
  _selectedShipping = null;

  products.forEach(p => {
    if (p.variants?.length) updateVariantBadge(p.id);
    else refreshCard(p.id);
  });
  syncStickyFooter();
  document.getElementById('customerName').value = '';
  document.getElementById('customerWA').value   = '';
  document.getElementById('customerNote').value = '';
  if (orderType === 'delivery') {
    document.getElementById('customerAddress').value = '';
    const verify = document.getElementById('addressMapsVerify');
    if (verify) { verify.style.display = 'none'; verify.href = '#'; }
    const locBtn = document.getElementById('btnUseLocation');
    if (locBtn) locBtn.querySelector('.btn-loc-text').textContent = 'Gunakan Lokasi Saya';
    _deliveryLat = null; _deliveryLng = null;
    const ongkirBox = document.getElementById('ongkirOptions');
    if (ongkirBox) ongkirBox.innerHTML = '';
  }
  document.getElementById('step3').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  window.scrollTo(0, 0);
}

function copyOrderCode() {
  const code = document.getElementById('ossCode').textContent;
  const copyBtn = document.querySelector('.btn-oss-copy');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => {
      showToast('Kode pesanan disalin!', 'success');
      if (copyBtn) { copyBtn.textContent = '✅ Disalin'; setTimeout(() => { copyBtn.textContent = '📋 Salin'; }, 2000); }
    });
  } else {
    const el = document.createElement('input');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Kode pesanan disalin!', 'success');
  }
}

// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  renderDateChips();
  loadSettings();

  // WA help buttons
  const waMsg = `Halo ${STORE_NAME}, saya butuh bantuan untuk pemesanan!`;
  const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(waMsg)}`;
  const btn1  = document.getElementById('waHelpBtn1');
  const btn2  = document.getElementById('waHelpBtn2');
  if (btn1) btn1.href = waUrl;
  if (btn2) btn2.href = waUrl;

  // Social media footer links (DB settings override config.js defaults)
  document.querySelectorAll('.footer-ig').forEach(el => { el.href = appSettings?.instagram_url || INSTAGRAM_URL; });
  document.querySelectorAll('.footer-tt').forEach(el => { el.href = appSettings?.tiktok_url    || TIKTOK_URL; });
});
