import { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTime } from '../../contexts/TimeProvider';
import { CalendarEvent } from '../../agents/types';
import { X, MapPin, Clock, Weight } from 'lucide-react';

interface CalendarViewProps {
  events: CalendarEvent[];
}

export function CalendarView({ events }: CalendarViewProps) {
  const { currentTime } = useTime();
  const [selected, setSelected] = useState<any>(null);
  const calRef = useRef<any>(null);

  // Navigate calendar to current simulated time
  useEffect(() => {
    const api = calRef.current?.getApi();
    if (api) {
      api.gotoDate(currentTime);
    }
  }, [Math.floor(currentTime.getTime() / (1000 * 60 * 60 * 24))]); // once per simulated day

  const fcEvents = useMemo(() =>
    events.map(e => ({
      ...e,
      start: e.start instanceof Date ? e.start.toISOString() : e.start,
      end: e.end instanceof Date ? e.end?.toISOString() : e.end,
    }))
  , [events]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4 overflow-auto calendar-container">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={fcEvents}
          initialDate={currentTime.toISOString()}
          nowIndicator={true}
          now={currentTime.toISOString()}
          height="auto"
          eventClick={(info) => {
            setSelected(info.event.extendedProps);
          }}
          eventClassNames="cursor-pointer text-xs"
          dayMaxEvents={4}
        />
      </div>

      {/* Event detail popover */}
      {selected && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-surface-400 hover:text-surface-600">
              <X size={18} />
            </button>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: selected.colour || selected.courseColour || '#888' }} />
              <div>
                <h3 className="font-display font-bold text-surface-800">{selected.courseName || selected.courseId}</h3>
                <p className="text-sm text-surface-500 capitalize">{selected.eventType || selected.type}</p>
              </div>
            </div>
            {selected.title && <p className="text-sm font-medium text-surface-700 mb-2">{selected.title}</p>}
            <div className="space-y-1.5 text-xs text-surface-500">
              {selected.location && (
                <div className="flex items-center gap-1.5"><MapPin size={12} /><span>{selected.location}</span></div>
              )}
              {selected.startTime && (
                <div className="flex items-center gap-1.5"><Clock size={12} /><span>{selected.startTime} — {selected.endTime}</span></div>
              )}
              {selected.weight && (
                <div className="flex items-center gap-1.5"><Weight size={12} /><span>{selected.weight}% of final grade</span></div>
              )}
              {selected.topics && (
                <p className="mt-2 text-surface-400 italic">Topics: {selected.topics}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
