import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_PROMPTS } from './agentPrompts.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });

// ── #7: Model routing — Haiku for structured analysis, Sonnet for reasoning/writing ──
const AGENT_MODELS: Record<string, string> = {
  'timetable-agent':             'claude-haiku-4-5-20251001',
  'attendance-agent':            'claude-haiku-4-5-20251001',
  'performance-agent':           'claude-haiku-4-5-20251001',
  'persona-agent':               'claude-sonnet-4-20250514',
  'notification-composer-agent': 'claude-sonnet-4-20250514',
  'feedback-agent':              'claude-sonnet-4-20250514',
  'daily-digest-agent':          'claude-sonnet-4-20250514',
  'weekly-summary-agent':        'claude-sonnet-4-20250514',
  'chat-agent':                  'claude-sonnet-4-20250514',
};

// ── Usage tracking ──
let totalCalls = 0;
let totalTokensIn = 0;
let totalTokensOut = 0;
let totalCacheRead = 0;
const callLog: Array<{
  agentId: string; model: string; timestamp: string;
  tokensIn: number; tokensOut: number; cacheRead: number; durationMs: number;
}> = [];

// ── #5: Payload trimming — strip nulls, empty arrays/objects ──
function trimPayload(obj: any): any {
  if (Array.isArray(obj)) {
    const f = obj.map(trimPayload).filter(v => v != null);
    return f.length > 0 ? f : undefined;
  }
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const r: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const t = trimPayload(v);
      if (t != null && t !== '') {
        if (typeof t === 'object' && !Array.isArray(t) && Object.keys(t).length === 0) continue;
        r[k] = t;
      }
    }
    return Object.keys(r).length > 0 ? r : undefined;
  }
  return obj;
}

// ── Main agent endpoint ──
app.post('/api/agent', async (req, res) => {
  const { agentId, input } = req.body;
  if (!agentId || !input) return res.status(400).json({ error: 'agentId and input required' });

  const systemPrompt = AGENT_PROMPTS[agentId];
  if (!systemPrompt) return res.status(400).json({ error: `Unknown agent: ${agentId}` });

  const model = AGENT_MODELS[agentId] || 'claude-sonnet-4-20250514';
  const startTime = Date.now();

  try {
    let systemBlocks: any[];
    let messages: any[];

    if (agentId === 'chat-agent' && input.messages) {
      // ── Chat agent: multi-turn with tiered context ──
      // Tier 1 (student profile) goes in system prompt → cached
      // Tier 2 (day snapshot) goes as first system block → also cached
      // Tier 3 (timestamp) is prepended to each user message
      const studentContext = input._systemContext || '';
      systemBlocks = [
        { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: `\n--- Student Context ---\n${studentContext}`, cache_control: { type: 'ephemeral' as const } },
      ];
      // Conversation history
      messages = input.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
    } else {
      // ── Standard agent: single-turn JSON ──
      const trimmedInput = typeof input === 'string' ? input : JSON.stringify(trimPayload(input));
      systemBlocks = [{
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      }];
      messages = [{ role: 'user', content: trimmedInput }];
    }

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemBlocks,
      messages,
    });

    const durationMs = Date.now() - startTime;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('');

    totalCalls++;
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;
    const cacheRead = (response.usage as any)?.cache_read_input_tokens || 0;
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    totalCacheRead += cacheRead;

    const modelTag = model.includes('haiku') ? 'haiku' : 'sonnet';
    callLog.push({ agentId, model: modelTag, timestamp: new Date().toISOString(), tokensIn, tokensOut, cacheRead, durationMs });
    if (callLog.length > 200) callLog.splice(0, 200);

    let parsed: any;
    if (agentId === 'chat-agent') {
      // Chat agent returns natural language, not JSON
      parsed = { response: text.trim() };
    } else {
      try {
        parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch {
        console.warn(`⚠️  ${agentId} non-JSON:`, text.substring(0, 150));
        parsed = { _raw: text, _parseError: true };
      }
    }

    const cacheTag = cacheRead > 0 ? ` [cached:${cacheRead}]` : '';
    console.log(`✅ ${agentId} (${modelTag}) ${tokensIn}+${tokensOut}tok ${durationMs}ms${cacheTag}`);

    res.json({ agentId, data: parsed, usage: { tokensIn, tokensOut, cacheRead, durationMs, model: modelTag } });
  } catch (error: any) {
    console.error(`❌ ${agentId}:`, error.message);
    res.status(500).json({ error: error.message, agentId });
  }
});

app.get('/api/stats', (_req, res) => {
  res.json({
    totalCalls, totalTokensIn, totalTokensOut, totalCacheRead,
    estimatedCacheSavings: Math.round(totalCacheRead * 0.9),
    recentCalls: callLog.slice(-50),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!API_KEY, totalCalls });
});

app.listen(PORT, () => {
  console.log(`\n🤖 AgenticTimetable API Server (Optimized)`);
  console.log(`   Prompt caching: ENABLED`);
  console.log(`   Payload trimming: ENABLED`);
  console.log(`   Model routing:`);
  for (const [a, m] of Object.entries(AGENT_MODELS)) {
    console.log(`     ${a.padEnd(34)} → ${m.includes('haiku') ? '💨 haiku' : '🧠 sonnet'}`);
  }
  console.log(`\n   Ready.\n`);
});
