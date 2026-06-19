import json
from dataclasses import dataclass
from typing import Optional

from .base import _to_dict, _from_dict


@dataclass
class SignupRequest:
    username: str

    @classmethod
    def from_dict(cls, data: dict) -> "SignupRequest":
        return _from_dict(cls, data)


@dataclass
class SignupResponse:
    user_id: str
    username: str
    email: str

    def to_dict(self) -> dict:
        return _to_dict(self)

    def to_lambda_response(self) -> dict:
        return {
            "statusCode": 201,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(self.to_dict()),
        }


@dataclass
class UserResponse:
    user_id: str
    sub: str
    email: str
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "UserResponse":
        return _from_dict(cls, data)

    def to_dict(self) -> dict:
        return _to_dict(self)

    def to_lambda_response(self) -> dict:
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(self.to_dict()),
        }


@dataclass
class UpdateProfileRequest:
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "UpdateProfileRequest":
        return _from_dict(cls, data)

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class ChangeUsernameRequest:
    new_username: str

    @classmethod
    def from_dict(cls, data: dict) -> "ChangeUsernameRequest":
        return _from_dict(cls, data)
