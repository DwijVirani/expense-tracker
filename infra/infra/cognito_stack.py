import aws_cdk as cdk
from aws_cdk import aws_cognito as cognito
from constructs import Construct


class CognitoStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, *, stage: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name=f"expense-tracker-{stage}",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=False),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=(
                cdk.RemovalPolicy.RETAIN if stage == "prod" else cdk.RemovalPolicy.DESTROY
            ),
        )

        self.user_pool_client = self.user_pool.add_client(
            "WebClient",
            user_pool_client_name=f"expense-tracker-web-{stage}",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(user_srp=True, user_password=False),
            access_token_validity=cdk.Duration.hours(1),
            refresh_token_validity=cdk.Duration.days(30),
            id_token_validity=cdk.Duration.hours(1),
            prevent_user_existence_errors=True,
            disable_o_auth=True,
        )

        cdk.CfnOutput(
            self,
            "UserPoolId",
            value=self.user_pool.user_pool_id,
            export_name=f"expense-tracker-{stage}-UserPoolId",
        )
        cdk.CfnOutput(
            self,
            "UserPoolClientId",
            value=self.user_pool_client.user_pool_client_id,
            export_name=f"expense-tracker-{stage}-UserPoolClientId",
        )
        cdk.CfnOutput(
            self,
            "Region",
            value=self.region,
            export_name=f"expense-tracker-{stage}-Region",
        )
