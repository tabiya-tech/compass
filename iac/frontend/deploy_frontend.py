import os
import mimetypes
import pulumi
import pulumi_gcp as gcp
from dataclasses import dataclass


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: str


def _get_resource_name(*, environment: str, resource: str, type=None):
    if not type:
        return f"compass-{environment}-{resource}"

    return f"compass-{environment}-{type}-{resource}"


def _enable_services(basic_config: ProjectBaseConfig, services_to_enable: list[str]) -> list[gcp.projects.Service]:
    enabled_services = []
    for service in services_to_enable:
        srv = gcp.projects.Service(
            _get_resource_name(environment=basic_config.environment, type="service", resource=service.split(".")[0]),
            project=basic_config.project,
            service=service,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
        )
        enabled_services.append(srv)
    return enabled_services


def _create_bucket(basic_config: ProjectBaseConfig, bucket_name: str,
                   dependencies: list[pulumi.Resource]) -> gcp.storage.Bucket:
    return gcp.storage.Bucket(
        _get_resource_name(environment=basic_config.environment, type="bucket", resource=bucket_name),
        project=basic_config.project,
        location=basic_config.location,
        uniform_bucket_level_access=True,
        website=gcp.storage.BucketWebsiteArgs(
            main_page_suffix="index.html",
            not_found_page="404.html",
        ),
        opts=pulumi.ResourceOptions(depends_on=dependencies))


def _upload_directory_to_bucket(basic_config: ProjectBaseConfig, bucket_name: pulumi.Output, source_dir: str,
                                target_dir: str,
                                do_not_cache: list[str] = [],
                                dependencies: list[pulumi.Resource] = []) -> None:
    print(f"Uploading files from folder {os.path.abspath(source_dir)}")
    for root, _, files in os.walk(source_dir):  # source_dir can be relative or absolute
        for file in files:
            absolute_file_path = os.path.abspath(os.path.join(root, file))
            file_path = os.path.relpath(absolute_file_path, source_dir)
            mime_type, _ = mimetypes.guess_type(absolute_file_path)
            target_name = os.path.join(target_dir, file_path)
            print(f"Uploading {file_path} as {target_name} with MIME type {mime_type}")

            gcp.storage.BucketObject(
                # Use a unique name for Pulumi resource while preserving the path
                _get_resource_name(environment=basic_config.environment, type="file",
                                   resource=target_name.replace("/", '_')),
                name=target_name,
                bucket=bucket_name,
                source=pulumi.FileAsset(absolute_file_path),
                content_type=mime_type,  # Ensure correct MIME type
                cache_control="no-store" if file_path in do_not_cache else None,  # Do not cache index.html
                opts=pulumi.ResourceOptions(depends_on=dependencies)
            )


def _make_bucket_public(basic_config: ProjectBaseConfig, bucket_name: pulumi.Output,
                        dependencies: list[pulumi.Resource]) -> None:
    gcp.storage.BucketIAMMember(
        _get_resource_name(environment=basic_config.environment, type="BucketIAMMember",
                           resource="allUsers-objectViewer"),
        bucket=bucket_name,
        role="roles/storage.objectViewer",
        member="allUsers",
        opts=pulumi.ResourceOptions(depends_on=dependencies)
    )


def deploy_frontend(project: str, location: str, environment: str):
    basic_config = ProjectBaseConfig(project=project, location=location, environment=environment)
    required_services = ["storage.googleapis.com"]
    services = _enable_services(basic_config, required_services)

    bucket = _create_bucket(basic_config, "frontend", services)

    frontend_out_dir = "../../frontend/out"
    _upload_directory_to_bucket(basic_config, bucket.name, frontend_out_dir, "",
                                ["index.html"], [bucket])

    new_ui_build_dir = "../../frontend-new/build"
    _upload_directory_to_bucket(basic_config, bucket.name, new_ui_build_dir, "new-ui",
                                ["index.html", "data/version.json"], [bucket])

    _make_bucket_public(basic_config, bucket.name, [bucket])

    pulumi.export('bucket_name', bucket.name)
    pulumi.export('bucket_url', pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com/index.html"))
    pulumi.export('new_ui_url',
                  pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com/new-ui/index.html"))
