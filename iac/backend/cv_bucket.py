import pulumi
import pulumi_gcp as gcp

from lib import ProjectBaseConfig, get_resource_name


def _create_cv_upload_bucket(*, basic_config: ProjectBaseConfig) -> gcp.storage.Bucket:
    """
    Creates a private GCS bucket for CV uploads.
    """
    return gcp.storage.Bucket(
        get_resource_name(resource="cv-uploads", resource_type="bucket"),
        project=basic_config.project,
        location=basic_config.location,
        uniform_bucket_level_access=True,
        public_access_prevention="enforced",
        opts=pulumi.ResourceOptions(provider=basic_config.provider, protect=True),
    )


def _grant_cloud_run_sa_access_to_cv_bucket(*,
                                            basic_config: ProjectBaseConfig,
                                            bucket: gcp.storage.Bucket,
                                            service_account: gcp.serviceaccount.Account) -> gcp.storage.BucketIAMMember:

    # The cloud run sa has access to admin objects in the cv bucket.
    return gcp.storage.BucketIAMMember(
        get_resource_name(resource="cv-uploads-cloud-run-sa", resource_type="bucket-object-admin-membership"),
        bucket=bucket.name,
        role="roles/storage.objectAdmin",
        member=service_account.email.apply(lambda email: f"serviceAccount:{email}"),
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=[bucket, service_account])
    )
