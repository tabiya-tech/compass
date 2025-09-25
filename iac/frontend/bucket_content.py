import hashlib
import mimetypes
import os
import random
import tempfile
from dataclasses import dataclass, asdict
from textwrap import dedent
from typing import Union, Any, Dict

import brotli
import google
import pulumi
import sys
from google.cloud import storage
from pulumi.dynamic import Resource, ResourceProvider, CreateResult, CheckResult, CheckFailure, DiffResult, UpdateResult

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

from lib.std_pulumi import int_to_base36


@dataclass
class Props:
    """
    Typed Properties for BucketContent
    """

    bucket_name: str
    """
    GCP Storage Bucket name to upload the files. (eg: my-cool-bucket-382jda)
    """

    no_cache_paths: list[str]
    """
    Files to ignore when caching. (eg: ["version.json", "index.html"])
    """

    target_dir: str
    """
    The target directory path. (Target meaning at the target gcp storage bucket)
    """

    file_hashes: Dict[str, str]
    """
    The file hashes containing a map where 
        - key is the relative path on the target bucket (eg: "index.html") 
        - the value is the MD5 checksum.
         
        (Used to detect which files that have been changed so that we can know which files to upload and delete)
    """


def _get_credentials() -> Any:
    #    google_credentials = getenv("GOOGLE_CREDENTIALS", True)
    #    _credentials, _ = google.auth.load_credentials_from_file(google_credentials, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    _credentials, _ = google.auth.default()
    return _credentials


def _get_gcp_bucket(bucket_name: str) -> storage.Bucket:
    credentials = _get_credentials()

    if credentials is None:
        raise ValueError("Failed to get the credentials.")

    client = storage.Client(credentials=credentials)

    return client.bucket(bucket_name)


def _parse_props(props: dict[str, Any]) -> Props:
    """
    Parse the props into a typed Props class.

    :param props: Dictionary of props.
    :return: Typed Props class instance.
    """

    return Props(
        bucket_name=props.get("bucket_name"),
        no_cache_paths=props.get("no_cache_paths"),
        target_dir=props.get("target_dir", ""),
        file_hashes=props.get("file_hashes", {})
    )


def _compute_file_changes(old_hashes: Dict[str, str],
                          new_hashes: Dict[str, str]) -> tuple[set[str], set[str], set[str]]:
    """
    Compute file changes by comparing new and old hashes.

    :returns tuple: changed_files list of changed files. in a format of (new, deleted, changed)
    """
    old_files = set(old_hashes.keys())
    new_files = set(new_hashes.keys())

    # New files: exist in new_hashes but not in old_hashes
    new_only = new_files - old_files

    # Deleted files: exist in old_hashes but not in new_hashes
    deleted_only = old_files - new_files

    # Changed files: exist in both but with different hashes
    common_files = old_files & new_files
    _changed_files = set()
    for file_path in sorted(common_files):
        if old_hashes[file_path] != new_hashes[file_path]:
            _changed_files.add(file_path)

    return new_only, deleted_only, _changed_files


def _will_update(changes: tuple[set[str], set[str], set[str]]):
    return len(changes[0]) > 0 or len(changes[1]) > 0 or len(changes[2]) > 0


def _upload_file(*,
                 bucket: storage.Bucket,
                 source_file_path: str,
                 bucket_file_path: str,
                 do_not_cache: bool = False) -> bool:
    """
    Upload a single file to the bucket.

    It will compress the file if it is a text file.
    It will set the cache-control header to no-store if you do_not_cache is True.

    Return true if the file is uploaded successfully, false otherwise.
    """

    temp_file_path: str | None = None
    try:
        # 1. Determine if we are going to compress or not.
        mime_type, _ = mimetypes.guess_type(source_file_path)
        use_brotli = mime_type is not None and mime_type.startswith(
            ("text/", "application/javascript", "application/json", "image/svg+xml"))
        use_brotli = use_brotli or source_file_path.endswith(
            (".html", ".ttf", ".woff", ".woff2", ".css", ".js", ".json", ".svg"))
        
        if use_brotli:
            # Compress with Brotli
            with tempfile.NamedTemporaryFile(delete=False, suffix=".br") as temp_file:
                with open(source_file_path, 'rb') as f_in:
                    compressed_data = brotli.compress(f_in.read(), quality=11)  # Max compression
                    temp_file.write(compressed_data)
                temp_file_path = temp_file.name
                target_file_path = temp_file_path

            content_encoding = "br"
        else:
            # No compression
            target_file_path = source_file_path
            content_encoding = None

        # 2. Determine where we are going to upload the file to.
        blob = bucket.blob(bucket_file_path)

        # 3. set the cache control header (If the caller wants to cache the file)
        if do_not_cache:
            blob.cache_control = "no-store"

        # 4. Determine the encoding of the asset.
        if content_encoding:
            blob.content_encoding = content_encoding

        # 5. Upload the file.
        blob.upload_from_filename(target_file_path, mime_type)  # Ensure correct MIME type

        pulumi.info(
            f"Uploaded {bucket_file_path} with encoding: {content_encoding} and cache-control: {blob.cache_control} with mime type: {mime_type}")
        return True
    except Exception as e:
        pulumi.error(f"Error uploading {source_file_path} to {bucket_file_path}: {e}")
        return False
    finally:
        # Clean up temporary compressed file if created
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as cleanup_error:
                pulumi.warn(f"Failed to cleanup temp file {temp_file_path}: {cleanup_error}")


def _get_id() -> str:
    """
    Generates a random ID for the Bucket content Resource
    """

    random_int = random.Random().randrange(  # nosec B311: non-crypto randomness is acceptable for resource naming
        2 ** 32 - 1,  # 32bit integer
        2 ** 64 - 1)  # 64bit integer
    random_id = int_to_base36(random_int)
    return f"bucket-content-{random_id}"


def _calculate_file_checksum(file_path: str) -> str:
    """
    Calculate MD5 checksum for a file
    For now we are calculating the md5 of the file.
    """

    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        pulumi.error(f"Error calculating checksum for {file_path}: {e}")
        return ""


def _get_directory_files_info(directory_path: str) -> Dict[str, str]:
    """
    Get the directory files info.


    :param directory_path: Absolute path to the directory.
    :return: dict[str, str] where the key is the relative path and the value is the checksum.
    """

    file_hashes = {}

    if not os.path.exists(directory_path):
        pulumi.warn(f"Source folder path does not exist: {directory_path}")
        return file_hashes

    for root, _, files in os.walk(directory_path):
        for file in files:
            absolute_file_path: str = os.path.abspath(os.path.join(root, file).__str__())
            relative_path = os.path.relpath(absolute_file_path, directory_path)
            checksum = _calculate_file_checksum(absolute_file_path)
            if checksum:
                file_hashes[relative_path] = checksum

    return file_hashes


def _concat_object_path(prefix: str, object_path: str) -> str:
    """
    Safely concatenate a GCS object prefix (folder) and an object path.
    Does not assume trailing slash on the prefix.
    """
    if not prefix:
        return object_path
    if prefix.endswith('/'):
        return prefix + object_path
    return prefix + '/' + object_path


def _list_existing_object_paths(bucket: storage.Bucket, target_dir: str) -> set[str]:
    """
    List existing object paths in the bucket under the given target_dir, returning paths relative to target_dir.
    """
    existing_paths: set[str] = set()
    prefix = target_dir if target_dir else ""
    # list_blobs accepts either a bucket name or a bucket; use bucket for consistency
    try:
        for blob in bucket.list_blobs(prefix=prefix):
            name: str = blob.name
            if target_dir and name.startswith(prefix):
                existing_paths.add(name[len(prefix):])
            else:
                existing_paths.add(name)
    except Exception as e:
        pulumi.warn(f"Failed to list existing objects with prefix '{prefix}': {e}")
    return existing_paths


class BucketContentProvider(ResourceProvider):
    def __init__(self, source_dir_path: str):
        super().__init__()
        self.source_dir_path = source_dir_path

    def check(self, _olds: Dict[str, Any], news: Dict[str, Any]) -> CheckResult:
        pulumi.info("Verifying Bucket Content configurations")

        # Validate the new configurations.
        failures = []
        if not news.get("bucket_name"):
            failures.append(CheckFailure("bucket_name", "bucket_name is missing in props"))

        return CheckResult(news, failures)

    def delete(self, _id: str, _props: Any):
        pulumi.info(f"Deleting the BucketContent with id:{_id}")

        props = _parse_props(_props)
        if not props.file_hashes:
            pulumi.warn(f"No files found to delete in gs://{props.bucket_name}")
            return

        bucket = _get_gcp_bucket(props.bucket_name)
        for object_path in props.file_hashes.keys():
            blob = bucket.get_blob(_concat_object_path(props.target_dir, object_path))

            if not blob:
                pulumi.warn(f"File not found, skipping delete: {object_path}")
                continue

            pulumi.debug(f"Deleting file: {object_path}")
            blob.delete()
            pulumi.debug(f"Deleted: {object_path}!")

        pulumi.info("All files deleted successfully")

    def create(self, props: dict[str, Any]) -> CreateResult:
        # Validate the props
        props = _parse_props(props)

        # Construct the bucket (instance and client)
        bucket = _get_gcp_bucket(props.bucket_name)

        # if no files found, log a warning.
        if not props.file_hashes:
            pulumi.warn(f"No files found in directory: {self.source_dir_path}")

        pulumi.info(f"Uploading {len(props.file_hashes)} files to gs://{props.bucket_name}")

        success_count = 0
        for file in props.file_hashes.keys():
            file_path = os.path.join(self.source_dir_path, file)

            # Add the prefix because one bucket can have multiple folders. And bucket content can be linked to a folder.
            bucket_file_path = _concat_object_path(props.target_dir, file)

            file_uploaded = _upload_file(bucket=bucket,
                                         source_file_path=file_path,
                                         bucket_file_path=bucket_file_path,
                                         do_not_cache=(file in props.no_cache_paths))
            if file_uploaded:
                success_count += 1
                pulumi.info(f"Uploaded: {bucket_file_path}")
            else:
                pulumi.error(f"Failed to upload: {bucket_file_path}")

        if success_count != len(props.file_hashes):
            error_message = f"Failed to upload {len(props.file_hashes) - success_count} files."
            pulumi.error(error_message)
            raise Exception(error_message)  # NOSONAR

        pulumi.info(f"Successfully uploaded {success_count}/{len(props.file_hashes)} files")

        return CreateResult(id_=_get_id(), outs=asdict(props))

    def update(self, _id: str, _olds: Dict[str, Any], _news: Dict[str, Any]) -> UpdateResult:
        pulumi.info("Updating Bucket content")

        # Validate the props
        _old_props = _parse_props(_olds)
        _new_props = _parse_props(_news)
        new_files, deleted_files, changed_files = _compute_file_changes(_old_props.file_hashes, _new_props.file_hashes)

        # 1. Delete the deleted files and changed files
        bucket = _get_gcp_bucket(_new_props.bucket_name)
        files_to_delete = deleted_files.union(changed_files)

        for file in files_to_delete:
            try:
                bucket.delete_blob(_concat_object_path(_new_props.target_dir, file))
            except Exception as e:
                pulumi.error(f"Failed to delete {file}: {e}")

        # 2. Upload new files, changed files, and any missing files (in case previous deletions removed them)
        upload_success_count = 0
        existing_paths = _list_existing_object_paths(bucket, _new_props.target_dir)
        expected_paths = set(_new_props.file_hashes.keys())
        missing_files = expected_paths - existing_paths
        files_to_upload = new_files.union(changed_files).union(missing_files)
        for file in files_to_upload:
            file_path = os.path.join(self.source_dir_path, file)
            bucket_file_path = _concat_object_path(_new_props.target_dir, file)

            is_file_uploaded = _upload_file(bucket=bucket,
                                            source_file_path=file_path,
                                            bucket_file_path=bucket_file_path,
                                            do_not_cache=(file in _new_props.no_cache_paths))
            if is_file_uploaded:
                upload_success_count += 1
                pulumi.info(f"Uploaded: {bucket_file_path}")
            else:
                pulumi.error(f"Failed to upload: {bucket_file_path}")

        if upload_success_count != len(files_to_upload):
            error_message = f"Failed to upload {len(files_to_upload) - upload_success_count} files."
            pulumi.error(error_message)
            raise Exception(error_message)  # NOSONAR

        return UpdateResult(asdict(_new_props))

    def diff(
            self,
            _id: str,
            _olds: Dict[str, Any],
            _news: Dict[str, Any],
    ) -> DiffResult:
        pulumi.info("Diffing Bucket content")

        # Construct the old and new props into a typed class.
        new_props = _parse_props(_news)
        old_props = _parse_props(_olds)

        # If the bucket has changed, delete the resource before replacing it
        if new_props.bucket_name != old_props.bucket_name:
            return DiffResult(True, ["bucket_name"], [], True)

        # If the target dir has changed, delete the resource before replacing it
        if new_props.target_dir != old_props.target_dir:
            return DiffResult(True, ["target_dir"], [], True)

        _changed_files = _compute_file_changes(old_props.file_hashes, new_props.file_hashes)
        if _will_update(_changed_files):
            pulumi.info(dedent(f"""
                Changes:-
                    New files:
                        {', '.join(_changed_files[0])}
                    Deleted files:
                        {', '.join(_changed_files[1])}
                    Changed files:
                        {', '.join(_changed_files[2])}
            """))

            return DiffResult(True, [], [], False)
        try:
            bucket = _get_gcp_bucket(new_props.bucket_name)
            existing_paths = _list_existing_object_paths(bucket, new_props.target_dir)
            expected_paths = set(new_props.file_hashes.keys())
            missing_files = expected_paths - existing_paths
            if missing_files:
                pulumi.warn(
                    f"Detected {len(missing_files)} missing objects on bucket; will re-upload: {', '.join(sorted(list(missing_files))[:10])}"
                )
                return DiffResult(True, [], [], False)
        except Exception as e:
            pulumi.warn(f"Skipping missing-object check due to error: {e}")
        return DiffResult(False, [], [], False)


# Custom Resource for BucketContent
class BucketContent(Resource):
    """
    Custom Resource for bucket content to be uploaded to the GCP bucket.

    The normal BucketObject resource is not used because it is not resource-efficient, since
    for each file to be uploaded, a new resource is created.

    Since pulumi charges per resource, this is not ideal for a large number of files like our React frontend artifacts.
    """

    def __init__(self,
                 resource_name: str,
                 *,
                 bucket_name: Union[str, pulumi.Output[str]],
                 source_dir_path: str,
                 target_dir: str = "",
                 no_cache_paths: list[str] = None,
                 opts: pulumi.ResourceOptions = None):
        """
        Constructor Custom Resource for BucketContent

        :param resource_name: Name of the resource (Pulumi resource name)

        :param bucket_name: GCP storage bucket name to upload the files
        :param target_dir: The target directory path. (Target meaning at the target gcp storage bucket)
                            It should not start with /, but should end with a / if not empty (e.g.: "poc/" or "").

        :param source_dir_path: The Source directory path.

        :param no_cache_paths: List of paths to not cache.

        :param opts: `pulumi.ResourceOptions` options.
        """

        # GUARD: Validate that the path exists and throw early, to prevent further un-foreseen errors.
        if not os.path.exists(source_dir_path):
            raise ValueError(f"The source_dir_path does not exist: {source_dir_path}")

        # Construct the objects/files hashes
        # format: { [file_path]: [md_5_checksum] }
        file_hashes = _get_directory_files_info(source_dir_path)

        # construct de-serializable props
        props = {
            "resource_name": resource_name,
            "bucket_name": bucket_name,
            "target_dir": target_dir,
            "no_cache_paths": no_cache_paths if no_cache_paths else [],
            "file_hashes": file_hashes
        }

        # source dir path is a local (target) os path, so no storing it in the state.
        provider = BucketContentProvider(source_dir_path=source_dir_path)

        super().__init__(provider, name=resource_name, props=props, opts=opts)
