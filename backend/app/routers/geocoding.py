import asyncio
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.security import get_current_user


router = APIRouter(prefix="/geocoding", tags=["geocoding"])

BUCHAREST_VIEWBOX = "25.93,44.56,26.23,44.32"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "GeoEstateBucuresti/1.0 student-project"

_cache: dict[str, list[dict]] = {}
_last_external_request = 0.0
_lock = asyncio.Lock()


@router.get("/search")
async def search_location(
    query: str = Query(..., min_length=3),
    current_user: dict = Depends(get_current_user),
):
    global _last_external_request

    normalized_query = query.strip().lower()

    if not normalized_query:
        raise HTTPException(status_code=400, detail="Introdu o locatie de cautat.")

    if normalized_query in _cache:
        return _cache[normalized_query]

    async with _lock:
        if normalized_query in _cache:
            return _cache[normalized_query]

        elapsed = time.monotonic() - _last_external_request

        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)

        params = {
            "format": "jsonv2",
            "q": f"{query}, Bucuresti, Romania",
            "limit": 5,
            "countrycodes": "ro",
            "bounded": 1,
            "viewbox": BUCHAREST_VIEWBOX,
            "addressdetails": 1,
        }
        headers = {
            "User-Agent": USER_AGENT,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    NOMINATIM_URL,
                    params=params,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail="Serviciul de cautare locatie nu este disponibil momentan.",
            ) from exc
        finally:
            _last_external_request = time.monotonic()

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Serviciul de cautare locatie nu este disponibil momentan.",
        )

    results = []

    for item in response.json():
        try:
            results.append(
                {
                    "display_name": item.get("display_name", ""),
                    "latitude": float(item["lat"]),
                    "longitude": float(item["lon"]),
                    "type": item.get("type", ""),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue

    _cache[normalized_query] = results
    return results
