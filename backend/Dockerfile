FROM python:3.12-slim
ENV FORENSIQ_DB_PATH=/service/data/forensiq.sqlite3 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /service
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 forensiq && install -d -m 0700 -o forensiq -g forensiq /service/data
COPY app/ app/
COPY migrations/ migrations/
USER forensiq
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--no-server-header"]
