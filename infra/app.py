#!/usr/bin/env python3
import os

import aws_cdk as cdk

from infra.amplify_stack import AmplifyStack
from infra.api_stack import ApiStack
from infra.bot_stack import BotStack
from infra.cognito_stack import CognitoStack

app = cdk.App()

stage = app.node.try_get_context("stage") or "dev"

# GitHub repo context — set via cdk.json or --context
repo_owner = app.node.try_get_context("repoOwner") or "YOUR_GITHUB_USER"
repo_name = app.node.try_get_context("repoName") or "expense-tracker"
github_token_secret_name = app.node.try_get_context("githubTokenSecretName") or "github-oauth-token"

env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
)

cognito_stack = CognitoStack(app, f"CognitoStack-{stage}", stage=stage, env=env)

api_stack = ApiStack(
    app,
    f"ApiStack-{stage}",
    stage=stage,
    env=env,
    user_pool=cognito_stack.user_pool,
)
api_stack.add_dependency(cognito_stack)

amplify_stack = AmplifyStack(
    app,
    f"AmplifyStack-{stage}",
    stage=stage,
    env=env,
    user_pool=cognito_stack.user_pool,
    user_pool_client=cognito_stack.user_pool_client,
    api_url=api_stack.api_url,
    repo_owner=repo_owner,
    repo_name=repo_name,
    github_token_secret_name=github_token_secret_name,
)
amplify_stack.add_dependency(api_stack)

bot_stack = BotStack(
    app,
    f"BotStack-{stage}",
    stage=stage,
    env=env,
    api_url=api_stack.api_url,
    service_secret_param_name=api_stack.service_secret_param_name,
    repo_owner=repo_owner,
    repo_name=repo_name,
)
bot_stack.add_dependency(api_stack)

app.synth()
