export const DAYS   = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(price);
}

// Returns the next 7 days as { value: 'YYYY-MM-DD', label, isToday, isTomorrow, day, date, month }
export function buildDateChips() {
  const today = new Date();
  const chips = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const isTomorrow = i === 1;
    const label = isToday
      ? `Hari ini, ${d.getDate()} ${MONTHS[d.getMonth()]}`
      : isTomorrow
        ? `Besok, ${d.getDate()} ${MONTHS[d.getMonth()]}`
        : `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    chips.push({
      value,
      label,
      isToday,
      isTomorrow,
      day: DAYS[d.getDay()],
      date: d.getDate(),
      month: MONTHS[d.getMonth()],
    });
  }
  return chips;
}

export function formatOrderDate(isoString) {
  return new Date(isoString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatExpiryDate(isoString) {
  return new Date(isoString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
