// Pure cart math — ported from js/catalog.js. cart is keyed by productId
// (plain product) or `productId|Var1|Var2` (variant combo).

export function cartCount(cart) {
  return Object.values(cart).reduce((s, { qty }) => s + qty, 0);
}

export function cartTotal(cart) {
  return Object.values(cart).reduce((s, { product, qty, extraPrice = 0 }) => s + (product.price + extraPrice) * qty, 0);
}

export function getDiscountAmount(cart, activePromo) {
  if (!activePromo) return 0;
  const raw = cartTotal(cart);
  if (activePromo.discount_type === 'percent') {
    return Math.round(raw * activePromo.discount_value / 100);
  }
  return Math.min(activePromo.discount_value, raw);
}

export function cartFinalTotal(cart, activePromo, selectedShipping) {
  return Math.max(0, cartTotal(cart) - getDiscountAmount(cart, activePromo) + (selectedShipping?.price || 0));
}

export function getProductCartQty(cart, productId) {
  return Object.entries(cart)
    .filter(([k]) => k === productId || k.startsWith(productId + '|'))
    .reduce((s, [, v]) => s + v.qty, 0);
}

// Serializes the cart into the shape stored in orders.items / used in WA messages.
export function cartSnapshot(cart) {
  return Object.values(cart).map(({ product, qty, variantLabels, extraPrice = 0 }) => ({
    nm: product.name,
    qty,
    vl: variantLabels || [],
    up: product.price + (extraPrice || 0),
    sub: (product.price + (extraPrice || 0)) * qty,
  }));
}
