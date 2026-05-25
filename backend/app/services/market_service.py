from sqlalchemy.orm import Session

from app.models.models import PriceHistory, Property


MARKET_LABEL_UNDER = "sub_piata"
MARKET_LABEL_AT = "la_piata"
MARKET_LABEL_OVER = "peste_piata"


def get_latest_sector_market_averages(db: Session, sector_ids: list[int] | None = None) -> dict[int, float]:
    query = db.query(PriceHistory)

    if sector_ids:
        query = query.filter(PriceHistory.sector_id.in_(sector_ids))

    history_rows = query.order_by(
        PriceHistory.sector_id.asc(),
        PriceHistory.month.desc(),
    ).all()

    averages: dict[int, float] = {}
    for row in history_rows:
        if row.sector_id not in averages:
            averages[row.sector_id] = row.average_price_sqm

    return averages


def classify_property_against_market(
    property_item: Property,
    market_average_sqm: float | None,
) -> dict[str, float | str | None]:
    price_sqm = property_item.price_per_sqm

    if not market_average_sqm or market_average_sqm <= 0:
        return {
            "price_sqm": price_sqm,
            "market_average_sqm": None,
            "market_difference_percent": None,
            "market_label": MARKET_LABEL_AT,
        }

    market_difference_percent = round(
        ((price_sqm - market_average_sqm) / market_average_sqm) * 100,
        2,
    )

    if price_sqm < market_average_sqm * 0.90:
        market_label = MARKET_LABEL_UNDER
    elif price_sqm > market_average_sqm * 1.10:
        market_label = MARKET_LABEL_OVER
    else:
        market_label = MARKET_LABEL_AT

    return {
        "price_sqm": price_sqm,
        "market_average_sqm": round(market_average_sqm, 2),
        "market_difference_percent": market_difference_percent,
        "market_label": market_label,
    }
