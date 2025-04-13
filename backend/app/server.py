import asyncio
import logging
import os

from dotenv import load_dotenv

from fastapi import FastAPI, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.conversations.routes import add_conversation_routes
from app.countries import Country, get_country_from_string
from app.invitations import add_user_invitations_routes
from app.metrics.routes.routes import add_metrics_routes
from app.sentry_init import init_sentry
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, ApiKeyAuth
from app.vector_search.occupation_search_routes import add_occupation_search_routes
from app.vector_search.skill_search_routes import add_skill_search_routes
from app.vector_search.validate_taxonomy_model import validate_taxonomy_model
from app.version.version_routes import add_version_routes

from contextlib import asynccontextmanager

from app.users.routes import add_users_routes
from app.conversations.poc import add_poc_routes
from app.app_config import ApplicationConfig, set_application_config, get_application_config
from app.version.utils import load_version_info
from common_libs.logging.log_utilities import setup_logging_config


def setup_logging():
    # The configuration is loaded (once) when python imports the module.
    # If the LOG_CONFIG_FILE environment variable is not set, then fallback to the production logging configuration
    log_config_file = os.getenv("LOG_CONFIG_FILE", "logging.cfg.yaml")

    # If absolute path is not set, then use the relative path to this module
    # As we do not know how the module will be run. It may be started from the __main__ module or from the command line
    # or via uvicorn.
    if not os.path.isabs(log_config_file):
        log_config_file = os.path.join(os.path.dirname(__file__), log_config_file)
    setup_logging_config(log_config_file)
    logging.debug("Logging initialized")


def setup_sentry():
    # Sentry should only be initialized if the environment variable BACKEND_ENABLE_SENTRY is set to true
    # This environment will be set to false for local development or the CI/CD pipeline
    # because the sentry initialization breaks the unit tests (specifically the ones that use the fastapi test client)
    if os.getenv("BACKEND_ENABLE_SENTRY") == "True":
        sentry_dsn = os.getenv("BACKEND_SENTRY_DSN")
        target_environment_name = os.getenv("TARGET_ENVIRONMENT_NAME")

        if sentry_dsn:
            init_sentry(sentry_dsn, target_environment_name)
        else:
            logging.warning("BACKEND_SENTRY_DSN environment variable is not set. Sentry will not be initialized")
    else:
        logging.warning("BACKEND_ENABLE_SENTRY environment variable is not set to True.  Sentry will not be initialized")


############################################
# Load the environment variables
############################################
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Setup Sentry
setup_sentry()

# Setup CORS policy
# Keep the backend, frontend urls and the environment as separate env variables as a failsafe measure,
# as we want to be certain that both the backend, frontend urls are set correctly,
# especially in non dev or local environments.

if not os.getenv("FRONTEND_URL"):
    raise ValueError("Mandatory FRONTEND_URL env variable is not set! Please set it to the frontend URL as it is "
                     "required to set the CORS policy correctly.")
frontend_url = os.getenv("FRONTEND_URL")
logger.info(f"Frontend URL: {frontend_url}")

if not os.getenv("BACKEND_URL"):
    raise ValueError("Mandatory BACKEND_URL env variable is not set! Please set it to the backend URL as it is "
                     "required to set the CORS policy correctly for the api documentation /docs.")
backend_url = os.getenv("BACKEND_URL")
logger.info(f"Backend URL: {backend_url}")

if not os.getenv("TARGET_ENVIRONMENT_TYPE"):
    raise ValueError("Mandatory TARGET_ENVIRONMENT_TYPE env variable is not set! Please set it to the target environment type as it is "
                     "required to set the CORS policy correctly for allowing local development if it is set to 'local' or 'dev'.")

target_environment_type = os.getenv("TARGET_ENVIRONMENT_TYPE")
logger.info(f"Target environment: {target_environment_type}")

if not os.getenv("TARGET_ENVIRONMENT_NAME"):
    raise ValueError("Mandatory TARGET_ENVIRONMENT_NAME env variable is not set! Please set it to the target environment name as it is "
                     "Required by sentry to know on which environment some Sentry Events occurred")

enable_sentry = os.getenv("BACKEND_ENABLE_SENTRY")
if not enable_sentry:
    raise ValueError("Mandatory BACKEND_ENABLE_SENTRY env variable is not set! Please set it to the either True or False")
logger.info(f"BACKEND_ENABLE_SENTRY: {os.getenv('BACKEND_ENABLE_SENTRY')}")

_metrics_enabled_str = os.getenv("BACKEND_ENABLE_METRICS")
if not _metrics_enabled_str:
    raise ValueError("Mandatory BACKEND_ENABLE_METRICS env variable is not set! Please set it to the either True or False")
logger.info(f"BACKEND_ENABLE_METRICS: {_metrics_enabled_str}")

_default_country_of_user_str = os.getenv("DEFAULT_COUNTRY_OF_USER")
logger.info(f"DEFAULT_COUNTRY_OF_USER: {_default_country_of_user_str}")
if not _default_country_of_user_str:
    logger.warning("DEFAULT_COUNTRY_OF_USER environment variable is not set! Defaulting to 'Unspecified'")
    _default_country_of_user_str = Country.UNSPECIFIED.value

# Check mandatory environment variables and raise an early exception if they are not set
if not os.getenv('TAXONOMY_MONGODB_URI'):
    raise ValueError("Mandatory TAXONOMY_MONGODB_URI env variable is not set!")
if not os.getenv("TAXONOMY_DATABASE_NAME"):
    raise ValueError("Mandatory TAXONOMY_DATABASE_NAME environment variable is not set")
if not os.getenv('APPLICATION_MONGODB_URI'):
    raise ValueError("Mandatory APPLICATION_MONGODB_URI env variable is not set!")
if not os.getenv("APPLICATION_DATABASE_NAME"):
    raise ValueError("Mandatory APPLICATION_DATABASE_NAME environment variable is not set")
if not os.getenv('METRICS_MONGODB_URI'):
    raise ValueError("Mandatory METRICS_MONGODB_URI env variable is not set!")
if not os.getenv("METRICS_DATABASE_NAME"):
    raise ValueError("Mandatory METRICS_DATABASE_NAME environment variable is not set")
if not os.getenv('USERDATA_MONGODB_URI'):
    raise ValueError("Mandatory USERDATA_MONGODB_URI env variable is not set!")
if not os.getenv("USERDATA_DATABASE_NAME"):
    raise ValueError("Mandatory USERDATA_DATABASE_NAME environment variable is not set")
if not os.getenv('TAXONOMY_MODEL_ID'):
    raise ValueError("Mandatory TAXONOMY_MODEL_ID env variable is not set!")
if not os.getenv("EMBEDDINGS_SERVICE_NAME"):
    raise ValueError("Mandatory EMBEDDINGS_SERVICE_NAME environment variable is not set")
if not os.getenv("EMBEDDINGS_MODEL_NAME"):
    raise ValueError("Mandatory EMBEDDINGS_MODEL_NAME environment variable is not set")

# set global application configuration
set_application_config(
    ApplicationConfig(
        environment_name=os.getenv("TARGET_ENVIRONMENT_NAME"),
        version_info=load_version_info(),
        enable_metrics=_metrics_enabled_str.lower() == "true",
        default_country_of_user=get_country_from_string(_default_country_of_user_str),
        taxonomy_model_id=os.getenv('TAXONOMY_MODEL_ID'),
        embeddings_service_name=os.getenv("EMBEDDINGS_SERVICE_NAME"),
        embeddings_model_name=os.getenv("EMBEDDINGS_MODEL_NAME"),
    )
)


############################################
# Initiate the FastAPI app
############################################

# Configure lifespan events for the FastAPI application
# eg: for startup we need to initialize the database connection and create the indexes
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup logic
    logger.info("Starting up...")

    application_db = await CompassDBProvider.get_application_db()
    taxonomy_db = await CompassDBProvider.get_taxonomy_db()
    userdata_db = await CompassDBProvider.get_userdata_db()
    metrics_db = await CompassDBProvider.get_metrics_db()

    app_cfg = get_application_config()
    # Initialize the MongoDB databases
    # run the initialization in parallel
    await asyncio.gather(
        CompassDBProvider.initialize_application_mongo_db(application_db, logger),
        CompassDBProvider.initialize_userdata_mongo_db(userdata_db, logger),
        CompassDBProvider.initialize_metrics_mongo_db(metrics_db, logger),
        validate_taxonomy_model(taxonomy_db=taxonomy_db,
                                taxonomy_model_id=app_cfg.taxonomy_model_id,
                                embeddings_service_name=app_cfg.embeddings_service_name,
                                embeddings_model_name=app_cfg.embeddings_model_name),
    )

    yield

    # Shutdown logic
    logger.info("Shutting down...")

    # close the database connections
    application_db.client.close()
    userdata_db.client.close()
    metrics_db.client.close()


# Retrieve the backend URL from the environment variables,
# and set the server URL to the backend URL, so that Swagger UI can correctly call the backend paths
app = FastAPI(
    # redirect_slashes is set False to prevent FastAPI from redirecting when a trailing slash is added.
    title="Compass API",
    version=get_application_config().version_info.to_version_string(),
    description="The Compass API is used to interact with the Compass conversation agent.",
    redirect_slashes=False,
    servers=[
        {
            "url": backend_url or "/",
            "description": "The backend server"
        }],
    lifespan=lifespan
)

############################################
# Setup the CORS policy
############################################

origins = [
    frontend_url,
    backend_url + "/docs",
]

if target_environment_type == "dev" or target_environment_type == "local":
    logger.info(f"Setting CORS to allow all origins for the {target_environment_type} environment.")
    origins.append("*")

origins = list(set(origins))  # remove duplicates
logger.info(f"Allowed origins: {origins}")

# noinspection PyTypeChecker
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
############################################
# Initiate the Authentication Module for the FastAPI app
############################################
auth = Authentication()

############################################
# Add version routes
############################################
add_version_routes(app)

############################################
# Add routes relevant for the conversation
############################################
add_conversation_routes(app, auth)

############################################
# Add routes relevant for the user management
############################################
add_users_routes(app, auth)

############################################
# Add the user invitations routes
############################################
add_user_invitations_routes(app)

############################################
# Add routes relevant for esco search
############################################
api_key_auth = ApiKeyAuth()
search_router = APIRouter(dependencies=[Depends(api_key_auth)], tags=["Search"])
add_occupation_search_routes(search_router)
add_skill_search_routes(search_router)
app.include_router(search_router)

############################################
# Add metrics routes
############################################
add_metrics_routes(app)

############################################
# Add POC chat routes
############################################
add_poc_routes(app, auth)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
