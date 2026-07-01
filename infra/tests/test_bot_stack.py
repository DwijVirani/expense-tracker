import aws_cdk as cdk
from aws_cdk.assertions import Match, Template

from infra.bot_stack import BotStack

ACCOUNT = "123456789012"
REGION = "us-east-1"

# BotStack looks up the account's default VPC at synth time (ec2.Vpc.from_lookup).
# Pre-seed the lookup result in app context so the test doesn't call out to AWS.
# Key format follows the documented CDK testing pattern for context providers.
VPC_CONTEXT_KEY = (
    f"vpc-provider:account={ACCOUNT}:filter.isDefault=true:"
    f"region={REGION}:returnAsymmetricSubnets=true"
)
VPC_CONTEXT_VALUE = {
    "vpcId": "vpc-12345",
    "vpcCidrBlock": "10.0.0.0/16",
    "availabilityZones": ["us-east-1a", "us-east-1b"],
    "subnetGroups": [
        {
            "name": "Public",
            "type": "Public",
            "subnets": [
                {
                    "subnetId": "subnet-pub-1",
                    "cidr": "10.0.0.0/24",
                    "availabilityZone": "us-east-1a",
                    "routeTableId": "rtb-pub-1",
                },
                {
                    "subnetId": "subnet-pub-2",
                    "cidr": "10.0.1.0/24",
                    "availabilityZone": "us-east-1b",
                    "routeTableId": "rtb-pub-2",
                },
            ],
        },
        {
            "name": "Private",
            "type": "Private",
            "subnets": [
                {
                    "subnetId": "subnet-priv-1",
                    "cidr": "10.0.2.0/24",
                    "availabilityZone": "us-east-1a",
                    "routeTableId": "rtb-priv-1",
                },
                {
                    "subnetId": "subnet-priv-2",
                    "cidr": "10.0.3.0/24",
                    "availabilityZone": "us-east-1b",
                    "routeTableId": "rtb-priv-2",
                },
            ],
        },
    ],
}


def _synth_bot_stack() -> Template:
    app = cdk.App(context={VPC_CONTEXT_KEY: VPC_CONTEXT_VALUE})
    stack = BotStack(
        app,
        "TestBotStack",
        stage="test",
        env=cdk.Environment(account=ACCOUNT, region=REGION),
        api_url="https://example.execute-api.us-east-1.amazonaws.com/test/",
        service_secret_param_name="/expense-tracker/test/telegram-service-secret",
        repo_owner="someuser",
        repo_name="expense-tracker",
    )
    return Template.from_stack(stack)


def test_bot_stack_creates_nano_instance_with_no_inbound_rules():
    template = _synth_bot_stack()

    template.has_resource_properties("AWS::EC2::Instance", {"InstanceType": "t2.nano"})

    # No ingress rules — outbound-only security group.
    template.has_resource_properties(
        "AWS::EC2::SecurityGroup",
        {"SecurityGroupIngress": Match.absent()},
    )


def test_bot_stack_grants_ssm_session_manager_and_param_read():
    template = _synth_bot_stack()

    template.has_resource_properties(
        "AWS::IAM::Role",
        {
            "ManagedPolicyArns": Match.array_with(
                [
                    Match.object_like(
                        {"Fn::Join": Match.array_with([Match.array_with([Match.string_like_regexp("AmazonSSMManagedInstanceCore")])])}
                    )
                ]
            )
        },
    )

    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": {
                "Statement": Match.array_with(
                    [Match.object_like({"Action": "ssm:GetParameter"})]
                )
            }
        },
    )
