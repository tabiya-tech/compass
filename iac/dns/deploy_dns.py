from typing import Sequence

import pulumi
import pulumi_gcp as gcp
import pulumi_aws as aws

from lib.std_pulumi import get_resource_name, ProjectBaseConfig, get_project_base_config, hash_string


def _get_zone_name(domain_name: str) -> str:
    # The zone name is a user assigned name for this resource.
    # Must be unique within the project.
    # The name must be 1-63 characters long, must begin with a letter, end with a letter or digit, and only contain lowercase letters, digits or dashes.
    # See https://cloud.google.com/dns/docs/reference/rest/v1/managedZones#resource:-managedzone

    # Generate a unique and predictable name for the zone
    _domain_name = domain_name.replace(".", "-")
    _hashed_domain_name = hash_string(domain_name)
    _prefix = "zone-"
    # ensure that the zone name is less than 63 characters and the has is completely included
    return f"{_prefix}{_domain_name[:63 - len(_prefix) - len(_hashed_domain_name)]}-{_hashed_domain_name}"


def _create_dns(*, basic_config: ProjectBaseConfig, domain_name: pulumi.Output[str]) -> gcp.dns.ManagedZone:
    # create sub domain in gcp
    dns_zone = gcp.dns.ManagedZone(get_resource_name(resource="dns", resource_type="zone"),
                                   name=domain_name.apply(lambda s: _get_zone_name(s)),
                                   dns_name=domain_name.apply(lambda _domain_name: f"{_domain_name}."),
                                   project=basic_config.project,
                                   opts=pulumi.ResourceOptions(provider=basic_config.provider))

    return dns_zone


def _configure_ns_in_aws(
        sub_domain_name: pulumi.Output[str],
        ns_records: pulumi.Output[Sequence[str]]) -> aws.route53.Record:
    """
    This script is used to deploy the NS records for the subdomain in AWS Route53.
    """

    # add the NS records to the AWS main domain
    aws_zone = aws.route53.get_zone(name="tabiya.tech", private_zone=False)

    return aws.route53.Record(
        get_resource_name(resource="subdomain", resource_type="ns-record"),
        zone_id=aws_zone.zone_id,
        name=sub_domain_name,
        type=aws.route53.RecordType.NS,
        ttl=300,
        records=ns_records
    )


def deploy_dns(*,
               project: pulumi.Output[str],
               location: str,
               domain_name: pulumi.Output[str]):
    basic_config = get_project_base_config(project=project, location=location)

    # Create the DNS
    dns_zone = _create_dns(basic_config=basic_config,
                           domain_name=domain_name)
    # Configure the NS records in AWS Route53
    _configure_ns_in_aws(sub_domain_name=domain_name, ns_records=dns_zone.name_servers)

    pulumi.export("dns_zone_id", dns_zone.id)
    pulumi.export("dns_zone_name", dns_zone.name)
