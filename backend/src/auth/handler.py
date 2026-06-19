import json

from common.db import (
    get_user_by_sub,
    get_user,
    update_user,
    transact_set_username,
    transact_change_username,
    generate_user_id,
)
from common.dto import (
    SignupRequest,
    SignupResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangeUsernameRequest,
    ErrorResponse,
)


def lambda_handler(event, context):
    route_key = event.get("routeKey", "")

    if route_key == "POST /auth/signup":
        return handle_signup(event)
    if route_key == "GET /auth/me":
        return handle_get_me(event)
    if route_key == "PUT /auth/me":
        return handle_update_me(event)
    if route_key == "PUT /auth/me/username":
        return handle_change_username(event)

    return ErrorResponse("Not Found", f"No route matched: {route_key}", 404).to_lambda_response()


def _get_claims(event) -> dict | None:
    try:
        return event["requestContext"]["authorizer"]["jwt"]["claims"]
    except KeyError:
        return None


def _parse_body(event) -> tuple[dict | None, str | None]:
    try:
        return json.loads(event.get("body", "{}")), None
    except json.JSONDecodeError:
        return None, "Invalid JSON body"


def _username_valid(username: str) -> str | None:
    if not username or len(username) < 3:
        return "Username must be at least 3 characters"
    if not username.isalnum() and "_" not in username:
        return "Username must contain only letters, numbers, and underscores"
    return None


def handle_signup(event):
    claims = _get_claims(event)
    if not claims:
        return ErrorResponse("Unauthorized", "Missing JWT", 401).to_lambda_response()

    sub = claims.get("sub")
    email = claims.get("email")

    body, err = _parse_body(event)
    if err:
        return ErrorResponse("Bad Request", err, 400).to_lambda_response()

    req = SignupRequest.from_dict(body)
    username = req.username.strip()

    err = _username_valid(username)
    if err:
        return ErrorResponse("Bad Request", err, 400).to_lambda_response()

    username_lower = username.lower()
    user = get_user_by_sub(sub)

    if not user:
        user_id = generate_user_id()
        result = transact_set_username(user_id, username, username_lower, sub=sub, email=email)
        if not result:
            return ErrorResponse("Conflict", "Username already taken", 409).to_lambda_response()
        return SignupResponse(user_id=user_id, username=username, email=email).to_lambda_response()

    if user.get("username"):
        return ErrorResponse("Conflict", "Username already set", 409).to_lambda_response()

    result = transact_set_username(user["user_id"], username, username_lower, sub=sub, email=email)
    if not result:
        return ErrorResponse("Conflict", "Username already taken", 409).to_lambda_response()

    return SignupResponse(user_id=user["user_id"], username=username, email=email).to_lambda_response()


def handle_get_me(event):
    claims = _get_claims(event)
    if not claims:
        return ErrorResponse("Unauthorized", "Missing JWT", 401).to_lambda_response()

    sub = claims.get("sub")
    user = get_user_by_sub(sub)
    if not user:
        return ErrorResponse("Not Found", "User not found", 404).to_lambda_response()

    return UserResponse.from_dict(user).to_lambda_response()


def handle_update_me(event):
    claims = _get_claims(event)
    if not claims:
        return ErrorResponse("Unauthorized", "Missing JWT", 401).to_lambda_response()

    sub = claims.get("sub")
    user = get_user_by_sub(sub)
    if not user:
        return ErrorResponse("Not Found", "User not found", 404).to_lambda_response()

    body, err = _parse_body(event)
    if err:
        return ErrorResponse("Bad Request", err, 400).to_lambda_response()

    req = UpdateProfileRequest.from_dict(body)
    updates = {k: v for k, v in req.to_dict().items() if v is not None}

    if not updates:
        return ErrorResponse("Bad Request", "No fields to update", 400).to_lambda_response()

    updated = update_user(user["user_id"], updates)
    if not updated:
        return ErrorResponse("Internal Error", "Failed to update user", 500).to_lambda_response()

    return UserResponse.from_dict(updated).to_lambda_response()


def handle_change_username(event):
    claims = _get_claims(event)
    if not claims:
        return ErrorResponse("Unauthorized", "Missing JWT", 401).to_lambda_response()

    sub = claims.get("sub")
    user = get_user_by_sub(sub)
    if not user:
        return ErrorResponse("Not Found", "User not found", 404).to_lambda_response()

    body, err = _parse_body(event)
    if err:
        return ErrorResponse("Bad Request", err, 400).to_lambda_response()

    req = ChangeUsernameRequest.from_dict(body)
    new_username = req.new_username.strip()

    err = _username_valid(new_username)
    if err:
        return ErrorResponse("Bad Request", err, 400).to_lambda_response()

    old_lower = user.get("username_lower", "")
    new_lower = new_username.lower()

    if old_lower == new_lower:
        return ErrorResponse("Bad Request", "New username is the same as current", 400).to_lambda_response()

    success = transact_change_username(old_lower, new_lower, new_username, user["user_id"])
    if not success:
        return ErrorResponse("Conflict", "Username already taken", 409).to_lambda_response()

    updated = get_user(user["user_id"])
    if not updated:
        return ErrorResponse("Internal Error", "Failed to retrieve user after update", 500).to_lambda_response()

    return UserResponse.from_dict(updated).to_lambda_response()
