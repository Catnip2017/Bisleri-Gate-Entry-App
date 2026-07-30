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

    # Q18: persistent log file (logs/app.log, 5MB x5 rotation). Console
    # logging is ALWAYS on regardless; this flag only adds the file.
    # Flip to true in .env + restart uvicorn to activate.
    FILE_LOGGING: bool = Field(default=False, env="FILE_LOGGING")

    # Swagger / API docs toggle. When false (the secure default), /docs,
    # /redoc and /openapi.json all return 404 so the API surface is hidden
    # in production. Set ENABLE_DOCS=true in .env for local development, then
    # restart uvicorn — FastAPI reads the docs URLs once at startup.
    ENABLE_DOCS: bool = Field(default=False, env="ENABLE_DOCS")

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

    # Vehicle/Load dashboard — separate Bisleri_dashboard database. Holds
    # read-only copies of source data plus pre-computed summary tables
    # (vehicle_load_summary, document_tat_summary, etc.). Ported from the
    # standalone Streamlit dashboard's Load_management ETL scripts.
    HISTORICAL_DB_HOST: str = Field(default="localhost", env="HISTORICAL_DB_HOST")
    HISTORICAL_DB_PORT: int = Field(default=5432, env="HISTORICAL_DB_PORT")
    HISTORICAL_DB_NAME: str = Field(default="Bisleri_dashboard", env="HISTORICAL_DB_NAME")
    HISTORICAL_DB_USER: str = Field(default="postgres", env="HISTORICAL_DB_USER")
    HISTORICAL_DB_PASSWORD: str = Field(default="", env="HISTORICAL_DB_PASSWORD")

    # Bisleri Ecosystem sync — this app's own DB_* settings point at
    # bisleri_ecosystem (read-write, what this app actually runs against).
    # ECOSYSTEM_SOURCE_DB_* points at the live, currently-in-production
    # Bisleri_01 database, which this job only ever reads from — see
    # app/ecosystem_sync/connections.py for the enforced-read-only connection.
    ECOSYSTEM_SOURCE_DB_HOST: str = Field(default="localhost", env="ECOSYSTEM_SOURCE_DB_HOST")
    ECOSYSTEM_SOURCE_DB_PORT: int = Field(default=5432, env="ECOSYSTEM_SOURCE_DB_PORT")
    ECOSYSTEM_SOURCE_DB_NAME: str = Field(default="bisleri_01", env="ECOSYSTEM_SOURCE_DB_NAME")
    ECOSYSTEM_SOURCE_DB_USER: str = Field(default="postgres", env="ECOSYSTEM_SOURCE_DB_USER")
    ECOSYSTEM_SOURCE_DB_PASSWORD: str = Field(default="", env="ECOSYSTEM_SOURCE_DB_PASSWORD")

    class Config:
        env_file = ".env"

settings = Settings()
