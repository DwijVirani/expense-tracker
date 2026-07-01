# expense-tracker infra (CDK, Python)

CDK app for the expense-tracker stacks: Cognito user pool, backend Lambda +
API Gateway, Amplify-hosted frontend, and the Telegram bot's EC2 instance.

`app.py` wires up the stacks (`infra/cognito_stack.py`, `infra/api_stack.py`,
`infra/amplify_stack.py`, `infra/bot_stack.py`) in dependency order:
`CognitoStack` → `ApiStack` → (`AmplifyStack`, `BotStack`).

## Useful commands

```bash
uv sync                                                # install deps
uv run pytest                                          # unit tests
uv run cdk synth --context stage=dev                   # synthesize (no deploy)
uv run cdk diff --context stage=dev                    # diff vs deployed stack
uv run cdk deploy CognitoStack-dev --context stage=dev  # deploy a single stack
uv run cdk deploy --all --context stage=dev             # deploy everything
```

Pass `--context stage=prod` for production. Other context vars: `repoOwner`,
`repoName`, `githubTokenSecretName` — read in `app.py` and passed down to
`AmplifyStack`/`BotStack`.

See `../DEPLOY.md` for the full deploy walkthrough, including the SSM
parameters that must exist before deploying (`mongo-uri`,
`telegram-service-secret`, `telegram-bot-token`).
