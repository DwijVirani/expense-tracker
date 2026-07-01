from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    mongo_uri: str = "mongodb://localhost:27017/expense_tracker"
    aws_region: str = "ap-south-1"
    log_level: str = "INFO"
    telegram_service_secret: str = ""
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""


settings = Settings()
