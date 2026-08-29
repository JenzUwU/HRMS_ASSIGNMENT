# HRMS Post Offer Engagement

Monorepo.

```
HRMS_ASSIGNMENT/
  frontend/              Next.js + TypeScript + Tailwind + Recharts
  backend/               FastAPI + Python
  HRMS-SWIGGY-PAGES-UI/  UI reference screenshots (do not ship)
```

## Run

Backend:
```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend && npm run dev
```

## Status

Foundation only. No pages built. Supabase and Groq not connected.
