import { ClockDisplay } from '../clock/ClockDisplay';
import { useDataStore } from '../../stores/dataStore';
import { Cpu } from 'lucide-react';

export function Header() {
  const student = useDataStore(s => s.student);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-surface-200/60 px-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-display font-bold tracking-tight text-surface-800">AgenticTimetable</h1>
          {student && (
            <p className="text-[10px] text-surface-400 font-medium -mt-0.5">{student.name} · {student.program}</p>
          )}
        </div>
      </div>
      <ClockDisplay />
    </header>
  );
}
