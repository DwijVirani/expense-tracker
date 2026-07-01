import aws_cdk as cdk
from aws_cdk.assertions import Template

from infra.cognito_stack import CognitoStack


def test_cognito_stack_creates_user_pool_with_email_sign_in():
    app = cdk.App()
    stack = CognitoStack(
        app,
        "TestCognitoStack",
        stage="test",
        env=cdk.Environment(account="123456789012", region="ap-south-1"),
    )
    template = Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::Cognito::UserPool",
        {
            "UsernameAttributes": ["email"],
            "Policies": {"PasswordPolicy": {"MinimumLength": 12}},
        },
    )

    template.has_resource_properties(
        "AWS::Cognito::UserPoolClient",
        {
            "GenerateSecret": False,
            "PreventUserExistenceErrors": "ENABLED",
        },
    )
