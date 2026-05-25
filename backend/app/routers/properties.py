from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Property
from app.schemas.schemas import PropertyCreate, PropertyUpdate
from app.services.market_service import (
    classify_property_against_market,
    get_latest_sector_market_averages,
)

router = APIRouter(prefix="/properties", tags=["properties"])
VALID_STATUSES = {"available", "occupied", "sold", "rented", "inactive"}


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
        "created_at": p.created_at,
        "price_per_sqm": p.price_per_sqm,
        **market_data,
        "sector_name": p.sector.name if p.sector else None,
        "property_type_name": p.property_type.name if p.property_type else None,
    }


@router.get("")
def list_properties(sector_id: int | None = None, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Property)
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
def create_property(payload: PropertyCreate, db: Session = Depends(get_db)):
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

    prop = Property(code=f"PROP-{next_id:06d}", **payload.model_dump())

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
    return serialize_property(prop, market_average)


@router.get("/{property_id}")
def get_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.put("/{property_id}")
def update_property(property_id: int, payload: PropertyUpdate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status invalid")
    for key, value in payload.model_dump().items():
        setattr(prop, key, value)
    db.commit()
    db.refresh(prop)
    market_average = get_latest_sector_market_averages(db, [prop.sector_id]).get(prop.sector_id)
    return serialize_property(prop, market_average)


@router.delete("/{property_id}")
def delete_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proprietatea nu exista")
    db.delete(prop)
    db.commit()
    return {"message": "Proprietate stearsa"}
