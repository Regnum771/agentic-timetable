import Papa from 'papaparse';
import { Course, TimetableEvent, Assignment, Exam, AttendanceRecord, GradeRecord, StudentProfile, DayOfWeek } from '../agents/types';

async function loadCSV<T>(path: string): Promise<T[]> {
  const res = await fetch(path);
  const text = await res.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  return result.data as T[];
}

export async function loadAllData() {
  const [rawCourses, rawTimetable, rawAssignments, rawExams, rawAttendance, rawGrades, rawProfile] =
    await Promise.all([
      loadCSV<any>('/data/courses.csv'),
      loadCSV<any>('/data/timetable.csv'),
      loadCSV<any>('/data/assignments.csv'),
      loadCSV<any>('/data/exams.csv'),
      loadCSV<any>('/data/attendance.csv'),
      loadCSV<any>('/data/grades.csv'),
      loadCSV<any>('/data/student_profile.csv'),
    ]);

  const courses: Course[] = rawCourses.map((r: any) => ({
    courseId: r.course_id,
    courseName: r.course_name,
    instructor: r.instructor,
    credits: r.credits,
    colour: r.colour,
  }));

  const timetable: TimetableEvent[] = rawTimetable.map((r: any) => ({
    eventId: r.event_id,
    courseId: r.course_id,
    type: r.type,
    dayOfWeek: r.day_of_week as DayOfWeek,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    weeks: String(r.weeks),
  }));

  const assignments: Assignment[] = rawAssignments.map((r: any) => ({
    assignmentId: r.assignment_id,
    courseId: r.course_id,
    title: r.title,
    dueDate: new Date(r.due_date),
    weight: r.weight,
    type: r.type,
    description: r.description,
  }));

  const exams: Exam[] = rawExams.map((r: any) => ({
    examId: r.exam_id,
    courseId: r.course_id,
    title: r.title,
    date: new Date(r.date),
    durationMins: r.duration_mins,
    weight: r.weight,
    location: r.location,
    topics: r.topics,
  }));

  const attendance: AttendanceRecord[] = rawAttendance.map((r: any) => ({
    recordId: r.record_id,
    eventId: r.event_id,
    courseId: r.course_id,
    week: r.week,
    date: new Date(r.date),
    status: r.status,
  }));

  const grades: GradeRecord[] = rawGrades.map((r: any) => ({
    gradeId: r.grade_id,
    assignmentId: r.assignment_id,
    courseId: r.course_id,
    score: r.score,
    submittedAt: new Date(r.submitted_at),
    late: r.late === true || r.late === 'true',
    feedback: r.feedback,
  }));

  const student: StudentProfile = rawProfile[0] ? {
    studentId: rawProfile[0].student_id,
    name: rawProfile[0].name,
    semester: rawProfile[0].semester,
    program: rawProfile[0].program,
    gpaCumulative: rawProfile[0].gpa_cumulative,
  } : { studentId: 'STU001', name: 'Alex Nguyen', semester: 4, program: 'BSc CS', gpaCumulative: 3.2 };

  return { courses, timetable, assignments, exams, attendance, grades, student };
}
