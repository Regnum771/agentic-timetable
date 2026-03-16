import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CalendarView } from './components/calendar/CalendarView';
import { NotificationCentre } from './components/notifications/NotificationCentre';
import { ToastArea } from './components/notifications/ToastArea';
import { Dashboard } from './components/dashboard/Dashboard';
import { DebugPanel } from './components/debug/DebugPanel';
import { ChatView } from './components/chat/ChatView';
import { TimeProvider, useTime } from './contexts/TimeProvider';
import { Orchestrator } from './agents/orchestrator';
import { useDataStore } from './stores/dataStore';
import { useNotificationStore } from './stores/notificationStore';
import { useAgentLogStore } from './stores/agentLogStore';
import { loadAllData } from './utils/csvLoader';
import { fetchStats } from './utils/apiClient';
import {
  FeedbackAction, AttendanceReport, PerformanceReport,
  CalendarEvent, FeedbackEvent,
} from './agents/types';
import { Loader2 } from 'lucide-react';

type ViewName = 'calendar' | 'notifications' | 'dashboard' | 'chat' | 'debug';
const orchestrator = new Orchestrator();

function AppInner() {
  const [activeView, setActiveView] = useState<ViewName>('calendar');
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [performance, setPerformance] = useState<PerformanceReport | null>(null);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [feedbackLog, setFeedbackLog] = useState<any[]>([]);
  const [learningModel, setLearningModel] = useState<any>({});
  const [apiStats, setApiStats] = useState<any>(null);

  const isLoaded = useDataStore(s => s.isLoaded);
  const setData = useDataStore(s => s.setData);
  const addNotifications = useNotificationStore(s => s.addNotifications);
  const updateStatus = useNotificationStore(s => s.updateStatus);
  const notifications = useNotificationStore(s => s.notifications);
  const setLogMessages = useAgentLogStore(s => s.setMessages);
  const { currentTime } = useTime();

  // Load CSV data on mount
  useEffect(() => {
    loadAllData().then(data => {
      setData(data);
      orchestrator.loadData({
        courses: data.courses, timetable: data.timetable,
        assignments: data.assignments, exams: data.exams,
        attendance: data.attendance, grades: data.grades,
      });
      orchestrator.timetableAgent.process({ type: 'getCalendarEvents' }).then(res => setCalEvents(res.data));
      // Local reports for initial display
      orchestrator.attendanceAgent.process({ type: 'getReport' }).then(r => setAttendance(r.data));
      orchestrator.performanceAgent.process({ type: 'getReport' }).then(r => setPerformance(r.data));
    });
  }, []);

  // Poll API stats every 10s for debug panel
  useEffect(() => {
    const poll = () => fetchStats().then(setApiStats).catch(() => {});
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFeedbackAction = useCallback(async (notifId: string, action: FeedbackAction) => {
    const notif = notifications.find(n => n.id === notifId);
    if (!notif) return;
    const statusMap: Record<FeedbackAction, any> = {
      acknowledge: 'acknowledged', dismiss: 'dismissed', snooze: 'snoozed',
      thumbs_up: 'acknowledged', thumbs_down: 'acknowledged',
    };
    updateStatus(notifId, statusMap[action]);

    const feedbackEvent: FeedbackEvent = {
      notificationId: notifId, action, timestamp: currentTime,
      category: notif.category, leadTimeDays: notif.metadata?.leadTimeDays || 0,
      templateUsed: notif.templateId,
    };
    await orchestrator.onUserFeedback(feedbackEvent);

    setLogMessages(orchestrator.getLog());
    setFeedbackLog(orchestrator.feedbackAgent.getFeedbackLog());
    setLearningModel(orchestrator.feedbackAgent.getLearningModel());
    const analytics = await orchestrator.feedbackAgent.process({ type: 'getAnalytics' });
    setFeedbackAnalytics(analytics.data);
    const ps = await orchestrator.personaAgent.process({ type: 'getState' });
    setPreferences(ps.data);
    fetchStats().then(setApiStats).catch(() => {});
  }, [notifications, currentTime, updateStatus, setLogMessages]);

  const handleResetPreferences = useCallback(() => {
    orchestrator.personaAgent = new (orchestrator.personaAgent.constructor as any)();
    orchestrator.feedbackAgent = new (orchestrator.feedbackAgent.constructor as any)();
    orchestrator.resetDeliveryTracking();
    setPreferences({}); setFeedbackLog([]); setLearningModel({}); setFeedbackAnalytics(null);
  }, []);

  const activeNotifCount = notifications.filter(n => n.status === 'delivered').length;
  const stats = useMemo(() => ({
    gpa: useDataStore.getState().student?.gpaCumulative || 0,
    attendance: attendance?.overallRate || 0,
    notifCount: activeNotifCount,
  }), [attendance, activeNotifCount]);

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-accent animate-spin" />
          <p className="text-sm text-surface-400 font-medium">Loading semester data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeView={activeView} onViewChange={setActiveView} stats={stats} />
        <main className="flex-1 overflow-hidden bg-surface-50">
          {activeView === 'calendar' && <CalendarView events={calEvents} />}
          {activeView === 'notifications' && <NotificationCentre onAction={handleFeedbackAction} />}
          {activeView === 'chat' && <ChatView attendance={attendance} performance={performance} />}
          {activeView === 'dashboard' && <Dashboard attendance={attendance} performance={performance} feedbackAnalytics={feedbackAnalytics} />}
          {activeView === 'debug' && (
            <DebugPanel preferences={preferences} feedbackLog={feedbackLog}
              learningModel={learningModel} apiStats={apiStats}
              onResetPreferences={handleResetPreferences} />
          )}
        </main>
      </div>
      <ToastArea onAction={handleFeedbackAction} />
    </div>
  );
}

function AppWithTick() {
  const addNotifications = useNotificationStore(s => s.addNotifications);
  const setLogMessages = useAgentLogStore(s => s.setMessages);
  const lastHourRef = useRef(0);
  const lastDayRef = useRef('');
  const busyRef = useRef(false);

  const handleTick = useCallback(async (time: Date) => {
    // ── Hourly: local-only lecture proximity check (no API calls) ──
    const hourKey = Math.floor(time.getTime() / (1000 * 60 * 60));
    if (hourKey !== lastHourRef.current) {
      lastHourRef.current = hourKey;
      try {
        const reminders = await orchestrator.onHourlyTick(time);
        if (reminders.length > 0) addNotifications(reminders);
        setLogMessages(orchestrator.getLog());
      } catch (e) { console.error('Hourly tick error:', e); }
    }

    // ── Daily: full LLM pipeline (3 Haiku + 2 Sonnet calls max) ──
    const dayKey = time.toISOString().split('T')[0];
    if (dayKey !== lastDayRef.current && !busyRef.current) {
      lastDayRef.current = dayKey;
      busyRef.current = true;
      try {
        const notifications = await orchestrator.onDailyTick(time);
        if (notifications.length > 0) addNotifications(notifications);
        setLogMessages(orchestrator.getLog());
      } catch (e) {
        console.error('Daily tick error:', e);
      } finally {
        busyRef.current = false;
      }
    }
  }, [addNotifications, setLogMessages]);

  return (
    <TimeProvider onTick={handleTick}>
      <AppInner />
    </TimeProvider>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setTimeout(() => setReady(true), 100); }, []);
  if (!ready) return <div className="h-screen flex items-center justify-center bg-surface-50"><Loader2 size={32} className="text-accent animate-spin" /></div>;
  return <AppWithTick />;
}
