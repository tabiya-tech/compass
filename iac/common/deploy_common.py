import sys

import pulumi
import pulumi_gcp as gcp

from urllib.parse import urlparse

from lib.std_pulumi import get_resource_name, ProjectBaseConfig, enable_services

_SERVICES = [
    # GCP Cloud DNS
    "dns.googleapis.com",
]


def _setup_loadbalancer(*, basic_config: ProjectBaseConfig,
                        dns_zone: gcp.dns.ManagedZone,
                        frontend_domain: str,
                        frontend_url: str,
                        frontend_bucket_name: pulumi.Output[str]):
    # Create a global IP address for the load balancer
    ipaddress = gcp.compute.GlobalAddress(
        get_resource_name(environment=basic_config.environment, resource="lb-ipaddress"),
        project=basic_config.project,
        address_type="EXTERNAL",
    )

    # Add an A record with the GLB IP
    gcp.dns.RecordSet(get_resource_name(environment=basic_config.environment, resource="a-record"),
                      project=basic_config.project,
                      name=dns_zone.dns_name,
                      managed_zone=dns_zone.name,
                      type="A",
                      ttl=300,
                      rrdatas=[ipaddress.address])
    # Create a backend service for the frontend bucket
    backend_service_bucket = gcp.compute.BackendBucket(
        get_resource_name(environment=basic_config.environment, resource="lb-backendservice"),
        project=basic_config.project,
        bucket_name=frontend_bucket_name,
        enable_cdn=True,
        cdn_policy=gcp.compute.BackendBucketCdnPolicyArgs(
            cache_mode="USE_ORIGIN_HEADERS",  # Use the cache headers from the origin
        ),
    )

    # Map <frontend_url>/* -> /* of the frontend bucket
    parsed_url = urlparse(frontend_url)

    port = f"{parsed_url.port}" if parsed_url.port else "80"
    frontend_path_rule = parsed_url.path.strip("/") + "/*"

    http_url_map = gcp.compute.URLMap(
        get_resource_name(environment=basic_config.environment, resource="http-urlmap"),
        project=basic_config.project,
        default_service=backend_service_bucket.id,
        host_rules=[
            gcp.compute.URLMapHostRuleArgs(
                hosts=[frontend_domain],
                path_matcher="all-paths",
            )
        ],
        path_matchers=[gcp.compute.URLMapPathMatcherArgs(
            name="all-paths",
            default_service=backend_service_bucket.id,
            path_rules=[gcp.compute.URLMapPathMatcherPathRuleArgs(paths=[frontend_path_rule],
                                                                  service=backend_service_bucket.id)],
        )],
        opts=pulumi.ResourceOptions(depends_on=[backend_service_bucket]),
    )

    http_proxy = gcp.compute.TargetHttpProxy(
        get_resource_name(environment=basic_config.environment, resource="http-proxy"),
        project=basic_config.project,
        url_map=http_url_map.id,
        opts=pulumi.ResourceOptions(depends_on=[http_url_map]),
    )

    gcp.compute.GlobalForwardingRule(
        get_resource_name(environment=basic_config.environment, resource="http-global-fw-rule"),
        project=basic_config.project,
        target=http_proxy.id,
        ip_address=ipaddress.address,
        port_range=port,
        load_balancing_scheme="EXTERNAL_MANAGED",
        opts=pulumi.ResourceOptions(depends_on=[http_proxy]),
    )


def _create_dns(*, basic_config: ProjectBaseConfig, domain_name: str,
                dependencies: list[pulumi.Resource]) -> gcp.dns.ManagedZone:
    # create sub domain in gcp
    dns_zone = gcp.dns.ManagedZone(get_resource_name(environment=basic_config.environment, resource="dns-zone"),
                                   name=get_resource_name(environment=basic_config.environment, resource="dns-zone"),
                                   dns_name=domain_name + ".",
                                   project=basic_config.project,
                                   opts=pulumi.ResourceOptions(depends_on=dependencies))

    return dns_zone


def deploy_common(project: str,
                  location: str,
                  environment: str,
                  domain_name: str,
                  frontend_domain: str,
                  frontend_url: str):
    basic_config = ProjectBaseConfig(project=project, location=location, environment=environment)
    # Get the frontend bucket name
    frontend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-frontend/{basic_config.environment}")
    bucket_name = frontend_stack_ref.get_output("bucket_name")
    bucket_name.apply(lambda name: print(f"Using frontend bucket name: {name}"))

    # Enable the necessary services
    services = enable_services(basic_config=basic_config,
                               service_names=_SERVICES)

    # Create the DNS
    dns_zone = _create_dns(basic_config=basic_config,
                           domain_name=domain_name,
                           dependencies=services)
    pulumi.export("ns-records", dns_zone.name_servers)

    # Create the Global Load Balancer
    _setup_loadbalancer(basic_config=basic_config,
                        dns_zone=dns_zone,
                        frontend_domain=frontend_domain,
                        frontend_url=frontend_url,
                        frontend_bucket_name=bucket_name)
