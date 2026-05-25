from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.indicators_service import get_dashboard, get_sector_analytics
from app.services.forecast_service import generate_arima_forecast

router = APIRouter(tags=["analytics"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return get_dashboard(db)


@router.get("/analytics/sectors")
def sector_analytics(db: Session = Depends(get_db)):
    return get_sector_analytics(db)


@router.get("/forecast/{sector_id}")
def forecast(sector_id: int, db: Session = Depends(get_db)):
    return generate_arima_forecast(db, sector_id)
