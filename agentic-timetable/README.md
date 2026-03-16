# AgenticTimetable

A multi-agent university timetable system where **10 specialized agents** collaborate through a central orchestrator to deliver personto students. Built as a proof of concept demonstrating agentic AI architecture with real Claude API calls.

The system learns from student interactions — dismiss a notification too early and it adjusts timing; rate a notification negatively and it changes tone. Agents analyse attendance patterns, academic performance, and schedule context to generate genuinely useful, personalized reminders.alized, adaptive notifications 
g
---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An [Anthropic API key](https://console.anthropic.com/)

### Run

```bash
git clone https://github.com/your-username/agentic-timetable.git
cd agentic-timetable
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
docker compose up --build
```

Open **http://localhost:5173** in your browser.

### Run Without Docker

```bash
# Terminal 1 — Backend
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev

# Terminal 2 — Frontend
npm install
npm run dev
```

---

## How It Works

### The Agent Architecture

Ten agents, one orchestrator, two pipelines.

```
┌──────────────────────────────────────────────────────────┐
│                    React Frontend                         │
│  Calendar · Notifications · Chat · Dashboard · Debug      │
└────────────────────────┬─────────────────────────────────┘
                         │ /api/agent
              ┌──────────┴──────────┐
              │   Express Server    │
              │   (API Proxy)       │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │   Claude API        │
              │   (Sonnet + Haiku)  │
              └─────────────────────┘
```

Every agent has a dedicated system prompt defining its role, expected inputs, and required output format. The orchestrator controls execution order, and all inter-agent messages are logged for inspection.

### The Agents

| Agent | Model | Role |
|-------|-------|------|
| **Time Agent** | Local only | Computes semester week, exam period, day context. Zero API calls. |
| **Timetable Agent** | Haiku | Filters events locally; calls LLM to **prioritize** by type, weight, and proximity. |
| **Attendance Agent** | Haiku | Computes rates locally; calls LLM to detect **patterns** (e.g., "skips Monday mornings"). |
| **Performance Agent** | Haiku | Computes grades locally; calls LLM to classify **risk tiers** and identify trends. |
| **Persona Agent** | Sonnet | The decision-maker. Receives all context and decides **which notifications to send**, at what urgency, with what content. Respects learned preferences. |
| **Notification Composer** | Sonnet | The writer. Crafts **natural language** notification titles and bodies with appropriate tone and emoji. |
| **Daily Digest** | Sonnet | Writes a consolidated **morning briefing** each simulated day. |
| **Weekly Summary** | Sonnet | Writes a **Monday recap + preview** each simulated week. |
| **Feedback Agent** | Sonnet | Analyzes user interactions (dismiss/ack/snooze/rate) and determines **how to adapt** the preference model. |
| **Chat Agent** | Sonnet | A timetable-aware conversational assistant. Knows the student's grades, attendance, schedule, and current simulated date. |

### Two Pipelines

**Tick Pipeline** — runs on simulated clock progression:

```
Hourly (local, 0 API calls):
  Time Agent → Timetable Agent → "Lecture in 45 min" template reminders

Daily (up to 7 API calls):
  Timetable enrichment (Haiku)
  → Attendance insights (Haiku)
  → Performance insights (Haiku)
  → Persona decisions (Sonnet)
  → Notification composition (Sonnet)
  → Daily digest (Sonnet)
  → Weekly summary (Sonnet, Mondays only)
```

**Feedback Loop** — runs on user interaction:

```
User clicks Dismiss/Acknowledge/Snooze/👍/👎
  → Feedback Agent (Sonnet) analyzes interaction
  → Emits PreferenceUpdate
  → Persona Agent applies update
```

### Adaptive Learning

The Feedback Agent maintains a preference model per notification category. When a student dismisses assignment notifications 3 times at 7-day lead time, the agent reduces it to 6 days. When they consistently rate exam reminders positively, it increases verbosity. When they snooze, it reschedules with exponential backoff.

The Persona Agent reads this preference model and applies contextual overrides: at-risk courses get earlier, more urgent notifications regardless of learned timing. Low-attendance courses get attendance warnings injected into lecture reminders.

### Chat Interface

A conversational assistant that knows the student's full academic context. Uses a three-tier context optimization:

| Tier | Content | Size | Refresh Rate |
|------|---------|------|-------------|
| Tier 1 | Student profile + course list | ~50 tokens | Never (prompt-cached) |
| Tier 2 | Day snapshot: grades, attendance, classes, deadlines | ~120 tokens | Per simulated day |
| Tier 3 | Simulated timestamp | ~20 tokens | Per message |

Multi-turn conversation history (last 10 messages) is included with each call. Total context overhead: ~170 tokens per message.

---

## API Cost Optimizations

Seven optimizations reduce token usage by approximately 90–95% compared to the naive approach:

| # | Optimization | Impact |
|---|-------------|--------|
| 1 | **Local-first agents** — Time, Timetable, Attendance, Performance run locally for data queries; LLM only for enrichment/insights | Eliminates 4 Sonnet calls per tick |
| 2 | **Hybrid tick** — hourly local checks + daily LLM pipeline instead of LLM every hour | ~24× fewer pipeline runs per day |
| 3 | **Daily throttle** — full pipeline runs at most once per simulated day regardless of clock speed | Prevents runaway at 3600× speed |
| 4 | **Report caching** — Attendance and Performance LLM reports cached per simulated day | Saves 2 Haiku calls on cache hit |
| 5 | **Payload trimming** — abbreviated keys, nulls stripped, events capped at 15, server-side recursive trim | ~40% fewer input tokens |
| 6 | **Prompt caching** — system prompts marked `cache_control: ephemeral` for 90% token discount on repeat calls | Major savings on system prompt tokens |
| 7 | **Model routing** — Haiku for structured analysis, Sonnet for reasoning/writing | ~10× cheaper for 3 of the pipeline agents |

### API Call Budget

| Trigger | Frequency | Calls | Models |
|---------|-----------|-------|--------|
| Hourly tick | ~2,688/semester | **0** | Local only |
| Daily tick | ~112/semester | **≤6** | 3 Haiku + 2 Sonnet + 1 digest |
| Weekly summary | 16/semester | **+1** | Sonnet |
| User feedback | Per action | **1** | Sonnet |
| Chat message | Per message | **1** | Sonnet |

A full 16-week semester demo at 3600× speed generates roughly **130 API calls** (vs. ~16,000+ without optimizations).

---

## Demo Walkthrough

1. **Start the app** — the calendar shows Week 1 of a 16-week semester (starting Feb 2, 2026)
2. **Press Play** (▶) in the header to start the simulated clock
3. **Set speed** to `360×` for a 45-minute demo or `3600×` for a 4.5-minute overview
4. **Watch notifications** appear as toast popups — each one is written by Claude in real time
5. **Interact** — Acknowledge, Dismiss, Snooze, or rate with 👍/👎 to train the learning model
6. **Open Chat** — ask "What do I have today?" or "How am I doing in Database Systems?"
7. **Check Debug Panel** — see all agent communication logs, API usage stats, cache metrics, and the evolving preference model
8. **Visit Dashboard** — GPA gauges, attendance charts, and persona insight panel

### Things to Look For

- **Database Systems notifications** are more urgent (student is at-risk at 48%) and include grade context
- **Monday morning lecture reminders** mention low attendance if the student's pattern is poor
- **Daily digests** consolidate the day's schedule into one natural-language briefing
- **Weekly summaries** appear on Mondays with last-week recap and coming-week preview
- **After 3 dismissals** of the same notification category, the next one arrives later (learning in action)
- The **Debug Panel → API Stats** tab shows real-time Haiku vs. Sonnet call breakdown and cache hit rates

---

## Sample Data

The PoC ships with a pre-built student profile designed to exercise all agent capabilities:

| Course | Weekly Classes | Assignments | Exams | Student Performance |
|--------|--------------|-------------|-------|-------------------|
| CS201 Data Structures | 2 lectures + 1 tutorial | 4 | 2 | Strong (avg 80%) |
| CS202 Algorithms | 2 lectures + 1 tutorial | 3 | 2 | Strong (avg 82%) |
| CS210 Database Systems | 2 lectures | 3 | 2 | **Weak (avg 48%)** |
| CS220 Operating Systems | 2 lectures + 1 tutorial | 3 | 2 | Average (avg 68%) |
| CS250 Software Engineering | 2 lectures | 2 + 1 group project | 1 | Average (avg 70%) |

- Overall attendance: ~85%, but notably lower in Database Systems (~65%) and Monday mornings (~70%)
- 104 attendance records across 8 weeks with realistic patterns
- 9 grade records with 2 late submissions
- 16-week semester: Feb 2 – May 22, 2026

---

## Project Structure

```
agentic-timetable/
├── docker-compose.yml          # Two-service orchestration
├── .env.example                # API key template
├── Dockerfile                  # Frontend container
│
├── server/                     # Backend
│   ├── Dockerfile
│   ├── index.ts                # Express server, model routing, prompt caching
│   ├── agentPrompts.ts         # System prompts for all 9 agents
│   └── package.json
│
├── src/
│   ├── agents/                 # Agent implementations
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   ├── orchestrator.ts     # Central hub: hourly + daily + feedback pipelines
│   │   ├── timeAgent.ts        # Fully local, zero API calls
│   │   ├── timetableAgent.ts   # Local queries + Haiku enrichment
│   │   ├── attendanceAgent.ts  # Local computation + cached Haiku insights
│   │   ├── performanceAgent.ts # Local computation + cached Haiku insights
│   │   ├── personaAgent.ts     # Sonnet: notification decisions
│   │   ├── notificationComposerAgent.ts  # Sonnet: natural language
│   │   └── feedbackAgent.ts    # Sonnet: preference learning
│   │
│   ├── components/
│   │   ├── calendar/           # FullCalendar integration
│   │   ├── chat/               # Chat interface with tiered context
│   │   ├── clock/              # Simulated clock controls
│   │   ├── dashboard/          # Recharts: grades, attendance, persona insights
│   │   ├── debug/              # Agent log, API stats, preference viewer
│   │   ├── layout/             # Header, Sidebar
│   │   └── notifications/      # Notification centre + toast area
│   │
│   ├── contexts/
│   │   └── TimeProvider.tsx    # Simulated clock (1×–3600× speed)
│   │
│   ├── stores/                 # Zustand state management
│   │   ├── dataStore.ts
│   │   ├── notificationStore.ts
│   │   └── agentLogStore.ts
│   │
│   └── utils/
│       ├── apiClient.ts        # Frontend → Backend HTTP client
│       ├── contextBuilder.ts   # Three-tier chat context builder
│       ├── csvLoader.ts        # PapaParse CSV ingestion
│       └── helpers.ts
│
└── public/data/                # 7 CSV sample data files
    ├── courses.csv
    ├── timetable.csv
    ├── assignments.csv
    ├── exams.csv
    ├── attendance.csv
    ├── grades.csv
    └── student_profile.csv
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite + TypeScript | UI framework |
| Styling | Tailwind CSS | Utility-first styling |
| State | Zustand | Lightweight state management |
| Calendar | FullCalendar | Schedule visualization |
| Charts | Recharts | Dashboard data visualization |
| Data | PapaParse | CSV parsing |
| Backend | Express + TypeScript | API proxy server |
| AI | Anthropic SDK (Claude Sonnet 4 + Haiku 4.5) | Agent reasoning and generation |
| Infrastructure | Docker Compose | Two-container orchestration |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com/) |

### Simulated Clock Speeds

| Preset | Real 1 second = | Full semester in |
|--------|----------------|-----------------|
| 1× | 1 second | ~16 weeks |
| 60× | 1 minute | ~4.5 hours |
| 360× | 6 minutes | ~45 minutes |
| 3600× | 1 hour | ~4.5 minutes |

---

## Design Decisions

**Why a central orchestrator instead of peer-to-peer agents?**
Deterministic execution order, centralized logging for the debug panel, and simple extensibility. Adding a new agent means registering it with the orchestrator — no need to modify existing agents.

**Why local-first with optional LLM enrichment?**
Most agent computations (attendance rates, grade averages, event filtering) are deterministic — an LLM doesn't add value over arithmetic. The LLM adds value for pattern detection ("tends to skip Monday mornings"), nuanced decision-making ("should we warn about attendance in this notification?"), and natural language generation. Splitting these concerns reduces cost by ~90%.

**Why separate Persona and Notification Composer agents?**
The Persona Agent decides *what* and *when* — it outputs structured decisions. The Composer decides *how* — it produces natural language. Separation means the Persona Agent's logic can be tested without parsing prose, and the Composer's tone can be tuned without affecting decision logic.

**Why not merge the Daily Digest, Weekly Summary, and Notification Composer?**
For a production system, they should probably be merged — the output shape is identical and it would save 1–2 Sonnet calls per day. They're kept separate in this PoC for clarity: each agent has one distinct responsibility, making the architecture easier to understand and demonstrate.

---

## Future Enhancements

- **Merge Composer + Digest + Weekly** into a single Sonnet call per daily tick
- **LLM-powered chat actions** — "remind me about the OS exam 2 days before" creates a notification
- **Multi-student support** with authentication and per-student data isolation
- **ML-based preference learning** — replace rule-based feedback model with a bandit algorithm
- **Real data integration** — connect to university LMS APIs instead of CSV files
- **Mobile push notifications** via service workers
- **A/B testing** — use the composition log to automatically test different notification tones

---

## License

MIT
