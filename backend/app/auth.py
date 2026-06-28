"""Extract verified Cognito claims forwarded by API Gateway and resolve to
a Mongo user doc, creating one on first login (JIT provisioning)."""

from fastapi import HTTPException, Request, status

from app import db


async def get_current_user(request: Request) -> dict:
    # API Gateway Cognito authorizer injects claims into the Lambda event under
    # requestContext.authorizer.claims. Mangum exposes the raw event via scope.
    event: dict = request.scope.get("aws.event", {})
    claims: dict = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )

    sub: str | None = claims.get("sub")
    email: str | None = claims.get("email")

    if not sub:
        # Fallback for local dev: read from a header (never trusted in prod
        # since API GW strips arbitrary headers before Lambda).
        sub = request.headers.get("X-Dev-Sub")
        email = request.headers.get("X-Dev-Email", "dev@local")

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return await db.get_or_create_user(sub, email or "")
