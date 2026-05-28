from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Sector, PropertyType, PriceHistory
from app.security import require_roles

router = APIRouter(tags=["nomenclatoare"])
CAN_VIEW_ANALYTICS = ("admin", "manager", "developer")


@router.get("/sectors")
def list_sectors(db: Session = Depends(get_db)):
    return db.query(Sector).order_by(Sector.id.asc()).all()


@router.get("/property-types")
def list_property_types(db: Session = Depends(get_db)):
    return db.query(PropertyType).order_by(PropertyType.id.asc()).all()


@router.get("/price-history/{sector_id}")
def price_history(
    sector_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return db.query(PriceHistory).filter(PriceHistory.sector_id == sector_id).order_by(PriceHistory.month.asc()).all()
