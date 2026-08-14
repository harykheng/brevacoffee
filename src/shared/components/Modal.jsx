// Generic modal shell — reused by admin's ProductFormModal/PromoFormModal/OrderDetailModal.
// Mirrors the original .modal-overlay/.modal-box/.modal-header/.modal-close markup,
// toggled via the "active" class (opacity/pointer-events transition in main.css).
export default function Modal({ isOpen, onClose, title, boxClassName = '', overlayClassName = '', children }) {
  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}${overlayClassName ? ` ${overlayClassName}` : ''}`}
      role="dialog"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-box${boxClassName ? ` ${boxClassName}` : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
