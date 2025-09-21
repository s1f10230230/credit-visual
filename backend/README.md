# Subscan Backend

FastAPI based backend service for parsing credit card statements and providing dashboards.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

The API is available under `http://localhost:8000/api`.

## Next steps

- Implement extractor plugins under `app/services/extractor/`
- Wire import endpoints to the parser pipeline
- Add database models / migrations (SQLAlchemy + Alembic)
- Implement subscription detection in `app/services/subscription/`
