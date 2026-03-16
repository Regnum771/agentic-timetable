import { IAgent, AgentInput, AgentOutput, AttendanceRecord, AttendanceReport } from './types';
import { callAgent } from '../utils/apiClient';

export class AttendanceAgent implements IAgent {
  id = 'attendance-agent';
  name = 'Attendance Agent';
  description = 'Local computation; LLM insights cached per simulated day';

  private records: AttendanceRecord[] = [];
  // #4: Cache — store LLM-enriched report per simulated day
  private cache: { dayKey: string; report: AttendanceReport } | null = null;

  loadData(records: AttendanceRecord[]) { this.records = records; }

  async process(input: AgentInput): Promise<AgentOutput> {
    // Local-only report (fast, no API call)
    if (input.type === 'getReport') {
      const report = this.computeLocal();
      return { agentId: this.id, type: 'attendanceReport', data: report, _local: true } as any;
    }

    // LLM-enriched report (daily only, cached)
    if (input.type === 'getEnrichedReport') {
      const dayKey = input.dayKey as string;
      if (this.cache && this.cache.dayKey === dayKey) {
        return { agentId: this.id, type: 'attendanceReport', data: this.cache.report, _cached: true } as any;
      }

      const localReport = this.computeLocal();

      try {
        // #5: Trimmed payload — send summaries not raw records
        const byCourse: Record<string, any> = {};
        for (const [cid, data] of Object.entries(this.groupByCourse())) {
          byCourse[cid] = { p: data.present, a: data.absent, l: data.late, recent: data.records.slice(-6).map((r: any) => `${r.day}:${r.status[0]}`) };
        }

        const resp = await callAgent(this.id, { byCourse });
        const d = resp.data;
        const enriched: AttendanceReport = {
          overallRate: d.overallRate ?? localReport.overallRate,
          perCourse: d.perCourse ?? localReport.perCourse,
          riskCourses: d.riskCourses ?? localReport.riskCourses,
        };
        this.cache = { dayKey, report: enriched };
        return { agentId: this.id, type: 'attendanceReport', data: enriched, _usage: resp.usage, _llmInsights: d.insights } as any;
      } catch (e: any) {
        console.warn('AttendanceAgent LLM fallback:', e.message);
        this.cache = { dayKey, report: localReport };
        return { agentId: this.id, type: 'attendanceReport', data: localReport };
      }
    }

    return { agentId: this.id, type: 'error', data: {} };
  }

  private groupByCourse() {
    const map: Record<string, { present: number; absent: number; late: number; records: any[] }> = {};
    for (const r of this.records) {
      if (!map[r.courseId]) map[r.courseId] = { present: 0, absent: 0, late: 0, records: [] };
      const c = map[r.courseId];
      if (r.status === 'present') c.present++; else if (r.status === 'absent') c.absent++; else c.late++;
      c.records.push({ week: r.week, day: r.date.toLocaleDateString('en-US', { weekday: 'short' }), status: r.status });
    }
    return map;
  }

  computeLocal(): AttendanceReport {
    const byCourse = this.groupByCourse();
    let totalP = 0, totalR = 0;
    const perCourse: AttendanceReport['perCourse'] = {};
    const risk: string[] = [];
    for (const [id, d] of Object.entries(byCourse)) {
      const rate = Math.round(((d.present + d.late) / (d.present + d.absent + d.late)) * 100);
      totalP += d.present + d.late; totalR += d.present + d.absent + d.late;
      const sorted = d.records;
      const mid = Math.floor(sorted.length / 2);
      const r1 = sorted.slice(0, mid).filter((r: any) => r.status !== 'absent').length / Math.max(1, mid);
      const r2 = sorted.slice(mid).filter((r: any) => r.status !== 'absent').length / Math.max(1, sorted.length - mid);
      const trend = r2 > r1 + 0.05 ? 'improving' as const : r2 < r1 - 0.05 ? 'declining' as const : 'stable' as const;
      const missedLast = sorted.slice(-6).filter((r: any) => r.status === 'absent').length;
      perCourse[id] = { rate, trend, missedLast };
      if (rate < 75) risk.push(id);
    }
    return { overallRate: totalR > 0 ? Math.round((totalP / totalR) * 100) : 100, perCourse, riskCourses: risk };
  }
}
