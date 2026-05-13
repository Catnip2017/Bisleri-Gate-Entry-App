from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DB_USER: str = Field(..., env="DB_USER")
    DB_PASSWORD: str = Field(..., env="DB_PASSWORD")
    DB_HOST: str = Field(..., env="DB_HOST")
    DB_PORT: int = Field(..., env="DB_PORT")
    DB_NAME: str = Field(..., env="DB_NAME")

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # Co Packer Feature
    COPACKER_FEATURE_ENABLED: bool = Field(default=True, env="COPACKER_FEATURE_ENABLED")
    COPACKER_IMAGE_PATH: str = Field(default="/copacker_images", env="COPACKER_IMAGE_PATH")

    # WatsonX OCR
    WATSONX_MODEL: str = Field(default="placeholder", env="WATSONX_MODEL")
    WATSONX_API_URL: str = Field(default="placeholder", env="WATSONX_API_URL")
    WATSONX_API_KEY: str = Field(default="placeholder", env="WATSONX_API_KEY")
    WATSONX_PROJECT_ID: str = Field(default="placeholder", env="WATSONX_PROJECT_ID")

    class Config:
        env_file = ".env"

settings = Settings()