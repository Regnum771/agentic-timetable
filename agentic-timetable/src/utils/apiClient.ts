const API_BASE = '/api';

export interface AgentResponse {
  agentId: string;
  data: any;
  usage?: { tokensIn: number; tokensOut: number; cacheRead: number; durationMs: number; model: string };
}

export async function callAgent(agentId: string, input: any): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Agent ${agentId} failed: ${err.error || res.statusText}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<any> {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}
