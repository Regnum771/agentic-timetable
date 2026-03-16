import {
  IAgent, AgentInput, AgentOutput, NotificationDecision, PreferenceModel,
  CategoryPreference, AttendanceReport, PerformanceReport, TimeContext,
  UrgencyLevel, PreferenceUpdate, EventType, Verbosity,
} from './types';
import { callAgent } from '../utils/apiClient';

const DEFAULT_PREFS: CategoryPreference = {
  leadTimeDays: 7, verbosity: 'standard', includePerformance: false,
  includeAttendance: false, engagementScore: 0.5, dismissCount: 0,
  acknowledgeCount: 0, snoozeCount: 0, positiveRatings: 0, negativeRatings: 0,
};

export class PersonaAgent implements IAgent {
  id = 'persona-agent';
  name = 'Persona Agent';
  description = 'LLM-powered decision maker (Sonnet), called daily';

  private preferences: PreferenceModel = {};
  getPreferences(): PreferenceModel { return { ...this.preferences }; }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (input.type === 'getNotificationDecisions') {
      const events = input.events;
      const attendance: AttendanceReport = input.attendance;
      const performance: PerformanceReport = input.performance;
      const timeCtx: TimeContext = input.timeCtx;

      if (!events || events.length === 0) {
        return { agentId: this.id, type: 'notificationDecisions', data: [] };
      }

      try {
        // #5: Trimmed payload — only essential fields, abbreviated keys
        const resp = await callAgent(this.id, {
          t: { week: timeCtx.semesterWeek, exam: timeCtx.isExamPeriod, day: timeCtx.dayOfWeek },
          ev: events.slice(0, 15).map((e: any) => ({
            ref: e.ref, cid: e.courseId, cat: e.category, title: e.title,
            days: Math.round((e.date.getTime() - timeCtx.currentTime.getTime()) / 86400000),
            w: e.weight, pri: e.priority,
          })),
          att: { rate: attendance.overallRate, risk: attendance.riskCourses,
            courses: Object.fromEntries(Object.entries(attendance.perCourse).map(([k, v]) => [k, { r: v.rate, m: v.missedLast }])) },
          perf: { risk: performance.atRiskCourses,
            courses: Object.fromEntries(Object.entries(performance.perCourse).map(([k, v]) => [k, { avg: v.average, tier: v.riskTier }])) },
          prefs: Object.keys(this.preferences).length > 0 ? this.preferences : undefined,
        });

        const llm = resp.data.decisions || [];
        const decisions: NotificationDecision[] = llm
          .filter((d: any) => d.shouldNotify !== false)
          .map((d: any) => {
            const ev = events.find((e: any) => e.ref === d.eventRef);
            return {
              eventRef: d.eventRef, courseId: d.courseId, category: d.category as EventType,
              decidedLeadTimeDays: d.decidedLeadTimeDays ?? 3,
              urgency: (d.urgency || 'info') as UrgencyLevel,
              contentFlags: {
                includePerformance: d.contentFlags?.includePerformance ?? false,
                includeAttendance: d.contentFlags?.includeAttendance ?? false,
                verbosity: (d.contentFlags?.verbosity || 'standard') as Verbosity,
              },
              eventData: ev?.data || {},
            };
          });

        return { agentId: this.id, type: 'notificationDecisions', data: decisions,
          _llmInsight: resp.data.personaInsight, _usage: resp.usage } as any;
      } catch (e: any) {
        console.warn('PersonaAgent LLM fallback:', e.message);
        return { agentId: this.id, type: 'notificationDecisions', data: [] };
      }
    }

    if (input.type === 'applyPreferenceUpdate') {
      const u: PreferenceUpdate = input.update;
      if (!this.preferences[u.category]) this.preferences[u.category] = { ...DEFAULT_PREFS };
      const p = this.preferences[u.category];
      const d = u.deltas;
      if (d.leadTimeDays) p.leadTimeDays = Math.max(1, p.leadTimeDays + (d.leadTimeDays as number));
      if (d.verbosity) p.verbosity = d.verbosity as Verbosity;
      if (d.dismissCount) p.dismissCount += d.dismissCount;
      if (d.acknowledgeCount) p.acknowledgeCount += d.acknowledgeCount;
      if (d.snoozeCount) p.snoozeCount += d.snoozeCount;
      if (d.positiveRatings) p.positiveRatings += d.positiveRatings;
      if (d.negativeRatings) p.negativeRatings += d.negativeRatings;
      if (d.engagementScore !== undefined) p.engagementScore = p.engagementScore * 0.7 + (d.engagementScore as number) * 0.3;
      return { agentId: this.id, type: 'preferenceApplied', data: { category: u.category } };
    }

    if (input.type === 'getState') {
      return { agentId: this.id, type: 'state', data: this.preferences };
    }

    return { agentId: this.id, type: 'error', data: {} };
  }
}
