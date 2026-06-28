#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AmplifyStack } from "../lib/amplify-stack";
import { ApiStack } from "../lib/api-stack";
import { CognitoStack } from "../lib/cognito-stack";

const app = new cdk.App();

const stage = (app.node.tryGetContext("stage") as string) ?? "dev";

// GitHub repo context — set via cdk.json or --context
const repoOwner = (app.node.tryGetContext("repoOwner") as string) ?? "YOUR_GITHUB_USER";
const repoName = (app.node.tryGetContext("repoName") as string) ?? "expense-tracker";
const githubTokenSecretName =
  (app.node.tryGetContext("githubTokenSecretName") as string) ?? "github-oauth-token";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
};

const cognitoStack = new CognitoStack(app, `CognitoStack-${stage}`, { stage, env });

const apiStack = new ApiStack(app, `ApiStack-${stage}`, {
  stage,
  env,
  userPool: cognitoStack.userPool,
});
apiStack.addDependency(cognitoStack);

const amplifyStack = new AmplifyStack(app, `AmplifyStack-${stage}`, {
  stage,
  env,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
  apiUrl: apiStack.apiUrl,
  repoOwner,
  repoName,
  githubTokenSecretName,
});
amplifyStack.addDependency(apiStack);
