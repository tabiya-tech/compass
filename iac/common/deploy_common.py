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
        frontend_bucket_name: pulumi.Output[str],
        backend_url: str,
        api_gateway_id: pulumi.Output[str]):
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
            get_resource_name(environment=basic_config.environment, resource="lb-backend-bucket-for-frontend"),
            project=basic_config.project,
            bucket_name=frontend_bucket_name,
            enable_cdn=True,
            cdn_policy=gcp.compute.BackendBucketCdnPolicyArgs(
                    cache_mode="USE_ORIGIN_HEADERS",  # Use the cache headers from the origin
            ),
    )

    # create a region network endpoint group for connecting to the api gateway
    endpoint_group = gcp.compute.RegionNetworkEndpointGroup(
            get_resource_name(environment=basic_config.environment, resource="lb-endpoint-group"),
            network_endpoint_type="SERVERLESS",
            project=basic_config.project,
            region=basic_config.location,
            serverless_deployment=gcp.compute.RegionNetworkEndpointGroupServerlessDeploymentArgs(
                    platform="apigateway.googleapis.com",
                    resource=api_gateway_id
            )
    )

    # Create a backend service for the api gateway
    api_gateway_backend_service = gcp.compute.BackendService(
            get_resource_name(environment=basic_config.environment, resource="lb-backend-service-for-api-gateway"),
            project=basic_config.project,
            connection_draining_timeout_sec=10,
            protocol="HTTP",
            enable_cdn=False,  # the responses will not be cached.
            load_balancing_scheme="EXTERNAL_MANAGED",
            backends=[gcp.compute.BackendServiceBackendArgs(group=endpoint_group.id)],
            log_config=gcp.compute.BackendServiceLogConfigArgs(enable=True),
            opts=pulumi.ResourceOptions(depends_on=[endpoint_group]),
    )

    route_action = gcp.compute.URLMapPathMatcherPathRuleRouteActionArgs(
            url_rewrite=gcp.compute.URLMapPathMatcherPathRuleRouteActionUrlRewriteArgs(
                    path_prefix_rewrite="/",
            )
    )
    # Map <frontend_url>/* -> /* of the frontend bucket
    frontend_parsed_url = urlparse(frontend_url)

    port = f"{frontend_parsed_url.port}" if frontend_parsed_url.port else "80"

    frontend_parsed_url_path = frontend_parsed_url.path.strip("/")
    frontend_path_rule = "/" + frontend_parsed_url_path + "/*" if frontend_parsed_url_path else "/*"

    frontend_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=[frontend_path_rule],
                                                              service=backend_service_bucket.id,
                                                              route_action=route_action)

    # Map <backend_url>/* -> /* of the backend service
    backend_parsed_url = urlparse(backend_url)
    backend_parsed_url_path = backend_parsed_url.path.strip("/")
    backend_path_rule = "/" + backend_parsed_url_path + "/*" if backend_parsed_url_path else "/*"
    backend_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=[backend_path_rule,
                                                                    "/openapi.json"  # Swagger UI will request this file
                                                                    ],
                                                             service=api_gateway_backend_service.id,
                                                             route_action=route_action)

    # Swagger UI will request /openapi.json, so we need to rewrite the path to the correct one
    backend_openapi_rule = gcp.compute.URLMapPathMatcherPathRuleArgs(paths=["/openapi.json"],
                                                                     service=api_gateway_backend_service.id,
                                                                     )

    if backend_parsed_url_path == frontend_parsed_url_path:
        pulumi.error("The frontend and backend paths cannot be the same")
        sys.exit(1)

    https_url_map = gcp.compute.URLMap(
            get_resource_name(environment=basic_config.environment, resource="https-urlmap"),
            project=basic_config.project,
            default_service=backend_service_bucket.id,
            host_rules=[
                    gcp.compute.URLMapHostRuleArgs(
                            hosts=[frontend_domain],
                            path_matcher="all-paths",
                    ),
            ],
            path_matchers=[gcp.compute.URLMapPathMatcherArgs(
                    name="all-paths",
                    default_service=backend_service_bucket.id,
                    path_rules=[backend_rule, backend_openapi_rule, frontend_rule],
            )],
            opts=pulumi.ResourceOptions(depends_on=[backend_service_bucket]),
    )

    ssl_certificate = gcp.compute.ManagedSslCertificate(
            resource_name=get_resource_name(environment=basic_config.environment, resource="ssl-certificate"),
            project=basic_config.project,
            managed=gcp.compute.ManagedSslCertificateManagedArgs(
                    domains=[frontend_domain + "."],
            ))

    https_proxy = gcp.compute.TargetHttpsProxy(
            get_resource_name(environment=basic_config.environment, resource="https-proxy"),
            project=basic_config.project,
            url_map=https_url_map.id,
            ssl_certificates=[ssl_certificate.id],
            opts=pulumi.ResourceOptions(depends_on=[https_url_map, ssl_certificate]),
    )

    http_url_map = gcp.compute.URLMap(
        get_resource_name(environment=basic_config.environment, resource="http-urlmap-redirect"),
        default_url_redirect=gcp.compute.URLMapDefaultUrlRedirectArgs(
                https_redirect=True,
                strip_query=False))

    http_proxy = gcp.compute.TargetHttpProxy(
        get_resource_name(environment=basic_config.environment, resource="http-proxy"),
        project=basic_config.project,
        url_map=http_url_map.id,
        opts=pulumi.ResourceOptions(depends_on=[http_url_map]))

    # forwarding rule for HTTP
    gcp.compute.GlobalForwardingRule(
            get_resource_name(environment=basic_config.environment, resource="http-global-fw-rule"),
            project=basic_config.project,
            target=http_proxy.id,
            ip_address=ipaddress.address,
            port_range=port,
            load_balancing_scheme="EXTERNAL_MANAGED",
            opts=pulumi.ResourceOptions(depends_on=[http_proxy]))

    # forwarding rule for HTTPS
    gcp.compute.GlobalForwardingRule(
            get_resource_name(environment=basic_config.environment, resource="https-global-fw-rule"),
            project=basic_config.project,
            target=https_proxy.id,
            ip_address=ipaddress.address,
            port_range=443,
            load_balancing_scheme="EXTERNAL_MANAGED",
            opts=pulumi.ResourceOptions(depends_on=[https_proxy]))


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
        frontend_url: str,
        backend_url: str):
    basic_config = ProjectBaseConfig(project=project, location=location, environment=environment)
    # Get the frontend bucket name
    frontend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-frontend/{basic_config.environment}")
    frontend_bucket_name = frontend_stack_ref.get_output("bucket_name")
    frontend_bucket_name.apply(lambda name: print(f"Using frontend bucket name: {name}"))

    # Get the backend api gateway id
    backend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-backend/{basic_config.environment}")
    api_gateway_id = backend_stack_ref.get_output("apigateway_id")
    api_gateway_id.apply(lambda id: print(f"Using API gateway id: {id}"))

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
                        frontend_bucket_name=frontend_bucket_name,
                        backend_url=backend_url,
                        api_gateway_id=api_gateway_id)
