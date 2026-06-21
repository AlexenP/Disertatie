from pydantic import BaseModel, Field, EmailStr
from datetime import date, datetime
from typing import Optional


class SectorRead(BaseModel):
    id: int
    name: str
    code: str
    center_latitude: float
    center_longitude: float

    class Config:
        from_attributes = True


class PropertyTypeRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class PropertyCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    address: str = Field(min_length=3, max_length=250)
    sector_id: int
    property_type_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    surface_sqm: float = Field(gt=0)
    price: float = Field(gt=0)
    monthly_rent: float = Field(ge=0)
    status: str
    interested_clients: int = Field(ge=0, default=0)
    views_count: int = Field(ge=0, default=0)


class PropertyUpdate(PropertyCreate):
    pass


class PropertyRead(BaseModel):
    id: int
    code: str
    title: str
    address: str
    sector_id: int
    property_type_id: int
    latitude: float
    longitude: float
    surface_sqm: float
    price: float
    monthly_rent: float
    status: str
    interested_clients: int
    views_count: int
    created_at: datetime
    price_per_sqm: float
    price_sqm: float
    market_average_sqm: Optional[float] = None
    market_difference_percent: Optional[float] = None
    market_label: str
    accessibility_score: Optional[float] = None
    facilities_score: Optional[float] = None
    location_score: Optional[float] = None
    investment_score: Optional[float] = None
    poi_metro_count: int = 0
    poi_transport_count: int = 0
    poi_education_count: int = 0
    poi_health_count: int = 0
    poi_pharmacy_count: int = 0
    poi_green_count: int = 0
    poi_commercial_count: int = 0
    nearest_metro_m: Optional[float] = None
    nearest_transport_m: Optional[float] = None
    nearest_school_m: Optional[float] = None
    nearest_health_m: Optional[float] = None
    nearest_green_m: Optional[float] = None
    nearest_commercial_m: Optional[float] = None
    poi_summary_json: Optional[str] = None
    poi_last_updated_at: Optional[datetime] = None
    sector_name: Optional[str] = None
    property_type_name: Optional[str] = None

    class Config:
        from_attributes = True


class PriceHistoryRead(BaseModel):
    month: date
    average_price_sqm: float

    class Config:
        from_attributes = True


class ForecastRead(BaseModel):
    forecast_month: date
    predicted_price_sqm: float
    model_name: str

    class Config:
        from_attributes = True


class DashboardRead(BaseModel):
    total_properties: int
    total_value: float
    average_price_sqm: float
    average_occupancy_rate: float
    monthly_revenue: float
    top_sector_by_price: str
    top_sector_by_interest: str


class SectorAnalyticsRead(BaseModel):
    sector_id: int
    sector_name: str
    properties_count: int
    average_price_sqm: float
    total_value: float
    monthly_revenue: float
    occupancy_rate: float
    interest_score: int
    avg_location_score: Optional[float] = None
    avg_investment_score: Optional[float] = None
