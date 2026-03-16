import { Play, Pause, SkipForward, Clock, Calendar } from 'lucide-react';
import { useTime } from '../../contexts/TimeProvider';

const SPEED_PRESETS = [
  { label: '1×', value: 1 },
  { label: '60×', value: 60 },
  { label: '360×', value: 360 },
  { label: '3600×', value: 3600 },
];

export function ClockDisplay() {
  const { currentTime, speed, isPaused, semesterWeek, semesterStart, semesterEnd, setSpeed, togglePause, jumpTo } = useTime();

  const progress = Math.min(100, Math.max(0,
    ((currentTime.getTime() - semesterStart.getTime()) / (semesterEnd.getTime() - semesterStart.getTime())) * 100));

  const jumpWeek = (w: number) => {
    const d = new Date(semesterStart);
    d.setDate(d.getDate() + (w - 1) * 7);
    d.setHours(8, 0, 0, 0);
    jumpTo(d);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Time display */}
      <div className="flex items-center gap-2 min-w-0">
        <Clock size={16} className="text-accent shrink-0" />
        <div className="text-sm font-mono font-semibold text-surface-800 whitespace-nowrap">
          {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          <span className="text-accent ml-2">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      {/* Semester week */}
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
        <Calendar size={12} />
        <span>Week {semesterWeek}/16</span>
      </div>

      {/* Progress bar */}
      <div className="hidden lg:block w-24 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button onClick={togglePause}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>

        {SPEED_PRESETS.map(p => (
          <button key={p.value} onClick={() => setSpeed(p.value)}
            className={`px-2 py-1 rounded text-xs font-mono font-semibold transition-colors ${
              speed === p.value ? 'bg-accent text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
            }`}>
            {p.label}
          </button>
        ))}

        {/* Quick jump */}
        <div className="relative ml-1">
          <select
            className="appearance-none pl-2 pr-6 py-1 rounded text-xs font-mono bg-surface-100 text-surface-600 cursor-pointer hover:bg-surface-200"
            value={semesterWeek}
            onChange={(e) => jumpWeek(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={i + 1}>W{i + 1}</option>
            ))}
          </select>
          <SkipForward size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
