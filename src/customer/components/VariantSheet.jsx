import { useEffect, useState } from 'react';
import { formatPrice } from '../../shared/lib/format.js';
import { useCart } from '../CartContext.jsx';
import { useToast } from '../../shared/components/Toast.jsx';

export default function VariantSheet({ product, onClose }) {
  const { dispatch } = useCart();
  const showToast = useToast();
  const [selected, setSelected] = useState({}); // { groupName: { label, price } }
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setSelected({});
    setQty(1);
  }, [product]);

  const isOpen = Boolean(product);
  const groups = product?.variants || [];
  const extra = Object.values(selected).reduce((s, v) => s + v.price, 0);
  const total = product ? (product.price + extra) * qty : 0;

  function selectChip(groupName, option) {
    setSelected((prev) => ({ ...prev, [groupName]: { label: option.label, price: option.price || 0 } }));
  }

  function changeQty(delta) {
    setQty((q) => Math.max(1, Math.min(20, q + delta)));
  }

  function confirmAdd() {
    for (const g of groups) {
      if (!selected[g.name]) {
        showToast(`Pilih ${g.name} dulu ya!`, 'error');
        return;
      }
    }
    const variantLabels = groups.map((g) => selected[g.name].label);
    const cartKey = variantLabels.length ? `${product.id}|${variantLabels.join('|')}` : product.id;
    const extraPrice = Object.values(selected).reduce((s, v) => s + v.price, 0);

    dispatch({ type: 'ADD_TO_CART', key: cartKey, product, qty, variantLabels, extraPrice });
    onClose();
  }

  return (
    <div className={`variant-overlay${isOpen ? ' active' : ''}`} onClick={onClose}>
      <div className="variant-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="variant-sheet-drag"></div>

        <div className="variant-sheet-header">
          <div className="variant-sheet-product">
            <div className="variant-sheet-img-wrap">
              {product?.image_url ? (
                <img className="variant-sheet-img" src={product.image_url} alt={product.name} />
              ) : (
                <span className="variant-sheet-img-ph">☕</span>
              )}
            </div>
            <div className="variant-sheet-info">
              <div className="variant-sheet-name">{product?.name}</div>
              <div className="variant-sheet-price">{product ? formatPrice(product.price) : ''}</div>
            </div>
          </div>
          <button className="variant-sheet-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="variant-sheet-body">
          {groups.map((group) => (
            <div className="vs-group" key={group.name}>
              <div className="vs-group-name">{group.name}</div>
              <div className="vs-chips">
                {group.options.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`vs-chip${selected[group.name]?.label === opt.label ? ' selected' : ''}`}
                    onClick={() => selectChip(group.name, opt)}
                  >
                    {opt.label}{opt.price > 0 ? ` +${formatPrice(opt.price)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="variant-sheet-footer">
          <div className="vs-qty-row">
            <span className="vs-qty-label">Jumlah</span>
            <div className="vs-qty-ctrl">
              <button className="qty-btn minus" onClick={() => changeQty(-1)} aria-label="Kurangi">−</button>
              <span className="qty-display">{qty}</span>
              <button className="qty-btn plus" onClick={() => changeQty(1)} aria-label="Tambah">+</button>
            </div>
          </div>
          <button className="btn btn-primary vs-add-btn" onClick={confirmAdd}>
            Tambah ke Keranjang — {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
