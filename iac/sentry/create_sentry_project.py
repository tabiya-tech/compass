from dataclasses import dataclass
import pulumiverse_sentry as sentry
import pulumi


@dataclass
class SentryConfig:
    project: str
    organization: str
    team: str
    auth_token: str


def create_sentry_team(sentry_config: SentryConfig):
    sentry_team = sentry.SentryTeam(
        sentry_config.team,
        organization=sentry_config.organization,
        slug=sentry_config.team,
    )
    return sentry_team

def get_sentry_key_and_export(organization: str, project_slug: str):
    dsn = sentry.get_sentry_key(
        name="sentry-dsn",
        organization=organization,
        project=project_slug,
    )
    print(f"DSN: {dsn}")
    sentry_dsn = f"https://{dsn.public_key}:{dsn.secret_key}@{dsn.url}/{dsn.project_id}"
    return sentry_dsn



def create_sentry_project(organization: str, team: str, auth_token: str, project: str):
    sentry_config = SentryConfig(
        organization=organization,
        team=team,
        auth_token=auth_token,
        project=project,
    )
    sentry_team = create_sentry_team(sentry_config)
    SENTRY_PLATFORM = "javascript-react"
    sentry_project = sentry.SentryProject(
        sentry_config.project,
        organization=sentry_config.organization,
        team=sentry_team.slug,
        platform=SENTRY_PLATFORM
    )

    # Use apply to work with the project slug and get the Sentry key
    sentry_dsn = sentry_project.slug.apply(lambda slug: get_sentry_key_and_export(sentry_config.organization, slug))

    pulumi.export('sentry_dsn', sentry_dsn)
