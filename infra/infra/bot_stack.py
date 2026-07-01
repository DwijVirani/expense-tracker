import aws_cdk as cdk
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_iam as iam
from constructs import Construct


class BotStack(cdk.Stack):
    """Telegram bot: single t2.nano EC2 instance, long-polling Docker container.

    No inbound ports — the bot only makes outbound calls to api.telegram.org and
    the backend API Gateway URL. Access for debugging is via SSM Session Manager
    (no SSH key, no port 22).

    Secrets are pulled from SSM SecureString params at boot, via the instance's
    IAM role:
      - /expense-tracker/{stage}/telegram-service-secret  (already created by
        ApiStack's deploy prerequisites — shared secret with the backend)
      - /expense-tracker/{stage}/telegram-bot-token        (NEW — CloudFormation
        cannot create SecureString values, so create it manually before deploy:
          aws ssm put-parameter --name /expense-tracker/<stage>/telegram-bot-token \\
            --type SecureString --value <token from @BotFather>
        This stack only reads it; it does not create or manage its value.)
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        stage: str,
        api_url: str,
        service_secret_param_name: str,
        repo_owner: str,
        repo_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        bot_token_param_name = f"/expense-tracker/{stage}/telegram-bot-token"

        vpc = ec2.Vpc.from_lookup(self, "DefaultVpc", is_default=True)

        security_group = ec2.SecurityGroup(
            self,
            "BotSecurityGroup",
            vpc=vpc,
            description="Telegram bot EC2 - outbound only, no inbound rules",
            allow_all_outbound=True,
        )

        role = iam.Role(
            self,
            "BotInstanceRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSSMManagedInstanceCore"),
            ],
        )

        param_arns = [
            self.format_arn(
                service="ssm",
                resource="parameter",
                resource_name=name.lstrip("/"),
            )
            for name in (bot_token_param_name, service_secret_param_name)
        ]
        role.add_to_policy(
            iam.PolicyStatement(
                actions=["ssm:GetParameter"],
                resources=param_arns,
            )
        )
        role.add_to_policy(
            iam.PolicyStatement(
                actions=["kms:Decrypt"],
                resources=[f"arn:{self.partition}:kms:{self.region}:{self.account}:alias/aws/ssm"],
            )
        )

        repo_url = f"https://github.com/{repo_owner}/{repo_name}.git"

        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "set -euo pipefail",
            "dnf install -y docker git",
            "systemctl enable --now docker",
            f"TOKEN=$(aws ssm get-parameter --name '{bot_token_param_name}' --with-decryption "
            f"--region {self.region} --query Parameter.Value --output text)",
            f"SERVICE_SECRET=$(aws ssm get-parameter --name '{service_secret_param_name}' "
            f"--with-decryption --region {self.region} --query Parameter.Value --output text)",
            f"rm -rf /opt/expense-tracker && git clone --depth 1 {repo_url} /opt/expense-tracker",
            "cd /opt/expense-tracker/telegram-bot",
            "cat > .env <<EOF\n"
            "TELEGRAM_BOT_TOKEN=$TOKEN\n"
            "SERVICE_SECRET=$SERVICE_SECRET\n"
            f"BACKEND_URL={api_url}\n"
            "EOF",
            "docker build -t expense-tracker-bot .",
            "docker run -d --name expense-tracker-bot --env-file .env "
            "--restart unless-stopped expense-tracker-bot",
        )

        instance = ec2.Instance(
            self,
            "BotInstance",
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.NANO),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            security_group=security_group,
            role=role,
            user_data=user_data,
            associate_public_ip_address=True,
        )
        cdk.Tags.of(instance).add("Name", f"expense-tracker-bot-{stage}")

        cdk.CfnOutput(self, "BotInstanceId", value=instance.instance_id)
        cdk.CfnOutput(self, "BotPublicIp", value=instance.instance_public_ip)
