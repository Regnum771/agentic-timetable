# AgenticTimetable — Proof of Concept

An agentic, AI-powered university timetable system built with React. Features a **7-agent architecture** where every agent runs through real Claude API calls for analysis, decision-making, and natural language generation.

## Quick Start

### 1. Set your API key

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### 2. Run with Docker Compose

```bash
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. (Alternative) Run locally without Docker

```bash
# Terminal 1 — Backend
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev

# Terminal 2 — Frontend
npm install
npm run dev
```

## Architecture

Two-service architecture: a **React frontend** and an **Express backend** that proxies all agent calls through the Claude API.

```
┌─────────────────────────────────────────────┐
│              React Frontend                  │
│  Calendar · Notifications · Dashboard · Debug│
└──────────────────┬──────────────────────────┘
                   │ /api/agent
         ┌─────────┴─────────┐
         │  Express Server   │
         │  (API Proxy)      │
         └────────┬──────────┘
                  │
         ┌────────┴──────────┐
         │  Claude API       │
         │  (Sonnet 4)       │
         └───────────────────┘
```

### 7 LLM-Powered Agents

Each agent has a dedicated **system prompt** that defines its role, expected input, and required JSON output format. The orchestrator calls them in sequence on each clock tick.

| Agent | LLM Role |
|-------|----------|
| **Time Agent** | Analyses temporal context — determines semester week, exam period, period of day, and generates insights about what's notable |
| **Timetable Agent** | Receives raw event data and uses LLM to **prioritise** events, assign priority scores, and determine imminence |
| **Attendance Agent** | Analyses attendance records, detects **patterns** (e.g., "tends to miss Monday mornings"), identifies trends and risk courses |
| **Performance Agent** | Analyses grade records, classifies **risk tiers**, identifies late-submission patterns, generates performance insights |
| **Persona Agent** | The decision-maker — receives all context and uses LLM to decide **which notifications to send**, at what urgency, and with what content flags |
| **Notification Composer** | The writer — receives decisions and crafts **natural language** notification titles and bodies with appropriate tone and emoji |
| **Feedback Agent** | Analyses user interactions (dismiss/ack/snooze/rate) and uses LLM to determine **how to adapt** the preference model |

### Tick Pipeline (6 LLM calls)

```
Time Agent → Timetable Agent → Attendance + Performance (parallel)
  → Persona Agent → Notification Composer → UI
```

### Feedback Loop (1 LLM call)

```
User Action → Feedback Agent → Persona Agent (local update) → UI
```

## How to Demo

1. **Start the app** — calendar shows Week 1 of a 16-week semester
2. **Press Play** (▶) in the header to start the simulated clock
3. **Set speed** to `360×` (recommended) or `3600×` for fast overview
4. **Watch notifications** — Claude crafts each one with natural language
5. **Interact** — Acknowledge, Dismiss, Snooze, or rate with 👍/👎
6. **Check Debug Panel** — see all 7 agents communicating with LLM usage stats
7. **Visit Dashboard** — GPA, attendance charts, persona insights

## API Usage Notes

- Each clock tick that produces notifications triggers **5-6 Claude API calls** (one per agent in the pipeline)
- Each user feedback action triggers **1 API call** (Feedback Agent)
- All agents use **claude-sonnet-4-20250514** for cost efficiency
- Each agent has a graceful **fallback** — if an API call fails, the agent falls back to local rule-based logic
- Usage stats (tokens, latency) are tracked and visible at `GET /api/stats`
- The backend logs every call: `✅ persona-agent → 450+380 tokens, 1200ms`

## Project Structure

```
agentic-timetable/
├── docker-compose.yml       # Two-service orchestration
├── .env.example             # API key template
├── Dockerfile               # Frontend container
├── server/
│   ├── Dockerfile           # Backend container
│   ├── index.ts             # Express server with /api/agent endpoint
│   ├── agentPrompts.ts      # System prompts for all 7 agents
│   └── package.json
├── src/
│   ├── agents/              # 7 agents + orchestrator (call Claude API)
│   ├── components/          # React UI
│   ├── contexts/            # TimeProvider (simulated clock)
│   ├── stores/              # Zustand stores
│   └── utils/
│       ├── apiClient.ts     # Frontend → Backend API client
│       └── csvLoader.ts     # CSV data ingestion
└── public/data/             # 7 CSV sample data files
```

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Express + Anthropic SDK
- **AI Model**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **State**: Zustand
- **Calendar**: FullCalendar
- **Charts**: Recharts
- **Data**: PapaParse (CSV)
