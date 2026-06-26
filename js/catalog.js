// ================================================
// BREVA COFFEE — CATALOG PAGE
// ================================================

// ---- STATE ----
let products       = [];
let cart           = {};   // { [productId]: { product, qty } }
let cartOpen       = false;
let deliveryMethod = 'Ambil Sendiri';

// ---- HELPERS ----
function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(price);
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

// ---- LOAD PRODUCTS ----
async function loadProducts() {
  const grid = document.getElementById('productsGrid');

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    products = data || [];
    grid.innerHTML = '';

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="catalog-empty">
          <span class="catalog-empty-icon">☕</span>
          <h3>Menu segera hadir!</h3>
          <p>Produk sedang kami siapkan dengan penuh cinta.</p>
        </div>`;
      return;
    }

    products.forEach((product, i) => {
      const card = buildProductCard(product, i);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML = `
      <div class="catalog-error">
        <span class="catalog-error-icon">😔</span>
        <h3>Gagal memuat menu</h3>
        <p>Coba refresh halaman ini ya!</p>
      </div>`;
  }
}

// ---- BUILD PRODUCT CARD ----
function buildProductCard(product, index) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.id = product.id;
  card.style.animationDelay = `${Math.min(index, 8) * 65}ms`;

  const qty = cart[product.id]?.qty || 0;

  // Badge (bestseller takes priority)
  let badgeHTML = '';
  if (product.is_bestseller) {
    badgeHTML = '<div class="product-badge badge-bestseller">⭐ Terlaris</div>';
  } else if (product.is_new) {
    badgeHTML = '<div class="product-badge badge-new">✨ New</div>';
  }

  // Image
  const imgHTML = product.image_url
    ? `<img
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
       >
       <span class="product-image-placeholder" style="display:none">☕</span>`
    : `<span class="product-image-placeholder">☕</span>`;

  card.innerHTML = `
    ${badgeHTML}
    <div class="product-image-wrap">
      ${imgHTML}
    </div>
    <div class="product-info">
      <h3 class="product-name">${escapeHTML(product.name)}</h3>
      <p class="product-price">${formatPrice(product.price)}</p>
    </div>
    <div class="product-controls">
      <button
        class="qty-btn minus${qty === 0 ? ' minus-disabled' : ''}"
        onclick="updateQty('${product.id}', -1, this)"
        aria-label="Kurangi"
      >−</button>
      <span class="qty-display" id="qty-${product.id}">${qty}</span>
      <button
        class="qty-btn plus"
        onclick="updateQty('${product.id}', 1, this)"
        aria-label="Tambah"
      >+</button>
    </div>
  `;

  return card;
}

// ---- REFRESH A SINGLE CARD ----
function refreshCard(productId) {
  const oldCard = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (!oldCard) return;
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const index = parseInt(oldCard.style.animationDelay) || 0;
  const newCard = buildProductCard(product, index);
  newCard.style.animationDelay = oldCard.style.animationDelay;
  newCard.style.animation = 'none'; // don't re-animate on refresh
  oldCard.replaceWith(newCard);
}

// ---- CART LOGIC ----
function updateQty(productId, delta, btnEl) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const prev = cart[productId]?.qty || 0;
  const next = Math.max(0, prev + delta);

  if (next === 0) {
    delete cart[productId];
  } else {
    cart[productId] = { product, qty: next };
  }

  // Bounce animation on the clicked button
  if (btnEl) {
    btnEl.classList.add('bounce');
    btnEl.addEventListener('animationend', () => btnEl.classList.remove('bounce'), { once: true });
  }

  refreshCard(productId);
  syncCartUI();

  // If cart panel is open, re-render items live
  if (cartOpen) renderCartItems();
}

function cartCount() {
  return Object.values(cart).reduce((s, { qty }) => s + qty, 0);
}

function cartTotal() {
  return Object.values(cart).reduce((s, { product, qty }) => s + product.price * qty, 0);
}

function syncCartUI() {
  const count = cartCount();

  // Badge
  const badge = document.getElementById('cartBadge');
  const prev  = parseInt(badge.textContent) || 0;
  badge.textContent = count;

  if (count === 0) {
    badge.classList.add('hidden');
  } else {
    badge.classList.remove('hidden');
    if (count !== prev) {
      badge.classList.remove('pop');
      void badge.offsetWidth;      // force reflow to restart animation
      badge.classList.add('pop');
    }
  }

  // Total
  document.getElementById('cartTotalAmount').textContent = formatPrice(cartTotal());

  // Checkout button
  const btn = document.getElementById('checkoutBtn');
  if (btn) btn.disabled = count === 0;
}

// ---- RENDER CART ITEMS ----
function renderCartItems() {
  const list  = document.getElementById('cartItemsList');
  const items = Object.values(cart);

  if (items.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-icon">🛒</span>
        <p>Keranjangmu masih kosong</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map(({ product, qty }) => {
    const imgEl = product.image_url
      ? `<img class="cart-item-img" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">`
      : `<div class="cart-item-img">☕</div>`;

    return `
      <div class="cart-item">
        ${imgEl}
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHTML(product.name)}</div>
          <div class="cart-item-price">${formatPrice(product.price * qty)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn minus${qty <= 1 ? '' : ''}" onclick="updateQty('${product.id}', -1, this)">−</button>
          <span class="qty-display">${qty}</span>
          <button class="qty-btn plus" onclick="updateQty('${product.id}', 1, this)">+</button>
        </div>
      </div>`;
  }).join('');
}

// ---- TOGGLE CART PANEL ----
function toggleCart() {
  cartOpen = !cartOpen;
  document.getElementById('cartPanel').classList.toggle('active', cartOpen);
  document.getElementById('cartOverlay').classList.toggle('active', cartOpen);
  document.body.style.overflow = cartOpen ? 'hidden' : '';
  if (cartOpen) renderCartItems();
}

// ---- CHECKOUT ----
function openCheckout() {
  if (cartCount() === 0) return;
  if (cartOpen) toggleCart();   // close cart panel first

  renderOrderSummary();

  const modal = document.getElementById('checkoutModal');
  modal.classList.add('active');
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

  document.getElementById('orderSummary').innerHTML = `
    <div class="order-summary-title">Ringkasan Pesanan</div>
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

function selectDelivery(el) {
  document.querySelectorAll('.delivery-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  deliveryMethod = el.dataset.value;

  const addressGroup = document.getElementById('addressGroup');
  const addressInput = document.getElementById('customerAddress');

  if (deliveryMethod === 'Dikirim') {
    addressGroup.style.display = 'block';
    addressInput.required = true;
  } else {
    addressGroup.style.display = 'none';
    addressInput.required = false;
    addressInput.value = '';
  }
}

function submitOrder(event) {
  event.preventDefault();

  const name    = document.getElementById('customerName').value.trim();
  const wa      = document.getElementById('customerWA').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const note    = document.getElementById('customerNote').value.trim();

  if (!name || !wa) return;
  if (deliveryMethod === 'Dikirim' && !address) {
    document.getElementById('customerAddress').focus();
    return;
  }

  const items = Object.values(cart);
  const total = cartTotal();

  // Build WhatsApp message
  let msg = `Halo *${STORE_NAME}*! 😊\n\n`;
  msg += `Berikut pesanan saya:\n\n`;
  items.forEach(({ product, qty }, i) => {
    msg += `${i + 1}. ${product.name} ×${qty} — ${formatPrice(product.price * qty)}\n`;
  });
  msg += `\n*Total: ${formatPrice(total)}*\n`;
  msg += `\n---\n`;
  msg += `Nama: ${name}\n`;
  msg += `WhatsApp: ${wa}\n`;
  msg += `Pengiriman: ${deliveryMethod}\n`;
  if (deliveryMethod === 'Dikirim' && address) msg += `Alamat: ${address}\n`;
  if (note) msg += `Catatan: ${note}\n`;

  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

  // Reset
  closeCheckout();
  cart = {};
  syncCartUI();

  // Reset product qty displays
  products.forEach(p => refreshCard(p.id));

  // Reset form fields (keep delivery choice as-is)
  document.getElementById('checkoutForm').reset();
  deliveryMethod = 'Ambil Sendiri';
  document.querySelectorAll('.delivery-option').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.getElementById('addressGroup').style.display = 'none';

  showToast('Pesanan terkirim! Sebentar lagi kami hubungi kamu 🎉', 'success');
}

// ---- CLOSE MODAL ON OVERLAY CLICK ----
document.getElementById('checkoutModal').addEventListener('click', function (e) {
  if (e.target === this) closeCheckout();
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', loadProducts);
