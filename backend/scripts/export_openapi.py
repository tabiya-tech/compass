import sys
sys.path.insert(1, '../app')

from fastapi.openapi.utils import get_openapi
from server import app
from yaml import dump


with open('openapi3.yaml', 'w') as f:
    dump(get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes
    ), f)
