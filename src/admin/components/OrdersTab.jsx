import { useState } from 'react';
import { useOrders } from '../../shared/hooks/useOrders.js';
import { formatPrice, formatOrderDate } from '../../shared/lib/format.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { updateOrderStatus } from '../../shared/lib/orders.js';
import OrderDetailModal from './OrderDetailModal.jsx';

const FILTERS = [
  { key: 'pending', label: '🕐 Menunggu' },
  { key: 'confirmed', label: '🆕 Diproses' },
  { key: 'done', label: '✅ Selesai' },
  { key: 'cancelled', label: '❌ Dibatalkan' },
  { key: 'all', label: 'Semua' },
];

const STATUS_BADGES = {
  pending: <span className="order-status-badge badge-pending">🕐 Menunggu</span>,
  confirmed: <span className="order-status-badge badge-confirmed">🆕 Diproses</span>,
  done: <span className="order-status-badge badge-done">✅ Selesai</span>,
  cancelled: <span className="order-status-badge badge-cancelled">❌ Dibatalkan</span>,
};

export default function OrdersTab() {
  const { orders, loading, refetch } = useOrders();
  const showToast = useToast();
  const [filter, setFilter] = useState('pending');
  const [detailOrder, setDetailOrder] = useState(null);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  async function quickConfirm(order) {
    try {
      await updateOrderStatus(order.id, 'confirmed');
      showToast('Pesanan Dikonfirmasi ✅', 'success');
      await refetch();
    } catch (err) {
      showToast('Gagal ubah status: ' + err.message, 'error');
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Pesanan Masuk</h2>
          <p className="admin-page-subtitle">
            {loading ? 'Memuat...' : orders.length === 0
              ? '0 pesanan'
              : pendingCount > 0
                ? `${orders.length} pesanan · ${pendingCount} menunggu konfirmasi`
                : `${orders.length} pesanan`}
          </p>
        </div>
      </div>

      <div className="orders-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`order-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-state" style={{ display: 'flex' }}>
          <div className="spinner"></div>
          <span>Memuat pesanan...</span>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-admin-state visible">
          <span className="empty-admin-icon">📦</span>
          <h3>Belum ada pesanan</h3>
          <p>Pesanan yang dikonfirmasi dari WhatsApp akan muncul di sini</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="orders-list">
          {filtered.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsPreview = items.slice(0, 2).map((it) => `${it.nm} ×${it.qty}`).join(', ')
              + (items.length > 2 ? `, +${items.length - 2} lainnya` : '');

            return (
              <div className={`order-card order-card-${order.status}`} key={order.id}>
                <div className="order-card-top">
                  <div>
                    <div className="order-number">{order.order_number}</div>
                    <div className="order-customer">{order.customer_name} · {order.customer_wa}</div>
                    <div className="order-meta">
                      {order.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'} · {order.order_date_label || order.order_date}
                    </div>
                    <div className="order-items-preview">{itemsPreview}</div>
                  </div>
                  <div className="order-card-right">
                    {STATUS_BADGES[order.status]}
                    <div className="order-total">{formatPrice(order.total)}</div>
                    <div className="order-date">{formatOrderDate(order.created_at)}</div>
                  </div>
                </div>
                <div className="order-card-actions">
                  {order.status === 'pending' && (
                    <button className="btn-sm btn-confirm-quick" onClick={() => quickConfirm(order)}>✅ Konfirmasi</button>
                  )}
                  <button className="btn-sm btn-edit" onClick={() => setDetailOrder(order)}>📋 Detail</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OrderDetailModal
        isOpen={Boolean(detailOrder)}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onStatusChanged={refetch}
      />
    </div>
  );
}
