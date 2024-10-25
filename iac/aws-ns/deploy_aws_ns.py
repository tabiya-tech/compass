import pulumi
import pulumi_aws as aws

from lib.std_pulumi import get_resource_name


def _configure_ns_in_aws(sub_domain_name: pulumi.Output[str], ns_records: pulumi.Output[list[str]]):
    """
    This script is used to deploy the NS records for the subdomain in AWS Route53.
    """

    # add the NS records to the AWS main domain
    aws_zone = aws.route53.get_zone(name="tabiya.tech", private_zone=False)

    aws.route53.Record(
        get_resource_name(resource="subdomain", resource_type="ns-record"),
        zone_id=aws_zone.zone_id,
        name=sub_domain_name,
        type=aws.route53.RecordType.NS,
        ttl=300,
        records=ns_records
    )


def deploy_aws_ns(domain_name: pulumi.Output[str], ns_records: pulumi.Output[list[str]]):
    _configure_ns_in_aws(domain_name, ns_records)
