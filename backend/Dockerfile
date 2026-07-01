# Production image — AWS Lambda container (used by infra/infra/api_stack.py
# via DockerImageAsset/DockerImageFunction). For local dev, see Dockerfile.dev
# (plain uvicorn server, used by docker-compose.yml).
FROM public.ecr.aws/lambda/python:3.12

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock* ./

# Resolve locked runtime deps (exclude dev group) and install into the Lambda
# task root — the Lambda Python base image runs on system pip, not a venv.
RUN uv export --frozen --no-dev --no-emit-project -o requirements.txt \
    && pip install --no-cache-dir -r requirements.txt -t "${LAMBDA_TASK_ROOT}"

# Copy source
COPY app/ ${LAMBDA_TASK_ROOT}/app/

CMD ["app.main.handler"]
