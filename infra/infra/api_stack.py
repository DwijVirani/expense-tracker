from pathlib import Path

import aws_cdk as cdk
from aws_cdk import aws_apigateway as apigateway
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_ecr_assets as ecr_assets
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_ssm as ssm
from constructs import Construct

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class ApiStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        stage: str,
        user_pool: cognito.UserPool,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.service_secret_param_name = f"/expense-tracker/{stage}/telegram-service-secret"

        mongo_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "MongoUri", f"expense-tracker/{stage}/mongo-uri"
        )

        service_secret = ssm.StringParameter.from_secure_string_parameter_attributes(
            self,
            "ServiceSecret",
            parameter_name=self.service_secret_param_name,
            version=1,
        )

        backend_image = ecr_assets.DockerImageAsset(
            self, "BackendImage", directory=str(REPO_ROOT / "backend")
        )

        fn = lambda_.DockerImageFunction(
            self,
            "BackendFn",
            code=lambda_.DockerImageCode.from_ecr(
                backend_image.repository, tag_or_digest=backend_image.image_tag
            ),
            memory_size=512,
            timeout=cdk.Duration.seconds(30),
            environment={
                "MONGO_URI": mongo_secret.secret_value.unsafe_unwrap(),
                "AWS_REGION_NAME": self.region,
                "COGNITO_USER_POOL_ID": user_pool.user_pool_id,
            },
        )

        # Grant Lambda access to SSM SecureString at runtime
        service_secret.grant_read(fn)
        fn.add_environment("TELEGRAM_SERVICE_SECRET_PARAM", self.service_secret_param_name)

        logs.LogGroup(
            self,
            "BackendLogs",
            log_group_name=f"/expense-tracker/{stage}/backend",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        api = apigateway.RestApi(
            self,
            "Api",
            rest_api_name=f"expense-tracker-{stage}",
            deploy_options=apigateway.StageOptions(stage_name=stage),
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Authorization", "Content-Type", "X-Service-Token"],
            ),
        )

        authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self, "CognitoAuth", cognito_user_pools=[user_pool]
        )

        lambda_integration = apigateway.LambdaIntegration(fn)

        # /health — open (no auth)
        api.root.add_resource("health").add_method("GET", lambda_integration)

        # /transactions, /settings — Cognito protected
        for resource_name in ("transactions", "settings"):
            resource = api.root.add_resource(resource_name)
            resource.add_method(
                "ANY",
                lambda_integration,
                authorizer=authorizer,
                authorization_type=apigateway.AuthorizationType.COGNITO,
            )
            resource.add_resource("{proxy+}").add_method(
                "ANY",
                lambda_integration,
                authorizer=authorizer,
                authorization_type=apigateway.AuthorizationType.COGNITO,
            )

        # /telegram — no Cognito, service-token checked in app
        telegram_resource = api.root.add_resource("telegram")
        telegram_resource.add_method("ANY", lambda_integration)
        telegram_resource.add_resource("{proxy+}").add_method("ANY", lambda_integration)

        self.api_url = api.url

        cdk.CfnOutput(
            self,
            "ApiUrl",
            value=api.url,
            export_name=f"expense-tracker-{stage}-ApiUrl",
        )
