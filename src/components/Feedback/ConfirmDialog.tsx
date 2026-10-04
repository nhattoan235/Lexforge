import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Trash2, X } from 'lucide-react';
import './Feedback.css';

type Tone = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, description, confirmLabel, cancelLabel = 'Để sau', tone = 'warning', busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const isBusy = busy || pending;
  const cancelHandler = useRef(onCancel);
  const busyRef = useRef(isBusy);
  cancelHandler.current = onCancel;
  busyRef.current = isBusy;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) cancelHandler.current();
      if (event.key !== 'Tab') return;
      const first = closeRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);

  const confirm = async () => {
    if (isBusy) return;
    setPending(true);
    try { await onConfirm(); }
    finally { setPending(false); }
  };

  const Icon = tone === 'danger' ? Trash2 : tone === 'info' ? HelpCircle : AlertTriangle;
  return createPortal(
    <div className="lf-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isBusy) onCancel(); }}>
      <div className={`lf-confirm lf-confirm-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="lf-confirm-title" aria-describedby="lf-confirm-description">
        <div className="lf-confirm-art" aria-hidden="true"><span className="lf-confirm-halo" /><span className="lf-confirm-icon"><Icon size={30} strokeWidth={1.9} /></span></div>
        <button ref={closeRef} className="lf-confirm-close" type="button" onClick={onCancel} disabled={isBusy} aria-label="Đóng thông báo"><X size={19} /></button>
        <div className="lf-confirm-copy"><span className="lf-confirm-eyebrow">{tone === 'danger' ? 'XÁC NHẬN THAO TÁC' : tone === 'info' ? 'THÔNG BÁO' : 'CẦN BẠN XÁC NHẬN'}</span><h2 id="lf-confirm-title">{title}</h2><p id="lf-confirm-description">{description}</p></div>
        <div className="lf-confirm-actions"><button ref={cancelRef} className="lf-confirm-cancel" type="button" onClick={onCancel} disabled={isBusy}>{cancelLabel}</button><button ref={confirmRef} className="lf-confirm-submit" type="button" onClick={confirm} disabled={isBusy}>{isBusy ? 'Đang xử lý…' : confirmLabel}</button></div>
      </div>
    </div>, document.body
  );
}
