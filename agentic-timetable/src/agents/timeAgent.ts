import { IAgent, AgentInput, AgentOutput, TimeContext, DayOfWeek } from './types';

const SEMESTER_START = new Date('2026-02-02T08:00:00');
const SEMESTER_END = new Date('2026-05-22T18:00:00');
const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export class TimeAgent implements IAgent {
  id = 'time-agent';
  name = 'Time Agent';
  description = 'Fully local — computes temporal context without API calls';

  async process(input: AgentInput): Promise<AgentOutput> {
    if (input.type === 'getContext') {
      const now: Date = input.currentTime;
      const weekMs = now.getTime() - SEMESTER_START.getTime();
      const semesterWeek = Math.max(1, Math.min(16, Math.floor(weekMs / (7 * 24 * 60 * 60 * 1000)) + 1));
      const jsDay = now.getDay();
      const dayOfWeek: DayOfWeek = jsDay >= 1 && jsDay <= 5 ? DAYS[jsDay - 1] : 'Monday';
      const isExamPeriod = semesterWeek >= 14;
      const hour = now.getHours();
      const periodOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

      const lookAheadEnd = new Date(now);
      lookAheadEnd.setDate(lookAheadEnd.getDate() + 14);

      const ctx: TimeContext = {
        currentTime: now, semesterWeek, dayOfWeek, isExamPeriod,
        lookAheadWindow: { start: now, end: lookAheadEnd },
      };

      return {
        agentId: this.id, type: 'timeContext', data: ctx,
        _local: true, _insights: `Week ${semesterWeek}, ${dayOfWeek} ${periodOfDay}${isExamPeriod ? ' (EXAM PERIOD)' : ''}`,
      } as any;
    }
    return { agentId: this.id, type: 'error', data: {} };
  }

  static getSemesterStart() { return SEMESTER_START; }
  static getSemesterEnd() { return SEMESTER_END; }
}
