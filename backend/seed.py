from datetime import date
from random import randint, choice, uniform, seed
from dateutil.relativedelta import relativedelta

from app.database import Base, engine, SessionLocal
from app.models.models import Role, User, Sector, PropertyType, Property, PriceHistory

seed(42)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    if db.query(Sector).count() > 0:
        print("Baza de date are deja date demo.")
        raise SystemExit

    roles = ["admin", "agent", "manager", "developer"]
    for role_name in roles:
        db.add(Role(name=role_name))
    db.commit()
    role_ids = {role.name: role.id for role in db.query(Role).all()}

    admin_demo = User(
        full_name="Administrator GeoEstate",
        email="admin@geoestate.ro",
        password_hash="admin123",
        role="admin",
        role_name="Administrator",
        role_id=role_ids["admin"],
    )
    db.add(admin_demo)
    db.flush()

    db.add_all([
        User(
            full_name="Agent Imobiliar",
            email="agent@geoestate.ro",
            password_hash="agent123",
            role="agent",
            role_name="Agent imobiliar",
            role_id=role_ids["agent"],
            admin_id=admin_demo.id,
        ),
        User(
            full_name="Manager Portofoliu",
            email="manager@geoestate.ro",
            password_hash="manager123",
            role="manager",
            role_name="Manager portofoliu",
            role_id=role_ids["manager"],
            admin_id=admin_demo.id,
        ),
        User(
            full_name="Dezvoltator Imobiliar",
            email="developer@geoestate.ro",
            password_hash="developer123",
            role="developer",
            role_name="Dezvoltator imobiliar",
            role_id=role_ids["developer"],
            admin_id=admin_demo.id,
        ),
    ])

    sectors = [
        ("Sector 1", "SEC-01", 44.4710, 26.0730),
        ("Sector 2", "SEC-02", 44.4520, 26.1400),
        ("Sector 3", "SEC-03", 44.4210, 26.1680),
        ("Sector 4", "SEC-04", 44.3860, 26.1100),
        ("Sector 5", "SEC-05", 44.4030, 26.0710),
        ("Sector 6", "SEC-06", 44.4350, 26.0270),
    ]
    for name, code, lat, lon in sectors:
        db.add(Sector(name=name, code=code, center_latitude=lat, center_longitude=lon))

    types = ["Apartament", "Garsoniera", "Casa", "Spatiu comercial", "Birou"]
    for type_name in types:
        db.add(PropertyType(name=type_name))
    db.commit()

    base_prices = {
        1: 2300,
        2: 1850,
        3: 1750,
        4: 1650,
        5: 1450,
        6: 1700,
    }

    neighborhoods = {
        1: ["Aviatiei", "Dorobanti", "Baneasa", "Victoriei", "Domenii"],
        2: ["Obor", "Iancului", "Tei", "Colentina", "Stefan cel Mare"],
        3: ["Titan", "Dristor", "Vitan", "Unirii", "Muncii"],
        4: ["Tineretului", "Berceni", "Brancoveanu", "Oltenitei", "Eroii Revolutiei"],
        5: ["Rahova", "Cotroceni", "13 Septembrie", "Ferentari", "Sebastian"],
        6: ["Militari", "Drumul Taberei", "Crangasi", "Grozavesti", "Lujerului"],
    }

    code_number = 1
    for sector_id in range(1, 7):
        sector = db.query(Sector).filter(Sector.id == sector_id).first()
        for index in range(10):
            surface = randint(35, 120)
            price_sqm = base_prices[sector_id] + randint(-220, 280)
            price = surface * price_sqm
            rent = round(price * uniform(0.0035, 0.0055), 2)
            lat = sector.center_latitude + uniform(-0.025, 0.025)
            lon = sector.center_longitude + uniform(-0.025, 0.025)
            neighborhood = choice(neighborhoods[sector_id])
            property_type_id = randint(1, 5)
            db.add(Property(
                code=f"PROP-{code_number:06d}",
                title=f"Proprietate {neighborhood} {code_number}",
                address=f"Strada Demo {code_number}, {neighborhood}, Bucuresti",
                sector_id=sector_id,
                property_type_id=property_type_id,
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                surface_sqm=surface,
                price=round(price, 2),
                monthly_rent=rent,
                status=choice(["available", "rented", "occupied", "sold"]),
                interested_clients=randint(0, 18),
                views_count=randint(10, 220),
                owner_admin_id=admin_demo.id,
            ))
            code_number += 1

    start_month = date(2024, 1, 1)
    for sector_id in range(1, 7):
        base = base_prices[sector_id]
        for month_index in range(24):
            trend = month_index * randint(4, 11)
            noise = randint(-35, 35)
            value = base + trend + noise
            db.add(PriceHistory(
                sector_id=sector_id,
                month=start_month + relativedelta(months=month_index),
                average_price_sqm=round(value, 2),
            ))

    db.commit()
    print("Date demo generate cu succes.")
finally:
    db.close()
