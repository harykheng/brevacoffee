import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { ConfirmDialogProvider } from '../shared/components/ConfirmDialog.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import ProductsTab from './components/ProductsTab.jsx';
import PromoTab from './components/PromoTab.jsx';
import OrdersTab from './components/OrdersTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const TABS = [
  { key: 'products', label: '🛍 Produk' },
  { key: 'promo', label: '🎟 Promo' },
  { key: 'orders', label: '📦 Pesanan' },
  { key: 'settings', label: '⚙️ Pengaturan' },
];

function Dashboard() {
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="admin-layout active">
      <header className="admin-header">
        <div className="logo">
          <span className="logo-icon">☕</span>
          <div className="logo-text">Breva Admin</div>
        </div>
        <div className="admin-header-right">
          <span className="admin-user-email">{session.user.email}</span>
          <button className="btn-logout" onClick={logout}>Keluar</button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tab${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="tab-products" className="tab-panel" style={{ display: activeTab === 'products' ? '' : 'none' }}>
          {activeTab === 'products' && <ProductsTab />}
        </div>
        <div id="tab-promo" className="tab-panel" style={{ display: activeTab === 'promo' ? '' : 'none' }}>
          {activeTab === 'promo' && <PromoTab />}
        </div>
        <div id="tab-orders" className="tab-panel" style={{ display: activeTab === 'orders' ? '' : 'none' }}>
          {activeTab === 'orders' && <OrdersTab />}
        </div>
        <div id="tab-settings" className="tab-panel" style={{ display: activeTab === 'settings' ? '' : 'none' }}>
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

function AppShell() {
  const { session } = useAuth();
  if (session === undefined) return null; // brief loading check, no original equivalent to flash
  return session ? <Dashboard /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <AppShell />
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}
