import { IAgent, AgentInput, AgentOutput, GradeRecord, Assignment, PerformanceReport, RiskTier } from './types';
import { callAgent } from '../utils/apiClient';

export class PerformanceAgent implements IAgent {
  id = 'performance-agent';
  name = 'Performance Agent';
  description = 'Local computation; LLM insights cached per simulated day';

  private grades: GradeRecord[] = [];
  private assignments: Assignment[] = [];
  private cache: { dayKey: string; report: PerformanceReport } | null = null;

  loadData(grades: GradeRecord[], assignments: Assignment[]) { this.grades = grades; this.assignments = assignments; }

  async process(input: AgentInput): Promise<AgentOutput> {
    if (input.type === 'getReport') {
      return { agentId: this.id, type: 'performanceReport', data: this.computeLocal(), _local: true } as any;
    }

    if (input.type === 'getEnrichedReport') {
      const dayKey = input.dayKey as string;
      if (this.cache && this.cache.dayKey === dayKey) {
        return { agentId: this.id, type: 'performanceReport', data: this.cache.report, _cached: true } as any;
      }

      const local = this.computeLocal();
      try {
        // #5: Trimmed — send per-course summaries only
        const summary: Record<string, any> = {};
        for (const [cid, grades] of Object.entries(this.groupByCourse())) {
          summary[cid] = {
            scores: grades.map(g => g.score),
            late: grades.filter(g => g.late).length,
            n: grades.length,
          };
        }
        const resp = await callAgent(this.id, { gradesByCourse: summary });
        const d = resp.data;
        const enriched: PerformanceReport = {
          gpa: d.gpa ?? local.gpa,
          perCourse: d.perCourse ?? local.perCourse,
          atRiskCourses: d.atRiskCourses ?? local.atRiskCourses,
        };
        this.cache = { dayKey, report: enriched };
        return { agentId: this.id, type: 'performanceReport', data: enriched, _usage: resp.usage, _llmInsights: d.insights } as any;
      } catch (e: any) {
        console.warn('PerformanceAgent LLM fallback:', e.message);
        this.cache = { dayKey, report: local };
        return { agentId: this.id, type: 'performanceReport', data: local };
      }
    }

    return { agentId: this.id, type: 'error', data: {} };
  }

  private groupByCourse(): Record<string, GradeRecord[]> {
    const m: Record<string, GradeRecord[]> = {};
    for (const g of this.grades) { if (!m[g.courseId]) m[g.courseId] = []; m[g.courseId].push(g); }
    return m;
  }

  computeLocal(): PerformanceReport {
    const byCourse = this.groupByCourse();
    const perCourse: PerformanceReport['perCourse'] = {};
    const atRisk: string[] = [];
    let total = 0, count = 0;
    for (const [id, grades] of Object.entries(byCourse)) {
      const avg = Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length);
      const tier: RiskTier = avg < 50 ? 'at-risk' : avg < 65 ? 'borderline' : avg < 80 ? 'on-track' : 'excelling';
      const sorted = [...grades].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
      const mid = Math.max(1, Math.floor(sorted.length / 2));
      const r1 = sorted.slice(0, mid).reduce((s, g) => s + g.score, 0) / mid;
      const r2 = sorted.slice(mid).reduce((s, g) => s + g.score, 0) / Math.max(1, sorted.length - mid);
      const trend = r2 > r1 + 3 ? 'improving' as const : r2 < r1 - 3 ? 'declining' as const : 'stable' as const;
      perCourse[id] = { average: avg, riskTier: tier, lateSubs: grades.filter(g => g.late).length, trend };
      if (tier === 'at-risk') atRisk.push(id);
      total += avg; count++;
    }
    const gpa = count > 0 ? Math.min(4.0, Math.round((total / count) / 25 * 10) / 10) : 0;
    return { gpa, perCourse, atRiskCourses: atRisk };
  }
}
