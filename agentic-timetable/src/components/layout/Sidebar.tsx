import { Calendar, Bell, BarChart3, Bug, GraduationCap, Percent, MessageCircle } from 'lucide-react';

type ViewName = 'calendar' | 'notifications' | 'dashboard' | 'chat' | 'debug';

const NAV_ITEMS: { id: ViewName; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'debug', label: 'Debug Panel', icon: Bug },
];

interface SidebarProps {
  activeView: ViewName;
  onViewChange: (v: ViewName) => void;
  stats?: { gpa: number; attendance: number; notifCount: number };
}

export function Sidebar({ activeView, onViewChange, stats }: SidebarProps) {
  return (
    <aside className="w-56 bg-white/60 backdrop-blur-xl border-r border-surface-200/60 flex flex-col shrink-0">
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button key={item.id} onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent shadow-sm'
                  : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'
              }`}>
              <Icon size={16} />
              <span>{item.label}</span>
              {item.id === 'notifications' && stats && stats.notifCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-status-critical text-white w-5 h-5 rounded-full flex items-center justify-center">
                  {stats.notifCount > 9 ? '9+' : stats.notifCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick stats */}
      {stats && (
        <div className="p-3 border-t border-surface-200/60 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <GraduationCap size={13} className="text-accent" />
            <span className="text-surface-500">GPA</span>
            <span className="ml-auto font-mono font-bold text-surface-700">{stats.gpa.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Percent size={13} className="text-status-success" />
            <span className="text-surface-500">Attendance</span>
            <span className="ml-auto font-mono font-bold text-surface-700">{stats.attendance}%</span>
          </div>
        </div>
      )}
    </aside>
  );
}
