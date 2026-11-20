FROM node:22-alpine AS frontend
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV FORENSIQ_DB_PATH=/service/data/forensiq.sqlite3 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_DISABLE_PIP_VERSION_CHECK=1 FRONTEND_DIST=/service/web PYTHONPATH=/service/backend PORT=8080
WORKDIR /service
COPY backend/requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 forensiq && install -d -m 0700 -o forensiq -g forensiq /service/data
COPY backend/app/ backend/app/
COPY backend/migrations/ backend/migrations/
COPY server.py .
COPY --from=frontend /ui/dist/ web/
USER forensiq
EXPOSE 8080
CMD ["python", "server.py"]
