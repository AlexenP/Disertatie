# GeoEstate Bucuresti

Aplicatie web pentru analiza geospatiala si economica a proprietatilor imobiliare din Bucuresti.

## Module

- backend FastAPI
- frontend Next.js
- baza de date locala SQLite pentru pornire rapida
- structura pregatita pentru PostgreSQL + PostGIS

## Rulare backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

## Rulare frontend

```bash
cd frontend
npm install
npm run dev
```

## URL-uri

Backend:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

Frontend:

```text
http://localhost:3000
```

## Ce contine MVP-ul

1. Proprietati demo pentru Bucuresti.
2. Date pe cele 6 sectoare.
3. Dashboard economic.
4. Harta interactiva cu marker pentru proprietati.
5. Analiza pe sectoare.
6. Istoric pret/mp.
7. Forecast ARIMA pentru Sector 1.
8. RSI calculat pe seria de pret.
