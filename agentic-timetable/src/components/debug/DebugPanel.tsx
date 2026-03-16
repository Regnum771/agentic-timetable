import { useState } from 'react';
import { useAgentLogStore } from '../../stores/agentLogStore';
import { PreferenceModel, AgentMessage } from '../../agents/types';
import { Terminal, RefreshCw, ChevronDown, ChevronRight, Trash2, Zap, Database, DollarSign } from 'lucide-react';

interface DebugPanelProps {
  preferences: PreferenceModel;
  feedbackLog: any[];
  learningModel: PreferenceModel;
  apiStats: any;
  onResetPreferences: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  'orchestrator': 'text-purple-600', 'time-agent': 'text-blue-500',
  'timetable-agent': 'text-teal-500', 'attendance-agent': 'text-orange-500',
  'performance-agent': 'text-red-500', 'persona-agent': 'text-indigo-500',
  'notification-composer-agent': 'text-green-500', 'feedback-agent': 'text-amber-600',
  'ui': 'text-surface-600', 'system': 'text-surface-400',
};

export function DebugPanel({ preferences, feedbackLog, learningModel, apiStats, onResetPreferences }: DebugPanelProps) {
  const messages = useAgentLogStore(s => s.messages);
  const clearLog = useAgentLogStore(s => s.clear);
  const [tab, setTab] = useState<'log' | 'preferences' | 'feedback' | 'learning' | 'api'>('api');
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);

  const tabs = [
    { id: 'api', label: '⚡ API Stats' },
    { id: 'log', label: 'Agent Log', count: messages.length },
    { id: 'preferences', label: 'Persona Prefs' },
    { id: 'feedback', label: 'Feedback', count: feedbackLog.length },
    { id: 'learning', label: 'Learning Model' },
  ] as const;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface-200/60 flex items-center gap-3">
        <Terminal size={16} className="text-surface-400" />
        <h2 className="font-display font-bold text-sm text-surface-700">Debug Panel</h2>
        <div className="flex-1" />
        <button onClick={onResetPreferences}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-status-critical/10 text-status-critical hover:bg-status-critical/20">
          <RefreshCw size={11} /> Reset Prefs
        </button>
      </div>

      <div className="flex border-b border-surface-200/60 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-surface-400 hover:text-surface-600'
            }`}>
            {t.label}
            {'count' in t && t.count !== undefined && <span className="ml-1 opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* ── API Stats Tab ── */}
        {tab === 'api' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <ApiStatCard icon={Zap} label="Total API Calls" value={apiStats?.totalCalls || 0} />
              <ApiStatCard icon={Database} label="Tokens In" value={(apiStats?.totalTokensIn || 0).toLocaleString()} />
              <ApiStatCard icon={Database} label="Tokens Out" value={(apiStats?.totalTokensOut || 0).toLocaleString()} />
              <ApiStatCard icon={DollarSign} label="Cache Savings" value={`${(apiStats?.estimatedCacheSavings || 0).toLocaleString()} tok`} accent />
            </div>

            {/* Optimization summary */}
            <div className="bg-surface-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-surface-600 mb-2">Active Optimizations</h4>
              <div className="space-y-1 text-[11px] text-surface-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Hybrid tick:</b> Hourly local checks + daily LLM pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Model routing:</b> Haiku for Timetable/Attendance/Performance, Sonnet for Persona/Composer/Feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Prompt caching:</b> Static system prompts cached for 90% token discount</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Report caching:</b> Attendance/Performance LLM reports cached per simulated day</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Payload trimming:</b> Abbreviated keys, nulls stripped, max 15 events per call</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Time Agent:</b> Fully local, zero API calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Lecture reminders:</b> Local template-based, no API call</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Daily digest:</b> Morning summary via 1 Sonnet call per simulated day</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Weekly summary:</b> Monday recap+preview via 1 Sonnet call per simulated week</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span><b>Chat context:</b> 3-tier system — Tier 1 cached, Tier 2 daily snapshot, Tier 3 timestamp only (~170 tok/msg)</span>
                </div>
              </div>
            </div>

            {/* Per-call breakdown */}
            <div className="bg-surface-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-surface-600 mb-2">Cost per tick cycle</h4>
              <div className="text-[11px] text-surface-500 space-y-1">
                <div>Hourly tick: <span className="text-status-success font-bold">0 API calls</span> (local only)</div>
                <div>Daily tick: <span className="text-accent font-bold">≤6 API calls</span> (3× Haiku + 2× Sonnet + 1× digest Sonnet)</div>
                <div>Weekly tick (Mon): <span className="text-accent font-bold">+1 API call</span> (weekly summary Sonnet)</div>
                <div>User feedback: <span className="text-accent font-bold">1 API call</span> (1× Sonnet)</div>
                <div>Chat message: <span className="text-accent font-bold">1 API call</span> (1× Sonnet, ~170 tok context)</div>
              </div>
            </div>

            {/* Recent calls log */}
            {apiStats?.recentCalls && apiStats.recentCalls.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-surface-600 mb-2">Recent API Calls</h4>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {[...apiStats.recentCalls].reverse().slice(0, 30).map((c: any, i: number) => (
                    <div key={i} className="font-mono text-[10px] flex items-center gap-2 py-0.5">
                      <span className={`px-1 rounded ${c.model === 'haiku' ? 'bg-teal-100 text-teal-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {c.model}
                      </span>
                      <span className={AGENT_COLORS[c.agentId] || 'text-surface-500'}>{c.agentId}</span>
                      <span className="text-surface-300">{c.tokensIn}+{c.tokensOut}tok</span>
                      {c.cacheRead > 0 && <span className="text-status-success">cache:{c.cacheRead}</span>}
                      <span className="text-surface-300">{c.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Agent Log Tab ── */}
        {tab === 'log' && (
          <div className="space-y-0.5">
            <div className="flex justify-end mb-2">
              <button onClick={clearLog} className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600">
                <Trash2 size={11} /> Clear
              </button>
            </div>
            {messages.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-8">No agent messages yet. Start the clock.</p>
            ) : (
              [...messages].reverse().slice(0, 200).map(m => (
                <div key={m.id} className="font-mono text-[11px]">
                  <button className="flex items-start gap-1 w-full text-left hover:bg-surface-50 rounded px-1 py-0.5"
                    onClick={() => setExpandedMsg(expandedMsg === m.id ? null : m.id)}>
                    {expandedMsg === m.id ? <ChevronDown size={10} className="mt-0.5 shrink-0" /> : <ChevronRight size={10} className="mt-0.5 shrink-0" />}
                    <span className="text-surface-300">[{m.timestamp.toLocaleTimeString()}]</span>
                    <span className={AGENT_COLORS[m.from] || 'text-surface-500'}>{m.from}</span>
                    <span className="text-surface-300">→</span>
                    <span className={AGENT_COLORS[m.to] || 'text-surface-500'}>{m.to}</span>
                    <span className="text-surface-300 capitalize ml-1">[{m.type}]</span>
                    {m.payload?._noApiCall && <span className="text-status-success ml-1">[local]</span>}
                    {m.payload?._cached && <span className="text-amber-500 ml-1">[cached]</span>}
                  </button>
                  {expandedMsg === m.id && (
                    <pre className="ml-6 text-[10px] text-surface-400 bg-surface-50 rounded p-2 overflow-x-auto mb-1">
                      {JSON.stringify(m.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'preferences' && (
          <pre className="font-mono text-[11px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(preferences, null, 2)}
          </pre>
        )}

        {tab === 'feedback' && (
          <div className="space-y-1">
            {feedbackLog.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-8">No feedback events yet.</p>
            ) : [...feedbackLog].reverse().map((fe, i) => (
              <div key={i} className="font-mono text-[11px] bg-surface-50 rounded p-2">
                <span className="text-surface-400">{new Date(fe.timestamp).toLocaleTimeString()}</span>
                <span className="text-accent font-semibold ml-2">{fe.action}</span>
                <span className="text-surface-400 ml-2">on {fe.category}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'learning' && (
          <pre className="font-mono text-[11px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(learningModel, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function ApiStatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-surface-200/60 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className={accent ? 'text-status-success' : 'text-surface-400'} />
        <span className="text-[10px] text-surface-400 font-medium">{label}</span>
      </div>
      <p className={`text-lg font-display font-bold ${accent ? 'text-status-success' : 'text-surface-700'}`}>{value}</p>
    </div>
  );
}
