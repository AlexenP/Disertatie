from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import properties, sectors, analytics
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
app.include_router(sectors.router)
app.include_router(analytics.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": "GeoEstate Bucuresti API ruleaza"}
