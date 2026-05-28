from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.indicators_service import get_dashboard, get_sector_analytics
from app.services.forecast_service import generate_arima_forecast
from app.security import require_roles

router = APIRouter(tags=["analytics"])
CAN_VIEW_ANALYTICS = ("admin", "manager", "developer")


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return get_dashboard(db)


@router.get("/analytics/sectors")
def sector_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return get_sector_analytics(db)


@router.get("/forecast/{sector_id}")
def forecast(
    sector_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return generate_arima_forecast(db, sector_id)
