# GeoEstate Bucuresti, Backend

## Rulare in PyCharm

1. Deschide folderul `backend` in PyCharm.
2. Creeaza un virtual environment.
3. Ruleaza:

```bash
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

API-ul ruleaza la:

```text
http://127.0.0.1:8000
```

Documentatia Swagger:

```text
http://127.0.0.1:8000/docs
```

## Endpointuri importante

```text
GET /properties
POST /properties
GET /sectors
GET /property-types
GET /dashboard
GET /analytics/sectors
GET /price-history/{sector_id}
GET /forecast/{sector_id}
```
