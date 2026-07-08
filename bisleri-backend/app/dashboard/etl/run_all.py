# app/dashboard/etl/run_all.py
#
# Orchestrator ported from Load_management/scheduler.py's run_complete_pipeline()
# + check_initial_data() / run_tat_full_rebuild() first-run logic. The `schedule`
# library polling loop from the original is dropped — APScheduler
# (registered in app/main.py) now owns the interval trigger; this module just
# exposes the functions it calls.
#
# Pipeline:
#   1. Sync source (Bisleri_01, read-only) -> historical (4 tables)
#   2. ETL historical mfabric tables -> dashboard_data
#   3. Calculate vehicle loads -> vehicle_load_summary
#   4. Compute loader details -> loader_details_summary
#   5. Build TAT summary tables -> document_tat_summary, vehicle_loading_time_summary
import logging

import psycopg2

from .connections import HISTORICAL_DB
from .data_sync import DataSync
from .mfabric import DashboardETL
from .lms import VehicleLoadPipeline
from .loader_details import LoaderSummaryETL
from .tat_generation import TATSummaryBuilder

logger = logging.getLogger(__name__)


def run_complete_pipeline():
    """Run the complete 5-step pipeline (incremental)."""
    logger.info("[Dashboard ETL] COMPLETE PIPELINE STARTED")

    logger.info("[Dashboard ETL] [1/5] Syncing source -> historical DB...")
    DataSync().run()

    logger.info("[Dashboard ETL] [2/5] Running ETL -> dashboard_data...")
    DashboardETL().run()

    logger.info("[Dashboard ETL] [3/5] Calculating vehicle loads -> vehicle_load_summary...")
    VehicleLoadPipeline().run()

    logger.info("[Dashboard ETL] [4/5] Computing loader details -> loader_details_summary...")
    LoaderSummaryETL().run()

    logger.info("[Dashboard ETL] [5/5] Building TAT summary tables (incremental)...")
    tat_builder = TATSummaryBuilder()
    tat_builder.connect()
    try:
        success = tat_builder.run_incremental_update(days_back=1)
    finally:
        tat_builder.disconnect()
    if not success:
        raise Exception("TAT summary build failed")

    logger.info("[Dashboard ETL] COMPLETE PIPELINE FINISHED SUCCESSFULLY")


def run_tat_full_rebuild():
    """Full rebuild of TAT summary tables (used on first run only)."""
    tat_builder = TATSummaryBuilder()
    tat_builder.connect()
    try:
        success = tat_builder.run_full_rebuild()
    finally:
        tat_builder.disconnect()
    if not success:
        raise Exception("TAT full rebuild failed")


def check_initial_data() -> bool:
    """Return True if all summary tables already have data."""
    try:
        conn = psycopg2.connect(**HISTORICAL_DB)
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM vehicle_load_summary")
        vls_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM loader_details_summary")
        lds_count = cursor.fetchone()[0]

        try:
            cursor.execute("SELECT COUNT(*) FROM document_tat_summary")
            doc_tat_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM vehicle_loading_time_summary")
            veh_loading_count = cursor.fetchone()[0]
        except Exception:
            conn.rollback()
            doc_tat_count = 0
            veh_loading_count = 0

        cursor.close()
        conn.close()

        return vls_count > 0 and lds_count > 0 and doc_tat_count > 0 and veh_loading_count > 0

    except Exception as e:
        logger.warning(f"[Dashboard ETL] Could not check initial data: {e}")
        return False


def run_dashboard_etl(is_startup: bool = False):
    """Entry point called by APScheduler (and once on app startup).

    On startup, if the summary tables are empty, runs a full initial load
    (complete pipeline + a TAT full rebuild to backfill history) instead of
    the normal incremental pipeline — mirrors scheduler.py's original
    first-run behavior.
    """
    try:
        if is_startup and not check_initial_data():
            logger.info("[Dashboard ETL] No data found in summary tables — running INITIAL FULL LOAD")
            run_complete_pipeline()

            logger.info("[Dashboard ETL] Running TAT FULL REBUILD to backfill historical data...")
            run_tat_full_rebuild()

            logger.info("[Dashboard ETL] Initial full load completed")
        else:
            run_complete_pipeline()
    except Exception as exc:
        logger.error(f"[Dashboard ETL] Pipeline run failed: {exc}")


if __name__ == "__main__":
    # Manual verification: `python -m app.dashboard.etl.run_all` from bisleri-backend/
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    run_dashboard_etl(is_startup=True)
