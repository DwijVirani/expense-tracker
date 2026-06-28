# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`/backend`, Python 3.12 + uv)

```bash
cd backend
uv run pytest                          # all tests
uv run pytest tests/test_parser.py     # single test file
uv run pytest -k "test_amount_formats" # single test by name
uv run uvicorn app.main:app --reload   # local dev server (port 8000)
uv run ruff check app/ tests/          # lint
uv run ruff format app/ tests/         # format
uv run mypy app/                       # type check
```

### Frontend (`/frontend`, Node 22 + pnpm)

```bash
cd frontend
pnpm dev        # dev server (port 3000)
pnpm build      # production build + type check
pnpm lint       # eslint
```

### Infra (`/infra`, CDK TypeScript)

```bash
cd infra
npm run build                                        # compile TS
npm test                                             # jest tests
npx cdk synth --context stage=dev                    # synthesize (no deploy)
npx cdk deploy CognitoStack-dev --context stage=dev  # deploy single stack
npx cdk deploy --all --context stage=dev             # deploy all stacks
```

Pass `--context stage=prod` for production. CDK context vars: `stage`, `repoOwner`, `repoName`, `githubTokenSecretName`.

### Telegram bot (`/telegram-bot`, Python 3.12 + uv)

```bash
cd telegram-bot
uv run python bot.py   # long-polling process (needs .env)
```

### Local full stack

```bash
docker compose up   # mongo + backend + frontend
```

## Architecture

### Auth flow (critical to understand)

FastAPI **never verifies JWTs**. API Gateway's Cognito authorizer validates the token and injects verified claims into the Lambda event. Mangum exposes this via `request.scope["aws.event"]["requestContext"]["authorizer"]["claims"]`. `app/auth.py:get_current_user` reads `sub` + `email` from there and JIT-creates a Mongo user doc on first login.

For **local dev** (no API Gateway), pass `X-Dev-Sub` and `X-Dev-Email` headers — these are ignored in prod since API Gateway strips unknown headers before Lambda.

### Data scoping

Every Mongo query for transactions must include `user_id`. The `user_id` field is the Mongo `ObjectId` of the `users` document (not the Cognito `sub`). `get_current_user` returns the full user dict including `_id`. All routers access `user["_id"]` for queries.

### Parser (`app/parser.py`)

Shared between `POST /transactions/quick-add` (web) and `POST /telegram/message` (bot). Never duplicated. Accepts `user_categories` dict to merge per-user keyword overrides on top of `app/categories.py` defaults. Category matching uses `\b` word-boundary regex — not substring contains.

### Telegram bot auth

`/telegram/*` routes have **no** Cognito authorizer on API Gateway. Auth is a shared secret: bot sends `X-Service-Token: <secret>`, FastAPI's `require_service_token` dependency checks it against `TELEGRAM_SERVICE_SECRET` env var. The two secrets (`TELEGRAM_SERVICE_SECRET` in backend, `SERVICE_SECRET` in bot) must match.

### MongoDB motor client

Module-level singleton in `app/db.py`. Intentionally not recreated per-request — Lambda warm invocations reuse the connection pool. `ensure_indexes()` runs once at FastAPI lifespan startup.

### CDK stack dependency order

`CognitoStack` → `ApiStack` (receives `userPool`) → `AmplifyStack` (receives `userPool`, `userPoolClient`, `apiUrl`). All stacks are in `infra/bin/infra.ts`.

### Frontend API calls

`lib/api.ts` wraps fetch and auto-attaches the Cognito ID token from the Amplify session. All page components use `hooks/useAuth.ts` to get the current user and redirect to `/login` when `!loading && !user`.

### Secrets in prod (AWS)

- MongoDB URI → Secrets Manager: `expense-tracker/{stage}/mongo-uri`
- Telegram service secret → SSM SecureString: `/expense-tracker/{stage}/telegram-service-secret`
- GitHub OAuth token for Amplify → Secrets Manager: name set via `githubTokenSecretName` CDK context

### Testing approach

Backend tests use `mongomock-motor` to replace the motor client. The `mock_mongo` fixture in `test_transactions.py` patches `app.db._client` with a mock client and resets it after each test. Parser tests are pure functions — no fixtures needed.
