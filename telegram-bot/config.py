from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    telegram_bot_token: str
    backend_url: str = "http://localhost:8000"
    service_secret: str


settings = Settings()  # type: ignore[call-arg]
