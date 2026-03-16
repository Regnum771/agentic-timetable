import { create } from 'zustand';
import { Course, TimetableEvent, Assignment, Exam, AttendanceRecord, GradeRecord, StudentProfile } from '../agents/types';

interface DataState {
  courses: Course[];
  timetable: TimetableEvent[];
  assignments: Assignment[];
  exams: Exam[];
  attendance: AttendanceRecord[];
  grades: GradeRecord[];
  student: StudentProfile | null;
  isLoaded: boolean;
  setData: (data: Omit<DataState, 'isLoaded' | 'setData'>) => void;
}

export const useDataStore = create<DataState>((set) => ({
  courses: [],
  timetable: [],
  assignments: [],
  exams: [],
  attendance: [],
  grades: [],
  student: null,
  isLoaded: false,
  setData: (data) => set({ ...data, isLoaded: true }),
}));
