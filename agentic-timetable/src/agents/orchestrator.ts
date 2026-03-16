import { v4 as uuid } from 'uuid';
import { TimeAgent } from './timeAgent';
import { TimetableAgent } from './timetableAgent';
import { AttendanceAgent } from './attendanceAgent';
import { PerformanceAgent } from './performanceAgent';
import { PersonaAgent } from './personaAgent';
import { NotificationComposerAgent } from './notificationComposerAgent';
import { FeedbackAgent } from './feedbackAgent';
import {
  AgentMessage, AppNotification, FeedbackEvent, PreferenceUpdate,
  Course, TimetableEvent, Assignment, Exam, AttendanceRecord, GradeRecord,
} from './types';
import { callAgent } from '../utils/apiClient';
import { buildDigestContext, buildWeeklyContext } from '../utils/contextBuilder';

export class Orchestrator {
  timeAgent = new TimeAgent();
  timetableAgent = new TimetableAgent();
  attendanceAgent = new AttendanceAgent();
  performanceAgent = new PerformanceAgent();
  personaAgent = new PersonaAgent();
  composerAgent = new NotificationComposerAgent();
  feedbackAgent = new FeedbackAgent();

  private log: AgentMessage[] = [];
  private deliveredEventRefs = new Set<string>();
  private deliveredReminderKeys = new Set<string>();
  private lastDailyKey = '';
  private lastWeeklyKey = 0;
  private cachedAttendanceReport: any = null;

  // Store raw data refs for digest/weekly context building
  private courses: Course[] = [];
  private assignments: Assignment[] = [];
  private exams: Exam[] = [];
  private timetable: TimetableEvent[] = [];

  getLog(): AgentMessage[] { return [...this.log]; }

  private addLog(from: string, to: string, type: AgentMessage['type'], payload: any) {
    this.log.push({ id: uuid(), from, to, type, payload, timestamp: new Date() });
    if (this.log.length > 500) this.log = this.log.slice(-300);
  }

  loadData(data: {
    courses: Course[]; timetable: TimetableEvent[]; assignments: Assignment[];
    exams: Exam[]; attendance: AttendanceRecord[]; grades: GradeRecord[];
  }) {
    this.courses = data.courses;
    this.assignments = data.assignments;
    this.exams = data.exams;
    this.timetable = data.timetable;
    this.timetableAgent.loadData(data.timetable, data.assignments, data.exams, data.courses);
    this.attendanceAgent.loadData(data.attendance);
    this.performanceAgent.loadData(data.grades, data.assignments);
    this.composerAgent.loadCourses(data.courses);
    this.cachedAttendanceReport = this.attendanceAgent.computeLocal();
    this.addLog('orchestrator', 'all', 'event', { type: 'dataLoaded' });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HOURLY TICK — fully local, no API calls
  // Checks for lectures/tutorials starting within 60 minutes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async onHourlyTick(currentTime: Date): Promise<AppNotification[]> {
    // 1. Local time context (no API call)
    const timeResult = await this.timeAgent.process({ type: 'getContext', currentTime });
    const timeCtx = timeResult.data;

    // 2. Local proximity check for imminent classes
    const lowAttCourses = this.cachedAttendanceReport?.riskCourses || [];
    const reminderResult = await this.timetableAgent.process({
      type: 'getImminentClasses',
      currentTime,
      semesterWeek: timeCtx.semesterWeek,
      lowAttendanceCourses: lowAttCourses,
    });

    const reminders: AppNotification[] = reminderResult.data;

    // Deduplicate: don't re-send same class reminder
    const newReminders = reminders.filter(r => {
      const key = r.eventRef;
      if (this.deliveredReminderKeys.has(key)) return false;
      this.deliveredReminderKeys.add(key);
      return true;
    });

    if (newReminders.length > 0) {
      this.addLog('timetable-agent', 'orchestrator', 'event', {
        type: 'localReminders', count: newReminders.length, _noApiCall: true,
      });
    }

    return newReminders;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DAILY TICK — full LLM pipeline (up to 5 API calls)
  // Timetable enrichment (Haiku) + Attendance insights (Haiku) +
  // Performance insights (Haiku) + Persona decisions (Sonnet) +
  // Notification composition (Sonnet)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async onDailyTick(currentTime: Date): Promise<AppNotification[]> {
    const dayKey = currentTime.toISOString().split('T')[0];

    // #4: Skip if already ran for this simulated day
    if (dayKey === this.lastDailyKey) return [];
    this.lastDailyKey = dayKey;

    this.addLog('orchestrator', 'system', 'event', { type: 'dailyPipeline', day: dayKey });

    // 1. Local time context (free)
    const timeResult = await this.timeAgent.process({ type: 'getContext', currentTime });
    const timeCtx = timeResult.data;
    this.addLog('time-agent', 'orchestrator', 'response', { week: timeCtx.semesterWeek, _local: true });

    // 2. Local event list + LLM enrichment/prioritization (1 Haiku call)
    const rawEvents = await this.timetableAgent.process({ type: 'getUpcoming', timeCtx });
    this.addLog('timetable-agent', 'orchestrator', 'response', { eventCount: rawEvents.data.length, _local: true });

    if (rawEvents.data.length === 0) return [];

    this.addLog('orchestrator', 'timetable-agent', 'query', { type: 'enrichUpcoming' });
    const enriched = await this.timetableAgent.process({
      type: 'enrichUpcoming', events: rawEvents.data,
      semesterWeek: timeCtx.semesterWeek, isExamPeriod: timeCtx.isExamPeriod,
    });
    const events = enriched.data;
    this.addLog('timetable-agent', 'orchestrator', 'response', {
      enrichedCount: events.length, _usage: (enriched as any)._usage,
    });

    // 3. Attendance + Performance — LLM enrichment in parallel (2 Haiku calls, cached per day)
    this.addLog('orchestrator', 'attendance-agent', 'query', { type: 'getEnrichedReport' });
    this.addLog('orchestrator', 'performance-agent', 'query', { type: 'getEnrichedReport' });
    const [attResult, perfResult] = await Promise.all([
      this.attendanceAgent.process({ type: 'getEnrichedReport', dayKey }),
      this.performanceAgent.process({ type: 'getEnrichedReport', dayKey }),
    ]);
    const attendance = attResult.data;
    const performance = perfResult.data;
    this.cachedAttendanceReport = attendance; // update cache for hourly use
    this.addLog('attendance-agent', 'orchestrator', 'response', {
      rate: attendance.overallRate, _cached: (attResult as any)._cached, _usage: (attResult as any)._usage,
    });
    this.addLog('performance-agent', 'orchestrator', 'response', {
      atRisk: performance.atRiskCourses, _cached: (perfResult as any)._cached, _usage: (perfResult as any)._usage,
    });

    // 4. Persona Agent — LLM decides what to notify (1 Sonnet call)
    this.addLog('orchestrator', 'persona-agent', 'query', { type: 'getNotificationDecisions' });
    const decisionsResult = await this.personaAgent.process({
      type: 'getNotificationDecisions', events, attendance, performance, timeCtx,
    });
    const decisions = decisionsResult.data;
    this.addLog('persona-agent', 'orchestrator', 'response', {
      decisionCount: decisions.length, _insight: (decisionsResult as any)._llmInsight, _usage: (decisionsResult as any)._usage,
    });

    // Deduplicate
    const newDecisions = decisions.filter((d: any) => !this.deliveredEventRefs.has(d.eventRef));
    if (newDecisions.length === 0) return [];

    // 5. Notification Composer — LLM writes the messages (1 Sonnet call)
    this.addLog('orchestrator', 'notification-composer-agent', 'query', { type: 'composeNotifications', count: newDecisions.length });
    const composeResult = await this.composerAgent.process({
      type: 'composeNotifications', decisions: newDecisions, attendance, performance,
    });
    const notifications: AppNotification[] = composeResult.data;
    this.addLog('notification-composer-agent', 'orchestrator', 'response', {
      count: notifications.length, _usage: (composeResult as any)._usage,
    });

    for (const n of notifications) this.deliveredEventRefs.add(n.eventRef);

    // ── 6. Daily Digest — 1 Sonnet call via dedicated agent ──
    this.addLog('orchestrator', 'daily-digest-agent', 'query', { type: 'compose' });
    try {
      const digestCtx = buildDigestContext(
        currentTime, timeCtx.semesterWeek, this.courses,
        attendance, performance, this.assignments, this.exams, this.timetable,
      );
      const digestResp = await callAgent('daily-digest-agent', { context: digestCtx });
      const d = digestResp.data;
      if (d.title && d.body) {
        const digestNotif: AppNotification = {
          id: uuid(), eventRef: `digest-${dayKey}`, category: 'lecture',
          title: d.title, body: d.body, urgency: 'info',
          status: 'delivered', scheduledFor: currentTime, deliveredAt: currentTime,
          courseId: 'SYSTEM', courseName: 'Daily Digest', courseColour: '#6366f1',
          templateId: `digest-${d.tone || 'neutral'}`,
          metadata: { type: 'daily-digest', leadTimeDays: 0 },
        };
        notifications.push(digestNotif);
        this.addLog('daily-digest-agent', 'orchestrator', 'response', { _usage: digestResp.usage });
      }
    } catch (e: any) {
      console.warn('Daily digest failed:', e.message);
    }

    // ── 7. Weekly Summary — 1 Sonnet call, Monday only ──
    const isMonday = currentTime.getDay() === 1;
    if (isMonday && timeCtx.semesterWeek !== this.lastWeeklyKey) {
      this.lastWeeklyKey = timeCtx.semesterWeek;
      this.addLog('orchestrator', 'weekly-summary-agent', 'query', { type: 'compose', week: timeCtx.semesterWeek });
      try {
        const weeklyCtx = buildWeeklyContext(
          currentTime, timeCtx.semesterWeek, this.courses,
          attendance, performance, this.assignments, this.exams, this.timetable,
        );
        const weeklyResp = await callAgent('weekly-summary-agent', { context: weeklyCtx });
        const w = weeklyResp.data;
        if (w.title && w.body) {
          const weeklyNotif: AppNotification = {
            id: uuid(), eventRef: `weekly-${timeCtx.semesterWeek}`, category: 'lecture',
            title: w.title, body: w.body, urgency: 'info',
            status: 'delivered', scheduledFor: currentTime, deliveredAt: currentTime,
            courseId: 'SYSTEM', courseName: 'Weekly Summary', courseColour: '#8b5cf6',
            templateId: `weekly-${w.tone || 'neutral'}`,
            metadata: { type: 'weekly-summary', week: timeCtx.semesterWeek, leadTimeDays: 0 },
          };
          notifications.push(weeklyNotif);
          this.addLog('weekly-summary-agent', 'orchestrator', 'response', { _usage: weeklyResp.usage });
        }
      } catch (e: any) {
        console.warn('Weekly summary failed:', e.message);
      }
    }

    const apiCallSummary = `3 Haiku + 2 Sonnet + 1 digest${isMonday ? ' + 1 weekly' : ''}`;
    this.addLog('orchestrator', 'system', 'event', {
      type: 'dailyPipelineComplete', notifications: notifications.length, apiCalls: apiCallSummary,
    });

    return notifications;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER FEEDBACK — 1 Sonnet call per interaction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async onUserFeedback(feedbackEvent: FeedbackEvent): Promise<PreferenceUpdate | null> {
    this.addLog('ui', 'orchestrator', 'feedback', { action: feedbackEvent.action, category: feedbackEvent.category });

    this.addLog('orchestrator', 'feedback-agent', 'feedback', { action: feedbackEvent.action });
    const fbResult = await this.feedbackAgent.process({ type: 'processFeedback', feedback: feedbackEvent });
    const update: PreferenceUpdate | null = fbResult.data;

    if (update) {
      this.addLog('feedback-agent', 'orchestrator', 'preference_update', {
        ...update, _usage: (fbResult as any)._usage,
      });
      this.addLog('orchestrator', 'persona-agent', 'preference_update', { category: update.category });
      await this.personaAgent.process({ type: 'applyPreferenceUpdate', update });
      this.addLog('persona-agent', 'orchestrator', 'response', { applied: true });
    }
    return update;
  }

  resetDeliveryTracking() {
    this.deliveredEventRefs.clear();
    this.deliveredReminderKeys.clear();
    this.lastDailyKey = '';
    this.lastWeeklyKey = 0;
  }
}
