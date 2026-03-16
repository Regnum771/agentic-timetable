import { useEffect } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationCard } from './NotificationCard';
import { FeedbackAction } from '../../agents/types';

interface Props {
  onAction: (notifId: string, action: FeedbackAction) => void;
}

export function ToastArea({ onAction }: Props) {
  const toasts = useNotificationStore(s => s.toasts);
  const dismissToast = useNotificationStore(s => s.dismissToast);

  // Auto-dismiss toasts after 15 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      if (toasts[0]) dismissToast(toasts[0].id);
    }, 15000);
    return () => clearTimeout(timer);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 space-y-2 max-h-[60vh] overflow-hidden">
      {toasts.map(t => (
        <div key={t.id} className="animate-slide-in shadow-xl rounded-xl bg-white/95 backdrop-blur-xl">
          <NotificationCard notification={t} onAction={onAction} compact />
        </div>
      ))}
    </div>
  );
}
