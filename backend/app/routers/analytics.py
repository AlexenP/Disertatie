from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Property
from app.services.indicators_service import get_dashboard, get_sector_analytics
from app.services.forecast_service import generate_arima_forecast
from app.security import get_current_user, require_roles

router = APIRouter(tags=["analytics"])
CAN_VIEW_ANALYTICS = ("admin", "manager", "developer")
HEATMAP_METRICS = {
    "location_score",
    "accessibility_score",
    "facilities_score",
    "investment_score",
}


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return get_dashboard(db, current_user["portfolio_admin_id"])


@router.get("/analytics/sectors")
def sector_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return get_sector_analytics(db, current_user["portfolio_admin_id"])


@router.get("/analytics/heatmap")
def heatmap(
    metric: str = "location_score",
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if metric not in HEATMAP_METRICS:
        raise HTTPException(
            status_code=400,
            detail="Metric invalid pentru heatmap.",
        )

    properties = (
        db.query(Property)
        .filter(Property.owner_admin_id == current_user["portfolio_admin_id"])
        .filter(Property.latitude.isnot(None), Property.longitude.isnot(None))
        .all()
    )

    points = []

    for prop in properties:
        value = getattr(prop, metric, None)

        if value is None:
            continue

        points.append(
            {
                "property_id": prop.id,
                "title": prop.title,
                "latitude": prop.latitude,
                "longitude": prop.longitude,
                "value": float(value),
                "metric": metric,
            }
        )

    return points


@router.get("/forecast/{sector_id}")
def forecast(
    sector_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(CAN_VIEW_ANALYTICS)),
):
    return generate_arima_forecast(db, sector_id)
