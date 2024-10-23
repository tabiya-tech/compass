import os
import mimetypes
import pulumi
import pulumi_gcp as gcp

from lib.std_pulumi import get_resource_name, ProjectBaseConfig, enable_services, get_project_base_config


def _create_bucket(basic_config: ProjectBaseConfig, bucket_name: str,
                   dependencies: list[pulumi.Resource]) -> gcp.storage.Bucket:
    return gcp.storage.Bucket(
        get_resource_name(environment=basic_config.environment, resource_type="bucket", resource=bucket_name),
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
                get_resource_name(environment=basic_config.environment, resource_type="file",
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
        get_resource_name(environment=basic_config.environment, resource_type="BucketIAMMember",
                          resource="allUsers-objectViewer"),
        bucket=bucket_name,
        role="roles/storage.objectViewer",
        member="allUsers",
        opts=pulumi.ResourceOptions(depends_on=dependencies)
    )


def deploy_frontend(project: str, location: str, environment: str):
    basic_config = get_project_base_config(project=project, location=location, environment=environment)
    required_services = ["storage.googleapis.com"]
    services = enable_services(basic_config, required_services)

    bucket = _create_bucket(basic_config, "frontend", services)

    new_ui_build_dir = "../../frontend-new/build"
    _upload_directory_to_bucket(basic_config, bucket.name, new_ui_build_dir, "",
                                ["index.html", "data/version.json"], [bucket])

    frontend_out_dir = "../../frontend/out"
    _upload_directory_to_bucket(basic_config, bucket.name, frontend_out_dir, "poc-ui",
                                ["index.html"], [bucket])

    _make_bucket_public(basic_config, bucket.name, [bucket])

    pulumi.export('bucket_name', bucket.name)
    pulumi.export('bucket_url', pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com/index.html"))
    pulumi.export('new_ui_url',
                  pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com"))
