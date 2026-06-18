import os
import vonage

def get_vonage_client():
    key = os.getenv("VONAGE_API_KEY")
    secret = os.getenv("VONAGE_API_SECRET")
    app_id = os.getenv("VONAGE_APPLICATION_ID")
    pk_path = os.getenv("VONAGE_PRIVATE_KEY_PATH")

    if all([key, app_id, pk_path]) and os.path.exists(pk_path):
        return vonage.Client(
            key=key,
            secret=secret,
            application_id=app_id,
            private_key=pk_path,
        )
    return None
