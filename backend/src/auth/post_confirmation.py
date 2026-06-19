from common.db import create_user, generate_user_id


def lambda_handler(event, context):
    sub = event["request"]["userAttributes"]["sub"]
    email = event["request"]["userAttributes"]["email"]

    user_id = generate_user_id()
    create_user(user_id, sub, email)

    return event
