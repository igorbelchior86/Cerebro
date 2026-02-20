# Quick Start Guide - Playbook Brain

## Prerequisites
- macOS or Linux
- Docker & Docker Compose
- Node.js 18+ (for development)
- pnpm 9+

## Installation (5 minutes)

### 1. Clone & Install
```bash
cd /Users/igorbelchior/Documents/Github/Cerebro
pnpm install
```

### 2. Start Docker Services
```bash
# Start PostgreSQL + Redis
pnpm db:up

# Wait 10 seconds, then migrate database
sleep 10
pnpm db:migrate
```

### 3. Configure Environment
Copy and edit `.env` file - add your API keys:
```bash
# Get Groq API key (free): https://console.groq.com
GROQ_API_KEY=gsk_...

# Optional - Autotask, NinjaOne, IT Glue credentials
```

### 4. Run Development Servers
```bash
pnpm dev
```

This starts both:
- **API**: http://localhost:3001
- **Web UI**: http://localhost:3000

## First Steps

### Via Web UI (Easiest)

1. Open http://localhost:3000 in browser
2. Click "New Triage Session"
3. Enter a Ticket ID (e.g., "T-12345", or just "test")
4. Click "Start Triage Session"
5. Watch real-time progress:
   - Evidence collection
   - LLM diagnosis
   - Safety validation
   - Playbook generation
6. Click "Playbook" tab to view the generated markdown

### Via Command Line (Testing)

Test the complete pipeline with curl:

```bash
# 1. Create session
SESSION=$(curl -s -X POST http://localhost:3001/triage/sessions \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": "TEST-001", "created_by": "cli"}' | \
  jq -r '.id')

echo "Session ID: $SESSION"

# 2. Collect evidence
curl -X POST http://localhost:3001/prepare-context \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}"

# 3. Generate diagnosis
curl -X POST http://localhost:3001/diagnose \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}"

# 4. Validate diagnosis
curl -X POST http://localhost:3001/diagnose/validate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}"

# 5. Generate playbook
curl -X POST http://localhost:3001/playbook \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}"

# 6. View playbook (HTML rendered)
curl http://localhost:3001/playbook/$SESSION/markdown
```

## API Endpoints Summary

### Phase 1: Connectors
- `GET /autotask/ticket/:id` - Get Autotask ticket
- `GET /autotask/company/:companyId/devices` - Devices by company
- `GET /ninjaone/device/:id` - NinjaOne device info
- `GET /itglue/documents/search` - Search IT Glue docs

### Phase 2: Evidence Collection
- `POST /prepare-context` - Collect all evidence
- `GET /prepare-context/:sessionId` - Get evidence pack

### Phase 3: Diagnosis & Validation
- `POST /diagnose` - Generate AI diagnosis
- `GET /diagnose/:sessionId` - Get diagnosis
- `POST /diagnose/validate` - Validate diagnosis
- `GET /diagnose/validation/:sessionId` - Get validation

### Phase 4: Playbooks & UI
- `POST /playbook` - Generate playbook
- `GET /playbook/:sessionId` - Get playbook (JSON)
- `GET /playbook/:sessionId/markdown` - Get markdown

## Project Structure

```
Playbook Brain/
├── apps/
│   ├── api/          # Express backend + services
│   └── web/          # Next.js frontend
├── packages/
│   └── types/        # Shared TypeScript definitions
├── docs/
│   ├── LLM_SETUP.md
│   └── PHASE_4_COMPLETE.md
└── docker-compose.yml
```

## Troubleshooting

### Port already in use
```bash
# Change ports:
PORT=3002 pnpm --filter @playbook-brain/api dev
pnpm --filter @playbook-brain/web dev -- -p 3001
```

### Database connection failed
```bash
# Check services:
docker ps | grep "postgres\|redis"

# Restart:
pnpm db:up
```

### LLM API errors
- Verify `GROQ_API_KEY` is set in `.env`
- Get new key: https://console.groq.com
- Check internet connectivity

### TypeScript errors
```bash
# Rebuild everything:
pnpm install
pnpm typecheck
pnpm build
```

## Development

### Build for production
```bash
pnpm build
```

### Run production build
```bash
NODE_ENV=production pnpm start
```

### View logs
```bash
# API logs
pnpm --filter @playbook-brain/api dev

# Web logs
pnpm --filter @playbook-brain/web dev
```

### Database

```bash
# View database directly
psql postgresql://playbook:playbook_dev@localhost:5432/playbook_brain

# Query sessions
SELECT id, ticket_id, status, created_at FROM triage_sessions;

# Query outputs
SELECT session_id, output_type, created_at FROM llm_outputs;
```

## Customization

### Change LLM Provider
```bash
# Options: groq, minimax, anthropic
# In `.env`:
LLM_PROVIDER=minimax
MINIMAX_API_KEY=sk_...
```

### Add Autotask/NinjaOne/IT Glue
```bash
# Add to `.env`:
AUTOTASK_API_KEY=your_key
NINJAONE_CLIENT_ID=your_id
NINJAONE_CLIENT_SECRET=your_secret
ITGLUE_API_KEY=your_key
```

### Customize Playbook Format
Edit: `apps/api/src/services/playbook-writer.ts`
- Method `buildPlaybookPrompt()` - Change prompt template
- Method `validatePlaybookStructure()` - Change validation rules

## Performance

- **API Response Time**: 100-500ms (excluding LLM)
- **LLM Inference**: 10-30 seconds (Groq)
- **Database Queries**: <100ms each
- **Web Load Time**: <2 seconds

## Security

- API keys stored in `.env` (NOT in git)
- Database connections use credentials
- CORS enabled for localhost
- No authentication implemented (add in production)
- LLM prompts sanitized

## Monitoring

Check health:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/version
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T..."
}
```

## Support

- **Docs**: See `docs/` folder
- **Issues**: Check error logs with `pnpm dev`
- **API Keys**: Get from Groq, Anthropic, or Minimax consoles

## Next Steps

- Add authentication (NextAuth.js)
- Deploy to Cloud (Vercel, AWS, GCP)
- Add integration webhooks (Slack, Teams)
- Set up monitoring & analytics
- Create playbook templates
- Build admin dashboard

---

Ready to generate intelligent playbooks! 🚀
