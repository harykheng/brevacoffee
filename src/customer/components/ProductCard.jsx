import { useState } from 'react';
import { formatPrice } from '../../shared/lib/format.js';
import { getProductCartQty } from '../../shared/lib/cart.js';
import { useCart } from '../CartContext.jsx';

export default function ProductCard({ product, index, onPickVariant }) {
  const { state, dispatch } = useCart();
  const [imgError, setImgError] = useState(false);
  const hasVariants = product.variants && product.variants.length > 0;
  const qty = hasVariants
    ? getProductCartQty(state.cart, product.id)
    : (state.cart[product.id]?.qty || 0);

  function updateQty(delta) {
    const next = Math.max(0, qty + delta);
    dispatch({ type: 'SET_CART_QTY', key: product.id, product, qty: next });
  }

  return (
    <div className="product-card" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      {product.is_bestseller && <div className="product-badge badge-bestseller">⭐ Terlaris</div>}
      {!product.is_bestseller && product.is_new && <div className="product-badge badge-new">✨ New</div>}

      <div className="product-image-wrap">
        {product.image_url && !imgError ? (
          <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <span className="product-image-placeholder">☕</span>
        )}
      </div>

      <div className="product-info">
        <div className="product-name">{product.name}</div>
        {product.description && <div className="product-desc">{product.description}</div>}
        <div className="product-price">{formatPrice(product.price)}</div>
      </div>

      {hasVariants ? (
        <div className="product-controls">
          <button className="btn-pick-variant" onClick={() => onPickVariant(product)}>
            {qty > 0 && <span className="vbadge" style={{ display: 'flex' }}>{qty}</span>}
            Pilih
          </button>
        </div>
      ) : (
        <div className="product-controls">
          <button
            className={`qty-btn minus${qty === 0 ? ' minus-disabled' : ''}`}
            onClick={() => updateQty(-1)}
            aria-label="Kurangi"
          >
            −
          </button>
          <span className="qty-display">{qty}</span>
          <button className="qty-btn plus" onClick={() => updateQty(1)} aria-label="Tambah">+</button>
        </div>
      )}
    </div>
  );
}
