// ================================================
// BREVA COFFEE — CATALOG PAGE
// ================================================

// ---- STATE ----
let orderType        = null;   // 'pickup' | 'delivery'
let selectedDate     = null;   // 'YYYY-MM-DD'
let selectedDateLabel = null;  // human-readable label
let products         = [];
let cart             = {};
let cartOpen         = false;
let productsLoaded   = false;

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
// STEP 1 — ORDER TYPE & DATE
// ================================================================

function selectOrderType(card) {
  // Deselect all
  document.querySelectorAll('.order-type-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  orderType = card.dataset.type;

  // Show/hide pickup address
  const addrCard = document.getElementById('pickupAddressCard');
  if (orderType === 'pickup') {
    document.getElementById('pickupAddr').textContent    = STORE_ADDRESS;
    document.getElementById('pickupHours').textContent   = STORE_OPEN_HOURS;
    document.getElementById('pickupMapsLink').href       = STORE_MAPS_URL;
    addrCard.classList.add('visible');
  } else {
    addrCard.classList.remove('visible');
  }

  // Show date section with correct label
  const dateSection = document.getElementById('dateSection');
  document.getElementById('dateSectionLabel').textContent =
    orderType === 'pickup' ? 'Pilih Tanggal Pickup' : 'Pilih Tanggal Delivery';
  dateSection.classList.add('visible');

  checkStep1Ready();
}

function renderDateChips() {
  const wrap = document.getElementById('dateChips');
  wrap.innerHTML = '';
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const chip = document.createElement('div');
    const dateStr = d.toISOString().split('T')[0];

    if (i === 0 || i === 1) {
      const label = i === 0 ? 'Hari ini' : 'Besok';
      chip.className = `date-chip ${i === 0 ? 'chip-today' : 'chip-tomorrow'}`;
      chip.dataset.label = `${label}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      chip.innerHTML = `
        <span class="dc-label">${label}</span>
        <span class="dc-sublabel">${d.getDate()} ${MONTHS[d.getMonth()]}</span>
      `;
    } else {
      chip.className = 'date-chip';
      chip.dataset.label = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      chip.innerHTML = `
        <span class="dc-day">${DAYS[d.getDay()]}</span>
        <span class="dc-date">${d.getDate()}</span>
        <span class="dc-month">${MONTHS[d.getMonth()]}</span>
      `;
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

  // Update topbar
  document.getElementById('topbarType').textContent =
    orderType === 'pickup' ? '🏠 Pickup' : '🛵 Delivery';
  document.getElementById('topbarDate').textContent = selectedDateLabel;

  // Show address field only for delivery
  document.getElementById('addressGroup').style.display =
    orderType === 'delivery' ? 'block' : 'none';

  // Switch step
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('floatingCart').style.display = 'block';

  window.scrollTo(0, 0);

  // Load products once
  if (!productsLoaded) {
    loadProducts();
    productsLoaded = true;
  }
}

function goBack() {
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  document.getElementById('floatingCart').style.display = 'none';

  // Close cart if open
  if (cartOpen) toggleCart();

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
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
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
    </div>
  `;
  return card;
}

function refreshCard(productId) {
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
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
  syncCartUI();
  if (cartOpen) renderCartItems();
}

function cartCount() { return Object.values(cart).reduce((s, { qty }) => s + qty, 0); }
function cartTotal()  { return Object.values(cart).reduce((s, { product, qty }) => s + product.price * qty, 0); }

function syncCartUI() {
  const count = cartCount();
  const badge = document.getElementById('cartBadge');
  const prev  = parseInt(badge.textContent) || 0;

  badge.textContent = count;
  if (count === 0) {
    badge.classList.add('hidden');
  } else {
    badge.classList.remove('hidden');
    if (count !== prev) {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
  }

  document.getElementById('cartTotalAmount').textContent = formatPrice(cartTotal());
  const btn = document.getElementById('checkoutBtn');
  if (btn) btn.disabled = count === 0;
}

function renderCartItems() {
  const list  = document.getElementById('cartItemsList');
  const items = Object.values(cart);

  if (!items.length) {
    list.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><p>Keranjangmu kosong</p></div>`;
    return;
  }

  list.innerHTML = items.map(({ product, qty }) => {
    const img = product.image_url
      ? `<img class="cart-item-img" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">`
      : `<div class="cart-item-img">☕</div>`;
    return `
      <div class="cart-item">
        ${img}
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHTML(product.name)}</div>
          <div class="cart-item-price">${formatPrice(product.price * qty)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn minus" onclick="updateQty('${product.id}',-1,this)">−</button>
          <span class="qty-display">${qty}</span>
          <button class="qty-btn plus"  onclick="updateQty('${product.id}',1,this)">+</button>
        </div>
      </div>`;
  }).join('');
}

function toggleCart() {
  cartOpen = !cartOpen;
  document.getElementById('cartPanel').classList.toggle('active', cartOpen);
  document.getElementById('cartOverlay').classList.toggle('active', cartOpen);
  document.body.style.overflow = cartOpen ? 'hidden' : '';
  if (cartOpen) renderCartItems();
}

// ================================================================
// CHECKOUT
// ================================================================

function openCheckout() {
  if (!cartCount()) return;
  if (cartOpen) toggleCart();
  renderOrderSummary();
  document.getElementById('checkoutModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('customerName').focus();
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('active');
  document.body.style.overflow = '';
}

function renderOrderSummary() {
  const items = Object.values(cart);
  const total = cartTotal();

  const typeLabel = orderType === 'pickup' ? '🏠 Pickup' : '🛵 Delivery';

  document.getElementById('orderSummary').innerHTML = `
    <div class="order-meta">
      <span class="order-meta-pill">${typeLabel}</span>
      <span class="order-meta-pill">📅 ${selectedDateLabel}</span>
    </div>
    <div class="order-summary-title">Pesanan</div>
    ${items.map(({ product, qty }) => `
      <div class="order-summary-item">
        <span>${escapeHTML(product.name)} ×${qty}</span>
        <span>${formatPrice(product.price * qty)}</span>
      </div>`).join('')}
    <div class="order-summary-total">
      <span>Total</span>
      <span>${formatPrice(total)}</span>
    </div>
  `;
}

function submitOrder(event) {
  event.preventDefault();

  const name    = document.getElementById('customerName').value.trim();
  const wa      = document.getElementById('customerWA').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const note    = document.getElementById('customerNote').value.trim();

  if (!name || !wa) return;
  if (orderType === 'delivery' && !address) {
    document.getElementById('customerAddress').focus();
    return;
  }

  const items = Object.values(cart);
  const total = cartTotal();
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
  if (orderType === 'delivery' && address) msg += `Alamat: ${address}\n`;
  if (note) msg += `Catatan: ${note}\n`;

  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

  // Reset
  closeCheckout();
  cart = {};
  syncCartUI();
  products.forEach(p => refreshCard(p.id));
  document.getElementById('checkoutForm').reset();
  showToast('Pesanan terkirim! Tunggu konfirmasi dari kami ya 🎉', 'success');
}

// ---- CLOSE CHECKOUT ON OVERLAY CLICK ----
document.getElementById('checkoutModal').addEventListener('click', function (e) {
  if (e.target === this) closeCheckout();
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', renderDateChips);
