import {
  IAgent, AgentInput, AgentOutput, NotificationDecision, AppNotification,
  AttendanceReport, PerformanceReport, Course,
} from './types';
import { callAgent } from '../utils/apiClient';
import { v4 as uuid } from 'uuid';

export class NotificationComposerAgent implements IAgent {
  id = 'notification-composer-agent';
  name = 'Notification Composer Agent';
  description = 'LLM-powered writer (Sonnet), called daily';

  private courses: Course[] = [];
  private compositionLog: Array<{ notificationId: string; templateId: string; timestamp: Date }> = [];
  loadCourses(courses: Course[]) { this.courses = courses; }
  getCompositionLog() { return [...this.compositionLog]; }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (input.type === 'composeNotifications') {
      const decisions: NotificationDecision[] = input.decisions;
      const attendance: AttendanceReport = input.attendance;
      const performance: PerformanceReport = input.performance;
      if (!decisions || decisions.length === 0) return { agentId: this.id, type: 'composedNotifications', data: [] };

      try {
        // #5: Trimmed — only what the writer needs
        const resp = await callAgent(this.id, {
          items: decisions.map(d => {
            const c = this.courses.find(x => x.courseId === d.courseId);
            const p = performance.perCourse[d.courseId];
            const a = attendance.perCourse[d.courseId];
            return {
              ref: d.eventRef, cid: d.courseId, cname: c?.courseName || d.courseId,
              cat: d.category, urg: d.urgency, days: d.decidedLeadTimeDays,
              flags: d.contentFlags,
              ev: { title: d.eventData?.title, w: d.eventData?.weight, loc: d.eventData?.location, topics: d.eventData?.topics },
              grade: p ? `${p.average}% (${p.riskTier})` : undefined,
              attRate: a ? `${a.rate}%` : undefined,
            };
          }),
        });

        const llm = resp.data.notifications || [];
        const notifs: AppNotification[] = llm.map((ln: any) => {
          const dec = decisions.find(d => d.eventRef === ln.eventRef) || decisions[0];
          const course = this.courses.find(c => c.courseId === (ln.courseId || dec.courseId));
          const id = uuid();
          this.compositionLog.push({ notificationId: id, templateId: ln.templateId || 'llm', timestamp: new Date() });
          return {
            id, eventRef: ln.eventRef || dec.eventRef, category: ln.category || dec.category,
            title: ln.title || `${dec.category} reminder`, body: ln.body || 'Check your schedule.',
            urgency: ln.urgency || dec.urgency, status: 'delivered' as const,
            scheduledFor: new Date(), deliveredAt: new Date(),
            courseId: dec.courseId, courseName: course?.courseName, courseColour: course?.colour,
            templateId: ln.templateId || 'llm-generated',
            metadata: { leadTimeDays: dec.decidedLeadTimeDays, weight: dec.eventData?.weight, tone: ln.tone },
          };
        });
        return { agentId: this.id, type: 'composedNotifications', data: notifs, _usage: resp.usage } as any;
      } catch (e: any) {
        console.warn('ComposerAgent LLM fallback:', e.message);
        const notifs = decisions.map(d => {
          const c = this.courses.find(x => x.courseId === d.courseId);
          return {
            id: uuid(), eventRef: d.eventRef, category: d.category,
            title: `${d.category === 'exam' ? '🎓' : '📝'} ${d.eventData?.title || c?.courseName}`,
            body: `${d.category} for ${c?.courseName}. ${d.decidedLeadTimeDays} days remaining.`,
            urgency: d.urgency, status: 'delivered' as const,
            scheduledFor: new Date(), deliveredAt: new Date(),
            courseId: d.courseId, courseName: c?.courseName, courseColour: c?.colour,
            templateId: 'fallback', metadata: { leadTimeDays: d.decidedLeadTimeDays },
          } as AppNotification;
        });
        return { agentId: this.id, type: 'composedNotifications', data: notifs };
      }
    }
    return { agentId: this.id, type: 'error', data: {} };
  }
}
