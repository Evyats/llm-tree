# Chat Tree

Branching chat canvas with React Flow + FastAPI + PostgreSQL.  
Each assistant response has 3 variants (`short`, `medium`, `long`), supports highlight-to-elaborate branching, and can continue from any selected node.  
If live model calls are unavailable, deterministic fallback responses are used.

## Prerequisites
- Docker
- Node.js 20+
- Python 3.11+

## Setup
1. Copy env files:
   - `Copy-Item infra/.env.example infra/.env`
   - `Copy-Item backend/.env.example backend/.env`
   - `Copy-Item frontend/.env.example frontend/.env`
2. Set `OPENAI_API_KEY` in `backend/.env` (optional if fallback-only).

## Run
1. Start PostgreSQL (data persists in `infra/postgres/data`):
   - `docker compose -f infra/docker-compose.yml --env-file infra/.env up`
2. Backend:
   - `cd backend`
   - `python -m pip install -r requirements.txt`
   - `python -m uvicorn app.main:app --reload --port 8713`
3. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

Open `http://localhost:5173`.

## Test
- Backend: `cd backend && python -m pytest -q`
- Frontend: `cd frontend && npm run test && npm run build`

## Architecture
- Frontend
  - `frontend/src/App.tsx`: orchestration only (load/send/toggle/layout mode wiring).
  - `frontend/src/components/panels/*`: header, history, composer, context chat UI.
  - `frontend/src/features/layout/*`: fixed-layout engine + graph constants.
  - `frontend/src/features/chat/*`: transcript/path helpers.
  - `frontend/src/api/modules/*`: domain API clients (`graphs`, `messages`, `chat`, `nodes`, `session`).
- Backend
  - `backend/app/api/*`: thin FastAPI routes.
  - `backend/app/services/conversation.py`: graph/message persistence and branching flow.
  - `backend/app/services/message_service.py`: shared endpoint response assembly.
  - `backend/app/services/payloads.py`: model-to-API payload mapping.
  - `backend/app/core/logging.py`: logging setup (per-run rotating files).
