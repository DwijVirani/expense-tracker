"""Extract verified Cognito claims forwarded by API Gateway and resolve to
a Mongo user doc, creating one on first login (JIT provisioning)."""

import base64
import json

from fastapi import HTTPException, Request, status

from app import db


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload without verifying signature (local dev only).
    In prod, API Gateway's Cognito authorizer has already verified the token."""
    try:
        payload_b64 = token.split(".")[1]
        # Add padding if needed
        payload_b64 += "=" * (-len(payload_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return {}


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
        # Local dev: decode JWT from Authorization header (no sig check needed —
        # API GW verifies in prod; this path never runs behind API GW).
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            payload = _decode_jwt_payload(auth_header[7:])
            sub = payload.get("sub")
            email = payload.get("email")

    if not sub:
        # Last resort: explicit dev headers for curl/seed user testing.
        sub = request.headers.get("X-Dev-Sub")
        email = request.headers.get("X-Dev-Email", "dev@local")

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return await db.get_or_create_user(sub, email or "")
