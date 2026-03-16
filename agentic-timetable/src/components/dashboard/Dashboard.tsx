import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDataStore } from '../../stores/dataStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTime } from '../../contexts/TimeProvider';
import { AttendanceReport, PerformanceReport, Course } from '../../agents/types';
import { GraduationCap, Percent, CalendarDays, TrendingUp, AlertTriangle, BookOpen } from 'lucide-react';
import { daysUntil, formatDate } from '../../utils/helpers';

interface DashboardProps {
  attendance: AttendanceReport | null;
  performance: PerformanceReport | null;
  feedbackAnalytics: any;
}

const RISK_COLORS: Record<string, string> = {
  'at-risk': '#ef4444',
  'borderline': '#f59e0b',
  'on-track': '#3b82f6',
  'excelling': '#10b981',
};

export function Dashboard({ attendance, performance, feedbackAnalytics }: DashboardProps) {
  const courses = useDataStore(s => s.courses);
  const assignments = useDataStore(s => s.assignments);
  const exams = useDataStore(s => s.exams);
  const student = useDataStore(s => s.student);
  const notifications = useNotificationStore(s => s.notifications);
  const { currentTime } = useTime();

  const gradeData = useMemo(() => {
    if (!performance) return [];
    return courses.map(c => ({
      name: c.courseId,
      fullName: c.courseName,
      grade: performance.perCourse[c.courseId]?.average || 0,
      risk: performance.perCourse[c.courseId]?.riskTier || 'on-track',
      color: c.colour,
    }));
  }, [performance, courses]);

  const attendanceData = useMemo(() => {
    if (!attendance) return [];
    return courses.map(c => ({
      name: c.courseId,
      fullName: c.courseName,
      rate: attendance.perCourse[c.courseId]?.rate || 0,
      color: c.colour,
    }));
  }, [attendance, courses]);

  // Upcoming deadlines
  const upcoming = useMemo(() => {
    const items = [
      ...assignments.map(a => ({ title: a.title, courseId: a.courseId, date: a.dueDate, type: 'assignment' as const, weight: a.weight })),
      ...exams.map(e => ({ title: e.title, courseId: e.courseId, date: e.date, type: 'exam' as const, weight: e.weight })),
    ].filter(i => i.date > currentTime)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
    return items;
  }, [assignments, exams, currentTime]);

  const engagementPie = useMemo(() => {
    if (!feedbackAnalytics) return [];
    const data = [
      { name: 'Engaged', value: feedbackAnalytics.engagementRate || 0, color: '#10b981' },
      { name: 'Unengaged', value: 100 - (feedbackAnalytics.engagementRate || 0), color: '#e2e6ef' },
    ];
    return data;
  }, [feedbackAnalytics]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="font-display font-bold text-xl text-surface-800 mb-4">Dashboard</h2>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={GraduationCap} label="Current GPA" value={student?.gpaCumulative.toFixed(1) || '—'} accent="text-accent" />
        <StatCard icon={Percent} label="Attendance" value={`${attendance?.overallRate || 0}%`}
          accent={attendance && attendance.overallRate < 75 ? 'text-status-critical' : 'text-status-success'} />
        <StatCard icon={CalendarDays} label="Notifications" value={String(notifications.length)} accent="text-purple-500" />
        <StatCard icon={TrendingUp} label="Engagement"
          value={`${feedbackAnalytics?.engagementRate || 0}%`} accent="text-status-info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Grade chart */}
        <div className="bg-white rounded-xl border border-surface-200/60 p-4">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-3">Course Grades</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, _: any, entry: any) => [`${v}% (${entry.payload.risk})`, entry.payload.fullName]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="grade" radius={[0, 4, 4, 0]}>
                {gradeData.map((d, i) => <Cell key={i} fill={RISK_COLORS[d.risk] || d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance chart */}
        <div className="bg-white rounded-xl border border-surface-200/60 p-4">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-3">Attendance Rates</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, _: any, entry: any) => [`${v}%`, entry.payload.fullName]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {attendanceData.map((d, i) => <Cell key={i} fill={d.rate < 75 ? '#ef4444' : d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming deadlines + Persona insight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-surface-200/60 p-4">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-3 flex items-center gap-2">
            <BookOpen size={14} /> Upcoming Deadlines
          </h3>
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-xs text-surface-400">No upcoming deadlines from current date</p>
            ) : upcoming.map((item, i) => {
              const course = courses.find(c => c.courseId === item.courseId);
              const days = daysUntil(currentTime, item.date);
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: course?.colour || '#888' }} />
                  <span className="text-surface-600 flex-1 truncate">{item.title}</span>
                  <span className="text-surface-400">{item.weight}%</span>
                  <span className={`font-mono font-semibold ${days <= 3 ? 'text-status-critical' : days <= 7 ? 'text-status-warning' : 'text-surface-500'}`}>
                    {days}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Persona insights */}
        <div className="bg-white rounded-xl border border-surface-200/60 p-4">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Persona Insight
          </h3>
          {feedbackAnalytics && feedbackAnalytics.totalInteractions > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={engagementPie} dataKey="value" innerRadius={18} outerRadius={28} paddingAngle={2}>
                        {engagementPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-700">{feedbackAnalytics.engagementRate}% engaged</p>
                  <p className="text-xs text-surface-400">{feedbackAnalytics.totalInteractions} interactions recorded</p>
                </div>
              </div>
              {Object.entries(feedbackAnalytics.byCategory || {}).map(([cat, data]: [string, any]) => (
                <div key={cat} className="text-xs text-surface-500">
                  <span className="font-medium capitalize text-surface-600">{cat}:</span>{' '}
                  {data.acknowledges} acks, {data.dismisses} dismissals, {data.thumbsUp} 👍, {data.thumbsDown} 👎
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-surface-400">Interact with notifications to see persona insights</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200/60 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={accent} />
        <span className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">{label}</span>
      </div>
      <p className={`text-2xl font-display font-bold ${accent}`}>{value}</p>
    </div>
  );
}
