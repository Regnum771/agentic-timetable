import { IAgent, AgentInput, AgentOutput, TimetableEvent, Assignment, Exam, Course, EventType, TimeContext, CalendarEvent, AppNotification } from './types';
import { callAgent } from '../utils/apiClient';
import { TimeAgent } from './timeAgent';
import { v4 as uuid } from 'uuid';

export class TimetableAgent implements IAgent {
  id = 'timetable-agent';
  name = 'Timetable Agent';
  description = 'Local data queries; LLM enrichment on daily tick only';

  private events: TimetableEvent[] = [];
  private assignments: Assignment[] = [];
  private exams: Exam[] = [];
  private courses: Course[] = [];

  loadData(events: TimetableEvent[], assignments: Assignment[], exams: Exam[], courses: Course[]) {
    this.events = events; this.assignments = assignments; this.exams = exams; this.courses = courses;
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    // Local: get raw upcoming events (no API call)
    if (input.type === 'getUpcoming') {
      const timeCtx: TimeContext = input.timeCtx;
      const items = this.getRawUpcoming(timeCtx.lookAheadWindow.start, timeCtx.lookAheadWindow.end, timeCtx.semesterWeek);
      return { agentId: this.id, type: 'upcomingEvents', data: items };
    }

    // LLM: enrichment call for prioritisation (daily only)
    if (input.type === 'enrichUpcoming') {
      const events = input.events;
      if (!events || events.length === 0) return { agentId: this.id, type: 'enriched', data: events };
      try {
        // #5: Trimmed payload — send only essential fields
        const resp = await callAgent(this.id, {
          week: input.semesterWeek,
          exam: input.isExamPeriod,
          events: events.slice(0, 20).map((e: any) => ({
            ref: e.ref, cid: e.courseId, cat: e.category,
            t: e.title, d: Math.round((e.date.getTime() - Date.now()) / 86400000), w: e.weight,
          })),
        });
        const llm = resp.data.upcomingEvents || [];
        const enriched = events.map((raw: any) => {
          const match = llm.find((l: any) => l.ref === raw.ref);
          return { ...raw, priority: match?.priority || 5, isImminent: match?.isImminent || false };
        });
        return { agentId: this.id, type: 'enriched', data: enriched, _usage: resp.usage } as any;
      } catch (e: any) {
        console.warn('TimetableAgent LLM fallback:', e.message);
        return { agentId: this.id, type: 'enriched', data: events };
      }
    }

    // Local: hourly proximity check for lectures/tutorials starting within 60min
    if (input.type === 'getImminentClasses') {
      const now: Date = input.currentTime;
      const reminders = this.getImminentClassReminders(now, input.semesterWeek, input.lowAttendanceCourses || []);
      return { agentId: this.id, type: 'imminentReminders', data: reminders };
    }

    // Local: calendar events for display
    if (input.type === 'getCalendarEvents') {
      return { agentId: this.id, type: 'calendarEvents', data: this.buildCalendarEvents() };
    }

    return { agentId: this.id, type: 'error', data: {} };
  }

  // ── Hourly: local lecture proximity check (no API call) ──
  private getImminentClassReminders(now: Date, currentWeek: number, lowAttendanceCourses: string[]): AppNotification[] {
    const reminders: AppNotification[] = [];
    const semStart = TimeAgent.getSemesterStart();

    for (const ev of this.events) {
      const weekRanges = this.parseWeeks(ev.weeks);
      if (!weekRanges.includes(currentWeek)) continue;

      const dayOffset = this.dayToOffset(ev.dayOfWeek);
      const eventDate = new Date(semStart);
      eventDate.setDate(eventDate.getDate() + (currentWeek - 1) * 7 + dayOffset);
      const [h, m] = ev.startTime.split(':').map(Number);
      eventDate.setHours(h, m, 0, 0);

      const diffMs = eventDate.getTime() - now.getTime();
      const diffMins = diffMs / 60000;

      // Within 0-60 minutes from now
      if (diffMins > 0 && diffMins <= 60) {
        const course = this.courses.find(c => c.courseId === ev.courseId);
        const courseName = course?.courseName || ev.courseId;
        const isLowAttendance = lowAttendanceCourses.includes(ev.courseId);

        let body = `${courseName} ${ev.type} at ${ev.location} (${ev.startTime}).`;
        if (isLowAttendance) {
          body += ` Your attendance in this course is low — try not to miss this one.`;
        }

        reminders.push({
          id: uuid(),
          eventRef: `${ev.eventId}-w${currentWeek}-reminder`,
          category: ev.type as EventType,
          title: `📅 ${courseName} ${ev.type} in ${Math.round(diffMins)} min`,
          body,
          urgency: isLowAttendance ? 'warning' : 'info',
          status: 'delivered',
          scheduledFor: now,
          deliveredAt: now,
          courseId: ev.courseId,
          courseName,
          courseColour: course?.colour,
          templateId: 'local-proximity',
          metadata: { leadTimeDays: 0, minutesUntil: Math.round(diffMins), local: true },
        });
      }
    }
    return reminders;
  }

  // ── Local data queries ──
  getRawUpcoming(start: Date, end: Date, currentWeek: number) {
    const items: Array<{ ref: string; courseId: string; category: EventType; date: Date; title: string; weight: number; data: any }> = [];
    const semStart = TimeAgent.getSemesterStart();

    for (const a of this.assignments) {
      if (a.dueDate >= start && a.dueDate <= end) {
        items.push({ ref: a.assignmentId, courseId: a.courseId, category: 'assignment', date: a.dueDate, title: a.title, weight: a.weight, data: a });
      }
    }
    for (const e of this.exams) {
      if (e.date >= start && e.date <= end) {
        items.push({ ref: e.examId, courseId: e.courseId, category: 'exam', date: e.date, title: e.title, weight: e.weight, data: e });
      }
    }
    for (const ev of this.events) {
      const weekRanges = this.parseWeeks(ev.weeks);
      if (!weekRanges.includes(currentWeek)) continue;
      const dayOffset = this.dayToOffset(ev.dayOfWeek);
      const eventDate = new Date(semStart);
      eventDate.setDate(eventDate.getDate() + (currentWeek - 1) * 7 + dayOffset);
      const [h, m] = ev.startTime.split(':').map(Number);
      eventDate.setHours(h, m, 0, 0);
      if (eventDate >= start && eventDate <= end) {
        items.push({
          ref: ev.eventId, courseId: ev.courseId, category: ev.type as EventType,
          date: eventDate, title: `${this.getCourseName(ev.courseId)} ${ev.type}`, weight: 0, data: ev,
        });
      }
    }
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  buildCalendarEvents(): CalendarEvent[] {
    const cal: CalendarEvent[] = [];
    const semStart = TimeAgent.getSemesterStart();
    for (const ev of this.events) {
      const weeks = this.parseWeeks(ev.weeks);
      const course = this.courses.find(c => c.courseId === ev.courseId);
      const color = course?.colour || '#888';
      for (const w of weeks) {
        const s = new Date(semStart); s.setDate(s.getDate() + (w - 1) * 7 + this.dayToOffset(ev.dayOfWeek));
        const [sh, sm] = ev.startTime.split(':').map(Number); s.setHours(sh, sm, 0, 0);
        const e = new Date(s); const [eh, em] = ev.endTime.split(':').map(Number); e.setHours(eh, em, 0, 0);
        cal.push({ id: `${ev.eventId}-w${w}`, title: `${course?.courseName || ev.courseId} (${ev.type})`, start: s, end: e,
          backgroundColor: color + '22', borderColor: color, textColor: color,
          extendedProps: { ...ev, courseName: course?.courseName, week: w } });
      }
    }
    for (const a of this.assignments) {
      const c = this.courses.find(x => x.courseId === a.courseId);
      cal.push({ id: a.assignmentId, title: `📝 ${a.title} due`, start: a.dueDate, allDay: true,
        backgroundColor: '#ef444422', borderColor: '#ef4444', textColor: '#dc2626',
        extendedProps: { ...a, courseName: c?.courseName, eventType: 'assignment' } });
    }
    for (const e of this.exams) {
      const c = this.courses.find(x => x.courseId === e.courseId);
      cal.push({ id: e.examId, title: `🎓 ${c?.courseName} — ${e.title}`, start: e.date,
        end: new Date(e.date.getTime() + e.durationMins * 60000),
        backgroundColor: '#f59e0b22', borderColor: '#f59e0b', textColor: '#d97706',
        extendedProps: { ...e, courseName: c?.courseName, eventType: 'exam' } });
    }
    return cal;
  }

  private getCourseName(id: string) { return this.courses.find(c => c.courseId === id)?.courseName || id; }
  private parseWeeks(s: string): number[] {
    const w: number[] = [];
    for (const p of s.split(',')) { if (p.includes('-')) { const [a, b] = p.split('-').map(Number); for (let i = a; i <= b; i++) w.push(i); } else w.push(Number(p)); }
    return w;
  }
  private dayToOffset(d: string): number { return { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[d] ?? 0; }
}
