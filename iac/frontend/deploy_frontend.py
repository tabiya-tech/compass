import os

import pulumi
import pulumi_gcp as gcp
import sys

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

from prepare_frontend import deployments_dir
from bucket_content import BucketContent
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

    _bucket_content = BucketContent(
        get_resource_name(resource="frontend-artifacts", resource_type="bucket-content"),
        bucket_name=bucket.name,
        # do not cache these files
        no_cache_paths=["index.html", "screening.html", "data/version.json", "data/env.js", "data/config/field.yaml"],
        target_dir="",  # On the target bucket, they will be saved at the root directory.
        source_dir_path=frontend_artifacts_dir,
        opts=pulumi.ResourceOptions(depends_on=bucket, provider=basic_config.provider))

    _make_bucket_public(basic_config, bucket.name, [bucket])

    # Upload the content from the artifacts folder to the bucket,
    pulumi.export('bucket_name', bucket.name)
    pulumi.export('bucket_url', pulumi.Output.concat("http://", bucket.name, ".storage.googleapis.com"))
