# Expense Tracker

Multi-user expense tracker. Log expenses via web or Telegram. Backend on AWS Lambda (FastAPI + Mangum), frontend on Amplify (Next.js), auth via Cognito, data in MongoDB Atlas.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), shadcn/ui, AWS Amplify Auth |
| Backend | FastAPI + Mangum on Lambda, `motor` (async Mongo) |
| Database | MongoDB Atlas (prod) / `mongo:7` container (dev) |
| Auth | AWS Cognito User Pool + Amplify Auth SDK |
| Telegram | python-telegram-bot v21 → calls backend API |
| IaC | AWS CDK (TypeScript) |

## Repo Layout

```
/frontend        Next.js app
/backend         FastAPI app (uv)
/telegram-bot    Telegram bot
/infra           CDK stacks
docker-compose.yml
```

## Local Dev

```bash
cp backend/.env.example backend/.env   # fill in values
cp frontend/.env.example frontend/.env

docker compose up
```

Backend runs on `:8000`, frontend on `:3000`. Auth uses a real dev-stage Cognito User Pool.

## Build Order

See `todo.md` for full spec. Phases: infra (Cognito) → backend → Docker Compose → infra (API GW) → frontend → bot → prod.
