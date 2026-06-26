// ================================================
// BREVA COFFEE — ADMIN DASHBOARD
// ================================================

// ---- STATE ----
let adminProducts    = [];
let editingProductId = null;
let selectedFile     = null;
let confirmCallback  = null;

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

// ---- PRODUCT FORM ----
function openProductForm(productId = null) {
  editingProductId = productId;
  selectedFile     = null;

  // Reset
  document.getElementById('productForm').reset();
  document.getElementById('productId').value       = '';
  document.getElementById('existingImageUrl').value = '';
  document.getElementById('toggleVisible').checked  = true;
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
  const area = document.getElementById('imageUploadArea');
  if (!area) return;

  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', ()  => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) { showToast('Ukuran foto maks 5 MB ya!', 'error'); return; }
      selectedFile = file;
      showImagePreview(URL.createObjectURL(file));
    }
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

    const payload = { name, price, image_url: imageUrl, is_new: isNew, is_bestseller: isBestseller, is_visible: isVisible };

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
