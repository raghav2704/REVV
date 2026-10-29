# REVV 🚗

**Drive Smarter. Buy Better.**

REVV is a full-stack automotive marketplace prototype built for the New Zealand market. It aims to make buying, selling and comparing vehicles simpler, with future plans for data-driven pricing insights and AI-assisted valuations.

> **Project status:** Actively in development. Current listings are demonstration/test data; REVV is not yet a public marketplace. AI valuations, dealership trade-in estimates, authentication and seller messaging are planned features, not live services.

## Features implemented

- **Vehicle marketplace:** browse listings from a PostgreSQL database.
- **Search and filters:** search by make, model or year; filter by price and location; sort results.
- **Vehicle detail pages:** dynamic routes for vehicle specifications, asking price and location.
- **Sell Your Car:** create a demonstration listing using the web form and REST API.
- **Vehicle photography:** select and preview multiple photos, choose the cover photo before submission, upload to FastAPI and view the resulting gallery.
- **Image storage:** local image files with metadata stored in PostgreSQL.
- **Responsive interface:** Next.js and Tailwind CSS, including a cinematic REVV homepage.
- **API documentation:** interactive FastAPI documentation through Swagger UI.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Database | PostgreSQL 17, SQLAlchemy, Psycopg |
| Image handling | Pillow, multipart uploads, local development storage |
| Development | Git, GitHub, VS Code, macOS |

## Project structure

```text
REVV/
├── backend/
│   ├── app/
│   │   ├── main.py              # REST API and upload endpoints
│   │   ├── database.py          # SQLAlchemy connection
│   │   └── models/              # Vehicle and VehicleImage models
│   ├── seed.py                  # Demo database records
│   ├── requirements.txt
│   └── uploads/                 # Local uploaded images (not committed)
├── frontend/
│   ├── public/                  # Static assets
│   └── src/
│       ├── app/                 # Home, sell and vehicle detail routes
│       └── components/          # Search, gallery, sell form, navbar, footer
├── docs/
└── README.md
```

## Run locally

**Prerequisites:** Node.js, npm, Python 3.13+, PostgreSQL 17 and Git. These instructions describe the current local macOS development workflow.

### 1. Start PostgreSQL

If installed through Homebrew:

```bash
brew services start postgresql@17
createdb revv_db  # Run once; skip if the database already exists
```

Ensure PostgreSQL's command-line tools are on your `PATH` if `psql` is not found.

### 2. Start the backend

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

The current local database connection defaults to `postgresql+psycopg://localhost/revv_db`. For other environments, supply a `DATABASE_URL` environment variable (do not commit credentials).

Create the tables and add demo vehicles once:

```bash
python seed.py
```

Start FastAPI:

```bash
python -m uvicorn app.main:app --reload --reload-dir app --port 8000
```

- API: <http://127.0.0.1:8000/api/v1/cars>
- Interactive API docs: <http://127.0.0.1:8000/docs>

### 3. Start the frontend

In a **second terminal**, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

> The frontend currently connects to FastAPI at `http://127.0.0.1:8000`. Both development servers must be running.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check |
| `GET` | `/api/v1/cars` | List vehicles |
| `GET` | `/api/v1/cars/{car_id}` | Vehicle details |
| `POST` | `/api/v1/cars` | Create a demo vehicle |
| `GET` | `/api/v1/cars/{car_id}/images` | Get vehicle image metadata |
| `POST` | `/api/v1/cars/{car_id}/images` | Upload vehicle photos |
| `GET` | `/uploads/vehicles/{filename}` | Serve locally stored vehicle photos |

### Example: create a demonstration listing

```bash
curl -X POST 'http://127.0.0.1:8000/api/v1/cars' \
  -H 'Content-Type: application/json' \
  -d '{"make":"Toyota","model":"Prius","year":2017,"price_nzd":20000,"mileage_km":50000,"location":"Auckland"}'
```

Each successful request creates a new record; don't repeatedly execute the example unless you intend to add another demo listing.

## REVV Intelligence — planned

The long-term goal is a condition-aware valuation experience that can estimate:

- **Private-sale value** based on relevant New Zealand market comparables.
- **Dealership trade-in value** based on actual dealer offer data and appropriate adjustments.
- **Dealer retail value** as a separate market estimate.
- **Photo condition insights** that highlight possible visible wear or damage for user confirmation.

The valuation system will require appropriately licensed or permissioned pricing data, robust testing against real sales/dealer offers and clear confidence ranges. Photos alone cannot produce an accurate valuation. **These AI features are not implemented yet.**

## Roadmap

- [x] Next.js frontend and FastAPI backend
- [x] PostgreSQL vehicle records
- [x] Marketplace search, sorting and filters
- [x] Dynamic vehicle detail pages
- [x] Demo listing creation
- [x] Vehicle photo upload and display
- [ ] Authentication and user/seller accounts
- [ ] Authorised listing edits, deletion and image management
- [ ] Seller messaging and enquiries
- [ ] Dealership profiles and inventory management
- [ ] Vehicle comparison, watchlists and price history
- [ ] NZ market data ingestion and valuation model evaluation
- [ ] AI-assisted photo condition analysis and trade-in estimates
- [ ] Deployment, monitoring and production security hardening

## Development and security notes

This is an early-stage prototype. Listing creation and image uploads currently lack production-grade authentication and authorisation. Image files are stored on the local backend, not in durable cloud object storage. **Do not expose these development endpoints publicly as-is.** Add ownership checks, rate limits, secure storage, migrations, monitoring and appropriate privacy controls before launch.

Do not commit `.env` files, API keys, virtual environments, local uploads, generated build files or database dumps.

## Author

Built by **Raghav Bhalla** as an independent full-stack software engineering and AI-focused project.

---

**REVV — Drive Smarter. Buy Better.**
