import asyncio
import json
import logging
import math
import time
from datetime import datetime

import httpx


logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
OVERPASS_RATE_LIMIT_SECONDS = 2.0
_cache: dict[str, list[dict]] = {}
_last_external_request = 0.0
_lock = asyncio.Lock()


class OverpassUnavailableError(RuntimeError):
    pass


def _format_overpass_error(exc: Exception) -> str:
    message = str(exc).strip()
    return message or exc.__class__.__name__


def normalize_coordinate_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 5)}:{round(longitude, 5)}"


def build_overpass_query(latitude: float, longitude: float) -> str:
    return f"""
[out:json][timeout:25];
(
  nwr(around:1200,{latitude},{longitude})["railway"="station"]["station"="subway"];
  nwr(around:1200,{latitude},{longitude})["railway"="subway_entrance"];
  nwr(around:900,{latitude},{longitude})["highway"="bus_stop"];
  nwr(around:900,{latitude},{longitude})["public_transport"~"^(platform|stop_position|station)$"];
  nwr(around:900,{latitude},{longitude})["railway"="tram_stop"];

  nwr(around:1200,{latitude},{longitude})["amenity"~"^(school|kindergarten|university|college)$"];

  nwr(around:1200,{latitude},{longitude})["amenity"~"^(hospital|clinic|doctors)$"];
  nwr(around:900,{latitude},{longitude})["amenity"="pharmacy"];

  nwr(around:1200,{latitude},{longitude})["leisure"~"^(park|garden)$"];

  nwr(around:800,{latitude},{longitude})["amenity"~"^(restaurant|cafe|fast_food)$"];
  nwr(around:800,{latitude},{longitude})["shop"~"^(supermarket|mall|convenience|bakery)$"];
);
out center tags;
"""


async def query_overpass_pois(
    latitude: float,
    longitude: float,
    property_id: int | None = None,
) -> list[dict]:
    global _last_external_request

    cache_key = normalize_coordinate_key(latitude, longitude)

    if cache_key in _cache:
        return _cache[cache_key]

    async with _lock:
        if cache_key in _cache:
            return _cache[cache_key]

        query = build_overpass_query(latitude, longitude)
        last_error: Exception | None = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            for url in OVERPASS_ENDPOINTS:
                elapsed = time.monotonic() - _last_external_request
                if elapsed < OVERPASS_RATE_LIMIT_SECONDS:
                    await asyncio.sleep(OVERPASS_RATE_LIMIT_SECONDS - elapsed)

                try:
                    logger.info(
                        "Querying Overpass endpoint %s for property_id=%s",
                        url,
                        property_id,
                    )
                    response = await client.post(
                        url,
                        data={"data": query},
                        headers={"User-Agent": "GeoEstateBucuresti/1.0 student-project"},
                    )
                    _last_external_request = time.monotonic()

                    if response.status_code in OVERPASS_RETRY_STATUS_CODES:
                        logger.warning(
                            "Overpass endpoint %s returned status %s for property_id=%s",
                            url,
                            response.status_code,
                            property_id,
                        )
                        last_error = httpx.HTTPStatusError(
                            f"Overpass endpoint returned {response.status_code}",
                            request=response.request,
                            response=response,
                        )
                        continue

                    response.raise_for_status()
                    elements = response.json().get("elements", [])
                    _cache[cache_key] = elements
                    return elements
                except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as exc:
                    logger.warning(
                        "Overpass connection error on endpoint %s for property_id=%s: %s",
                        url,
                        property_id,
                        exc,
                    )
                    last_error = exc
                    continue
                except httpx.HTTPStatusError as exc:
                    logger.warning(
                        "Overpass status error on endpoint %s for property_id=%s: status=%s error=%s",
                        url,
                        property_id,
                        exc.response.status_code if exc.response is not None else None,
                        _format_overpass_error(exc),
                    )
                    last_error = exc
                    if exc.response is not None and exc.response.status_code in OVERPASS_RETRY_STATUS_CODES:
                        continue
                    raise

        if last_error:
            raise OverpassUnavailableError(
                "Overpass API connection failed for all endpoints"
            ) from last_error

        elements = []
        _cache[cache_key] = elements
        return elements


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_m = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_m * c


def _element_coordinates(element: dict) -> tuple[float, float] | None:
    lat = element.get("lat")
    lon = element.get("lon")

    if lat is None or lon is None:
        center = element.get("center") or {}
        lat = center.get("lat")
        lon = center.get("lon")

    if lat is None or lon is None:
        return None

    return float(lat), float(lon)


def _category_names(tags: dict) -> set[str]:
    categories = set()
    amenity = tags.get("amenity")
    railway = tags.get("railway")
    station = tags.get("station")
    public_transport = tags.get("public_transport")
    highway = tags.get("highway")
    leisure = tags.get("leisure")
    shop = tags.get("shop")

    if railway == "station" and station == "subway":
        categories.add("metro")
        categories.add("transport")
    if railway == "subway_entrance":
        categories.add("metro")
        categories.add("transport")
    if highway == "bus_stop" or railway == "tram_stop" or public_transport in {"platform", "stop_position", "station"}:
        categories.add("transport")
    if amenity in {"school", "kindergarten", "university", "college"}:
        categories.add("education")
    if amenity in {"hospital", "clinic", "doctors"}:
        categories.add("health")
    if amenity == "pharmacy":
        categories.add("pharmacy")
        categories.add("health")
    if leisure in {"park", "garden"}:
        categories.add("green")
    if amenity in {"restaurant", "cafe", "fast_food"} or shop in {"supermarket", "mall", "convenience", "bakery"}:
        categories.add("commercial")

    return categories


def categorize_pois(elements: list[dict], latitude: float, longitude: float) -> dict:
    categories = {
        "metro": {"count": 0, "nearest_m": None},
        "transport": {"count": 0, "nearest_m": None},
        "education": {"count": 0, "nearest_m": None},
        "health": {"count": 0, "nearest_m": None},
        "pharmacy": {"count": 0, "nearest_m": None},
        "green": {"count": 0, "nearest_m": None},
        "commercial": {"count": 0, "nearest_m": None},
    }

    seen: set[tuple[int | str, str]] = set()

    for element in elements:
        coordinates = _element_coordinates(element)
        if not coordinates:
            continue

        item_lat, item_lon = coordinates
        distance = haversine_distance_m(latitude, longitude, item_lat, item_lon)
        element_id = element.get("id", f"{item_lat}:{item_lon}")
        tags = element.get("tags") or {}

        for category in _category_names(tags):
            seen_key = (element_id, category)
            if seen_key in seen:
                continue
            seen.add(seen_key)

            current = categories[category]
            current["count"] += 1
            nearest = current["nearest_m"]
            if nearest is None or distance < nearest:
                current["nearest_m"] = round(distance, 2)

    return categories


def calculate_category_score(
    count: int,
    nearest_distance: float | None,
    max_useful_count: int,
    max_useful_distance: int,
) -> float:
    if count <= 0 or nearest_distance is None:
        return 0.0

    count_score = min(count, max_useful_count) / max_useful_count * 100
    distance_score = max(0, 1 - nearest_distance / max_useful_distance) * 100
    return min(100, 0.45 * count_score + 0.55 * distance_score)


def calculate_investment_score(property_obj, location_score: float | None, market_label: str | None = None) -> float:
    location_value = location_score or 0

    if property_obj.price and property_obj.monthly_rent:
        gross_yield = (property_obj.monthly_rent * 12 / property_obj.price) * 100
        yield_score = 100 if gross_yield >= 8 else max(0, gross_yield / 8 * 100)
    else:
        yield_score = 0

    market_score = {
        "sub_piata": 100,
        "la_piata": 70,
        "peste_piata": 35,
    }.get(market_label, 50)
    occupancy_score = {
        "rented": 100,
        "occupied": 100,
        "available": 60,
        "sold": 40,
        "inactive": 20,
    }.get(property_obj.status, 50)
    score = (
        0.45 * location_value
        + 0.25 * yield_score
        + 0.20 * market_score
        + 0.10 * occupancy_score
    )
    return round(max(0, min(100, score)), 2)


def apply_location_score_data(property_obj, categories: dict, market_label: str | None = None):
    transport_score = calculate_category_score(
        categories["transport"]["count"],
        categories["transport"]["nearest_m"],
        12,
        900,
    )

    nearest_metro = categories["metro"]["nearest_m"]
    if categories["metro"]["count"] > 0 and nearest_metro is not None:
        if nearest_metro <= 500:
            transport_score = min(100, transport_score + 15)
        elif nearest_metro <= 900:
            transport_score = min(100, transport_score + 8)

    education_score = calculate_category_score(
        categories["education"]["count"],
        categories["education"]["nearest_m"],
        6,
        1200,
    )
    health_score = calculate_category_score(
        categories["health"]["count"],
        categories["health"]["nearest_m"],
        6,
        1200,
    )
    green_score = calculate_category_score(
        categories["green"]["count"],
        categories["green"]["nearest_m"],
        4,
        1200,
    )
    commercial_score = calculate_category_score(
        categories["commercial"]["count"],
        categories["commercial"]["nearest_m"],
        10,
        800,
    )

    facilities_score = (
        0.30 * education_score
        + 0.30 * health_score
        + 0.20 * green_score
        + 0.20 * commercial_score
    )
    location_score = (
        0.30 * transport_score
        + 0.20 * education_score
        + 0.20 * health_score
        + 0.15 * green_score
        + 0.15 * commercial_score
    )

    property_obj.accessibility_score = round(transport_score, 2)
    property_obj.facilities_score = round(facilities_score, 2)
    property_obj.location_score = round(location_score, 2)
    property_obj.investment_score = calculate_investment_score(
        property_obj,
        property_obj.location_score,
        market_label,
    )

    property_obj.poi_metro_count = categories["metro"]["count"]
    property_obj.poi_transport_count = categories["transport"]["count"]
    property_obj.poi_education_count = categories["education"]["count"]
    property_obj.poi_health_count = categories["health"]["count"]
    property_obj.poi_pharmacy_count = categories["pharmacy"]["count"]
    property_obj.poi_green_count = categories["green"]["count"]
    property_obj.poi_commercial_count = categories["commercial"]["count"]

    property_obj.nearest_metro_m = categories["metro"]["nearest_m"]
    property_obj.nearest_transport_m = categories["transport"]["nearest_m"]
    property_obj.nearest_school_m = categories["education"]["nearest_m"]
    property_obj.nearest_health_m = categories["health"]["nearest_m"]
    property_obj.nearest_green_m = categories["green"]["nearest_m"]
    property_obj.nearest_commercial_m = categories["commercial"]["nearest_m"]
    property_obj.poi_summary_json = json.dumps(
        {
            "transport": categories["transport"],
            "metro": categories["metro"],
            "education": categories["education"],
            "health": categories["health"],
            "green": categories["green"],
            "commercial": categories["commercial"],
        },
        ensure_ascii=False,
    )
    property_obj.poi_last_updated_at = datetime.utcnow()
    return property_obj


async def enrich_property_location_scores(property_obj, market_label: str | None = None):
    if property_obj.latitude is None or property_obj.longitude is None:
        return property_obj

    elements = await query_overpass_pois(
        property_obj.latitude,
        property_obj.longitude,
        getattr(property_obj, "id", None),
    )
    categories = categorize_pois(elements, property_obj.latitude, property_obj.longitude)
    return apply_location_score_data(property_obj, categories, market_label)


async def check_overpass_health() -> dict:
    endpoints = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for interpreter_url in OVERPASS_ENDPOINTS:
            api_url = interpreter_url.removesuffix("/interpreter")
            status_url = f"{api_url}/status"

            try:
                response = await client.get(
                    status_url,
                    headers={"User-Agent": "GeoEstateBucuresti/1.0 student-project"},
                )
                available = response.status_code == 200
                endpoints.append(
                    {
                        "url": api_url,
                        "available": available,
                        "error": None if available else f"Status code {response.status_code}",
                    }
                )
            except httpx.HTTPError as exc:
                endpoints.append(
                    {
                        "url": api_url,
                        "available": False,
                        "error": _format_overpass_error(exc),
                    }
                )

    return {
        "status": "ok" if any(endpoint["available"] for endpoint in endpoints) else "error",
        "endpoints": endpoints,
    }
