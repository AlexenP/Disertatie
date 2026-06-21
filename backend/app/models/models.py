from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    users = relationship("User", back_populates="role_record")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="admin")
    role_name = Column(String, nullable=False, default="Administrator")
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    role_record = relationship("Role", back_populates="users")
    admin = relationship("User", remote_side=[id])


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    center_latitude = Column(Float, nullable=False)
    center_longitude = Column(Float, nullable=False)

    properties = relationship("Property", back_populates="sector")
    price_history = relationship("PriceHistory", back_populates="sector")
    forecasts = relationship("Forecast", back_populates="sector")


class PropertyType(Base):
    __tablename__ = "property_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    properties = relationship("Property", back_populates="property_type")


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    address = Column(String, nullable=False)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=False)
    property_type_id = Column(Integer, ForeignKey("property_types.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    surface_sqm = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    monthly_rent = Column(Float, nullable=False, default=0)
    status = Column(String, nullable=False, default="available")
    interested_clients = Column(Integer, nullable=False, default=0)
    views_count = Column(Integer, nullable=False, default=0)
    owner_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accessibility_score = Column(Float, nullable=True)
    facilities_score = Column(Float, nullable=True)
    location_score = Column(Float, nullable=True)
    investment_score = Column(Float, nullable=True)
    poi_metro_count = Column(Integer, default=0)
    poi_transport_count = Column(Integer, default=0)
    poi_education_count = Column(Integer, default=0)
    poi_health_count = Column(Integer, default=0)
    poi_pharmacy_count = Column(Integer, default=0)
    poi_green_count = Column(Integer, default=0)
    poi_commercial_count = Column(Integer, default=0)
    nearest_metro_m = Column(Float, nullable=True)
    nearest_transport_m = Column(Float, nullable=True)
    nearest_school_m = Column(Float, nullable=True)
    nearest_health_m = Column(Float, nullable=True)
    nearest_green_m = Column(Float, nullable=True)
    nearest_commercial_m = Column(Float, nullable=True)
    poi_summary_json = Column(Text, nullable=True)
    poi_last_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sector = relationship("Sector", back_populates="properties")
    property_type = relationship("PropertyType", back_populates="properties")
    owner_admin = relationship("User")

    @property
    def price_per_sqm(self) -> float:
        if not self.surface_sqm:
            return 0
        return round(self.price / self.surface_sqm, 2)


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    budget_min = Column(Float, nullable=False, default=0)
    budget_max = Column(Float, nullable=False, default=0)
    preferred_sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=True)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=False)
    month = Column(Date, nullable=False)
    average_price_sqm = Column(Float, nullable=False)

    sector = relationship("Sector", back_populates="price_history")


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=False)
    forecast_month = Column(Date, nullable=False)
    predicted_price_sqm = Column(Float, nullable=False)
    model_name = Column(String, nullable=False, default="ARIMA")
    created_at = Column(DateTime, default=datetime.utcnow)

    sector = relationship("Sector", back_populates="forecasts")
