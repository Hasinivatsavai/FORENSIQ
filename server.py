"""Same-origin production entry point. The API routes are registered before the static mount."""
import os
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from uvicorn import run

from backend.app.main import app

static = Path(os.environ.get("FRONTEND_DIST", Path(__file__).parent / "frontend" / "dist"))
app.mount("/", StaticFiles(directory=static, html=True), name="web")

if __name__ == "__main__":
    run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")), server_header=False)
