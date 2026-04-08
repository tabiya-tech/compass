from http import HTTPStatus

from fastapi import APIRouter, FastAPI, HTTPException, Response

from app.constants.errors import HTTPErrorResponse
from app.teveta.loader import SECTOR_KEY_MAP, get_sector_data
from app.teveta.types import SectorData


def add_teveta_routes(app: FastAPI) -> None:
    router = APIRouter(prefix="/teveta", tags=["teveta"])

    @router.get(
        "/sector/{sector}",
        response_model=SectorData,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
        },
        description=(
            "Return TEVETA data for a knowledge hub sector: critical skills, "
            "accredited programmes, priority curriculum, and institution/programme counts. "
            f"Valid sectors: {', '.join(SECTOR_KEY_MAP.keys())}"
        ),
    )
    async def get_sector(sector: str, response: Response) -> SectorData:
        response.headers["Access-Control-Allow-Origin"] = "*"
        data = get_sector_data(sector)
        if data is None:
            raise HTTPException(
                status_code=HTTPStatus.NOT_FOUND,
                detail=f"Unknown sector '{sector}'. Valid sectors: {', '.join(SECTOR_KEY_MAP.keys())}",
            )
        return SectorData(**data)

    app.include_router(router)
