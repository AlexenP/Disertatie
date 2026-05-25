from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import Base, engine
from app.routers import properties, reports, sectors, analytics
from app.models import models
from app.routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="GeoEstate Bucuresti API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties.router)
app.include_router(reports.router)
app.include_router(sectors.router)
app.include_router(analytics.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": "GeoEstate Bucuresti API ruleaza"}


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "database": "disconnected",
                "app": "GeoEstate Bucuresti",
            },
        ) from exc

    return {
        "status": "ok",
        "database": "connected",
        "app": "GeoEstate Bucuresti",
    }
