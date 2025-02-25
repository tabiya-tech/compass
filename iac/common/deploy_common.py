from typing import Sequence

import pulumi
import pulumi_gcp as gcp
import pulumi_aws as aws

from urllib.parse import urlparse

from ssl_status import CertificateStatus
from lib.std_pulumi import get_resource_name, ProjectBaseConfig, get_project_base_config


def _setup_loadbalancer(*,
                        basic_config: ProjectBaseConfig,
                        dns_zone: gcp.dns.ManagedZone,
                        frontend_domain: pulumi.Output[str],
                        frontend_url: pulumi.Output[str],
                        frontend_bucket_name: pulumi.Output[str],
                        backend_url: pulumi.Output[str],
                        api_gateway_id: pulumi.Output[str]) -> pulumi.Resource:
    # Create a global IP address for the load balancer
    ipaddress = gcp.compute.GlobalAddress(
        get_resource_name(resource="lb", resource_type="global-ip-address"),
        project=basic_config.project,
        address_type="EXTERNAL",
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    # Add an A record with the GLB IP
    gcp.dns.RecordSet(get_resource_name(resource="lb", resource_type="record-set"),
                      project=basic_config.project,
                      name=dns_zone.dns_name,
                      managed_zone=dns_zone.name,
                      type="A",
                      ttl=300,
                      rrdatas=[ipaddress.address],
                      opts=pulumi.ResourceOptions(provider=basic_config.provider)
                      )

    # Create a backend service for the frontend bucket
    frontend_service_bucket = gcp.compute.BackendBucket(
        get_resource_name(resource="lb", resource_type="frontend-bucket"),
        project=basic_config.project,
        bucket_name=frontend_bucket_name,
        enable_cdn=True,
        cdn_policy=gcp.compute.BackendBucketCdnPolicyArgs(
            cache_mode="USE_ORIGIN_HEADERS",  # Use the cache headers from the origin
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    # create a region network endpoint group for connecting to the api gateway.
    endpoint_group = gcp.compute.RegionNetworkEndpointGroup(
        get_resource_name(resource="lb", resource_type="endpoint-group"),
        network_endpoint_type="SERVERLESS",
        project=basic_config.project,
        region=basic_config.location,
        serverless_deployment=gcp.compute.RegionNetworkEndpointGroupServerlessDeploymentArgs(
            platform="apigateway.googleapis.com",
            resource=api_gateway_id
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    # Create a backend service for the api gateway
    api_gateway_backend_service = gcp.compute.BackendService(
        get_resource_name(resource="lb", resource_type="backend-service"),
        project=basic_config.project,
        connection_draining_timeout_sec=10,
        protocol="HTTP",
        enable_cdn=False,  # the responses will not be cached.
        load_balancing_scheme="EXTERNAL_MANAGED",
        backends=[gcp.compute.BackendServiceBackendArgs(group=endpoint_group.id)],
        log_config=gcp.compute.BackendServiceLogConfigArgs(enable=True),
        opts=pulumi.ResourceOptions(depends_on=[endpoint_group], provider=basic_config.provider),
    )

    route_action = gcp.compute.URLMapPathMatcherPathRuleRouteActionArgs(
        url_rewrite=gcp.compute.URLMapPathMatcherPathRuleRouteActionUrlRewriteArgs(
            path_prefix_rewrite="/",
        )
    )

    port = "80"

    def _get_path_rule(_service_url: str):
        # Map <service_url>/* -> /* of the frontend bucket.
        _service_parsed_url = urlparse(_service_url)
        _service_parsed_url_path = _service_parsed_url.path.strip("/")
        _service_path_rule = "/" + _service_parsed_url_path + "/*" if _service_parsed_url_path else "/*"
        return _service_path_rule

    frontend_path_rule = frontend_url.apply(_get_path_rule)
    frontend_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=[frontend_path_rule],
                                                              service=frontend_service_bucket.id,
                                                              route_action=route_action)

    # Map <backend_url>/* -> /* of the backend service.
    backend_path_rule = backend_url.apply(_get_path_rule)
    backend_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=[backend_path_rule],
                                                             service=api_gateway_backend_service.id,
                                                             route_action=route_action)

    # Swagger UI will request /openapi.json, so we need to rewrite the path to the correct one.
    backend_openapi_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=["/openapi.json"],
                                                                     service=api_gateway_backend_service.id)

    https_url_map = gcp.compute.URLMap(
        get_resource_name(resource="lb", resource_type="https-urlmap"),
        project=basic_config.project,
        default_service=frontend_service_bucket.id,
        host_rules=[
            gcp.compute.URLMapHostRuleArgs(
                hosts=[frontend_domain],
                path_matcher="all-paths",
            ),
        ],
        path_matchers=[gcp.compute.URLMapPathMatcherArgs(
            name="all-paths",
            default_service=frontend_service_bucket.id,
            path_rules=[backend_rule, backend_openapi_rule, frontend_rule],
        )],
        opts=pulumi.ResourceOptions(depends_on=[frontend_service_bucket], provider=basic_config.provider),
    )

    ssl_certificate = gcp.compute.ManagedSslCertificate(
        resource_name=get_resource_name(resource="lb", resource_type="ssl-certificate"),
        project=basic_config.project,
        managed=gcp.compute.ManagedSslCertificateManagedArgs(
            domains=[
                frontend_domain.apply(lambda _frontend_domain: _frontend_domain + "."),
            ],
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    https_proxy = gcp.compute.TargetHttpsProxy(
        get_resource_name(resource="lb", resource_type="https-proxy"),
        project=basic_config.project,
        url_map=https_url_map.id,
        ssl_certificates=[ssl_certificate.id],
        opts=pulumi.ResourceOptions(depends_on=[https_url_map, ssl_certificate], provider=basic_config.provider),
    )

    http_url_map = gcp.compute.URLMap(
        get_resource_name(resource="lb", resource_type="http-urlmap-redirect"),
        default_url_redirect=gcp.compute.URLMapDefaultUrlRedirectArgs(
            https_redirect=True,
            strip_query=False),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    http_proxy = gcp.compute.TargetHttpProxy(
        get_resource_name(resource="lb", resource_type="http-proxy"),
        project=basic_config.project,
        url_map=http_url_map.id,
        opts=pulumi.ResourceOptions(depends_on=[http_url_map], provider=basic_config.provider),
    )

    # forwarding rule for HTTP
    gcp.compute.GlobalForwardingRule(
        get_resource_name(resource="lb", resource_type="http-global-fw-rule"),
        project=basic_config.project,
        target=http_proxy.id,
        ip_address=ipaddress.address,
        port_range=port,
        load_balancing_scheme="EXTERNAL_MANAGED",
        opts=pulumi.ResourceOptions(depends_on=[http_proxy], provider=basic_config.provider)
    )

    # forwarding rule for HTTPS
    gcp.compute.GlobalForwardingRule(
        get_resource_name(resource="lb", resource_type="https-global-fw-rule"),
        project=basic_config.project,
        target=https_proxy.id,
        ip_address=ipaddress.address,
        port_range="443",
        load_balancing_scheme="EXTERNAL_MANAGED",
        opts=pulumi.ResourceOptions(depends_on=[https_proxy], provider=basic_config.provider)
    )

    return CertificateStatus(
        get_resource_name(resource="dns", resource_type="certificate-status"),
        project=basic_config.project,
        # 30 minutes
        max_wait_secs=30 * 60,
        ssl_name=ssl_certificate.name,
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=[dns_zone])
    )


def _setup_auth_subdomain(*,
                          basic_config: ProjectBaseConfig,
                          dns_zone: gcp.dns.ManagedZone,
                          auth_site_url: pulumi.Output[str],
                          auth_site_id: pulumi.Output[str],
                          auth_domain: pulumi.Output[str],
                          frontend_domain: pulumi.Output[str],
                          dependencies: list[pulumi.Resource]):
    record_set = gcp.dns.RecordSet(
        get_resource_name(resource="auth", resource_type="record-set"),
        project=basic_config.project,
        # Add a dot at the end.
        name=auth_domain.apply(lambda s: s + "."),
        managed_zone=dns_zone.name,
        type="CNAME",
        ttl=300,
        rrdatas=[auth_site_url.apply(lambda s: s + ".")],
        opts=pulumi.ResourceOptions(provider=basic_config.provider))

    gcp.firebase.HostingCustomDomain(
        get_resource_name(resource="auth", resource_type="custom-domain"),
        args=gcp.firebase.HostingCustomDomainArgs(
            project=basic_config.project,
            site_id=auth_site_id,
            custom_domain=auth_domain,
            redirect_target=frontend_domain,
            wait_dns_verification=True
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=dependencies+[record_set]),
    )


def _create_dns(*, basic_config: ProjectBaseConfig, domain_name: pulumi.Output[str]) -> gcp.dns.ManagedZone:
    # create sub domain in gcp
    dns_zone = gcp.dns.ManagedZone(get_resource_name(resource="dns", resource_type="zone"),
                                   name="dns-zone",
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


def deploy_common(*,
                  project: pulumi.Output[str],
                  location: str,
                  domain_name: pulumi.Output[str],

                  frontend_domain: pulumi.Output[str],
                  frontend_url: pulumi.Output[str],
                  frontend_bucket_name: pulumi.Output[str],

                  backend_url: pulumi.Output[str],
                  api_gateway_id: pulumi.Output[str],

                  auth_site_url: pulumi.Output[str],
                  auth_site_id: pulumi.Output[str],
                  auth_domain: pulumi.Output[str]):
    basic_config = get_project_base_config(project=project, location=location)

    # Create the DNS
    dns_zone = _create_dns(basic_config=basic_config,
                           domain_name=domain_name)

    aws_record = _configure_ns_in_aws(sub_domain_name=frontend_domain, ns_records=dns_zone.name_servers)

    # Create the Global Load Balancer
    _setup_loadbalancer(
        basic_config=basic_config,
        dns_zone=dns_zone,
        frontend_domain=frontend_domain,
        frontend_url=frontend_url,
        frontend_bucket_name=frontend_bucket_name,
        backend_url=backend_url,
        api_gateway_id=api_gateway_id)

    # Create the Auth subdomain
    _setup_auth_subdomain(basic_config=basic_config,
                          dns_zone=dns_zone,
                          auth_site_id=auth_site_id,
                          auth_site_url=auth_site_url,
                          auth_domain=auth_domain,
                          frontend_domain=frontend_domain,
                          dependencies=[aws_record])
