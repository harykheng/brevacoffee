import { createContext, useCallback, useContext, useState } from 'react';

const ConfirmDialogContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, text: '', onConfirm: null });

  const confirm = useCallback((text, onConfirm) => {
    setState({ isOpen: true, text, onConfirm });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm, close }}>
      {children}
      <div
        className={`confirm-overlay${state.isOpen ? ' active' : ''}`}
        role="alertdialog"
        aria-label="Konfirmasi hapus"
      >
        <div className="confirm-box">
          <span className="confirm-icon">🗑️</span>
          <h3 className="confirm-title">Hapus?</h3>
          <p className="confirm-text">{state.text}</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={close}>Batal</button>
            <button className="btn btn-danger" onClick={() => state.onConfirm?.()}>Hapus</button>
          </div>
        </div>
      </div>
    </ConfirmDialogContext.Provider>
  );
}

// Returns { confirm(text, onConfirm), close() }. onConfirm should perform the
// action and call close() itself when done (mirrors the old confirmCallback
// pattern where the callback closed the dialog after a successful delete).
export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  return ctx;
}
