# Backend (FastAPI)

This backend provides API endpoints for:
- Submitting daily survey results (per class, per day)
- Fetching current standings (per group)

## Setup
1. Ensure Python 3.8+ is installed
2. (Recommended) Use a virtual environment
3. Install dependencies:
   ```
pip install -r requirements.txt
   ```
4. Run the server:
   ```
uvicorn main:app --reload
   ```

## Endpoints (to be implemented)
- `POST /survey` — Submit daily results
- `GET /standings` — Get current leaders per group
