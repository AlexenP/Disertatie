from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import logging

from app.database import get_db
from app.models.models import Property
from app.schemas.schemas import PropertyCreate, PropertyUpdate
from app.services.market_service import (
    classify_property_against_market,
    get_latest_sector_market_averages,
)
from app.services.location_score_service import (
    calculate_investment_score,
    enrich_property_location_scores,
    OverpassUnavailableError,
)
from app.security import require_roles

router = APIRouter(prefix="/properties", tags=["properties"])
logger = logging.getLogger(__name__)
VALID_STATUSES = {"available", "occupied", "sold", "rented", "inactive"}
CAN_VIEW_PROPERTIES = ("admin", "agent", "manager", "developer")
CAN_WRITE_PROPERTIES = ("admin", "agent")


LOCATION_SCORE_FIELDS = [
    "accessibility_score",
    "facilities_score",
    "location_score",
    "investment_score",
    "poi_metro_count",
    "poi_transport_count",
    "poi_education_count",
    "poi_health_count",
    "poi_pharmacy_count",
    "poi_green_count",
    "poi_commercial_count",
    "nearest_metro_m",
    "nearest_transport_m",
    "nearest_school_m",
    "nearest_health_m",
    "nearest_green_m",
    "nearest_commercial_m",
    "poi_summary_json",
    "poi_last_updated_at",
]


def serialize_property(p: Property, market_average_sqm: float | None = None):
    market_data = classify_property_against_market(p, market_average_sqm)

    return {
        "id": p.id,
        "code": p.code,
        "title": p.title,
        "address": p.address,
        "sector_id": p.sector_id,
        "property_type_id": p.property_type_id,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "surface_sqm": p.surface_sqm,
        "price": p.price,
        "monthly_rent": p.monthly_rent,
        "status": p.status,
        "interested_clients": p.interested_clients,
        "views_count": p.views_count,
        "owner_admin_id": p.owner_admin_id,
        "created_at": p.created_at,
        "price_per_sqm": p.price_per_sqm,
        **market_data,
        **{field: getattr(p, field, None) for field in LOCATION_SCORE_FIELDS},
        "sector_name": p.sector.name if p.sector else None,
        "property_type_name": p.property_type.name if p.property_type else None,
    }


def get_property_market_label(db: Session, prop: Property) -> str:
    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return classify_property_against_market(prop, market_average)["market_label"]


async def try_enrich_location_scores(db: Session, prop: Property):
    market_label = get_property_market_label(db, prop)

    try:
        await enrich_property_location_scores(prop, market_label)
        db.commit()
        db.refresh(prop)
    except Exception as exc:
        db.rollback()
        logger.warning("Location scoring failed for property %s: %s", prop.id, exc)


def update_investment_score(db: Session, prop: Property):
    market_label = get_property_market_label(db, prop)
    prop.investment_score = calculate_investment_score(prop, prop.location_score, market_label)


@router.get("")
def list_properties(
    sector_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_PROPERTIES)),
):
    portfolio_admin_id = current_user["portfolio_admin_id"]
    query = db.query(Property).filter(Property.owner_admin_id == portfolio_admin_id)
    if sector_id:
        query = query.filter(Property.sector_id == sector_id)
    if status:
        query = query.filter(Property.status == status)

    properties = query.order_by(Property.id.asc()).all()
    sector_ids = sorted({p.sector_id for p in properties})
    market_averages = get_latest_sector_market_averages(db, sector_ids)

    return [
        serialize_property(p, market_averages.get(p.sector_id))
        for p in properties
    ]


@router.post("")
async def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_WRITE_PROPERTIES)),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status invalid. Alege unul dintre: available, occupied, sold, rented, inactive.")

    if payload.sector_id < 1 or payload.sector_id > 6:
        raise HTTPException(status_code=400, detail="Sector invalid. Alege un sector intre 1 si 6.")

    if payload.surface_sqm <= 0:
        raise HTTPException(status_code=400, detail="Suprafata trebuie sa fie mai mare decat 0.")

    if payload.price <= 0:
        raise HTTPException(status_code=400, detail="Pretul trebuie sa fie mai mare decat 0.")

    last_property = db.query(Property).order_by(Property.id.desc()).first()
    next_id = (last_property.id + 1) if last_property else 1

    prop = Property(
        code=f"PROP-{next_id:06d}",
        owner_admin_id=current_user["portfolio_admin_id"],
        **payload.model_dump(),
    )

    try:
        db.add(prop)
        db.commit()
        db.refresh(prop)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Proprietatea nu a putut fi salvata in baza de date. Verifica daca sectorul si tipul proprietatii exista."
        )

    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    await try_enrich_location_scores(db, prop)
    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.post("/recalculate-location-scores")
async def recalculate_portfolio_location_scores(
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_WRITE_PROPERTIES)),
):
    properties = (
        db.query(Property)
        .filter(Property.owner_admin_id == current_user["portfolio_admin_id"])
        .filter(Property.latitude.isnot(None), Property.longitude.isnot(None))
        .filter(Property.latitude >= -90, Property.latitude <= 90)
        .filter(Property.longitude >= -180, Property.longitude <= 180)
        .all()
    )

    processed = len(properties)
    updated = 0
    skipped = 0
    failed = 0
    errors = []

    for prop in properties:
        if prop.location_score is not None and not force:
            skipped += 1
            continue

        market_label = get_property_market_label(db, prop)

        try:
            await enrich_property_location_scores(prop, market_label)
            db.commit()
            db.refresh(prop)
            updated += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            error_message = str(exc)
            errors.append(
                {
                    "property_id": prop.id,
                    "title": prop.title,
                    "error": error_message,
                }
            )
            logger.warning(
                "Portfolio location scoring failed for property %s: %s",
                prop.id,
                exc,
            )

    if failed and updated:
        message = "Scorurile locatiei au fost recalculate partial."
    elif failed and not updated:
        message = "Serviciul Overpass nu este disponibil momentan. Incearca recalcularea mai tarziu."
    else:
        message = "Scorurile locatiei au fost recalculate."

    return {
        "processed": processed,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "errors": errors,
        "message": message,
    }


@router.get("/{property_id}")
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_PROPERTIES)),
):
    prop = (
        db.query(Property)
        .filter(
            Property.id == property_id,
            Property.owner_admin_id == current_user["portfolio_admin_id"],
        )
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.put("/{property_id}")
async def update_property(
    property_id: int,
    payload: PropertyUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_WRITE_PROPERTIES)),
):
    prop = (
        db.query(Property)
        .filter(
            Property.id == property_id,
            Property.owner_admin_id == current_user["portfolio_admin_id"],
        )
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status invalid")

    location_changed = (
        round(prop.latitude or 0, 6) != round(payload.latitude, 6)
        or round(prop.longitude or 0, 6) != round(payload.longitude, 6)
    )
    economic_changed = (
        prop.price != payload.price
        or prop.monthly_rent != payload.monthly_rent
        or prop.status != payload.status
        or prop.surface_sqm != payload.surface_sqm
        or prop.sector_id != payload.sector_id
    )

    for key, value in payload.model_dump().items():
        setattr(prop, key, value)
    db.commit()
    db.refresh(prop)

    if location_changed:
        await try_enrich_location_scores(db, prop)
    elif economic_changed and prop.location_score is not None:
        update_investment_score(db, prop)
        db.commit()
        db.refresh(prop)

    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.post("/{property_id}/recalculate-location-score")
async def recalculate_property_location_score(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_WRITE_PROPERTIES)),
):
    prop = (
        db.query(Property)
        .filter(
            Property.id == property_id,
            Property.owner_admin_id == current_user["portfolio_admin_id"],
        )
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")

    market_label = get_property_market_label(db, prop)

    try:
        await enrich_property_location_scores(prop, market_label)
        db.commit()
        db.refresh(prop)
    except OverpassUnavailableError as exc:
        db.rollback()
        logger.warning("Manual location scoring failed for property %s: %s", prop.id, exc)
        raise HTTPException(
            status_code=502,
            detail="Serviciul Overpass nu este disponibil momentan. Incearca recalcularea mai tarziu.",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.warning("Manual location scoring failed for property %s: %s", prop.id, exc)
        raise HTTPException(
            status_code=502,
            detail="Scorurile locatiei nu au putut fi recalculate momentan.",
        ) from exc

    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.delete("/{property_id}")
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(("admin",))),
):
    prop = (
        db.query(Property)
        .filter(
            Property.id == property_id,
            Property.owner_admin_id == current_user["portfolio_admin_id"],
        )
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    db.delete(prop)
    db.commit()
    return {"message": "Proprietate stearsa"}
