import os
import mimetypes
import pulumi
import pulumi_gcp as gcp

def _enable_services(project: str, services_to_enable: list[str]) -> list[gcp.projects.Service]:
    enabled_services = []
    for service in services_to_enable:
        srv = gcp.projects.Service(f"enabled_services_{service.split('.')[0]}",
                                   project=project,
                                   service=service)
        enabled_services.append(srv)
    return enabled_services

def _create_bucket(project: str, bucket_name: str, location: str, dependencies: list[pulumi.Resource]) -> gcp.storage.Bucket:
    return gcp.storage.Bucket(bucket_name,
                              project=project,
                              location=location,
                              uniform_bucket_level_access=True,
                              website=gcp.storage.BucketWebsiteArgs(
                                  main_page_suffix="index.html",
                                  not_found_page="404.html",
                              ),
                              opts=pulumi.ResourceOptions(depends_on=dependencies))

def _upload_directory_to_bucket(bucket_name: str, source_dir: str, dependencies: list[pulumi.Resource]) -> None:
    for root, _, files in os.walk(source_dir):
        for file in files:
            file_path = os.path.join(root, file)
            relative_path = os.path.relpath(file_path, source_dir)
            mime_type, _ = mimetypes.guess_type(file_path)
            print(f"Uploading {file_path} as {relative_path} with MIME type {mime_type}")
            gcp.storage.BucketObject(
                f"{relative_path.replace('/', '_')}",  # Use a unique name for Pulumi resource while preserving the path
                name=relative_path,  # Set the actual object name in the bucket to match the relative path
                bucket=bucket_name,
                source=pulumi.FileAsset(file_path),
                content_type=mime_type,  # Ensure correct MIME type
                opts=pulumi.ResourceOptions(depends_on=dependencies)
            )

def _make_bucket_public(bucket_name: str, dependencies: list[pulumi.Resource]) -> None:
    gcp.storage.BucketIAMMember("allUsers-objectViewer",
                                bucket=bucket_name,
                                role="roles/storage.objectViewer",
                                member="allUsers",
                                opts=pulumi.ResourceOptions(depends_on=dependencies))

def deploy_frontend(project: str, location: str):
    config = pulumi.Config()
    bucket_name = config.require("frontend_bucket_name")
    pulumi.info(f'Using frontend_bucket_name: {bucket_name}')

    required_services = ["storage.googleapis.com"]
    services = _enable_services(project, required_services)

    bucket = _create_bucket(project, bucket_name, location, services)

    frontend_out_dir = "../../frontend/out"
    _upload_directory_to_bucket(bucket.name, frontend_out_dir, [bucket])

    _make_bucket_public(bucket.name, [bucket])

    pulumi.export('bucket_name', bucket.name)
    pulumi.export('bucket_url', pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com/index.html"))
