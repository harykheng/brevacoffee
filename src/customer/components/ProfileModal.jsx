import { useEffect, useState } from 'react';
import { useCart } from '../CartContext.jsx';
import { useShipping } from '../hooks/useShipping.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { config } from '../../shared/lib/config.js';
import { cartCount, cartTotal } from '../../shared/lib/cart.js';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import ShippingLoadingOverlay from './ShippingLoadingOverlay.jsx';

export default function ProfileModal({ isOpen, onClose }) {
  const { state, dispatch } = useCart();
  const { calculate } = useShipping();
  const showToast = useToast();
  useBodyScrollLock(isOpen);

  const [name, setName] = useState(state.profile.name);
  const [wa, setWa] = useState(state.profile.wa);
  const [address, setAddress] = useState(state.profile.address);
  const [addressNote, setAddressNote] = useState(state.profile.addressNote);
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLng, setDeliveryLng] = useState(null);
  const [saving, setSaving] = useState(false);

  // Re-sync local form state whenever the modal opens (so re-opening after save
  // shows the previously saved values, and reset after order completion clears it).
  useEffect(() => {
    if (isOpen) {
      setName(state.profile.name);
      setWa(state.profile.wa);
      setAddress(state.profile.address);
      setAddressNote(state.profile.addressNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleCoordsChange(lat, lng) {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    if (lat === null) dispatch({ type: 'CLEAR_SHIPPING' });
  }

  async function handleSave() {
    if (!name.trim()) { showToast('Nama wajib diisi!', 'error'); return; }
    if (!wa.trim())   { showToast('Nomor WhatsApp wajib diisi!', 'error'); return; }
    if (state.orderType === 'delivery' && !address.trim()) {
      showToast('Alamat pengiriman wajib diisi!', 'error');
      return;
    }

    if (state.orderType === 'delivery') {
      setSaving(true);

      let lat = deliveryLat, lng = deliveryLng;
      if (!lat || !lng) {
        // Safety net in case blur didn't resolve coords before Simpan was clicked
        try {
          const url = `https://api.locationiq.com/v1/search?key=${config.locationIqKey}&q=${encodeURIComponent(address.trim())}&limit=1&format=json&countrycodes=id&accept-language=id`;
          const res = await fetch(url);
          const data = res.ok ? await res.json() : [];
          if (data?.length) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
        } catch { /* silent */ }
      }

      if (lat && lng) {
        const weightGrams = cartCount(state.cart) * config.defaultItemWeightG;
        await calculate(lat, lng, weightGrams, cartTotal(state.cart));
      }
      setSaving(false);
    }

    dispatch({ type: 'SET_PROFILE', profile: { name: name.trim(), wa: wa.trim(), address: address.trim(), addressNote: addressNote.trim() } });
    onClose();
  }

  return (
    <div className="profile-overlay" style={{ display: isOpen ? 'flex' : 'none' }} onClick={onClose}>
      <div className="profile-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="profile-sheet-drag"></div>
        <div className="profile-sheet-inner">
          <div className="profile-sheet-header">
            <span className="profile-sheet-title">Detail Pemesan</span>
            <button className="profile-sheet-close" onClick={onClose} aria-label="Tutup">✕</button>
          </div>

          <div className="form-group">
            <label htmlFor="customerName">Nama *</label>
            <input type="text" id="customerName" placeholder="Nama kamu..." autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="customerWA">Nomor WhatsApp *</label>
            <input type="tel" id="customerWA" placeholder="08xxxxxxxxxx" autoComplete="tel" value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>

          {state.orderType === 'delivery' && (
            <div>
              <div className="form-group">
                <label htmlFor="customerAddress">Alamat Pengiriman *</label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  onCoordsChange={handleCoordsChange}
                  coordsResolved={Boolean(deliveryLat && deliveryLng)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="customerAddressNote">Catatan Alamat <span className="label-opt">(opsional)</span></label>
                <input
                  type="text"
                  id="customerAddressNote"
                  placeholder="No. unit, lantai, patokan, kode gate..."
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <button className="btn-profile-save" id="btnSaveProfile" onClick={handleSave} disabled={saving} style={{ marginBottom: 8 }}>
            {saving ? 'Mengecek ongkir…' : 'Simpan'}
          </button>
        </div>
      </div>
      <ShippingLoadingOverlay show={saving} />
    </div>
  );
}
