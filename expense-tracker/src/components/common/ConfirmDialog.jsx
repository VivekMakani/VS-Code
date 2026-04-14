import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Confirm', message, confirmLabel = 'Delete', confirmClass = 'btn-danger' }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${confirmClass}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </Modal>
  );
}
