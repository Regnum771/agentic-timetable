import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { useTime } from '../../contexts/TimeProvider';
import { callAgent } from '../../utils/apiClient';
import { buildTier1, buildTier2, buildTier3 } from '../../utils/contextBuilder';
import { useDataStore } from '../../stores/dataStore';
import { AttendanceReport, PerformanceReport } from '../../agents/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  usage?: { tokensIn: number; tokensOut: number; durationMs: number; model: string };
}

interface ChatViewProps {
  attendance: AttendanceReport | null;
  performance: PerformanceReport | null;
}

const SUGGESTED_QUESTIONS = [
  "What do I have today?",
  "How am I doing in Database Systems?",
  "When is my next exam?",
  "What should I focus on this week?",
  "Which courses am I at risk in?",
  "What assignments are due soon?",
];

export function ChatView({ attendance, performance }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentTime, semesterWeek } = useTime();
  const courses = useDataStore(s => s.courses);
  const student = useDataStore(s => s.student);
  const assignments = useDataStore(s => s.assignments);
  const exams = useDataStore(s => s.exams);
  const timetable = useDataStore(s => s.timetable);

  // ── Tier 1: Static (stays in system prompt, cached) ──
  const tier1 = student ? buildTier1(student, courses) : '';

  // ── Tier 2: Day snapshot (rebuilt when simulated day changes) ──
  const dayKey = currentTime.toISOString().split('T')[0];
  const tier2Ref = useRef({ dayKey: '', snapshot: '' });
  if (tier2Ref.current.dayKey !== dayKey && attendance && performance) {
    tier2Ref.current = {
      dayKey,
      snapshot: buildTier2(currentTime, semesterWeek, courses, attendance, performance, assignments, exams, timetable),
    };
  }
  const tier2 = tier2Ref.current.snapshot;

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`, role: 'user', content: text.trim(), timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // ── Tier 3: Per-message time stamp ──
      const tier3 = buildTier3(currentTime);

      // Build conversation history for multi-turn
      const history = [...messages, userMsg].slice(-10).map(m => ({
        role: m.role, content: m.role === 'user' ? `${tier3}\n${m.content}` : m.content,
      }));

      const resp = await callAgent('chat-agent', {
        // Tier 1 + 2 bundled as context (Tier 1 goes in system prompt via server)
        _systemContext: `${tier1}\n\n${tier2}`,
        messages: history,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`, role: 'assistant',
        content: resp.data?.response || resp.data?.content || (typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)),
        timestamp: new Date(),
        usage: resp.usage,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`, role: 'assistant',
        content: `Sorry, I couldn't process that — ${e.message}. Try again?`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, isLoading, currentTime, tier1, tier2]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="p-4 border-b border-surface-200/60 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <div>
          <h2 className="font-display font-bold text-sm text-surface-800">Timetable Assistant</h2>
          <p className="text-[10px] text-surface-400">
            Aware of your schedule, grades & attendance · Simulated: {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Week {semesterWeek}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Bot size={24} className="text-accent" />
            </div>
            <h3 className="font-display font-bold text-surface-700 mb-1">Ask me anything about your semester</h3>
            <p className="text-xs text-surface-400 mb-6 max-w-sm">
              I know your courses, grades, attendance, and schedule. I'm aware of the current simulated date and can calculate deadlines for you.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 rounded-full bg-surface-100 text-xs text-surface-600 hover:bg-accent/10 hover:text-accent transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={13} className="text-white" />
              </div>
            )}
            <div className={`max-w-[75%] ${
              msg.role === 'user'
                ? 'bg-accent text-white rounded-2xl rounded-tr-md px-4 py-2.5'
                : 'bg-white border border-surface-200/60 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm'
            }`}>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? '' : 'text-surface-700'}`}>
                {msg.content}
              </p>
              {msg.usage && (
                <p className="text-[9px] mt-1.5 opacity-50">
                  {msg.usage.model} · {msg.usage.tokensIn}+{msg.usage.tokensOut}tok · {msg.usage.durationMs}ms
                </p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center shrink-0 mt-0.5">
                <User size={13} className="text-surface-500" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-white border border-surface-200/60 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-surface-400">
                <Loader2 size={14} className="animate-spin" />
                <span>Thinking…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-surface-200/60 bg-white/60 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your schedule, grades, deadlines…"
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-50 border border-surface-200/60 text-sm placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-hover disabled:opacity-40 transition-colors">
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-surface-300 mt-1.5 text-center">
          Context: ~{tier1.length + tier2.length < 500 ? '~170' : '~' + Math.round((tier1.length + tier2.length) / 4)} tokens/msg (Tier 1 cached, Tier 2 daily snapshot)
        </p>
      </form>
    </div>
  );
}
