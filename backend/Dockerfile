FROM python:3.11-slim AS builder

RUN pip install poetry==1.8.1

RUN poetry config virtualenvs.create false

WORKDIR /code

COPY ./pyproject.toml ./README.md ./poetry.lock* ./


RUN poetry install --no-interaction --no-ansi --no-root --without dev

## Second stage to build the final image with a smaller image size

# Using alpine image to reduce the image size further
# Alternatively, you can use python:3.11-slim with a slightly larger image size
FROM python:3.11-slim

# Copy the dependencies from the builder image
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /code

COPY ./app ./app
COPY ./esco_search ./esco_search

EXPOSE 8080

CMD exec uvicorn app.server:app --host 0.0.0.0 --port 8080