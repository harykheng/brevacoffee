import { useMemo } from 'react';
import { useOrders } from '../../shared/hooks/useOrders.js';
import { formatPrice } from '../../shared/lib/format.js';

// Orders that represent an actual placed order (QRIS already generated) —
// cancelled orders are excluded from revenue, matching what an admin would
// consider "real" sales.
const REVENUE_STATUSES = ['pending', 'confirmed', 'done'];

function isSameDay(isoString, ref) {
  const d = new Date(isoString);
  return d.toDateString() === ref.toDateString();
}

function isSameMonth(isoString, ref) {
  const d = new Date(isoString);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function sumTotal(list) {
  return list.reduce((s, o) => s + (o.total || 0), 0);
}

function sumItemCount(list) {
  return list.reduce((s, o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    return s + items.reduce((si, it) => si + (it.qty || 0), 0);
  }, 0);
}

export default function DashboardTab() {
  const { orders, loading } = useOrders();

  const stats = useMemo(() => {
    const now = new Date();
    const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const todayOrders = revenueOrders.filter((o) => isSameDay(o.created_at, now));
    const monthOrders = revenueOrders.filter((o) => isSameMonth(o.created_at, now));

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayOrders = revenueOrders.filter((o) => isSameDay(o.created_at, d));
      days.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        isToday: i === 0,
        revenue: sumTotal(dayOrders),
      });
    }
    const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenue));

    const productMap = new Map();
    monthOrders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it) => {
        const entry = productMap.get(it.nm) || { name: it.nm, qty: 0, revenue: 0 };
        entry.qty += it.qty || 0;
        entry.revenue += it.sub || 0;
        productMap.set(it.nm, entry);
      });
    });
    const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    return {
      todayRevenue: sumTotal(todayOrders),
      todayOrderCount: todayOrders.length,
      todayItemCount: sumItemCount(todayOrders),
      monthRevenue: sumTotal(monthOrders),
      monthOrderCount: monthOrders.length,
      statusCounts,
      days,
      maxDayRevenue,
      topProducts,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="loading-state" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span>Memuat dashboard...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Dashboard</h2>
          <p className="admin-page-subtitle">Ringkasan performa toko</p>
        </div>
      </div>

      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <span className="dash-stat-icon">💰</span>
          <div className="dash-stat-label">Pendapatan Hari Ini</div>
          <div className="dash-stat-value">{formatPrice(stats.todayRevenue)}</div>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon">📦</span>
          <div className="dash-stat-label">Pesanan Hari Ini</div>
          <div className="dash-stat-value">{stats.todayOrderCount}</div>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon">☕</span>
          <div className="dash-stat-label">Item Terjual Hari Ini</div>
          <div className="dash-stat-value">{stats.todayItemCount}</div>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon">📈</span>
          <div className="dash-stat-label">Omset Bulan Ini</div>
          <div className="dash-stat-value">{formatPrice(stats.monthRevenue)}</div>
          <div className="dash-stat-sub">{stats.monthOrderCount} pesanan</div>
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Pendapatan 7 Hari Terakhir</h3>
        <div className="dash-chart">
          {stats.days.map((d, i) => (
            <div className="dash-chart-col" key={i}>
              <div className="dash-chart-bar-wrap">
                <div
                  className={`dash-chart-bar${d.isToday ? ' today' : ''}`}
                  style={{ height: `${Math.max(4, (d.revenue / stats.maxDayRevenue) * 100)}%` }}
                  title={formatPrice(d.revenue)}
                ></div>
              </div>
              <div className="dash-chart-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Status Pesanan</h3>
        <div className="dash-status-grid">
          <div className="dash-status-pill dash-status-pending">🕐 Menunggu <strong>{stats.statusCounts.pending || 0}</strong></div>
          <div className="dash-status-pill dash-status-confirmed">🆕 Diproses <strong>{stats.statusCounts.confirmed || 0}</strong></div>
          <div className="dash-status-pill dash-status-done">✅ Selesai <strong>{stats.statusCounts.done || 0}</strong></div>
          <div className="dash-status-pill dash-status-cancelled">❌ Dibatalkan <strong>{stats.statusCounts.cancelled || 0}</strong></div>
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Produk Terlaris Bulan Ini</h3>
        {stats.topProducts.length === 0 ? (
          <p className="dash-empty-note">Belum ada penjualan bulan ini.</p>
        ) : (
          <div className="dash-top-products">
            {stats.topProducts.map((p, i) => (
              <div className="dash-top-product-row" key={p.name}>
                <span className="dash-top-product-rank">#{i + 1}</span>
                <span className="dash-top-product-name">{p.name}</span>
                <span className="dash-top-product-qty">{p.qty} terjual</span>
                <span className="dash-top-product-revenue">{formatPrice(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
