import json
from dataclasses import dataclass, fields
from typing import Any, Optional


def _to_dict(obj) -> dict[str, Any]:
    result = {}
    for f in fields(obj):
        value = getattr(obj, f.name)
        if value is not None:
            result[f.name] = value
    return result


def _from_dict(cls, data: dict) -> Any:
    kwargs = {}
    for f in fields(cls):
        if f.name in data:
            kwargs[f.name] = data[f.name]
    return cls(**kwargs)


@dataclass
class ApiResponse:
    statusCode: int = 200
    headers: Optional[dict] = None

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class ErrorResponse:
    error: str
    message: str
    statusCode: int = 400

    def to_dict(self) -> dict:
        return _to_dict(self)

    def to_lambda_response(self) -> dict:
        return {
            "statusCode": self.statusCode,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": self.error, "message": self.message}),
        }
