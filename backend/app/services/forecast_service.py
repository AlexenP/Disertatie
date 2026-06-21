from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from statsmodels.tsa.arima.model import ARIMA
from app.models.models import PriceHistory, Sector


def calculate_rsi(values: list[float], period: int = 14) -> float:
    if len(values) <= period:
        return 50.0
    gains = []
    losses = []
    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def generate_arima_forecast(db: Session, sector_id: int, months: int = 6):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    sector_name = sector.name if sector else f"Sector {sector_id}"
    history = (
        db.query(PriceHistory)
        .filter(PriceHistory.sector_id == sector_id)
        .order_by(PriceHistory.month.asc())
        .all()
    )
    values = [h.average_price_sqm for h in history]
    if len(values) < 6:
        return {
            "sector_id": sector_id,
            "sector_name": sector_name,
            "rsi": calculate_rsi(values),
            "forecast": [],
        }

    try:
        model = ARIMA(values, order=(1, 1, 1))
        fitted = model.fit()
        predictions = fitted.forecast(steps=months)
    except Exception:
        last_value = values[-1]
        predictions = [last_value for _ in range(months)]

    last_month = history[-1].month
    forecast = []
    for index, predicted_value in enumerate(predictions, start=1):
        forecast.append({
            "forecast_month": last_month + relativedelta(months=index),
            "predicted_price_sqm": round(float(predicted_value), 2),
            "model_name": "ARIMA(1,1,1)",
        })

    return {
        "sector_id": sector_id,
        "sector_name": sector_name,
        "rsi": calculate_rsi(values),
        "forecast": forecast,
    }
