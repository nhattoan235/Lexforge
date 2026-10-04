import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, AlertCircle, X } from 'lucide-react';
import './Feedback.css';

type NoticeTone = 'success' | 'error' | 'info';
type Notice = { id: number; message: string; tone: NoticeTone; duration: number };
const eventName = 'lexforge:notice';
let nextNoticeId = 0;

export function notify(message: string, tone: NoticeTone = 'info', duration = 5500) {
  window.dispatchEvent(new CustomEvent<Notice>(eventName, { detail: { id: ++nextNoticeId, message, tone, duration } }));
}

export default function ToastHost() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(current => current?.id === notice.id ? null : current), notice.duration);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  if (!notice) return null;
  const Icon = notice.tone === 'success' ? Check : notice.tone === 'error' ? AlertCircle : Info;
  return createPortal(<div className={`lf-toast lf-toast-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}><span className="lf-toast-icon"><Icon size={20} strokeWidth={2.4}/></span><p>{notice.message}</p><button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={17}/></button></div>, document.body);
}
