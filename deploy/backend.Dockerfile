FROM python:3.13-slim
RUN pip install --no-cache-dir uv==0.12.7 && useradd --uid 10001 --create-home app
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --python 3.13
COPY backend/app ./app
COPY shared /app/shared
COPY deploy/backend-entrypoint.py /app/entrypoint.py
USER 10001
EXPOSE 8000
CMD ["/app/backend/.venv/bin/python", "/app/entrypoint.py"]
