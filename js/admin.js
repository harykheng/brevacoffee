// ================================================
// BREVA COFFEE — ADMIN DASHBOARD
// ================================================

// ---- STATE ----
let adminProducts      = [];
let editingProductId   = null;
let selectedFile       = null;
let selectedLogoFile   = null;
let selectedBannerFile = null;
let confirmCallback    = null;

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
  document.getElementById('productId').value       = '';
  document.getElementById('existingImageUrl').value = '';
  document.getElementById('toggleVisible').checked  = true;
  document.getElementById('variantGroups').innerHTML = '';
  resetImageUpload();

  if (productId) {
    const p = adminProducts.find(x => x.id === productId);
    if (!p) return;

    document.getElementById('productFormTitle').textContent  = 'Edit Produk';
    document.getElementById('productId').value               = p.id;
    document.getElementById('productName').value             = p.name;
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
    const payload  = { name, price, image_url: imageUrl, is_new: isNew, is_bestseller: isBestseller, is_visible: isVisible, variants };

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

document.getElementById('confirmOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeConfirm();
});

// ---- AUTH STATE LISTENER ----
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initDragDrop();
  checkAuth();
});
