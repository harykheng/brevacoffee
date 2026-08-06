// ================================================
// BREVA COFFEE — ADMIN DASHBOARD
// ================================================

// ---- STATE ----
let adminProducts      = [];
let adminPromos        = [];
let adminOrders        = [];
let editingProductId   = null;
let editingPromoId     = null;
let selectedFile       = null;
let selectedLogoFile   = null;
let selectedBannerFile = null;
let confirmCallback    = null;
let currentOrderFilter = 'pending';
let currentDetailOrder = null;

// ---- HELPERS ----
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
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3500);
}

// ---- AUTH ----
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showDashboard(session.user);
    loadAdminProducts();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminLayout').classList.remove('active');
}

function showDashboard(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminLayout').classList.add('active');
  document.getElementById('adminUserEmail').textContent = user.email;
}

async function handleLogin(event) {
  event.preventDefault();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl  = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  btn.textContent = 'Masuk...';
  btn.disabled    = true;
  errorEl.style.display = 'none';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showDashboard(data.user);
    loadAdminProducts();
  } catch {
    errorEl.textContent   = 'Email atau password salah. Coba lagi!';
    errorEl.style.display = 'block';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  } finally {
    btn.textContent = 'Masuk';
    btn.disabled    = false;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showLogin();
  showToast('Berhasil keluar', 'info');
}

// ---- LOAD PRODUCTS ----
async function loadAdminProducts() {
  const loadingEl = document.getElementById('adminLoadingState');
  const emptyEl   = document.getElementById('emptyAdminState');
  const grid      = document.getElementById('adminProductsGrid');

  loadingEl.style.display = 'flex';
  emptyEl.classList.remove('visible');
  grid.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    adminProducts = data || [];
    loadingEl.style.display = 'none';

    const count = adminProducts.length;
    document.getElementById('productCount').textContent =
      count === 0 ? '0 produk' : `${count} produk`;

    if (count === 0) {
      emptyEl.classList.add('visible');
      return;
    }

    adminProducts.forEach((product, i) => {
      const card = buildAdminCard(product, i);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('Load products failed:', err);
    loadingEl.style.display = 'none';
    showToast('Gagal memuat produk: ' + err.message, 'error');
    document.getElementById('productCount').textContent = 'Gagal memuat';
  }
}

// ---- BUILD ADMIN CARD ----
function buildAdminCard(product, index) {
  const card = document.createElement('div');
  card.className = 'admin-product-card';
  card.style.animationDelay = `${Math.min(index, 6) * 55}ms`;

  const imgEl = product.image_url
    ? `<img
        class="admin-product-img"
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        onerror="this.outerHTML='<div class=\\'admin-product-img\\'>☕</div>'"
       >`
    : `<div class="admin-product-img">☕</div>`;

  const descHtml = product.description
    ? `<div class="admin-product-desc">${escapeHTML(product.description)}</div>` : '';

  const tags = [
    product.is_new         ? '<span class="admin-tag tag-new">✨ New</span>'           : '',
    product.is_bestseller  ? '<span class="admin-tag tag-bestseller">⭐ Terlaris</span>' : '',
    product.is_visible
      ? '<span class="admin-tag tag-visible">👁 Tampil</span>'
      : '<span class="admin-tag tag-hidden">🙈 Disembunyikan</span>',
  ].join('');

  card.innerHTML = `
    ${imgEl}
    <div class="admin-product-info">
      <div class="admin-product-name">${escapeHTML(product.name)}</div>
      ${descHtml}
      <div class="admin-product-price">${formatPrice(product.price)}</div>
      <div class="admin-product-tags">${tags}</div>
      <div class="admin-product-actions">
        <button class="btn-sm btn-edit"   onclick="openProductForm('${product.id}')">✏️ Edit</button>
        <button class="btn-sm btn-delete" onclick="confirmDelete('${product.id}', \`${escapeHTML(product.name)}\`)">🗑️ Hapus</button>
      </div>
    </div>
  `;

  return card;
}

// ================================================================
// VARIANT BUILDER
// ================================================================

function addVariantGroup() {
  const list  = document.getElementById('variantGroups');
  const group = document.createElement('div');
  group.className = 'variant-group';
  group.innerHTML = `
    <div class="variant-group-head">
      <input type="text" class="variant-group-name form-input" placeholder="Nama varian (contoh: Ukuran)">
      <button type="button" class="variant-group-del" onclick="this.closest('.variant-group').remove()">✕</button>
    </div>
    <div class="variant-opts-list"></div>
    <button type="button" class="btn-add-variant-opt" onclick="addVariantOption(this)">+ Tambah Opsi</button>`;
  list.appendChild(group);
  addVariantOption(group.querySelector('.btn-add-variant-opt'));
  group.querySelector('.variant-group-name').focus();
}

function addVariantOption(btn) {
  const optList = btn.closest('.variant-group').querySelector('.variant-opts-list');
  const row = document.createElement('div');
  row.className = 'variant-opt-row';
  row.innerHTML = `
    <input type="text"   class="variant-opt-label form-input" placeholder="Nama opsi (contoh: Medium)">
    <div class="variant-opt-price-wrap">
      <span class="variant-opt-plus">+Rp</span>
      <input type="number" class="variant-opt-price form-input" placeholder="0" min="0" step="500" value="0">
    </div>
    <button type="button" class="variant-opt-del" onclick="this.closest('.variant-opt-row').remove()">✕</button>`;
  optList.appendChild(row);
  row.querySelector('.variant-opt-label').focus();
}

function getVariantsFromForm() {
  const result = [];
  document.querySelectorAll('#variantGroups .variant-group').forEach(g => {
    const name = g.querySelector('.variant-group-name').value.trim();
    if (!name) return;
    const options = [];
    g.querySelectorAll('.variant-opt-row').forEach(r => {
      const label = r.querySelector('.variant-opt-label').value.trim();
      const price = parseInt(r.querySelector('.variant-opt-price').value, 10) || 0;
      if (label) options.push({ label, price });
    });
    if (options.length) result.push({ name, options });
  });
  return result;
}

function populateVariantGroups(variants) {
  const list = document.getElementById('variantGroups');
  list.innerHTML = '';
  if (!variants?.length) return;
  variants.forEach(v => {
    addVariantGroup();
    const group = list.lastElementChild;
    group.querySelector('.variant-group-name').value = v.name;
    const optList = group.querySelector('.variant-opts-list');
    optList.innerHTML = '';
    v.options.forEach(opt => {
      addVariantOption(group.querySelector('.btn-add-variant-opt'));
      const row = optList.lastElementChild;
      row.querySelector('.variant-opt-label').value = opt.label;
      row.querySelector('.variant-opt-price').value = opt.price || 0;
    });
  });
}

// ---- PRODUCT FORM ----
function openProductForm(productId = null) {
  editingProductId = productId;
  selectedFile     = null;

  // Reset
  document.getElementById('productForm').reset();
  document.getElementById('productId').value          = '';
  document.getElementById('existingImageUrl').value   = '';
  document.getElementById('toggleVisible').checked    = true;
  document.getElementById('variantGroups').innerHTML  = '';
  document.getElementById('productDescription').value = '';
  resetImageUpload();

  if (productId) {
    const p = adminProducts.find(x => x.id === productId);
    if (!p) return;

    document.getElementById('productFormTitle').textContent  = 'Edit Produk';
    document.getElementById('productId').value               = p.id;
    document.getElementById('productName').value             = p.name;
    document.getElementById('productDescription').value     = p.description || '';
    document.getElementById('productPrice').value            = p.price;
    document.getElementById('toggleNew').checked             = p.is_new;
    document.getElementById('toggleBestseller').checked      = p.is_bestseller;
    document.getElementById('toggleVisible').checked         = p.is_visible;

    if (p.image_url) {
      document.getElementById('existingImageUrl').value = p.image_url;
      showImagePreview(p.image_url);
    }
    populateVariantGroups(p.variants || []);
  } else {
    document.getElementById('productFormTitle').textContent = 'Tambah Produk';
  }

  document.getElementById('productFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('productName').focus(), 100);
}

function closeProductForm() {
  document.getElementById('productFormModal').classList.remove('active');
  document.body.style.overflow = '';
  editingProductId = null;
  selectedFile     = null;
}

// ---- IMAGE UPLOAD ----
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran foto maks 5 MB ya!', 'error');
    e.target.value = '';
    return;
  }

  selectedFile = file;
  showImagePreview(URL.createObjectURL(file));
}

function showImagePreview(url) {
  document.getElementById('uploadPrompt').style.display    = 'none';
  document.getElementById('imagePreviewWrap').style.display = 'block';
  document.getElementById('imagePreviewImg').src            = url;
}

function removeImage(e) {
  e.stopPropagation();
  selectedFile = null;
  document.getElementById('existingImageUrl').value = '';
  document.getElementById('imageInput').value       = '';
  resetImageUpload();
}

function resetImageUpload() {
  document.getElementById('uploadPrompt').style.display    = 'block';
  document.getElementById('imagePreviewWrap').style.display = 'none';
  document.getElementById('imagePreviewImg').src            = '';
}

// Drag-and-drop (attached after DOM ready)
function initDragDrop() {
  function attachDrop(areaId, onFile) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.addEventListener('dragover',  e  => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) onFile(file);
    });
  }

  attachDrop('imageUploadArea', file => {
    if (file.size > 5 * 1024 * 1024) { showToast('Ukuran foto maks 5 MB ya!', 'error'); return; }
    selectedFile = file;
    showImagePreview(URL.createObjectURL(file));
  });

  attachDrop('bannerImageUploadArea', file => {
    if (file.size > 5 * 1024 * 1024) { showToast('Ukuran foto banner maks 5 MB ya!', 'error'); return; }
    selectedBannerFile = file;
    showBannerImagePreview(URL.createObjectURL(file));
  });
}

// ---- SAVE PRODUCT ----
async function saveProduct(event) {
  event.preventDefault();

  const btn = document.getElementById('saveProductBtn');
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  try {
    const name         = document.getElementById('productName').value.trim();
    const description  = document.getElementById('productDescription').value.trim() || null;
    const price        = parseInt(document.getElementById('productPrice').value, 10);
    const isNew        = document.getElementById('toggleNew').checked;
    const isBestseller = document.getElementById('toggleBestseller').checked;
    const isVisible    = document.getElementById('toggleVisible').checked;
    const productId    = document.getElementById('productId').value;
    let imageUrl       = document.getElementById('existingImageUrl').value || null;

    // Upload new image if one was selected
    if (selectedFile) {
      const ext      = selectedFile.name.split('.').pop().toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('product-images')
        .upload(fileName, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage
        .from('product-images')
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
    }

    const variants = getVariantsFromForm();
    const payload  = { name, description, price, image_url: imageUrl, is_new: isNew, is_bestseller: isBestseller, is_visible: isVisible, variants };

    if (productId) {
      const { error } = await supabaseClient.from('products').update(payload).eq('id', productId);
      if (error) throw error;
      showToast('Produk berhasil diperbarui! ✅', 'success');
    } else {
      const { error } = await supabaseClient.from('products').insert(payload);
      if (error) throw error;
      showToast('Produk berhasil ditambahkan! ✅', 'success');
    }

    closeProductForm();
    await loadAdminProducts();

  } catch (err) {
    console.error('Save product error:', err);
    showToast('Gagal menyimpan: ' + (err.message || 'Coba lagi'), 'error');
  } finally {
    btn.textContent = 'Simpan Produk';
    btn.disabled    = false;
  }
}

// ---- DELETE PRODUCT ----
function confirmDelete(productId, productName) {
  document.getElementById('confirmText').textContent =
    `Yakin mau hapus "${productName}"? Tindakan ini tidak bisa dibatalkan.`;

  confirmCallback = async () => {
    try {
      const { error } = await supabaseClient.from('products').delete().eq('id', productId);
      if (error) throw error;
      showToast(`"${productName}" berhasil dihapus`, 'success');
      closeConfirm();
      await loadAdminProducts();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Gagal menghapus: ' + err.message, 'error');
      closeConfirm();
    }
  };

  document.getElementById('confirmActionBtn').onclick = confirmCallback;
  document.getElementById('confirmOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
  document.body.style.overflow = '';
  confirmCallback = null;
}

// ================================================================
// TABS
// ================================================================

function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => { p.style.display = 'none'; });
  document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).style.display = '';
  if (tab === 'settings') loadSettings();
  if (tab === 'promo')    loadAdminPromos();
  if (tab === 'orders')   loadOrders();
}

// ================================================================
// PROMO CODES
// ================================================================

async function loadAdminPromos() {
  const loadingEl = document.getElementById('promoLoadingState');
  const emptyEl   = document.getElementById('emptyPromoState');
  const list      = document.getElementById('promosList');

  loadingEl.style.display = 'flex';
  emptyEl.classList.remove('visible');
  list.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    adminPromos = data || [];
    loadingEl.style.display = 'none';

    document.getElementById('promoCount').textContent =
      adminPromos.length === 0 ? '0 kode promo' : `${adminPromos.length} kode promo`;

    if (adminPromos.length === 0) { emptyEl.classList.add('visible'); return; }
    adminPromos.forEach(p => list.appendChild(buildPromoCard(p)));

  } catch (err) {
    console.error('Load promos failed:', err);
    loadingEl.style.display = 'none';
    showToast('Gagal memuat promo: ' + err.message, 'error');
  }
}

function buildPromoCard(promo) {
  const card = document.createElement('div');
  card.className = 'promo-card';

  const discLabel = promo.discount_type === 'percent'
    ? `${promo.discount_value}% OFF`
    : `Rp ${promo.discount_value.toLocaleString('id-ID')} OFF`;

  const minLabel = promo.min_order > 0
    ? `Min. order ${formatPrice(promo.min_order)}`
    : 'Tidak ada min. order';

  const expLabel = promo.expires_at
    ? `Berlaku hingga ${new Date(promo.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Tidak ada batas waktu';

  const statusTag = promo.is_active
    ? '<span class="promo-tag promo-tag-active">✅ Aktif</span>'
    : '<span class="promo-tag promo-tag-inactive">⭕ Nonaktif</span>';

  card.innerHTML = `
    <div class="promo-card-left">
      <div class="promo-code-text">${escapeHTML(promo.code)}</div>
      <div class="promo-disc-label">${discLabel}</div>
      <div class="promo-meta">${minLabel} · ${expLabel}</div>
      <div>${statusTag}</div>
    </div>
    <div class="promo-card-actions">
      <button class="btn-sm btn-edit"   onclick="openPromoForm('${promo.id}')">✏️ Edit</button>
      <button class="btn-sm btn-delete" onclick="confirmDeletePromo('${promo.id}', '${escapeHTML(promo.code)}')">🗑️</button>
    </div>`;
  return card;
}

function openPromoForm(promoId = null) {
  editingPromoId = promoId;
  document.getElementById('promoForm').reset();
  document.getElementById('promoId').value = '';
  document.getElementById('promoTypePercent').checked = true;
  document.getElementById('promoIsActive').checked    = true;
  document.getElementById('promoMinOrder').value      = '0';
  updatePromoValueHint();

  if (promoId) {
    const p = adminPromos.find(x => x.id === promoId);
    if (!p) return;
    document.getElementById('promoFormTitle').textContent = 'Edit Kode Promo';
    document.getElementById('promoId').value              = p.id;
    document.getElementById('promoCode').value            = p.code;
    document.getElementById('promoTypePercent').checked   = p.discount_type === 'percent';
    document.getElementById('promoTypeFlat').checked      = p.discount_type === 'flat';
    document.getElementById('promoValue').value           = p.discount_value;
    document.getElementById('promoMinOrder').value        = p.min_order || 0;
    document.getElementById('promoExpires').value         = p.expires_at ? p.expires_at.split('T')[0] : '';
    document.getElementById('promoIsActive').checked      = p.is_active;
    updatePromoValueHint();
  } else {
    document.getElementById('promoFormTitle').textContent = 'Tambah Kode Promo';
  }

  document.getElementById('promoFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('promoCode').focus(), 100);
}

function closePromoForm() {
  document.getElementById('promoFormModal').classList.remove('active');
  document.body.style.overflow = '';
  editingPromoId = null;
}

function updatePromoValueHint() {
  const isPercent = document.getElementById('promoTypePercent').checked;
  document.getElementById('promoValueHint').textContent = isPercent
    ? 'Masukkan angka persen (contoh: 20 = 20%)'
    : 'Masukkan nominal Rupiah (contoh: 10000 = Rp 10.000)';
}

async function savePromo(event) {
  event.preventDefault();
  const btn = document.getElementById('savePromoBtn');
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  try {
    const code           = document.getElementById('promoCode').value.trim().toUpperCase();
    const discount_type  = document.getElementById('promoTypePercent').checked ? 'percent' : 'flat';
    const discount_value = parseInt(document.getElementById('promoValue').value, 10);
    const min_order      = parseInt(document.getElementById('promoMinOrder').value, 10) || 0;
    const expiresVal     = document.getElementById('promoExpires').value;
    const expires_at     = expiresVal ? new Date(expiresVal + 'T23:59:59+07:00').toISOString() : null;
    const is_active      = document.getElementById('promoIsActive').checked;
    const promoId        = document.getElementById('promoId').value;

    if (!code) { showToast('Kode promo wajib diisi!', 'error'); return; }
    if (!discount_value || discount_value <= 0) { showToast('Nilai diskon wajib diisi!', 'error'); return; }
    if (discount_type === 'percent' && discount_value > 100) { showToast('Diskon persen maksimal 100%!', 'error'); return; }

    const payload = { code, discount_type, discount_value, min_order, expires_at, is_active };

    if (promoId) {
      const { error } = await supabaseClient.from('promo_codes').update(payload).eq('id', promoId);
      if (error) throw error;
      showToast('Kode promo berhasil diperbarui! ✅', 'success');
    } else {
      const { error } = await supabaseClient.from('promo_codes').insert(payload);
      if (error) throw error;
      showToast('Kode promo berhasil ditambahkan! ✅', 'success');
    }

    closePromoForm();
    await loadAdminPromos();

  } catch (err) {
    console.error('Save promo error:', err);
    showToast('Gagal menyimpan: ' + (err.message || 'Coba lagi'), 'error');
  } finally {
    btn.textContent = 'Simpan Promo';
    btn.disabled    = false;
  }
}

function confirmDeletePromo(promoId, promoCode) {
  document.getElementById('confirmText').textContent =
    `Yakin mau hapus kode "${promoCode}"? Tindakan ini tidak bisa dibatalkan.`;

  confirmCallback = async () => {
    try {
      const { error } = await supabaseClient.from('promo_codes').delete().eq('id', promoId);
      if (error) throw error;
      showToast(`Kode "${promoCode}" berhasil dihapus`, 'success');
      closeConfirm();
      await loadAdminPromos();
    } catch (err) {
      showToast('Gagal menghapus: ' + err.message, 'error');
      closeConfirm();
    }
  };

  document.getElementById('confirmActionBtn').onclick = confirmCallback;
  document.getElementById('confirmOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ================================================================
// SETTINGS
// ================================================================

async function loadSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('settings').select('*').eq('id', 1).single();
    if (error || !data) return;

    document.getElementById('settingBrandName').value    = data.brand_name       || '';
    document.getElementById('settingBrandIcon').value    = data.brand_icon       || '☕';
    document.getElementById('settingStoreAddress').value = data.store_address    || '';
    document.getElementById('settingStoreHours').value   = data.store_hours      || '';
    document.getElementById('settingStoreMapsUrl').value = data.store_maps_url   || '';
    document.getElementById('settingBannerTitle').value  = data.banner_title     || '';
    document.getElementById('settingBannerSub').value    = data.banner_subtitle  || '';
    document.getElementById('existingLogoUrl').value        = data.logo_url         || '';
    document.getElementById('existingBannerImageUrl').value = data.banner_image_url || '';
    document.getElementById('settingInstagramUrl').value    = data.instagram_url    || '';
    document.getElementById('settingTiktokUrl').value       = data.tiktok_url       || '';

    if (data.logo_url)         showLogoPreview(data.logo_url);
    if (data.banner_image_url) showBannerImagePreview(data.banner_image_url);
  } catch (err) {
    console.error('Load settings failed:', err);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const btn = document.getElementById('saveSettingsBtn');
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  try {
    const brand_name      = document.getElementById('settingBrandName').value.trim();
    const brand_icon      = document.getElementById('settingBrandIcon').value.trim() || '☕';
    const store_address   = document.getElementById('settingStoreAddress').value.trim();
    const store_hours     = document.getElementById('settingStoreHours').value.trim();
    const store_maps_url  = document.getElementById('settingStoreMapsUrl').value.trim() || null;
    const banner_title    = document.getElementById('settingBannerTitle').value.trim();
    const banner_subtitle = document.getElementById('settingBannerSub').value.trim();
    const instagram_url   = document.getElementById('settingInstagramUrl').value.trim() || null;
    const tiktok_url      = document.getElementById('settingTiktokUrl').value.trim()    || null;
    let   logo_url        = document.getElementById('existingLogoUrl').value || null;
    let   banner_image_url = document.getElementById('existingBannerImageUrl').value || null;

    if (selectedLogoFile) {
      const ext      = selectedLogoFile.name.split('.').pop().toLowerCase();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('product-images').upload(fileName, selectedLogoFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabaseClient.storage
        .from('product-images').getPublicUrl(fileName);
      logo_url = urlData.publicUrl;
    }

    if (selectedBannerFile) {
      const ext      = selectedBannerFile.name.split('.').pop().toLowerCase();
      const fileName = `banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('product-images').upload(fileName, selectedBannerFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabaseClient.storage
        .from('product-images').getPublicUrl(fileName);
      banner_image_url = urlData.publicUrl;
    }

    const { error } = await supabaseClient.from('settings').upsert({
      id: 1, brand_name, brand_icon, logo_url,
      store_address, store_hours, store_maps_url,
      banner_title, banner_subtitle, banner_image_url,
      instagram_url, tiktok_url,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    document.getElementById('existingLogoUrl').value        = logo_url         || '';
    document.getElementById('existingBannerImageUrl').value = banner_image_url || '';
    selectedLogoFile   = null;
    selectedBannerFile = null;
    showToast('Pengaturan berhasil disimpan! ✅', 'success');

  } catch (err) {
    console.error('Save settings error:', err);
    showToast('Gagal menyimpan: ' + (err.message || 'Coba lagi'), 'error');
  } finally {
    btn.textContent = 'Simpan Pengaturan';
    btn.disabled    = false;
  }
}

function handleLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran logo maks 2 MB ya!', 'error');
    e.target.value = '';
    return;
  }
  selectedLogoFile = file;
  showLogoPreview(URL.createObjectURL(file));
}

function showLogoPreview(url) {
  document.getElementById('logoUploadPrompt').style.display = 'none';
  document.getElementById('logoPreviewWrap').style.display  = 'block';
  document.getElementById('logoPreviewImg').src             = url;
}

function removeLogo(e) {
  e.stopPropagation();
  selectedLogoFile = null;
  document.getElementById('existingLogoUrl').value          = '';
  document.getElementById('logoInput').value                = '';
  document.getElementById('logoUploadPrompt').style.display = '';
  document.getElementById('logoPreviewWrap').style.display  = 'none';
  document.getElementById('logoPreviewImg').src             = '';
}

function handleBannerImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran foto banner maks 5 MB ya!', 'error');
    e.target.value = '';
    return;
  }
  selectedBannerFile = file;
  showBannerImagePreview(URL.createObjectURL(file));
}

function showBannerImagePreview(url) {
  document.getElementById('bannerImageUploadPrompt').style.display = 'none';
  document.getElementById('bannerImagePreviewWrap').style.display  = 'block';
  document.getElementById('bannerImagePreviewImg').src             = url;
}

function removeBannerImage(e) {
  e.stopPropagation();
  selectedBannerFile = null;
  document.getElementById('existingBannerImageUrl').value          = '';
  document.getElementById('bannerImageInput').value                = '';
  document.getElementById('bannerImageUploadPrompt').style.display = '';
  document.getElementById('bannerImagePreviewWrap').style.display  = 'none';
  document.getElementById('bannerImagePreviewImg').src             = '';
}

// ---- MODAL OVERLAY CLICKS ----
document.getElementById('productFormModal').addEventListener('click', function (e) {
  if (e.target === this) closeProductForm();
});

document.getElementById('promoFormModal').addEventListener('click', function (e) {
  if (e.target === this) closePromoForm();
});

document.getElementById('confirmOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeConfirm();
});

document.getElementById('orderDetailModal').addEventListener('click', function (e) {
  if (e.target === this) closeOrderDetail();
});

// ---- AUTH STATE LISTENER ----
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});

// ================================================================
// ORDERS
// ================================================================

const PENDING_EXPIRE_MS = 24 * 60 * 60 * 1000;

async function loadOrders() {
  const loadingEl = document.getElementById('ordersLoadingState');
  const emptyEl   = document.getElementById('emptyOrdersState');
  const list      = document.getElementById('ordersList');

  loadingEl.style.display = 'flex';
  emptyEl.classList.remove('visible');
  list.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Hide expired pending orders (> 24h without confirmation)
    const now = Date.now();
    adminOrders = (data || []).filter(o => {
      if (o.status !== 'pending') return true;
      return now - new Date(o.created_at).getTime() < PENDING_EXPIRE_MS;
    });

    loadingEl.style.display = 'none';

    const pendingCount = adminOrders.filter(o => o.status === 'pending').length;
    const totalCount   = adminOrders.length;
    document.getElementById('ordersCount').textContent =
      totalCount === 0 ? '0 pesanan'
        : pendingCount > 0 ? `${totalCount} pesanan · ${pendingCount} menunggu konfirmasi`
        : `${totalCount} pesanan`;

    filterOrders(currentOrderFilter);

  } catch (err) {
    console.error('Load orders failed:', err);
    loadingEl.style.display = 'none';
    showToast('Gagal memuat pesanan: ' + err.message, 'error');
  }
}

function filterOrders(filter) {
  currentOrderFilter = filter;

  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  const filtered = filter === 'all'
    ? adminOrders
    : adminOrders.filter(o => o.status === filter);

  const list    = document.getElementById('ordersList');
  const emptyEl = document.getElementById('emptyOrdersState');

  list.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.classList.add('visible');
    return;
  }
  emptyEl.classList.remove('visible');
  filtered.forEach(order => list.appendChild(buildOrderCard(order)));
}

function buildOrderCard(order) {
  const card = document.createElement('div');
  card.className = `order-card order-card-${order.status}`;

  const typeLabel = order.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery';
  const date = new Date(order.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const statusMap = {
    pending:   '<span class="order-status-badge badge-pending">🕐 Menunggu</span>',
    confirmed: '<span class="order-status-badge badge-confirmed">🆕 Diproses</span>',
    done:      '<span class="order-status-badge badge-done">✅ Selesai</span>',
    cancelled: '<span class="order-status-badge badge-cancelled">❌ Dibatalkan</span>',
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsPreview = items.slice(0, 2)
    .map(it => `${it.nm} ×${it.qty}`)
    .join(', ') + (items.length > 2 ? `, +${items.length - 2} lainnya` : '');

  const confirmBtn = order.status === 'pending'
    ? `<button class="btn-sm btn-confirm-quick" onclick="changeOrderStatus('confirmed','${order.id}')">✅ Konfirmasi</button>`
    : '';

  card.innerHTML = `
    <div class="order-card-top">
      <div>
        <div class="order-number">${escapeHTML(order.order_number)}</div>
        <div class="order-customer">${escapeHTML(order.customer_name)} · ${escapeHTML(order.customer_wa)}</div>
        <div class="order-meta">${typeLabel} · ${escapeHTML(order.order_date_label || order.order_date)}</div>
        <div class="order-items-preview">${escapeHTML(itemsPreview)}</div>
      </div>
      <div class="order-card-right">
        ${statusMap[order.status] || ''}
        <div class="order-total">${formatPrice(order.total)}</div>
        <div class="order-date">${date}</div>
      </div>
    </div>
    <div class="order-card-actions">
      ${confirmBtn}
      <button class="btn-sm btn-edit" onclick="openOrderDetail('${order.id}')">📋 Detail</button>
    </div>`;

  return card;
}

function openOrderDetail(orderId) {
  currentDetailOrder = adminOrders.find(o => o.id === orderId);
  if (!currentDetailOrder) return;

  const o = currentDetailOrder;
  document.getElementById('orderDetailTitle').textContent = `Pesanan ${o.order_number}`;
  document.getElementById('orderDetailContent').innerHTML = renderOrderDetailHTML(o);

  const isPending   = o.status === 'pending';
  const isDone      = o.status === 'done';
  const isCancelled = o.status === 'cancelled';

  // pending: Konfirmasi + Batalkan | confirmed: Print + Selesai + Batalkan | done/cancelled: Print only
  document.getElementById('btnConfirmOrder').style.display = isPending                    ? '' : 'none';
  document.getElementById('btnMarkDone').style.display     = (!isPending && !isDone && !isCancelled) ? '' : 'none';
  document.getElementById('btnMarkCancel').style.display   = (!isCancelled && !isDone)    ? '' : 'none';
  document.getElementById('btnPrintLabel').style.display   = !isPending                   ? '' : 'none';

  document.getElementById('orderDetailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeOrderDetail() {
  document.getElementById('orderDetailModal').classList.remove('active');
  document.body.style.overflow = '';
  currentDetailOrder = null;
}

function renderOrderDetailHTML(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const itemRows = items.map(it => {
    const variantStr = it.vl?.length ? ` <span class="order-variant">(${escapeHTML(it.vl.join(', '))})</span>` : '';
    return `<div class="order-detail-item">
      <span>${escapeHTML(it.nm)}${variantStr} ×${it.qty}</span>
      <span>${formatPrice(it.sub)}</span>
    </div>`;
  }).join('');

  const discountRow = o.discount_amount > 0
    ? `<div class="order-detail-row order-detail-discount">
        <span>Diskon (${escapeHTML(o.promo_code || '')})</span>
        <span>−${formatPrice(o.discount_amount)}</span>
       </div>` : '';

  const addrRow = o.order_type === 'delivery' && o.delivery_address
    ? `<div class="order-detail-field"><span class="order-field-label">Alamat</span><span>${escapeHTML(o.delivery_address)}</span></div>` : '';
  const noteRow = o.note
    ? `<div class="order-detail-field"><span class="order-field-label">Catatan</span><span>${escapeHTML(o.note)}</span></div>` : '';

  return `
    <div class="order-detail-meta">
      <div class="order-detail-field"><span class="order-field-label">Nomor</span><span>${escapeHTML(o.order_number)}</span></div>
      <div class="order-detail-field"><span class="order-field-label">Nama</span><span>${escapeHTML(o.customer_name)}</span></div>
      <div class="order-detail-field"><span class="order-field-label">WhatsApp</span><span><a href="https://wa.me/${encodeURIComponent(o.customer_wa)}" target="_blank">${escapeHTML(o.customer_wa)}</a></span></div>
      <div class="order-detail-field"><span class="order-field-label">Tipe</span><span>${o.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}</span></div>
      <div class="order-detail-field"><span class="order-field-label">Tanggal</span><span>${escapeHTML(o.order_date_label || o.order_date)}</span></div>
      ${addrRow}${noteRow}
    </div>
    <div class="order-detail-items">
      ${itemRows}
      <div class="order-detail-divider"></div>
      ${discountRow}
      <div class="order-detail-row order-detail-total">
        <span>Total</span>
        <span>${formatPrice(o.total)}</span>
      </div>
    </div>`;
}

async function changeOrderStatus(newStatus, orderId = null) {
  const order = orderId
    ? adminOrders.find(o => o.id === orderId)
    : currentDetailOrder;
  if (!order) return;

  const labelMap = { confirmed: 'Dikonfirmasi', done: 'Selesai', cancelled: 'Dibatalkan' };
  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (error) throw error;

    showToast(`Pesanan ${labelMap[newStatus] || newStatus} ✅`, 'success');
    if (!orderId) closeOrderDetail();
    await loadOrders();
  } catch (err) {
    showToast('Gagal ubah status: ' + err.message, 'error');
  }
}

function openPrintLabel() {
  if (!currentDetailOrder) return;
  const o = currentDetailOrder;
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLines = items.map(it => {
    const v = it.vl?.length ? ` (${it.vl.join(', ')})` : '';
    return `<div>${it.nm}${v} ×${it.qty}</div>`;
  }).join('');

  const labelEl = document.getElementById('printLabel');
  labelEl.innerHTML = `
    <div class="print-label-inner">
      <div class="print-label-brand">☕ Breva Coffee</div>
      <div class="print-label-order">${escapeHTML(o.order_number)}</div>
      <div class="print-label-section">
        <strong>Untuk:</strong> ${escapeHTML(o.customer_name)}<br>
        <strong>WA:</strong> ${escapeHTML(o.customer_wa)}<br>
        <strong>Tipe:</strong> ${o.order_type === 'pickup' ? 'Pickup' : 'Delivery'}<br>
        <strong>Tanggal:</strong> ${escapeHTML(o.order_date_label || o.order_date)}
        ${o.delivery_address ? `<br><strong>Alamat:</strong> ${escapeHTML(o.delivery_address)}` : ''}
        ${o.note ? `<br><strong>Catatan:</strong> ${escapeHTML(o.note)}` : ''}
      </div>
      <div class="print-label-items">${itemLines}</div>
      <div class="print-label-total"><strong>Total: ${formatPrice(o.total)}</strong></div>
    </div>`;
  window.print();
}


// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initDragDrop();
  checkAuth();
});
