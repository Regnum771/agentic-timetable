import { Check, X, Clock, ThumbsUp, ThumbsDown, AlertTriangle, AlertCircle, Bell } from 'lucide-react';
import { AppNotification, FeedbackAction } from '../../agents/types';

const URGENCY_STYLES: Record<string, { border: string; bg: string; icon: React.ComponentType<any>; iconColor: string }> = {
  info: { border: 'border-l-status-info', bg: 'bg-blue-50/50', icon: Bell, iconColor: 'text-status-info' },
  warning: { border: 'border-l-status-warning', bg: 'bg-amber-50/50', icon: AlertTriangle, iconColor: 'text-status-warning' },
  critical: { border: 'border-l-status-critical', bg: 'bg-red-50/50', icon: AlertCircle, iconColor: 'text-status-critical' },
};

interface NotificationCardProps {
  notification: AppNotification;
  onAction: (id: string, action: FeedbackAction) => void;
  compact?: boolean;
}

export function NotificationCard({ notification: n, onAction, compact }: NotificationCardProps) {
  const style = URGENCY_STYLES[n.urgency] || URGENCY_STYLES.info;
  const Icon = style.icon;
  const isDone = n.status === 'acknowledged' || n.status === 'dismissed';

  return (
    <div className={`border-l-4 ${style.border} ${style.bg} rounded-r-xl p-3 transition-all ${
      isDone ? 'opacity-50' : ''} ${n.urgency === 'critical' && !isDone ? 'animate-pulse-soft' : ''}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`${style.iconColor} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-surface-800 truncate">{n.title}</h4>
            {n.courseColour && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: n.courseColour }} />
            )}
          </div>
          {!compact && <p className="text-xs text-surface-500 leading-relaxed">{n.body}</p>}
          <div className="flex items-center gap-1 mt-2 text-xs text-surface-400">
            <span className="capitalize px-1.5 py-0.5 rounded bg-surface-100 font-medium">{n.status}</span>
            {n.courseName && <span className="ml-1">· {n.courseName}</span>}
          </div>
        </div>
      </div>

      {!isDone && (
        <div className="flex items-center gap-1 mt-2.5 pl-6">
          <button onClick={() => onAction(n.id, 'acknowledge')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success text-xs font-medium hover:bg-status-success/20 transition-colors">
            <Check size={12} /> Ack
          </button>
          <button onClick={() => onAction(n.id, 'dismiss')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-100 text-surface-500 text-xs font-medium hover:bg-surface-200 transition-colors">
            <X size={12} /> Dismiss
          </button>
          <button onClick={() => onAction(n.id, 'snooze')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-100 text-surface-500 text-xs font-medium hover:bg-surface-200 transition-colors">
            <Clock size={12} /> Snooze
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onAction(n.id, 'thumbs_up')}
              className="p-1 rounded hover:bg-status-success/10 text-surface-400 hover:text-status-success transition-colors">
              <ThumbsUp size={12} />
            </button>
            <button onClick={() => onAction(n.id, 'thumbs_down')}
              className="p-1 rounded hover:bg-status-critical/10 text-surface-400 hover:text-status-critical transition-colors">
              <ThumbsDown size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
