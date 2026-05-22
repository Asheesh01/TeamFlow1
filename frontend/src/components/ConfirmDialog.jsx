 import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * Custom confirmation dialog — replaces window.confirm()
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *
 *   <ConfirmDialog
 *     open={!!confirm}
 *     title={confirm?.title}
 *     message={confirm?.message}
 *     confirmLabel={confirm?.confirmLabel}
 *     danger={confirm?.danger}
 *     onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }}
 *     onCancel={() => setConfirm(null)}
 *   />
 */
const ConfirmDialog = ({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay confirm-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-dialog">
        {/* Icon */}
        <div className={`confirm-icon-wrap ${danger ? 'confirm-icon-danger' : 'confirm-icon-info'}`}>
          {danger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
        </div>

        {/* Content */}
        <div className="confirm-content">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
        </div>

        {/* Actions */}
        <div className="confirm-actions">
          <button className="btn btn-ghost confirm-cancel" onClick={onCancel}>
            <X size={15} /> {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'} confirm-ok`}
            onClick={onConfirm}
            autoFocus
          >
            {danger ? <Trash2 size={15} /> : null} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
