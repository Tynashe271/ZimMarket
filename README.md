# ZimMarket

[![Backend CI](https://github.com/Tynashe271/ZimMarket/actions/workflows/backend.yml/badge.svg?branch=master)](https://github.com/Tynashe271/ZimMarket/actions/workflows/backend.yml)

ZimMarket is split into two independent applications:

- `backend/` — NestJS, Prisma, PostgreSQL and Redis API
- `frontend/` — Next.js, React, TypeScript and Tailwind CSS customer marketplace

## Run locally

Start the backend dependencies and API:

```powershell
cd backend
podman-compose up -d
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3001. During development, Next.js rewrites `/api` to the NestJS backend at `http://localhost:3000`. For deployment, set `BACKEND_URL` to the private NestJS service URL or `NEXT_PUBLIC_API_URL` when the API is on a public origin.

## Marketplace assistant

The “Ask Zim” assistant is available on every frontend page. It always uses live catalog context from PostgreSQL through NestJS. Without an API key it runs in local catalog mode. To enable generated AI answers, set these server-only values in `backend/.env` and restart the backend:

```env
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5.4
```

Never expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_` variable.

Backend documentation remains in [`backend/README.md`](backend/README.md). Swagger is available at http://localhost:3000/docs.
