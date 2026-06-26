// ================================================
// BREVA COFFEE — CATALOG PAGE (3-step flow)
// ================================================

// ---- STATE ----
let orderType         = null;   // 'pickup' | 'delivery'
let selectedDate      = null;   // 'YYYY-MM-DD'
let selectedDateLabel = null;   // human-readable label
let products          = [];
let cart              = {};
let productsLoaded    = false;
let appSettings       = null;   // loaded from settings table

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
    document.getElementById('pickupAddr').textContent  = STORE_ADDRESS;
    document.getElementById('pickupHours').textContent = STORE_OPEN_HOURS;
    document.getElementById('pickupMapsLink').href     = STORE_MAPS_URL;
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

  const qty = cart[product.id]?.qty || 0;

  let badgeHTML = '';
  if (product.is_bestseller) badgeHTML = '<div class="product-badge badge-bestseller">⭐ Terlaris</div>';
  else if (product.is_new)   badgeHTML = '<div class="product-badge badge-new">✨ New</div>';

  const imgHTML = product.image_url
    ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const phHTML = `<span class="product-image-placeholder" ${product.image_url ? 'style="display:none"' : ''}>☕</span>`;

  card.innerHTML = `
    ${badgeHTML}
    <div class="product-image-wrap">${imgHTML}${phHTML}</div>
    <div class="product-info">
      <div class="product-name">${escapeHTML(product.name)}</div>
      <div class="product-price">${formatPrice(product.price)}</div>
    </div>
    <div class="product-controls">
      <button class="qty-btn minus${qty === 0 ? ' minus-disabled' : ''}"
        onclick="updateQty('${product.id}',-1,this)" aria-label="Kurangi">−</button>
      <span class="qty-display" id="qty-${product.id}">${qty}</span>
      <button class="qty-btn plus" onclick="updateQty('${product.id}',1,this)" aria-label="Tambah">+</button>
    </div>`;

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
function cartTotal()  { return Object.values(cart).reduce((s, { product, qty }) => s + product.price * qty, 0); }

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
}

function renderCheckoutStep() {
  // Date & type
  document.getElementById('coDate').textContent = selectedDateLabel || '-';

  if (orderType === 'pickup') {
    document.getElementById('coTypeIcon').textContent  = '🏠';
    document.getElementById('coTypeValue').textContent = 'Pickup';

    document.getElementById('coPickupAddr').textContent = STORE_ADDRESS;
    const mapsLink = document.getElementById('coMapsLink');
    mapsLink.href = STORE_MAPS_URL;
    document.getElementById('coPickupCard').style.display  = 'block';
    document.getElementById('coDeliveryInput').style.display = 'none';
  } else {
    document.getElementById('coTypeIcon').textContent  = '🛵';
    document.getElementById('coTypeValue').textContent = 'Delivery';

    document.getElementById('coPickupCard').style.display  = 'none';
    document.getElementById('coDeliveryInput').style.display = 'block';
  }

  // Items list
  const items = Object.values(cart);
  const list  = document.getElementById('coItemsList');

  list.innerHTML = items.map(({ product, qty }) => {
    const img = product.image_url
      ? `<img class="co-item-img" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const ph = `<div class="co-item-img co-item-img-ph" ${product.image_url ? 'style="display:none"' : ''}>☕</div>`;
    return `
      <div class="co-item">
        ${img}${ph}
        <div class="co-item-info">
          <div class="co-item-name">${escapeHTML(product.name)}</div>
          <div class="co-item-qty">× ${qty}</div>
        </div>
        <div class="co-item-price">${formatPrice(product.price * qty)}</div>
      </div>`;
  }).join('');

  document.getElementById('coTotalAmount').textContent = formatPrice(cartTotal());
}

function submitOrder() {
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

  const items     = Object.values(cart);
  const total     = cartTotal();
  const typeLabel = orderType === 'pickup' ? 'Pickup' : 'Delivery';

  let msg = `Halo *${STORE_NAME}*! 😊\n\n`;
  msg += `*Pesanan:*\n`;
  items.forEach(({ product, qty }, i) => {
    msg += `${i + 1}. ${product.name} ×${qty} — ${formatPrice(product.price * qty)}\n`;
  });
  msg += `\n*Total: ${formatPrice(total)}*\n\n`;
  msg += `---\n`;
  msg += `Nama: ${name}\n`;
  msg += `WhatsApp: ${wa}\n`;
  msg += `Tipe: ${typeLabel}\n`;
  msg += `Tanggal: ${selectedDateLabel}\n`;
  if (orderType === 'delivery') msg += `Alamat: ${address}\n`;
  if (note) msg += `Catatan: ${note}\n`;

  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

  // Reset after send
  cart = {};
  products.forEach(p => refreshCard(p.id));
  syncStickyFooter();

  document.getElementById('customerName').value    = '';
  document.getElementById('customerWA').value      = '';
  document.getElementById('customerNote').value    = '';
  if (orderType === 'delivery') document.getElementById('customerAddress').value = '';

  // Go back to step 1 for a fresh order
  document.getElementById('step3').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  window.scrollTo(0, 0);

  showToast('Pesanan terkirim! Tunggu konfirmasi kami ya 🎉', 'success');
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

  // Social media footer links
  document.querySelectorAll('.footer-ig').forEach(el => { el.href = INSTAGRAM_URL; });
  document.querySelectorAll('.footer-tt').forEach(el => { el.href = TIKTOK_URL; });
});
