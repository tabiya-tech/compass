import pulumi
import pulumi_aws as aws

from lib.std_pulumi import get_resource_name


def _configure_ns_in_aws(sub_domain_name: str, environment: str):
    common_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-common/{environment}")
    ns_records = common_stack_ref.get_output("ns-records")
    ns_records.apply(lambda records: print(f"Using NS records: {records}"))

    # add the NS records to the AWS main domain
    aws_zone = aws.route53.get_zone(name="tabiya.tech", private_zone=False)

    aws.route53.Record(get_resource_name(environment=environment, resource="subdomain-record"),
                       zone_id=aws_zone.zone_id,
                       name=sub_domain_name,
                       type=aws.route53.RecordType.NS,
                       ttl=300,
                       records=ns_records)


def deploy_aws_ns(domain_name: str, environment: str):
    _configure_ns_in_aws(domain_name, environment)
