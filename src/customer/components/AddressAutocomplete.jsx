import { useEffect, useRef, useState } from 'react';
import { config } from '../../shared/lib/config.js';

async function fetchSuggestions(q) {
  try {
    const url = `https://api.locationiq.com/v1/autocomplete?key=${config.locationIqKey}&q=${encodeURIComponent(q)}&limit=5&dedupe=1&accept-language=id&countrycodes=id`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return []; // silent — user can still type manually
  }
}

async function geocodeAddress(q) {
  try {
    const url = `https://api.locationiq.com/v1/search?key=${config.locationIqKey}&q=${encodeURIComponent(q)}&limit=1&format=json&countrycodes=id&accept-language=id`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.length ? data[0] : null;
  } catch {
    return null; // silent — user can still proceed without ongkir
  }
}

// Controlled address input with LocationIQ autocomplete. Reports resolved
// coordinates via onCoordsChange, but never triggers a shipping check itself —
// that only happens once, from ProfileModal's save handler.
export default function AddressAutocomplete({ value, onChange, onCoordsChange, coordsResolved }) {
  const [results, setResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!wrapRef.current?.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    onChange(q);
    onCoordsChange(null, null);

    clearTimeout(timerRef.current);
    if (q.length < 3) { setShowSuggestions(false); return; }
    timerRef.current = setTimeout(async () => {
      const data = await fetchSuggestions(q);
      setResults(data);
      setShowSuggestions(data.length > 0);
    }, 350);
  }

  function selectSuggestion(index) {
    const r = results[index];
    if (!r) return;
    const label = r.display_name || r.display_place || '';
    onChange(label);
    onCoordsChange(parseFloat(r.lat), parseFloat(r.lon));
    setShowSuggestions(false);
  }

  async function handleBlur() {
    if (coordsResolved) return;
    const q = value.trim();
    if (!q || q.length < 5) return;
    const r = await geocodeAddress(q);
    if (r) onCoordsChange(parseFloat(r.lat), parseFloat(r.lon));
  }

  return (
    <div className="address-autocomplete-wrap" ref={wrapRef}>
      <textarea
        id="customerAddress"
        placeholder="Tulis alamat lengkap + patokan..."
        rows={3}
        autoComplete="off"
        value={value}
        onInput={handleInput}
        onBlur={handleBlur}
      />
      {showSuggestions && (
        <div className="address-suggestions" style={{ display: 'block' }}>
          {results.map((r, i) => (
            <div key={i} className="address-suggestion-item" onMouseDown={() => selectSuggestion(i)}>
              {r.display_name || r.display_place || ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
