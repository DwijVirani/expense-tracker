import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CognitoStack } from "../lib/cognito-stack";

test("CognitoStack creates User Pool with email sign-in", () => {
  const app = new cdk.App();
  const stack = new CognitoStack(app, "TestCognitoStack", {
    stage: "test",
    env: { account: "123456789012", region: "ap-south-1" },
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::Cognito::UserPool", {
    UsernameAttributes: ["email"],
    Policies: {
      PasswordPolicy: { MinimumLength: 12 },
    },
  });

  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    GenerateSecret: false,
    PreventUserExistenceErrors: "ENABLED",
  });
});
