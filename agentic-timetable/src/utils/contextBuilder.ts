import { Course, StudentProfile, AttendanceReport, PerformanceReport, Assignment, Exam, TimetableEvent, TimeContext } from '../agents/types';
import { TimeAgent } from '../agents/timeAgent';

// ── Tier 1: Static student profile (cached in system prompt) ──
export function buildTier1(student: StudentProfile, courses: Course[]): string {
  const courseList = courses.map(c => `${c.courseId} ${c.courseName}`).join(', ');
  return `Student: ${student.name}, ${student.program}, Semester ${student.semester}, Cumulative GPA ${student.gpaCumulative}\nCourses: ${courseList}`;
}

// ── Tier 2: Day snapshot (rebuilt once per simulated day) ──
export function buildTier2(
  currentTime: Date,
  semesterWeek: number,
  courses: Course[],
  attendance: AttendanceReport,
  performance: PerformanceReport,
  assignments: Assignment[],
  exams: Exam[],
  timetable: TimetableEvent[],
): string {
  const lines: string[] = [];

  // Date line
  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const isExam = semesterWeek >= 14;
  lines.push(`Date: ${dayName}, Week ${semesterWeek}/16${isExam ? ' (EXAM PERIOD)' : ''}`);

  // Grades summary
  const grades = courses.map(c => {
    const p = performance.perCourse[c.courseId];
    if (!p) return `${c.courseId} no grades`;
    const flag = p.riskTier === 'at-risk' ? ' AT-RISK' : p.riskTier === 'borderline' ? ' BORDERLINE' : '';
    return `${c.courseId} ${p.average}% ${p.riskTier}${flag}`;
  }).join(' | ');
  lines.push(`Grades: ${grades}`);

  // Attendance summary
  const attLine = courses.map(c => {
    const a = attendance.perCourse[c.courseId];
    if (!a) return null;
    const flag = a.rate < 75 ? ' LOW' : '';
    return `${c.courseId} ${a.rate}%${flag}`;
  }).filter(Boolean).join(' | ');
  lines.push(`Attendance: ${attendance.overallRate}% overall | ${attLine}`);

  // Upcoming deadlines (next 14 days)
  const now = currentTime.getTime();
  const upcoming = [
    ...assignments.map(a => ({ title: a.title, cid: a.courseId, date: a.dueDate, w: a.weight, type: 'due' })),
    ...exams.map(e => ({ title: e.title, cid: e.courseId, date: e.date, w: e.weight, type: 'exam' })),
  ]
    .filter(i => i.date.getTime() > now && i.date.getTime() - now < 14 * 86400000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  if (upcoming.length > 0) {
    const deadlines = upcoming.map(u => {
      const days = Math.round((u.date.getTime() - now) / 86400000);
      return `${u.title} (${u.cid}, ${u.w}%) in ${days}d`;
    }).join(' | ');
    lines.push(`Upcoming: ${deadlines}`);
  }

  // Today's classes
  const semStart = TimeAgent.getSemesterStart();
  const jsDay = currentTime.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[jsDay];
  const todayClasses = timetable
    .filter(ev => ev.dayOfWeek === todayName)
    .filter(ev => {
      const weeks = parseWeeks(ev.weeks);
      return weeks.includes(semesterWeek);
    })
    .map(ev => {
      const c = courses.find(x => x.courseId === ev.courseId);
      return `${c?.courseName || ev.courseId} ${ev.type} ${ev.startTime} ${ev.location}`;
    });

  if (todayClasses.length > 0) {
    lines.push(`Today: ${todayClasses.join(' | ')}`);
  } else {
    lines.push(`Today: No classes scheduled`);
  }

  return lines.join('\n');
}

// ── Tier 3: Per-message timestamp (tiny) ──
export function buildTier3(currentTime: Date): string {
  return `[Time: ${currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}]`;
}

// ── Build context for daily digest ──
export function buildDigestContext(
  currentTime: Date,
  semesterWeek: number,
  courses: Course[],
  attendance: AttendanceReport,
  performance: PerformanceReport,
  assignments: Assignment[],
  exams: Exam[],
  timetable: TimetableEvent[],
): string {
  return buildTier2(currentTime, semesterWeek, courses, attendance, performance, assignments, exams, timetable);
}

// ── Build context for weekly summary ──
export function buildWeeklyContext(
  currentTime: Date,
  semesterWeek: number,
  courses: Course[],
  attendance: AttendanceReport,
  performance: PerformanceReport,
  assignments: Assignment[],
  exams: Exam[],
  timetable: TimetableEvent[],
): string {
  const base = buildTier2(currentTime, semesterWeek, courses, attendance, performance, assignments, exams, timetable);

  // Add last-week stats summary
  const lastWeekClasses = timetable.filter(ev => {
    const weeks = parseWeeks(ev.weeks);
    return weeks.includes(semesterWeek - 1);
  }).length;

  return `${base}\nLast week: ${lastWeekClasses} scheduled classes, Week ${semesterWeek - 1}`;
}

function parseWeeks(s: string): number[] {
  const w: number[] = [];
  for (const p of s.split(',')) {
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number);
      for (let i = a; i <= b; i++) w.push(i);
    } else w.push(Number(p));
  }
  return w;
}
