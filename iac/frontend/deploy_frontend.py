import os
import mimetypes
import tempfile
import brotli
import pulumi
import pulumi_gcp as gcp

from frontend.prepare_frontend import deployments_dir
from lib.std_pulumi import ProjectBaseConfig, get_project_base_config, get_resource_name


def _create_bucket(basic_config: ProjectBaseConfig, bucket_name: str) -> gcp.storage.Bucket:
    return gcp.storage.Bucket(
        get_resource_name(resource=bucket_name, resource_type="bucket"),
        project=basic_config.project,
        location=basic_config.location,
        uniform_bucket_level_access=True,
        website=gcp.storage.BucketWebsiteArgs(
            main_page_suffix="index.html",
            not_found_page="404.html",
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider))


def _upload_directory_to_bucket(basic_config: ProjectBaseConfig, bucket_name: pulumi.Output, source_dir: str,
                                target_dir: str,
                                do_not_cache: list[str],
                                dependencies: list[pulumi.Resource]) -> None:
    print(f"Uploading files from folder {os.path.abspath(source_dir)}")
    for root, _, files in os.walk(source_dir):  # source_dir can be relative or absolute
        for file in files:
            absolute_file_path = os.path.abspath(os.path.join(root, file))
            file_path = os.path.relpath(absolute_file_path, source_dir)
            mime_type, _ = mimetypes.guess_type(absolute_file_path)
            target_name = os.path.join(target_dir, file_path)
            # add svg
            use_brotli = mime_type is not None and mime_type.startswith(("text/", "application/javascript", "application/json", "image/svg+xml"))
            use_brotli = use_brotli or file_path.endswith((".html", ".ttf", ".woff", ".woff2", ".css", ".js", ".json", ".svg"))
            if use_brotli:
                # Compress with Brotli
                with tempfile.NamedTemporaryFile(delete=False, suffix=".br") as temp_file:
                    with open(absolute_file_path, 'rb') as f_in:
                        compressed_data = brotli.compress(f_in.read(), quality=11)  # Max compression
                        temp_file.write(compressed_data)
                    temp_file_path = temp_file.name
                source_asset = pulumi.FileAsset(temp_file_path)
                content_encoding = "br"
            else:
                # No compression
                source_asset = pulumi.FileAsset(absolute_file_path)
                content_encoding = None
            pulumi.info(f"Uploading {file_path} as {target_name} with MIME type {mime_type} and encoding {content_encoding}")
            gcp.storage.BucketObject(
                # Use a unique name for Pulumi resource while preserving the path.
                get_resource_name(resource=target_name.replace("/", '_'), resource_type="bucket-object"),
                name=target_name,
                bucket=bucket_name,
                source=source_asset,
                content_encoding=content_encoding,
                content_type=mime_type,  # Ensure correct MIME type
                cache_control="no-store" if file_path in do_not_cache else None,  # Do not cache index.html
                opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider)
            )


def _make_bucket_public(basic_config: ProjectBaseConfig, bucket_name: pulumi.Output,
                        dependencies: list[pulumi.Resource]) -> None:
    gcp.storage.BucketIAMMember(
        get_resource_name(resource="all-users-object-viewer", resource_type="bucket-membership"),
        bucket=bucket_name,
        role="roles/storage.objectViewer",
        member="allUsers",
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider)
    )


def deploy_frontend(*,
                    project: pulumi.Output[str],
                    location: str,
                    artifacts_dir: str
                    ):
    basic_config = get_project_base_config(project=project, location=location)

    bucket = _create_bucket(basic_config, "frontend")

    frontend_artifacts_dir = os.path.join(deployments_dir, artifacts_dir)
    _upload_directory_to_bucket(
        basic_config,
        bucket.name,
        frontend_artifacts_dir,
        "",
        ["index.html", "data/version.json", "data/env.js"],
        [bucket])

    _make_bucket_public(basic_config, bucket.name, [bucket])

    pulumi.export('bucket_name', bucket.name)
    pulumi.export('bucket_url', pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com"))
