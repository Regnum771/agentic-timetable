import { useState } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationCard } from './NotificationCard';
import { FeedbackAction } from '../../agents/types';
import { Filter, Inbox } from 'lucide-react';

interface Props {
  onAction: (notifId: string, action: FeedbackAction) => void;
}

export function NotificationCentre({ onAction }: Props) {
  const notifications = useNotificationStore(s => s.notifications);
  const [filter, setFilter] = useState<'all' | 'active' | 'dismissed'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const filtered = notifications.filter(n => {
    if (filter === 'active' && (n.status === 'dismissed' || n.status === 'acknowledged')) return false;
    if (filter === 'dismissed' && n.status !== 'dismissed' && n.status !== 'acknowledged') return false;
    if (courseFilter !== 'all' && n.courseId !== courseFilter) return false;
    return true;
  }).reverse();

  const courseIds = [...new Set(notifications.map(n => n.courseId))];

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="p-4 border-b border-surface-200/60 flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-surface-400" />
        {(['all', 'active', 'dismissed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f ? 'bg-accent text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
          className="ml-auto text-xs px-2 py-1 rounded bg-surface-100 text-surface-600">
          <option value="all">All Courses</option>
          {courseIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-surface-400">
            <Inbox size={40} className="mb-2 opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs">Start the clock to begin receiving notifications</p>
          </div>
        ) : (
          filtered.map(n => (
            <NotificationCard key={n.id} notification={n} onAction={onAction} />
          ))
        )}
      </div>

      <div className="p-3 border-t border-surface-200/60 text-xs text-surface-400 text-center">
        {notifications.length} total · {notifications.filter(n => n.status === 'delivered').length} active
      </div>
    </div>
  );
}
