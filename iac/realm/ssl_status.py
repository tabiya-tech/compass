import random
import time
from typing import Any, Dict
import google
import pulumi
from googleapiclient import discovery
from pulumi import Resource
from pulumi.dynamic import Resource, ResourceProvider, CreateResult, CheckResult, CheckFailure, UpdateResult, DiffResult

from lib import int_to_base36


def get_credentials() -> Any:
    # google_credentials = getenv("GOOGLE_CREDENTIALS", True)
    _credentials, _ = google.auth.load_credentials_from_file(
        "/Users/apostolos.benisis/sources/ox.ac.uk/compass-copy/iac/keys/test-realm-lower-env-ci-cd-key.json",
        scopes=["https://www.googleapis.com/auth/cloud-platform"])
    # _credentials, _ = google.auth.default()
    return _credentials


def get_ssl_status_active(project: str, ssl_id: str) -> bool:
    credentials = get_credentials()
    service = discovery.build('compute', 'v1', credentials=credentials)
    request = service.sslCertificates().get(project=project, sslCertificate=ssl_id)
    response = request.execute()
    return response["managed"]["status"] == "ACTIVE"


def _get_id() -> str:
    """
    Generates a random ID for the SSL.
    :return:
    """
    random_int = random.Random().randrange(
        2 ** 32 - 1,  # 32bit integer
        2 ** 64 - 1)  # 64bit integer
    random_id = int_to_base36(random_int)
    return f"ssl-staus-{random_id}"


class CertificateStatusProvider(ResourceProvider):
    def __init__(self, max_wait_secs: int):
        super().__init__()
        self.max_wait_secs = max_wait_secs

    def check(self, _olds: Dict[str, Any], news: Dict[str, Any]) -> CheckResult:
        pulumi.info("Checking the SSL Certificate Status")

        _failures = []
        _project_id = news.get("project")
        if _project_id is None:
            _failures.append(CheckFailure("project", "project is missing in props"))

        _ssl_id = news.get("ssl_id")
        if _ssl_id is None:
            _failures.append(CheckFailure("ssl_id", "ssl_id is missing in props"))

        return CheckResult(news, _failures)

    def create(self, props: dict[str, Any]) -> CreateResult:
        pulumi.info("Checking the SSL Certificate Status")
        _project_id = props.get("project")
        _ssl_id = props.get("ssl_id")

        status = False
        wait_time = 0
        while not status and wait_time < self.max_wait_secs:
            timestamp = time.time()
            pulumi.info("Waiting for the SSL Certificate to be active")
            status = get_ssl_status_active(_project_id, _ssl_id)
            # sleep for 5 seconds before checking again
            if not status:
                time.sleep(5)
            wait_time += time.time() - timestamp

        if not status:
            pulumi.info("The SSL Certificate is not active")

        return CreateResult(id_=_get_id(), outs={"status_active": status})


class CertificateStatus(Resource):
    """
    """

    def __init__(self, name: str, *, project: pulumi.Input[str] | None, ssl_id: pulumi.Input[str], max_wait_secs: int, opts: pulumi.ResourceOptions = None):
        _project = project
        if _project is None:
            # If the project is not set in the config args, get it from the provider
            _provider = getattr(opts, "provider", None)  # Safe check for opts and opts.provider
            _project = getattr(_provider, "project", None)  # Safe check for provider and provider.project
            if _project is None:
                raise ValueError("The 'project' should be set in the config args or in the provider args.")

        # Manually add client.api_key and client.firebase_subdomain to the properties
        # so they are included in the resource outputs. Only take client.permissions
        # from the configuration arguments, and only if it is present, as it can be updated.
        # Other values are read-only and should not be included in the outputs

        super().__init__(CertificateStatusProvider(max_wait_secs = max_wait_secs), name=name, props={"project": _project, "ssl_id": ssl_id, "status_active": False}, opts=opts)
