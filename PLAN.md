# The Signal — MerakiPeople Growth OS — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + TS + Tailwind)         │
│  Strategy | Signal Feed | Brain | Calendar | Pipeline | Analytics│
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                    BACKEND (Node.js + Express + TS)              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Routes   │  │ Swagger   │  │ Auth     │  │ Cost Tracker  │  │
│  │ /api/*   │  │ /api-docs │  │ JWT      │  │ per-call log  │  │
│  └────┬─────┘  └───────────┘  └──────────┘  └───────────────┘  │
│       │                                                          │
│  ┌────▼──────────────────────────────────────────────────────┐  │
│  │              AI ORCHESTRATOR (Agent + Critique Loop)       │  │
│  │  ┌─────────┐    ┌──────────┐    ┌─────────────────────┐  │  │
│  │  │ Agent   │───>│ Critique │───>│ Loop Controller     │  │  │
│  │  │ (Gen)   │<───│ Agent    │    │ max 3 iterations    │  │  │
│  │  └─────────┘    └──────────┘    │ tracks cost/tokens  │  │  │
│  │                                  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │                                                          │
│  ┌────▼─────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │ Prompt   │  │ fal.ai       │  │ Evidence Engine       │     │
│  │ Manager  │  │ Image Gen    │  │ (citations, sources)  │     │
│  │ (YAML)   │  └──────────────┘  └───────────────────────┘     │
│  └──────────┘                                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     MongoDB (Mongoose ODM)                       │
│  strategy | campaigns | signal_feed | posts | leads |           │
│  analytics_weekly | cost_logs | prompt_versions                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer        | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 18 + TypeScript + Tailwind CSS + Vite   |
| Backend     | Node.js + Express + TypeScript                |
| Database    | MongoDB Atlas + Mongoose ODM                  |
| Auth        | JWT (jsonwebtoken + bcrypt)                    |
| API Docs    | swagger-jsdoc + swagger-ui-express             |
| AI Text     | Anthropic Claude API (claude-sonnet-4-5)      |
| AI Images   | fal.ai (flux/dev)                             |
| Prompts     | YAML files in `/server/prompts/`              |
| Cost Track  | Custom middleware logging every AI call         |
| Monorepo    | npm workspaces (`/client` + `/server`)         |

## Key Architectural Decisions

### 1. Agent + Critique Loop Pattern
Every AI call follows this flow:
```
Input → Agent (generates) → Critique Agent (evaluates) →
  IF critique.score >= 8/10 → Return result
  ELSE → Agent regenerates with critique feedback → loop (max 3x)
  After max loops → return best-scored result + critique notes
```

Applied to:
- Signal Feed classification/routing
- Post generation (text)
- Image prompt construction
- Outreach message drafting
- Strategy recommendations
- Monday Brief generation

Each critique evaluates against:
- Strategy alignment (does it match the Living Strategy?)
- Voice fidelity (does it sound like the author?)
- Evidence backing (are claims supported by data?)
- Platform fit (is it right for LinkedIn vs Instagram?)

### 2. External Prompts (YAML)
All prompts live in `/server/prompts/*.yaml`:
```
server/prompts/
  signal-feed-classifier.yaml
  signal-feed-critique.yaml
  post-generator-linkedin.yaml
  post-generator-instagram.yaml
  post-critique.yaml
  image-prompt-builder.yaml
  image-prompt-critique.yaml
  outreach-drafter.yaml
  outreach-critique.yaml
  strategy-recommender.yaml
  strategy-critique.yaml
  monday-brief.yaml
  monday-brief-critique.yaml
  onboarding-interviewer.yaml
```

Each YAML has:
```yaml
name: "post-generator-linkedin"
version: "1.0"
description: "Generates LinkedIn posts from strategy + signal feed"
model: "claude-sonnet-4-5"
max_tokens: 2000
temperature: 0.7
system_prompt: |
  You are the content brain for MerakiPeople.
  {{STRATEGY_CONTEXT}}
  {{AUTHOR_VOICE}}
  {{CAMPAIGN_CONTEXT}}
  {{PERFORMANCE_CONTEXT}}
  ...
user_prompt: |
  Generate a LinkedIn post based on this signal:
  {{SIGNAL_FEED_ENTRY}}
  ...
evidence_requirements:
  - "Must reference specific data from strategy"
  - "Must cite which pillar this aligns to"
  - "Must reference ICP characteristics"
output_schema:
  type: object
  properties:
    hook: { type: string }
    body: { type: string }
    ...
```

### 3. Evidence-Based AI Responses
Every AI output includes an `evidence` field:
```json
{
  "content": "...",
  "evidence": {
    "strategy_references": ["Pillar 2: Founder Journey", "ICP: Mid-size IT companies"],
    "data_points": ["7.2% engagement rate on similar posts", "3 leads from this pillar last month"],
    "signal_feed_sources": ["signal_id_abc: 'Client told me...'"],
    "confidence_score": 0.85,
    "critique_iterations": 2,
    "final_critique_score": 9
  }
}
```

### 4. Cost Tracking
Every AI API call is logged to `cost_logs` collection:
```json
{
  "timestamp": "2026-03-05T...",
  "operation": "generate-post",
  "model": "claude-sonnet-4-5",
  "input_tokens": 1500,
  "output_tokens": 800,
  "cost_usd": 0.0138,
  "iteration": 2,
  "total_iterations": 2,
  "agent_type": "generator|critique",
  "user": "shohini",
  "post_id": "..."
}
```

Dashboard shows: daily/weekly/monthly costs, cost per post, cost per module.

### 5. Streaming (Phase 2 Ready)
Architecture supports streaming by:
- Using Server-Sent Events (SSE) endpoints alongside REST
- AI orchestrator returns AsyncIterables
- Frontend uses EventSource for real-time updates
- Phase 1: standard request/response
- Phase 2: flip streaming flag per endpoint

## MongoDB Schema (Mongoose Models)

### Collections:
1. **users** — Shohini & Sanjoy profiles + hashed passwords + JWT
2. **strategies** — Living Strategy Document (versioned)
3. **campaigns** — Time-bounded content pushes
4. **signal_feeds** — Raw diary entries + AI routing
5. **posts** — Generated content (text + image refs)
6. **leads** — Pipeline tracker
7. **analytics_weekly** — Weekly metrics + Signal Score
8. **cost_logs** — Every AI API call logged
9. **prompt_versions** — Audit trail of prompt changes (optional)

## Project Structure

```
outreach-agent/
├── package.json                 # npm workspaces root
├── .env                         # Environment variables
├── .gitignore
│
├── client/                      # React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                 # API client (axios)
│       ├── components/
│       │   ├── layout/          # Sidebar, TopBar, FloatingButton
│       │   ├── strategy/        # StrategyOnboarding, StrategyDoc, CampaignBuilder
│       │   ├── signal-feed/     # SignalInput, SignalCard, SignalFeedView
│       │   ├── brain/           # PostReview, ImagePanel, RegenerateControls
│       │   ├── calendar/        # MonthView, WeekView, ListView, PostCard
│       │   ├── pipeline/        # KanbanBoard, LeadCard, OutreachDraft
│       │   ├── analytics/       # Dashboard, SignalScore, MondayBrief
│       │   └── shared/          # Button, Card, Modal, Badge, EmptyState
│       ├── contexts/            # AuthContext, StrategyContext
│       ├── hooks/               # useStrategy, useSignalFeed, usePosts
│       ├── pages/               # StrategyPage, SignalFeedPage, etc.
│       ├── types/               # All TypeScript interfaces
│       └── utils/               # formatters, constants, brand colors
│
├── server/                      # Node.js backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Express app entry
│       ├── config/
│       │   ├── db.ts            # MongoDB connection
│       │   ├── env.ts           # Env var validation
│       │   └── swagger.ts       # Swagger config
│       ├── models/              # Mongoose schemas
│       │   ├── User.ts
│       │   ├── Strategy.ts
│       │   ├── Campaign.ts
│       │   ├── SignalFeed.ts
│       │   ├── Post.ts
│       │   ├── Lead.ts
│       │   ├── AnalyticsWeekly.ts
│       │   └── CostLog.ts
│       ├── routes/              # Express routers (Swagger-annotated)
│       │   ├── auth.routes.ts
│       │   ├── strategy.routes.ts
│       │   ├── signal-feed.routes.ts
│       │   ├── posts.routes.ts
│       │   ├── calendar.routes.ts
│       │   ├── pipeline.routes.ts
│       │   ├── analytics.routes.ts
│       │   └── costs.routes.ts
│       ├── controllers/         # Route handlers
│       ├── middleware/
│       │   ├── auth.ts          # JWT verification
│       │   └── costTracker.ts   # Wraps AI calls with cost logging
│       ├── services/
│       │   ├── ai/
│       │   │   ├── orchestrator.ts      # Agent + Critique loop controller
│       │   │   ├── promptManager.ts     # Loads/interpolates YAML prompts
│       │   │   ├── claudeClient.ts      # Anthropic SDK wrapper
│       │   │   ├── evidenceEngine.ts    # Attaches evidence to AI outputs
│       │   │   └── costTracker.ts       # Logs tokens + costs to MongoDB
│       │   ├── signalFeed.service.ts
│       │   ├── strategy.service.ts
│       │   ├── post.service.ts
│       │   ├── image.service.ts         # fal.ai integration
│       │   ├── pipeline.service.ts
│       │   └── analytics.service.ts
│       └── prompts/             # All AI prompts as YAML files
│           ├── signal-feed-classifier.yaml
│           ├── signal-feed-critique.yaml
│           ├── post-generator-linkedin.yaml
│           ├── post-generator-instagram.yaml
│           ├── post-critique.yaml
│           ├── image-prompt-builder.yaml
│           ├── image-prompt-critique.yaml
│           ├── outreach-drafter.yaml
│           ├── outreach-critique.yaml
│           ├── strategy-recommender.yaml
│           ├── strategy-critique.yaml
│           ├── monday-brief.yaml
│           ├── monday-brief-critique.yaml
│           └── onboarding-interviewer.yaml
│
└── docs/
    └── api-spec.md              # Additional API notes
```

## Implementation Phases

### Phase 1: Foundation (Steps 1-8)
1. **Monorepo + tooling** — npm workspaces, TS configs, ESLint, .gitignore, .env
2. **MongoDB models** — All 8 Mongoose schemas
3. **Express server** — Entry point, middleware, Swagger setup, health check
4. **Auth** — JWT login for Shohini + Sanjoy, seed users, auth middleware
5. **Prompt Manager** — YAML loader, template interpolation, hot-reload
6. **AI Orchestrator** — Agent + Critique loop, cost tracking, evidence engine
7. **Strategy routes** — CRUD, versioning, onboarding interview endpoint
8. **React shell** — Vite, Tailwind, routing, sidebar, auth context, brand theme

### Phase 2: Core Loop (Steps 9-15)
9. **Strategy UI** — Onboarding interview flow, Living Document view + inline edit
10. **Signal Feed backend** — Input, AI classification/routing via orchestrator
11. **Signal Feed UI** — Floating button, feed view, routing cards
12. **Brain backend** — Post generation (text), image prompt generation
13. **Brain + fal.ai** — Image generation, 3 variations, storage
14. **Post Review UI** — Split view (text + image), regenerate controls
15. **Calendar backend + UI** — Month/Week/List views, drag-drop, gap detection

### Phase 3: Tracking + Intelligence (Steps 16-20)
16. **Pipeline backend + UI** — Kanban, lead cards, content attribution, outreach drafts
17. **Analytics backend** — Manual input, Signal Score calculation
18. **Monday Brief** — Weekly digest generation via orchestrator
19. **Strategy Feedback Loop** — AI recommendations, accept/dismiss flow
20. **Analytics UI** — Dashboard, Signal Score animation, Monday Brief card

### Phase 4: Polish (Steps 21-24)
21. **Mobile responsiveness** — Signal Feed priority, swipeable calendar
22. **Empty states + first-run UX** — Locked modules, onboarding flow
23. **Cost tracking dashboard** — View AI spend by module/day/week
24. **Error handling + loading states + notifications**

### Phase 5 (Future): Streaming
25. **SSE endpoints** — For post generation, signal feed processing
26. **Frontend EventSource** — Real-time streaming UI

## API Endpoints (Swagger-documented)

### Auth
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Current user profile

### Strategy
- `GET /api/strategy/current` — Get current Living Strategy
- `POST /api/strategy/onboarding` — Submit onboarding answers (AI processes)
- `PUT /api/strategy/:id` — Update strategy field(s), creates new version
- `GET /api/strategy/versions` — Version history
- `GET /api/strategy/recommendations` — AI-generated recommendations
- `POST /api/strategy/recommendations/:id/accept` — Accept a recommendation

### Campaigns
- `GET /api/campaigns` — List campaigns
- `POST /api/campaigns` — Create campaign
- `PUT /api/campaigns/:id` — Update campaign
- `DELETE /api/campaigns/:id` — Delete campaign

### Signal Feed
- `POST /api/signal-feed` — Submit new entry (triggers AI processing)
- `GET /api/signal-feed` — List entries (filterable)
- `PUT /api/signal-feed/:id/confirm` — Confirm AI routing
- `PUT /api/signal-feed/:id/override` — Override AI routing

### Posts (Brain)
- `POST /api/posts/generate` — Generate post from signal/strategy
- `POST /api/posts/:id/regenerate` — Regenerate with instruction
- `POST /api/posts/:id/generate-image` — Generate/regenerate image
- `GET /api/posts` — List posts (filterable)
- `PUT /api/posts/:id` — Update post (edit content, schedule, status)
- `DELETE /api/posts/:id` — Delete draft

### Calendar
- `GET /api/calendar?view=month&date=2026-03` — Calendar data
- `GET /api/calendar/gaps` — Detect calendar gaps
- `GET /api/calendar/alignment` — Pillar alignment vs strategy targets
- `PUT /api/calendar/reschedule` — Drag-drop reschedule

### Pipeline
- `GET /api/pipeline` — All leads (filterable by stage)
- `POST /api/pipeline` — Add lead
- `PUT /api/pipeline/:id` — Update lead (stage, notes)
- `POST /api/pipeline/:id/draft-outreach` — AI-generate outreach message
- `DELETE /api/pipeline/:id` — Remove lead

### Analytics
- `POST /api/analytics/post-performance` — Log post metrics
- `GET /api/analytics/dashboard` — Dashboard data
- `GET /api/analytics/signal-score` — Current Signal Score
- `GET /api/analytics/monday-brief` — Latest Monday Brief
- `POST /api/analytics/generate-weekly` — Trigger weekly digest

### Costs
- `GET /api/costs` — Cost logs (filterable by date, module, user)
- `GET /api/costs/summary` — Aggregated cost summary

## Git Strategy
- Initialize repo, push to GitHub
- Commit after each logical step completion
- Branch: `main` (direct commits for solo build)

## Environment Variables
```
# MongoDB
MONGODB_URI=mongodb+srv://...

# Auth
JWT_SECRET=...

# AI
ANTHROPIC_API_KEY=...
FAL_KEY=...

# Server
PORT=5000
NODE_ENV=development

# Client
VITE_API_URL=http://localhost:5000/api
```
