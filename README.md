# Expense Tracker

Multi-user expense tracker. Log expenses via web quick-add or Telegram. Each user's data is fully isolated.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), shadcn/ui + Recharts, AWS Amplify Auth |
| Backend | FastAPI + Mangum on Lambda (container image), `motor` async driver |
| Database | MongoDB Atlas (prod) / `mongo:7` container (dev) |
| Auth | AWS Cognito User Pool — API Gateway authorizer validates JWTs, FastAPI never does |
| Telegram | python-telegram-bot v21, calls backend `/telegram/*` API only |
| IaC | AWS CDK (TypeScript) — three stacks: Cognito, API, Amplify |

## Repo Layout

```
/backend          FastAPI app (uv)
/frontend         Next.js app (pnpm)
/telegram-bot     Telegram bot (uv)
/infra            CDK stacks (npm)
docker-compose.yml
```

## Local Dev

Requires a real Cognito dev User Pool (auth is not mocked locally).

```bash
# 1. Deploy CognitoStack-dev first (one-time):
cd infra && npx cdk deploy CognitoStack-dev --context stage=dev

# 2. Fill env files with the Cognito outputs:
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit both files with your User Pool ID, Client ID, and a service secret

# 3. Start the stack:
docker compose up
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| MongoDB | localhost:27017 |

## Backend

```bash
cd backend
uv run pytest                           # all tests
uv run pytest tests/test_parser.py      # single file
uv run pytest -k "test_amount_formats"  # single test
uv run uvicorn app.main:app --reload    # without Docker
uv run ruff check app/ tests/
uv run mypy app/
```

Local auth bypass: pass `X-Dev-Sub` and `X-Dev-Email` headers. API Gateway strips these in prod.

## Frontend

```bash
cd frontend
pnpm dev        # dev server
pnpm build      # production build + type check
pnpm lint
```

## Infra (CDK)

```bash
cd infra
npm run build
npm test
npx cdk synth --context stage=dev
npx cdk deploy --all --context stage=dev \
  --context repoOwner=<github-user> \
  --context repoName=expense-tracker \
  --context githubTokenSecretName=<sm-secret-name>
```

Stack deploy order (enforced by `addDependency`): `CognitoStack` → `ApiStack` → `AmplifyStack`.

## Telegram Bot

```bash
cd telegram-bot
cp .env.example .env   # fill in token, backend URL, service secret
uv run python bot.py   # long-polling process
```

Commands: `/link <code>`, `/total`, `/budget`, `/undo`, plain text to log expenses.

To link a Telegram account: user generates a code in Settings → pastes it via `/link <code>` in the bot.

## Prod Deploy

Pre-requisites before `cdk deploy --context stage=prod`:

1. MongoDB Atlas cluster → store connection string in Secrets Manager as `expense-tracker/prod/mongo-uri`
2. Telegram service secret → SSM SecureString at `/expense-tracker/prod/telegram-service-secret`
3. GitHub OAuth token → Secrets Manager (name passed via `githubTokenSecretName` context)
4. Run `cdk bootstrap` if not already done for the target account/region

Default region: `us-east-1`.
