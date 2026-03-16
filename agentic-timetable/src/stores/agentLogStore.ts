import { create } from 'zustand';
import { AgentMessage } from '../agents/types';

interface AgentLogState {
  messages: AgentMessage[];
  setMessages: (msgs: AgentMessage[]) => void;
  clear: () => void;
}

export const useAgentLogStore = create<AgentLogState>((set) => ({
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  clear: () => set({ messages: [] }),
}));
