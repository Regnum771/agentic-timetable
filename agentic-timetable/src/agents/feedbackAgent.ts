import {
  IAgent, AgentInput, AgentOutput, FeedbackEvent, PreferenceUpdate,
  PreferenceModel, CategoryPreference,
} from './types';
import { callAgent } from '../utils/apiClient';

export class FeedbackAgent implements IAgent {
  id = 'feedback-agent';
  name = 'Feedback Agent';
  description = 'LLM-powered (Sonnet), called per user action only';

  private feedbackLog: FeedbackEvent[] = [];
  private learningModel: PreferenceModel = {};

  getFeedbackLog(): FeedbackEvent[] { return [...this.feedbackLog]; }
  getLearningModel(): PreferenceModel { return JSON.parse(JSON.stringify(this.learningModel)); }

  getAnalytics() {
    const byCategory: Record<string, any> = {};
    let engageCount = 0;
    for (const fe of this.feedbackLog) {
      if (!byCategory[fe.category]) byCategory[fe.category] = { acknowledges: 0, dismisses: 0, snoozes: 0, thumbsUp: 0, thumbsDown: 0 };
      const c = byCategory[fe.category];
      if (fe.action === 'acknowledge') { c.acknowledges++; engageCount++; }
      else if (fe.action === 'dismiss') c.dismisses++;
      else if (fe.action === 'snooze') c.snoozes++;
      else if (fe.action === 'thumbs_up') { c.thumbsUp++; engageCount++; }
      else if (fe.action === 'thumbs_down') { c.thumbsDown++; engageCount++; }
    }
    return {
      totalInteractions: this.feedbackLog.length,
      engagementRate: this.feedbackLog.length > 0 ? Math.round((engageCount / this.feedbackLog.length) * 100) : 0,
      byCategory, recentEvents: this.feedbackLog.slice(-20),
    };
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (input.type === 'processFeedback') {
      const fe: FeedbackEvent = input.feedback;
      this.feedbackLog.push(fe);
      const catHistory = this.feedbackLog.filter(f => f.category === fe.category);
      const model = this.learningModel[fe.category] || { leadTimeDays: 7, dismissCount: 0, acknowledgeCount: 0, snoozeCount: 0, positiveRatings: 0, negativeRatings: 0 };

      try {
        // #5: Trimmed — minimal context for the LLM
        const resp = await callAgent(this.id, {
          action: fe.action, cat: fe.category, lead: fe.leadTimeDays,
          model, history: catHistory.slice(-8).map(f => f.action),
          total: this.feedbackLog.length,
        });
        const d = resp.data;
        const update: PreferenceUpdate | null = d.update ? {
          category: d.update.category || fe.category, deltas: d.update.deltas || {},
          reason: d.update.reason || 'LLM update',
        } : null;

        if (update) {
          if (!this.learningModel[update.category]) this.learningModel[update.category] = { ...model } as CategoryPreference;
          const m = this.learningModel[update.category];
          const dl = update.deltas;
          if (dl.leadTimeDays) m.leadTimeDays = Math.max(1, (m.leadTimeDays || 7) + (dl.leadTimeDays as number));
          if (dl.dismissCount) m.dismissCount = (m.dismissCount || 0) + dl.dismissCount;
          if (dl.acknowledgeCount) m.acknowledgeCount = (m.acknowledgeCount || 0) + dl.acknowledgeCount;
          if (dl.snoozeCount) m.snoozeCount = (m.snoozeCount || 0) + dl.snoozeCount;
          if (dl.positiveRatings) m.positiveRatings = (m.positiveRatings || 0) + dl.positiveRatings;
          if (dl.negativeRatings) m.negativeRatings = (m.negativeRatings || 0) + dl.negativeRatings;
        }
        return { agentId: this.id, type: 'preferenceUpdate', data: update, _llmAnalytics: d.analytics, _usage: resp.usage } as any;
      } catch (e: any) {
        console.warn('FeedbackAgent LLM fallback:', e.message);
        return { agentId: this.id, type: 'preferenceUpdate', data: this.fallback(fe) };
      }
    }

    if (input.type === 'getAnalytics') return { agentId: this.id, type: 'analytics', data: this.getAnalytics() };
    if (input.type === 'getState') return { agentId: this.id, type: 'state', data: { feedbackLog: this.feedbackLog, learningModel: this.learningModel } };
    return { agentId: this.id, type: 'error', data: {} };
  }

  private fallback(fe: FeedbackEvent): PreferenceUpdate {
    const d: any = { dismissCount: 0, acknowledgeCount: 0, snoozeCount: 0, positiveRatings: 0, negativeRatings: 0, engagementScore: 0.5 };
    let reason = fe.action;
    if (fe.action === 'dismiss') { d.dismissCount = 1; d.engagementScore = 0.2; }
    else if (fe.action === 'acknowledge') { d.acknowledgeCount = 1; d.engagementScore = 0.8; }
    else if (fe.action === 'snooze') { d.snoozeCount = 1; d.engagementScore = 0.5; }
    else if (fe.action === 'thumbs_up') { d.positiveRatings = 1; d.engagementScore = 0.9; }
    else if (fe.action === 'thumbs_down') { d.negativeRatings = 1; d.engagementScore = 0.2; }
    return { category: fe.category, deltas: d, reason };
  }
}
