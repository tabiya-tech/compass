import asyncio
import logging
import os

from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.conversations.routes import add_conversation_routes
from app.invitations import add_user_invitations_routes
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication
from app.version.version_routes import add_version_routes

from contextlib import asynccontextmanager

from app.users.routes import add_users_routes
from app.conversations.poc import add_poc_routes

logger = logging.getLogger(__name__)

load_dotenv()


# Configure lifespan events for the FastAPI application
# eg: for startup we need to initialize the database connection and create the indexes
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup logic
    logger.info("Starting up...")

    application_db = await CompassDBProvider.get_application_db()
    userdata_db = await CompassDBProvider.get_userdata_db()

    # Initialize the MongoDB databases
    # run the initialization in parallel
    await asyncio.gather(
        CompassDBProvider.initialize_application_mongo_db(application_db, logger),
        CompassDBProvider.initialize_userdata_mongo_db(userdata_db, logger)
    )

    yield

    # Shutdown logic
    logger.info("Shutting down...")

    # close the database connections
    application_db.client.close()
    userdata_db.client.close()


# Retrieve the backend URL from the environment variables,
# and set the server URL to the backend URL, so that Swagger UI can correctly call the backend paths
app = FastAPI(
    # redirect_slashes is set False to prevent FastAPI from redirecting when a trailing slash is added.
    redirect_slashes=False,
    servers=[
        {
            "url": os.getenv("BACKEND_URL") or "/",
            "description": "The backend server"
        }],
    lifespan=lifespan
)

# Setup CORS policy
# Keep the backend, frontend urls and the environment as separate env variables as a failsafe measure,
# as we want to be certain that both the backend, frontend urls are set correctly,
# especially in non dev or local environments.

if not os.getenv("FRONTEND_URL"):
    raise ValueError("Mandatory FRONTEND_URL env variable is not set! Please set it to the frontend URL as it is "
                     "required to set the CORS policy correctly.")
logger.info(f"Frontend URL: {os.getenv('FRONTEND_URL')}")

if not os.getenv("BACKEND_URL"):
    raise ValueError("Mandatory BACKEND_URL env variable is not set! Please set it to the backend URL as it is "
                     "required to set the CORS policy correctly for the api documentation /docs.")
logger.info(f"Backend URL: {os.getenv('BACKEND_URL')}")

origins = [
    os.getenv("FRONTEND_URL"),
    os.getenv("BACKEND_URL") + "/docs",
]

target_env = os.getenv("TARGET_ENVIRONMENT")
logger.info(f"Target environment: {target_env}")

if target_env == "dev" or target_env == "local":
    logger.info(f"Setting CORS to allow all origins for the {target_env} environment.")
    origins.append("*")

enable_sentry = os.getenv("ENABLE_SENTRY")
if not enable_sentry:
    raise ValueError("Mandatory ENABLE_SENTRY env variable is not set! Please set it to the either True or False")
logger.info(f"ENABLE_SENTRY: {os.getenv('ENABLE_SENTRY')}")

origins = list(set(origins))  # remove duplicates
logger.info(f"Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Check mandatory environment variables and raise an early exception if they are not set
if not os.getenv('TAXONOMY_MONGODB_URI'):
    raise ValueError("Mandatory TAXONOMY_MONGODB_URI env variable is not set!")
if not os.getenv("TAXONOMY_DATABASE_NAME"):
    raise ValueError("Mandatory TAXONOMY_DATABASE_NAME environment variable is not set")
if not os.getenv('APPLICATION_MONGODB_URI'):
    raise ValueError("Mandatory APPLICATION_MONGODB_URI env variable is not set!")
if not os.getenv("APPLICATION_DATABASE_NAME"):
    raise ValueError("Mandatory APPLICATION_DATABASE_NAME environment variable is not set")
if not os.getenv('USERDATA_MONGODB_URI'):
    raise ValueError("Mandatory USERDATA_MONGODB_URI env variable is not set!")
if not os.getenv("USERDATA_DATABASE_NAME"):
    raise ValueError("Mandatory USERDATA_DATABASE_NAME environment variable is not set")
if not os.getenv('TAXONOMY_MODEL_ID'):
    raise ValueError("Mandatory TAXONOMY_MODEL_ID env variable is not set!")

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
# Add POC chat routes
############################################
add_poc_routes(app, auth)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
