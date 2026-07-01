import aws_cdk as cdk
from aws_cdk import aws_amplify as amplify_l1
from aws_cdk import aws_amplify_alpha as amplify
from aws_cdk import aws_codebuild as codebuild
from aws_cdk import aws_cognito as cognito
from constructs import Construct


class AmplifyStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        stage: str,
        user_pool: cognito.UserPool,
        user_pool_client: cognito.UserPoolClient,
        api_url: str,
        repo_owner: str,
        repo_name: str,
        github_token_secret_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        amplify_app = amplify.App(
            self,
            "FrontendApp",
            app_name=f"expense-tracker-{stage}",
            platform=amplify.Platform.WEB_COMPUTE,
            source_code_provider=amplify.GitHubSourceCodeProvider(
                owner=repo_owner,
                repository=repo_name,
                oauth_token=cdk.SecretValue.secrets_manager(github_token_secret_name),
            ),
            environment_variables={
                "NEXT_PUBLIC_API_BASE_URL": api_url,
                "NEXT_PUBLIC_AWS_REGION": self.region,
                "NEXT_PUBLIC_COGNITO_USER_POOL_ID": user_pool.user_pool_id,
                "NEXT_PUBLIC_COGNITO_CLIENT_ID": user_pool_client.user_pool_client_id,
            },
            build_spec=codebuild.BuildSpec.from_object_to_yaml(
                {
                    "version": "1.0",
                    "applications": [
                        {
                            "appRoot": "frontend",
                            "frontend": {
                                "phases": {
                                    "preBuild": {
                                        "commands": [
                                            "npm install -g pnpm",
                                            "pnpm install --frozen-lockfile",
                                        ]
                                    },
                                    "build": {"commands": ["pnpm build"]},
                                },
                                "artifacts": {
                                    "baseDirectory": ".next",
                                    "files": ["**/*"],
                                },
                                "cache": {"paths": ["node_modules/**/*"]},
                            },
                        }
                    ],
                }
            ),
        )

        branch = amplify_app.add_branch("main" if stage == "prod" else "dev")
        cfn_branch = branch.node.default_child
        assert isinstance(cfn_branch, amplify_l1.CfnBranch)
        cfn_branch.framework = "Next.js - SSR"

        cdk.CfnOutput(
            self,
            "AmplifyAppId",
            value=amplify_app.app_id,
            export_name=f"expense-tracker-{stage}-AmplifyAppId",
        )
        cdk.CfnOutput(
            self,
            "AmplifyUrl",
            value=f"https://{branch.branch_name}.{amplify_app.default_domain}",
            export_name=f"expense-tracker-{stage}-AmplifyUrl",
        )
