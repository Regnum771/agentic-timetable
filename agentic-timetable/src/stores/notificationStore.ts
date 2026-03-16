import { create } from 'zustand';
import { AppNotification } from '../agents/types';

interface NotificationState {
  notifications: AppNotification[];
  toasts: AppNotification[];
  addNotifications: (ns: AppNotification[]) => void;
  updateStatus: (id: string, status: AppNotification['status']) => void;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  toasts: [],

  addNotifications: (ns) => set((s) => ({
    notifications: [...s.notifications, ...ns],
    toasts: [...s.toasts, ...ns].slice(-3),
  })),

  updateStatus: (id, status) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, status } : n),
    toasts: s.toasts.filter(n => n.id !== id),
  })),

  dismissToast: (id) => set((s) => ({
    toasts: s.toasts.filter(n => n.id !== id),
  })),

  clearAll: () => set({ notifications: [], toasts: [] }),
}));
