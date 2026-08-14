import { createPortal } from 'react-dom';
import { formatPrice } from '../../shared/lib/format.js';

// Rendered via portal into #printLabel, a direct <body> child declared in
// admin/index.html — @media print in admin.css hides every other body child
// and only shows #printLabel, so this must NOT be nested inside #root.
export default function PrintLabel({ order }) {
  const target = document.getElementById('printLabel');
  if (!target || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];

  return createPortal(
    <div className="print-label-inner">
      <div className="print-label-brand">☕ Breva Coffee</div>
      <div className="print-label-order">{order.order_number}</div>
      <div className="print-label-section">
        <strong>Untuk:</strong> {order.customer_name}<br />
        <strong>WA:</strong> {order.customer_wa}<br />
        <strong>Tipe:</strong> {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'}<br />
        <strong>Tanggal:</strong> {order.order_date_label || order.order_date}
        {order.delivery_address && <><br /><strong>Alamat:</strong> {order.delivery_address}</>}
        {order.note && <><br /><strong>Catatan:</strong> {order.note}</>}
      </div>
      <div className="print-label-items">
        {items.map((it, i) => (
          <div key={i}>{it.nm}{it.vl?.length ? ` (${it.vl.join(', ')})` : ''} ×{it.qty}</div>
        ))}
      </div>
      <div className="print-label-total"><strong>Total: {formatPrice(order.total)}</strong></div>
    </div>,
    target
  );
}
