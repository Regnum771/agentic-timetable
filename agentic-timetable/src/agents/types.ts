export type EventType = 'lecture' | 'tutorial' | 'lab' | 'assignment' | 'exam';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type UrgencyLevel = 'info' | 'warning' | 'critical';
export type NotificationStatus = 'planned' | 'scheduled' | 'delivered' | 'acknowledged' | 'dismissed' | 'snoozed' | 'expired';
export type RiskTier = 'at-risk' | 'borderline' | 'on-track' | 'excelling';
export type Verbosity = 'minimal' | 'standard' | 'detailed';

// ── Data Models ──
export interface Course {
  courseId: string;
  courseName: string;
  instructor: string;
  credits: number;
  colour: string;
}

export interface TimetableEvent {
  eventId: string;
  courseId: string;
  type: EventType;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  location: string;
  weeks: string;
}

export interface Assignment {
  assignmentId: string;
  courseId: string;
  title: string;
  dueDate: Date;
  weight: number;
  type: string;
  description: string;
}

export interface Exam {
  examId: string;
  courseId: string;
  title: string;
  date: Date;
  durationMins: number;
  weight: number;
  location: string;
  topics: string;
}

export interface AttendanceRecord {
  recordId: string;
  eventId: string;
  courseId: string;
  week: number;
  date: Date;
  status: AttendanceStatus;
}

export interface GradeRecord {
  gradeId: string;
  assignmentId: string;
  courseId: string;
  score: number;
  submittedAt: Date;
  late: boolean;
  feedback: string;
}

export interface StudentProfile {
  studentId: string;
  name: string;
  semester: number;
  program: string;
  gpaCumulative: number;
}

// ── Agent Interface ──
export interface AgentInput {
  type: string;
  [key: string]: any;
}

export interface AgentOutput {
  agentId: string;
  type: string;
  data: any;
}

export interface IAgent {
  id: string;
  name: string;
  description: string;
  process(input: AgentInput): Promise<AgentOutput>;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'query' | 'response' | 'event' | 'feedback' | 'preference_update';
  payload: Record<string, any>;
  timestamp: Date;
}

// ── Time Context ──
export interface TimeContext {
  currentTime: Date;
  semesterWeek: number;
  dayOfWeek: DayOfWeek;
  isExamPeriod: boolean;
  lookAheadWindow: { start: Date; end: Date };
}

// ── Notification ──
export interface AppNotification {
  id: string;
  eventRef: string;
  category: EventType;
  title: string;
  body: string;
  urgency: UrgencyLevel;
  status: NotificationStatus;
  scheduledFor: Date;
  deliveredAt?: Date;
  courseId: string;
  courseName?: string;
  courseColour?: string;
  templateId?: string;
  metadata: Record<string, any>;
}

export type FeedbackAction = 'acknowledge' | 'dismiss' | 'snooze' | 'thumbs_up' | 'thumbs_down';

export interface FeedbackEvent {
  notificationId: string;
  action: FeedbackAction;
  timestamp: Date;
  category: EventType;
  leadTimeDays: number;
  templateUsed?: string;
}

// ── Notification Decision (Persona → Composer) ──
export interface NotificationDecision {
  eventRef: string;
  courseId: string;
  category: EventType;
  decidedLeadTimeDays: number;
  urgency: UrgencyLevel;
  contentFlags: {
    includePerformance: boolean;
    includeAttendance: boolean;
    verbosity: Verbosity;
  };
  eventData: any;
}

// ── Preference Model (Feedback Agent) ──
export interface CategoryPreference {
  leadTimeDays: number;
  verbosity: Verbosity;
  includePerformance: boolean;
  includeAttendance: boolean;
  engagementScore: number;
  dismissCount: number;
  acknowledgeCount: number;
  snoozeCount: number;
  positiveRatings: number;
  negativeRatings: number;
}

export type PreferenceModel = Record<string, CategoryPreference>;

export interface PreferenceUpdate {
  category: string;
  deltas: Partial<CategoryPreference>;
  reason: string;
}

// ── Reports ──
export interface AttendanceReport {
  overallRate: number;
  perCourse: Record<string, { rate: number; trend: 'improving' | 'declining' | 'stable'; missedLast: number }>;
  riskCourses: string[];
}

export interface PerformanceReport {
  gpa: number;
  perCourse: Record<string, { average: number; riskTier: RiskTier; lateSubs: number; trend: 'improving' | 'declining' | 'stable' }>;
  atRiskCourses: string[];
}

// ── Calendar Event for FullCalendar ──
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: Record<string, any>;
}
