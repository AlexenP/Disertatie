from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.models import Property, Sector

OCCUPIED_STATUSES = {"occupied", "rented", "sold"}


def get_dashboard(db: Session, portfolio_admin_id: int):
    properties = db.query(Property).filter(Property.owner_admin_id == portfolio_admin_id).all()
    if not properties:
        return {
            "total_properties": 0,
            "total_value": 0,
            "average_price_sqm": 0,
            "average_occupancy_rate": 0,
            "monthly_revenue": 0,
            "top_sector_by_price": "N/A",
            "top_sector_by_interest": "N/A",
        }

    total_value = sum(p.price for p in properties)
    monthly_revenue = sum(p.monthly_rent for p in properties if p.status in {"occupied", "rented"})
    average_price_sqm = sum(p.price_per_sqm for p in properties) / len(properties)
    average_occupancy_rate = len([p for p in properties if p.status in OCCUPIED_STATUSES]) / len(properties) * 100

    sector_price = defaultdict(list)
    sector_interest = defaultdict(int)
    sector_names = {}
    for p in properties:
        sector_names[p.sector_id] = p.sector.name
        sector_price[p.sector_id].append(p.price_per_sqm)
        sector_interest[p.sector_id] += p.interested_clients + p.views_count

    top_sector_price_id = max(sector_price, key=lambda sid: sum(sector_price[sid]) / len(sector_price[sid]))
    top_sector_interest_id = max(sector_interest, key=sector_interest.get)

    return {
        "total_properties": len(properties),
        "total_value": round(total_value, 2),
        "average_price_sqm": round(average_price_sqm, 2),
        "average_occupancy_rate": round(average_occupancy_rate, 2),
        "monthly_revenue": round(monthly_revenue, 2),
        "top_sector_by_price": sector_names[top_sector_price_id],
        "top_sector_by_interest": sector_names[top_sector_interest_id],
    }


def get_sector_analytics(db: Session, portfolio_admin_id: int):
    sectors = db.query(Sector).all()
    result = []

    def average_optional(values):
        valid_values = [value for value in values if value is not None]
        if not valid_values:
            return None
        return round(sum(valid_values) / len(valid_values), 2)

    for sector in sectors:
        props = [prop for prop in sector.properties if prop.owner_admin_id == portfolio_admin_id]
        if not props:
            continue
        result.append({
            "sector_id": sector.id,
            "sector_name": sector.name,
            "properties_count": len(props),
            "average_price_sqm": round(sum(p.price_per_sqm for p in props) / len(props), 2),
            "total_value": round(sum(p.price for p in props), 2),
            "monthly_revenue": round(sum(p.monthly_rent for p in props if p.status in {"occupied", "rented"}), 2),
            "occupancy_rate": round(len([p for p in props if p.status in OCCUPIED_STATUSES]) / len(props) * 100, 2),
            "interest_score": sum(p.interested_clients + p.views_count for p in props),
            "avg_location_score": average_optional([p.location_score for p in props]),
            "avg_investment_score": average_optional([p.investment_score for p in props]),
        })
    return result
