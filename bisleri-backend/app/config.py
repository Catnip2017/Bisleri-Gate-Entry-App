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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Co Packer Feature
    COPACKER_FEATURE_ENABLED: bool = Field(default=True, env="COPACKER_FEATURE_ENABLED")
    COPACKER_IMAGE_PATH: str = Field(default="/copacker_images", env="COPACKER_IMAGE_PATH")

    # IBM WatsonX OCR
    WATSONX_MODEL: str = Field(default="meta-llama/llama-4-maverick-17b-128e-instruct-fp8", env="WATSONX_MODEL")
    IBM_API_KEY: str = Field(default="placeholder", env="IBM_API_KEY")
    IBM_SERVICE_URL: str = Field(default="placeholder", env="IBM_SERVICE_URL")
    IBM_PROJECT_ID: str = Field(default="placeholder", env="IBM_PROJECT_ID")

    # Co Packer field editing toggle
    ENABLE_FIELD_EDIT: bool = Field(default=False, env="ENABLE_FIELD_EDIT")

    # RPA dashboards — separate RPA_Automation database
    RPA_DB_HOST: str = Field(default="localhost", env="RPA_DB_HOST")
    RPA_DB_PORT: int = Field(default=5432, env="RPA_DB_PORT")
    RPA_DB_NAME: str = Field(default="RPA_Automation", env="RPA_DB_NAME")
    RPA_DB_USER: str = Field(default="postgres", env="RPA_DB_USER")
    RPA_DB_PASSWORD: str = Field(default="", env="RPA_DB_PASSWORD")

    class Config:
        env_file = ".env"

settings = Settings()