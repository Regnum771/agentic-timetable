import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { TimeAgent } from '../agents/timeAgent';

interface TimeContextValue {
  currentTime: Date;
  semesterStart: Date;
  semesterEnd: Date;
  speed: number;
  isPaused: boolean;
  semesterWeek: number;
  setSpeed: (n: number) => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  jumpTo: (date: Date) => void;
}

const TimeCtx = createContext<TimeContextValue | null>(null);

const SEMESTER_START = TimeAgent.getSemesterStart();
const SEMESTER_END = TimeAgent.getSemesterEnd();
const TICK_MS = 100; // real ms per tick

export function TimeProvider({ children, onTick }: { children: React.ReactNode; onTick?: (time: Date) => void }) {
  const [currentTime, setCurrentTime] = useState(new Date(SEMESTER_START));
  const [speed, setSpeed] = useState(360);
  const [isPaused, setIsPaused] = useState(true);
  const speedRef = useRef(speed);
  const pausedRef = useRef(isPaused);
  const timeRef = useRef(currentTime);
  const onTickRef = useRef(onTick);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { timeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const newTime = new Date(timeRef.current.getTime() + speedRef.current * TICK_MS);
      if (newTime > SEMESTER_END) {
        setIsPaused(true);
        return;
      }
      setCurrentTime(newTime);
      onTickRef.current?.(newTime);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const semesterWeek = Math.max(1, Math.min(16,
    Math.floor((currentTime.getTime() - SEMESTER_START.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1));

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const togglePause = useCallback(() => setIsPaused(p => !p), []);
  const jumpTo = useCallback((date: Date) => {
    setCurrentTime(date);
    timeRef.current = date;
  }, []);

  return (
    <TimeCtx.Provider value={{
      currentTime, semesterStart: SEMESTER_START, semesterEnd: SEMESTER_END,
      speed, isPaused, semesterWeek, setSpeed, pause, resume, togglePause, jumpTo,
    }}>
      {children}
    </TimeCtx.Provider>
  );
}

export function useTime() {
  const ctx = useContext(TimeCtx);
  if (!ctx) throw new Error('useTime must be within TimeProvider');
  return ctx;
}
