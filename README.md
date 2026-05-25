# GeoEstate Bucuresti

GeoEstate Bucuresti este o platforma web GIS pentru analiza geospatiala si economica a proprietatilor imobiliare din Bucuresti. Aplicatia permite administrarea proprietatilor, vizualizarea lor pe harta, analiza pietei pe sectoare si generarea de indicatori economici folositi in documentatia proiectului de disertatie.

## Stack Tehnologic

- Backend: Python, FastAPI, SQLAlchemy
- Baza de date: SQLite local
- Frontend: Next.js, TypeScript, React, Tailwind CSS
- GIS si vizualizare: Leaflet, OpenStreetMap
- Grafice si analiza: Recharts, pandas, statsmodels
- Rapoarte: openpyxl pentru export Excel

## Rulare Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

Backend-ul porneste implicit la:

```text
http://127.0.0.1:8000
```

Documentatia Swagger este disponibila la:

```text
http://127.0.0.1:8000/docs
```

## Rulare Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend-ul porneste implicit la:

```text
http://localhost:3000
```

Pagina de autentificare:

```text
http://localhost:3000/login
```

## Conturi Demo

```text
admin@geoestate.ro / admin123
agent@geoestate.ro / agent123
manager@geoestate.ro / manager123
developer@geoestate.ro / developer123
```

## Functionalitati Principale

- login demo pe roluri
- CRUD pentru proprietati imobiliare
- harta interactiva cu marker-e pentru proprietati
- adaugare proprietate direct din harta prin click dreapta
- clasificarea proprietatilor fata de pretul mediu al pietei pe sector
- dashboard economic pentru portofoliul imobiliar
- analiza pe sectoare
- istoric pret/mp pe sectoare
- previziuni ARIMA
- indicator RSI pe seria de preturi
- export Excel pentru raportul de proprietati
- endpoint de health check pentru verificarea aplicatiei

## Linkuri Locale Utile

```text
http://127.0.0.1:8000/docs
http://localhost:3000/login
http://127.0.0.1:8000/health
http://127.0.0.1:8000/reports/properties/excel
```

## Activitati De Intretinere

### Backup Baza De Date SQLite

Baza de date locala este fisierul `backend/geoestate_bucuresti.db`. Pentru backup, opreste serverul backend si copiaza fisierul intr-un director de arhiva:

```bash
copy backend\geoestate_bucuresti.db backups\geoestate_bucuresti_backup.db
```

### Verificare Dependinte

Backend:

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
npm run build
```

### Testare Endpoint /health

```bash
curl http://127.0.0.1:8000/health
```

Raspuns asteptat:

```json
{
  "status": "ok",
  "database": "connected",
  "app": "GeoEstate Bucuresti"
}
```

### Regenerare Date Demo Prin seed.py

Scriptul `seed.py` insereaza date demo daca baza de date este goala. Pentru regenerare completa, opreste backend-ul, pastreaza un backup daca este nevoie, sterge fisierul SQLite si ruleaza din nou seed-ul:

```bash
cd backend
del geoestate_bucuresti.db
python seed.py
```

### Verificare Functionalitati Dupa Modificari

- porneste backend-ul si frontend-ul
- verifica autentificarea pe `http://localhost:3000/login`
- verifica incarcarea listei `/properties`
- testeaza adaugarea, editarea si stergerea unei proprietati
- verifica harta si adaugarea prin click dreapta
- descarca raportul Excel din pagina de proprietati
- testeaza `http://127.0.0.1:8000/health`
- ruleaza `npm run build` pentru validarea frontend-ului
