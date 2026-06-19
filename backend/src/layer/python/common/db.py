import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

TABLE_NAME = "0shared_data"

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def generate_user_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_user_by_sub(sub: str) -> dict | None:
    response = table.query(
        IndexName="SubIndex",
        KeyConditionExpression="sub = :sub",
        ExpressionAttributeValues={":sub": sub},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def get_user(user_id: str) -> dict | None:
    response = table.get_item(
        Key={"PK": f"USER#{user_id}", "SK": "USER#PROFILE"}
    )
    return response.get("Item")


def create_user(user_id: str, sub: str, email: str) -> dict:
    now = now_iso()
    item = {
        "PK": f"USER#{user_id}",
        "SK": "USER#PROFILE",
        "user_id": user_id,
        "sub": sub,
        "email": email,
        "created_at": now,
        "updated_at": now,
    }
    table.put_item(Item=item)
    return item


def update_user(user_id: str, updates: dict) -> dict | None:
    keys = list(updates.keys())
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in keys)
    expr += ", #updated_at = :now"
    names = {f"#{k}": k for k in keys}
    names["#updated_at"] = "updated_at"
    values = {f":{k}": v for k, v in updates.items()}
    values[":now"] = now_iso()
    table.update_item(
        Key={"PK": f"USER#{user_id}", "SK": "USER#PROFILE"},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return get_user(user_id)


def transact_set_username(user_id: str, username: str, username_lower: str, sub: str = "", email: str = "") -> bool:
    client = boto3.client("dynamodb")
    now = now_iso()

    set_parts = ["#username = :un", "#username_lower = :ul", "#updated_at = :now"]
    names = {
        "#username": "username",
        "#username_lower": "username_lower",
        "#updated_at": "updated_at",
    }
    values = {
        ":un": {"S": username},
        ":ul": {"S": username_lower},
        ":now": {"S": now},
    }

    if sub:
        set_parts.append("#user_id = :uid")
        set_parts.append("#sub = :sub")
        set_parts.append("#email = :em")
        set_parts.append("#created_at = :now")
        names["#user_id"] = "user_id"
        names["#sub"] = "sub"
        names["#email"] = "email"
        names["#created_at"] = "created_at"
        values[":uid"] = {"S": user_id}
        values[":sub"] = {"S": sub}
        values[":em"] = {"S": email}

    try:
        client.transact_write_items(
            TransactItems=[
                {
                    "Put": {
                        "TableName": TABLE_NAME,
                        "Item": {
                            "PK": {"S": f"USERNAME#{username_lower}"},
                            "SK": {"S": "RESERVED"},
                        },
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                },
                {
                    "Update": {
                        "TableName": TABLE_NAME,
                        "Key": {
                            "PK": {"S": f"USER#{user_id}"},
                            "SK": {"S": "USER#PROFILE"},
                        },
                        "UpdateExpression": "SET " + ", ".join(set_parts),
                        "ExpressionAttributeNames": names,
                        "ExpressionAttributeValues": values,
                        "ConditionExpression": "attribute_not_exists(#username)",
                    }
                },
            ]
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def transact_change_username(old_lower: str, new_lower: str, new_username: str, user_id: str) -> bool:
    client = boto3.client("dynamodb")
    try:
        client.transact_write_items(
            TransactItems=[
                {
                    "Delete": {
                        "TableName": TABLE_NAME,
                        "Key": {
                            "PK": {"S": f"USERNAME#{old_lower}"},
                            "SK": {"S": "RESERVED"},
                        },
                    }
                },
                {
                    "Put": {
                        "TableName": TABLE_NAME,
                        "Item": {
                            "PK": {"S": f"USERNAME#{new_lower}"},
                            "SK": {"S": "RESERVED"},
                        },
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                },
                {
                    "Update": {
                        "TableName": TABLE_NAME,
                        "Key": {
                            "PK": {"S": f"USER#{user_id}"},
                            "SK": {"S": "USER#PROFILE"},
                        },
                        "UpdateExpression": "SET #username = :un, #username_lower = :ul, #updated_at = :now",
                        "ExpressionAttributeNames": {
                            "#username": "username",
                            "#username_lower": "username_lower",
                            "#updated_at": "updated_at",
                        },
                        "ExpressionAttributeValues": {
                            ":un": {"S": new_username},
                            ":ul": {"S": new_lower},
                            ":now": {"S": now_iso()},
                        },
                    }
                },
            ]
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise
