import logging
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# BIS Item Pattern - Items that should have paired PPJRTWMRT containers
BIS_ITEM_PATTERN = ['BIS-20LTR01', 'BISW-20LTR01']

# ---------------------------------------------------------------------------
# Named logger — works whether this file is run standalone OR imported by
# FastAPI. Uses its own FileHandler so it never conflicts with uvicorn's
# root logger, and never causes double-printing.
# ---------------------------------------------------------------------------
LOG_FILE = "upload_log.txt"

_sync_logger = logging.getLogger("csv_to_DB")
_sync_logger.setLevel(logging.INFO)
_sync_logger.propagate = False  # don't bubble up to root logger

# Clear log file and attach a fresh FileHandler each time this module loads
if _sync_logger.handlers:
    for h in _sync_logger.handlers:
        h.close()
    _sync_logger.handlers.clear()

_log_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

_file_handler = logging.FileHandler(LOG_FILE, mode="w", encoding="utf-8")
_file_handler.setLevel(logging.INFO)
_file_handler.setFormatter(_log_formatter)
_sync_logger.addHandler(_file_handler)

_console_handler = logging.StreamHandler()
_console_handler.setLevel(logging.INFO)
_console_handler.setFormatter(_log_formatter)
_sync_logger.addHandler(_console_handler)

# ---------------------------------------------------------------------------
# Database engine (created once at import time, reused on every sync call)
# ---------------------------------------------------------------------------
engine = create_engine(
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={"options": "-c timezone=UTC"},
)

with engine.begin() as conn:
    conn.execute(text("SET TIME ZONE 'UTC';"))


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def check_source_tables():
    """Check if source tables exist and have data."""
    tables_to_check = [
        "mfabric_deliverychallan_data",
        "mfabric_invoice_data",
        "mfabric_transferorder_rgp_data",
    ]

    _sync_logger.info("=" * 60)
    _sync_logger.info("CHECKING SOURCE TABLES")
    _sync_logger.info("=" * 60)

    table_counts = {}

    try:
        with engine.begin() as conn:
            for table in tables_to_check:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = '{table}'
                    );
                """))
                table_exists = result.fetchone()[0]

                if table_exists:
                    count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    row_count = count_result.fetchone()[0]
                    table_counts[table] = row_count
                    _sync_logger.info(f"✓ {table}: {row_count} rows")

                    if row_count > 0:
                        dup_result = conn.execute(text(f"""
                            SELECT COUNT(*) as total_records,
                                   COUNT(DISTINCT document_no) as unique_documents,
                                   COUNT(*) - COUNT(DISTINCT document_no) as duplicates
                            FROM {table}
                        """))
                        total, unique, dups = dup_result.fetchone()
                        if dups > 0:
                            _sync_logger.info(f"  → {dups} duplicate document_no records found (will be aggregated)")
                        else:
                            _sync_logger.info("  → No duplicates found")
                else:
                    table_counts[table] = 0
                    _sync_logger.error(f"✗ {table}: TABLE DOES NOT EXIST!")

        return table_counts

    except Exception as e:
        _sync_logger.error(f"Error checking source tables: {str(e)}")
        return {}


def check_target_table_before():
    """Check document_data table before insertion."""
    _sync_logger.info("=" * 60)
    _sync_logger.info("CHECKING TARGET TABLE BEFORE INSERTION")
    _sync_logger.info("=" * 60)

    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'document_data'
                );
            """))
            table_exists = result.fetchone()[0]

            if table_exists:
                count_result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
                current_count = count_result.fetchone()[0]
                _sync_logger.info(f"✓ document_data table exists with {current_count} rows")

                type_result = conn.execute(text("""
                    SELECT document_type, COUNT(*)
                    FROM document_data
                    GROUP BY document_type
                    ORDER BY document_type
                """))

                _sync_logger.info("Current document types in target table:")
                for doc_type, count in type_result.fetchall():
                    _sync_logger.info(f"  {doc_type}: {count} records")

                return current_count
            else:
                _sync_logger.error("✗ document_data table does not exist!")
                return 0

    except Exception as e:
        _sync_logger.error(f"Error checking target table: {str(e)}")
        return 0


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------

def push_to_document_data():
    try:
        source_counts = check_source_tables()
        initial_count = check_target_table_before()

        _sync_logger.info("=" * 60)
        _sync_logger.info("STARTING AGGREGATED DATA INSERTION WITH UPDATES")
        _sync_logger.info("=" * 60)
        _sync_logger.info("Processing Rules:")
        _sync_logger.info("  - Filter: Smart PPJRTWMRT filtering with one-to-one BIS item matching")
        _sync_logger.info("    → Skip PPJRTWMRT only when paired with BIS items (same quantity)")
        _sync_logger.info("    → Keep unpaired PPJRTWMRT lines (extra containers/packaging)")
        _sync_logger.info("    → Keep all PPJRTWMRT when no BIS items present")
        _sync_logger.info(f"  - BIS Items: Pattern matching {[p + '%' for p in BIS_ITEM_PATTERN]}")
        _sync_logger.info("  - Deduplicate: Keep only one row per document_no and linenum")
        _sync_logger.info("  - Aggregate: SUM total_quantity for remaining records")
        _sync_logger.info("  - Transporter: Use first non-NULL transporter_name")
        _sync_logger.info("  - Clean: Convert spaces to NULL")
        _sync_logger.info("  - Data Type: Cast total_quantity to text")
        _sync_logger.info("  - Conflicts: UPDATE existing records (ON CONFLICT DO UPDATE)")
        _sync_logger.info("=" * 60)

        insertion_results = {}

        # ── DeliveryChallan ─────────────────────────────────────────────────
        _sync_logger.info("Processing DeliveryChallan data...")
        if source_counts.get("mfabric_deliverychallan_data", 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH source_data AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, itemid, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                route_no, customer_code, customer_name, total_quantity
                            FROM mfabric_deliverychallan_data
                            ORDER BY document_no, linenum
                        ),
                        bis_items AS (
                            SELECT
                                document_no, linenum, itemid, total_quantity,
                                ROW_NUMBER() OVER (
                                    PARTITION BY document_no, total_quantity ORDER BY linenum
                                ) as bis_rn
                            FROM source_data
                            WHERE itemid LIKE 'BIS-20LTR01%' OR itemid LIKE 'BISW-20LTR01%'
                        ),
                        matched_ppjrtwmrt AS (
                            SELECT
                                p.document_no, p.linenum,
                                ROW_NUMBER() OVER (
                                    PARTITION BY p.document_no, p.total_quantity ORDER BY p.linenum
                                ) as ppjr_rn
                            FROM source_data p
                            WHERE p.itemid = 'PPJRTWMRT'
                              AND EXISTS (
                                  SELECT 1 FROM bis_items b
                                  WHERE b.document_no = p.document_no
                                    AND b.total_quantity = p.total_quantity
                              )
                        ),
                        skip_list AS (
                            SELECT DISTINCT m.document_no, m.linenum
                            FROM matched_ppjrtwmrt m
                            INNER JOIN bis_items b ON b.document_no = m.document_no AND b.bis_rn = m.ppjr_rn
                            INNER JOIN source_data s ON s.document_no = m.document_no AND s.linenum = m.linenum
                            WHERE s.total_quantity = b.total_quantity
                        ),
                        filtered_dc AS (
                            SELECT s.document_no, s.linenum, s.site, s.document_type, s.document_date,
                                   s.e_way_bill_no, s.transporter_name, s.vehicle_no, s.irn_no,
                                   s.route_no, s.customer_code, s.customer_name, s.total_quantity
                            FROM source_data s
                            WHERE NOT EXISTS (
                                SELECT 1 FROM skip_list sl
                                WHERE sl.document_no = s.document_no AND sl.linenum = s.linenum
                            )
                        ),
                        aggregated_dc AS (
                            SELECT
                                document_no, site, document_type,
                                MAX(document_date) as document_date,
                                NULLIF(TRIM(MAX(e_way_bill_no)), '') as e_way_bill_no,
                                COALESCE(NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''), NULL) as transporter_name,
                                NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                NULLIF(TRIM(MAX(route_no)), '') as route_no,
                                MAX(customer_code) as customer_code,
                                MAX(customer_name) as customer_name,
                                SUM(COALESCE(total_quantity, 0)) as total_quantity
                            FROM filtered_dc
                            GROUP BY document_no, site, document_type
                        )
                        INSERT INTO document_data (
                            site, document_type, document_no, document_date,
                            e_way_bill_no, transporter_name, vehicle_no, irn_no,
                            route_no, customer_code, customer_name, total_quantity
                        )
                        SELECT site, document_type, document_no, document_date,
                               e_way_bill_no, transporter_name, vehicle_no, irn_no,
                               route_no, customer_code, customer_name, total_quantity::text
                        FROM aggregated_dc
                        ON CONFLICT (document_no) DO UPDATE SET
                            site = EXCLUDED.site,
                            document_type = EXCLUDED.document_type,
                            document_date = EXCLUDED.document_date,
                            e_way_bill_no = EXCLUDED.e_way_bill_no,
                            transporter_name = EXCLUDED.transporter_name,
                            vehicle_no = EXCLUDED.vehicle_no,
                            irn_no = EXCLUDED.irn_no,
                            route_no = EXCLUDED.route_no,
                            customer_code = EXCLUDED.customer_code,
                            customer_name = EXCLUDED.customer_name,
                            total_quantity = EXCLUDED.total_quantity
                        RETURNING document_no,
                            CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                    """))

                    results = result.fetchall()
                    inserts = sum(1 for r in results if r[1] == "INSERT")
                    updates = sum(1 for r in results if r[1] == "UPDATE")
                    insertion_results["DeliveryChallan"] = {"inserts": inserts, "updates": updates}
                    _sync_logger.info(f"✓ DeliveryChallan: {inserts} inserted, {updates} updated")
                    if results:
                        _sync_logger.info(f"  Sample documents: {[r[0] for r in results[:3]]}")

            except Exception as e:
                _sync_logger.error(f"✗ DeliveryChallan processing failed: {str(e)}")
                insertion_results["DeliveryChallan"] = {"inserts": 0, "updates": 0}
        else:
            _sync_logger.warning("⚠ Skipping DeliveryChallan - no source data")
            insertion_results["DeliveryChallan"] = {"inserts": 0, "updates": 0}

        # ── Invoice ──────────────────────────────────────────────────────────
        _sync_logger.info("Processing Invoice data...")
        if source_counts.get("mfabric_invoice_data", 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH source_data AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, itemid, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                customer_code, customer_name, total_quantity
                            FROM mfabric_invoice_data
                            ORDER BY document_no, linenum
                        ),
                        bis_items AS (
                            SELECT
                                document_no, linenum, itemid, total_quantity,
                                ROW_NUMBER() OVER (
                                    PARTITION BY document_no, total_quantity ORDER BY linenum
                                ) as bis_rn
                            FROM source_data
                            WHERE itemid LIKE 'BIS-20LTR01%' OR itemid LIKE 'BISW-20LTR01%'
                        ),
                        matched_ppjrtwmrt AS (
                            SELECT
                                p.document_no, p.linenum,
                                ROW_NUMBER() OVER (
                                    PARTITION BY p.document_no, p.total_quantity ORDER BY p.linenum
                                ) as ppjr_rn
                            FROM source_data p
                            WHERE p.itemid = 'PPJRTWMRT'
                              AND EXISTS (
                                  SELECT 1 FROM bis_items b
                                  WHERE b.document_no = p.document_no
                                    AND b.total_quantity = p.total_quantity
                              )
                        ),
                        skip_list AS (
                            SELECT DISTINCT m.document_no, m.linenum
                            FROM matched_ppjrtwmrt m
                            INNER JOIN bis_items b ON b.document_no = m.document_no AND b.bis_rn = m.ppjr_rn
                            INNER JOIN source_data s ON s.document_no = m.document_no AND s.linenum = m.linenum
                            WHERE s.total_quantity = b.total_quantity
                        ),
                        filtered_inv AS (
                            SELECT s.document_no, s.linenum, s.site, s.document_type, s.document_date,
                                   s.e_way_bill_no, s.transporter_name, s.vehicle_no, s.irn_no,
                                   s.customer_code, s.customer_name, s.total_quantity
                            FROM source_data s
                            WHERE NOT EXISTS (
                                SELECT 1 FROM skip_list sl
                                WHERE sl.document_no = s.document_no AND sl.linenum = s.linenum
                            )
                        ),
                        aggregated_inv AS (
                            SELECT
                                document_no, site, document_type,
                                MAX(document_date) as document_date,
                                MAX(e_way_bill_no) as e_way_bill_no,
                                COALESCE(NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''), NULL) as transporter_name,
                                NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                MAX(customer_code) as customer_code,
                                MAX(customer_name) as customer_name,
                                SUM(COALESCE(total_quantity, 0)) as total_quantity
                            FROM filtered_inv
                            GROUP BY document_no, site, document_type
                        )
                        INSERT INTO document_data (
                            site, document_type, document_no, document_date,
                            e_way_bill_no, transporter_name, vehicle_no, irn_no,
                            customer_code, customer_name, total_quantity
                        )
                        SELECT site, document_type, document_no, document_date,
                               e_way_bill_no, transporter_name, vehicle_no, irn_no,
                               customer_code, customer_name, total_quantity::text
                        FROM aggregated_inv
                        ON CONFLICT (document_no) DO UPDATE SET
                            site = EXCLUDED.site,
                            document_type = EXCLUDED.document_type,
                            document_date = EXCLUDED.document_date,
                            e_way_bill_no = EXCLUDED.e_way_bill_no,
                            transporter_name = EXCLUDED.transporter_name,
                            vehicle_no = EXCLUDED.vehicle_no,
                            irn_no = EXCLUDED.irn_no,
                            customer_code = EXCLUDED.customer_code,
                            customer_name = EXCLUDED.customer_name,
                            total_quantity = EXCLUDED.total_quantity
                        RETURNING document_no,
                            CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                    """))

                    results = result.fetchall()
                    inserts = sum(1 for r in results if r[1] == "INSERT")
                    updates = sum(1 for r in results if r[1] == "UPDATE")
                    insertion_results["Invoice"] = {"inserts": inserts, "updates": updates}
                    _sync_logger.info(f"✓ Invoice: {inserts} inserted, {updates} updated")
                    if results:
                        _sync_logger.info(f"  Sample documents: {[r[0] for r in results[:3]]}")

            except Exception as e:
                _sync_logger.error(f"✗ Invoice processing failed: {str(e)}")
                insertion_results["Invoice"] = {"inserts": 0, "updates": 0}
        else:
            _sync_logger.warning("⚠ Skipping Invoice - no source data")
            insertion_results["Invoice"] = {"inserts": 0, "updates": 0}

        # ── Transfer Order ───────────────────────────────────────────────────
        _sync_logger.info("Processing Transfer data...")
        if source_counts.get("mfabric_transferorder_rgp_data", 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH source_data AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, itemid, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                from_warehouse_code, to_warehouse_code, route_code,
                                direct_dispatch, sub_document_type, salesman, total_quantity
                            FROM mfabric_transferorder_rgp_data
                            ORDER BY document_no, linenum
                        ),
                        bis_items AS (
                            SELECT
                                document_no, linenum, itemid, total_quantity,
                                ROW_NUMBER() OVER (
                                    PARTITION BY document_no, total_quantity ORDER BY linenum
                                ) as bis_rn
                            FROM source_data
                            WHERE itemid LIKE 'BIS-20LTR01%' OR itemid LIKE 'BISW-20LTR01%'
                        ),
                        matched_ppjrtwmrt AS (
                            SELECT
                                p.document_no, p.linenum,
                                ROW_NUMBER() OVER (
                                    PARTITION BY p.document_no, p.total_quantity ORDER BY p.linenum
                                ) as ppjr_rn
                            FROM source_data p
                            WHERE p.itemid = 'PPJRTWMRT'
                              AND EXISTS (
                                  SELECT 1 FROM bis_items b
                                  WHERE b.document_no = p.document_no
                                    AND b.total_quantity = p.total_quantity
                              )
                        ),
                        skip_list AS (
                            SELECT DISTINCT m.document_no, m.linenum
                            FROM matched_ppjrtwmrt m
                            INNER JOIN bis_items b ON b.document_no = m.document_no AND b.bis_rn = m.ppjr_rn
                            INNER JOIN source_data s ON s.document_no = m.document_no AND s.linenum = m.linenum
                            WHERE s.total_quantity = b.total_quantity
                        ),
                        filtered_to AS (
                            SELECT s.document_no, s.linenum, s.site, s.document_type, s.document_date,
                                   s.e_way_bill_no, s.transporter_name, s.vehicle_no, s.irn_no,
                                   s.from_warehouse_code, s.to_warehouse_code, s.route_code,
                                   s.direct_dispatch, s.sub_document_type, s.salesman, s.total_quantity
                            FROM source_data s
                            WHERE NOT EXISTS (
                                SELECT 1 FROM skip_list sl
                                WHERE sl.document_no = s.document_no AND sl.linenum = s.linenum
                            )
                        ),
                        aggregated_to AS (
                            SELECT
                                document_no, site, document_type,
                                MAX(document_date) as document_date,
                                NULLIF(TRIM(MAX(e_way_bill_no)), '') as e_way_bill_no,
                                COALESCE(NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''), NULL) as transporter_name,
                                NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                MAX(from_warehouse_code) as from_warehouse_code,
                                MAX(to_warehouse_code) as to_warehouse_code,
                                MAX(route_code) as route_code,
                                MAX(direct_dispatch) as direct_dispatch,
                                MAX(sub_document_type) as sub_document_type,
                                MAX(salesman) as salesman,
                                SUM(COALESCE(total_quantity, 0)) as total_quantity
                            FROM filtered_to
                            GROUP BY document_no, site, document_type
                        )
                        INSERT INTO document_data (
                            site, document_type, document_no, document_date,
                            e_way_bill_no, transporter_name, vehicle_no, irn_no,
                            from_warehouse_code, to_warehouse_code, route_code,
                            direct_dispatch, sub_document_type, salesman, total_quantity
                        )
                        SELECT site, document_type, document_no, document_date,
                               e_way_bill_no, transporter_name, vehicle_no, irn_no,
                               from_warehouse_code, to_warehouse_code, route_code,
                               direct_dispatch, sub_document_type, salesman, total_quantity::text
                        FROM aggregated_to
                        ON CONFLICT (document_no) DO UPDATE SET
                            site = EXCLUDED.site,
                            document_type = EXCLUDED.document_type,
                            document_date = EXCLUDED.document_date,
                            e_way_bill_no = EXCLUDED.e_way_bill_no,
                            transporter_name = EXCLUDED.transporter_name,
                            vehicle_no = EXCLUDED.vehicle_no,
                            irn_no = EXCLUDED.irn_no,
                            from_warehouse_code = EXCLUDED.from_warehouse_code,
                            to_warehouse_code = EXCLUDED.to_warehouse_code,
                            route_code = EXCLUDED.route_code,
                            direct_dispatch = EXCLUDED.direct_dispatch,
                            sub_document_type = EXCLUDED.sub_document_type,
                            salesman = EXCLUDED.salesman,
                            total_quantity = EXCLUDED.total_quantity
                        RETURNING document_no,
                            CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                    """))

                    results = result.fetchall()
                    inserts = sum(1 for r in results if r[1] == "INSERT")
                    updates = sum(1 for r in results if r[1] == "UPDATE")
                    insertion_results["Transfer"] = {"inserts": inserts, "updates": updates}
                    _sync_logger.info(f"✓ Transfer: {inserts} inserted, {updates} updated")
                    if results:
                        _sync_logger.info(f"  Sample documents: {[r[0] for r in results[:3]]}")

            except Exception as e:
                _sync_logger.error(f"✗ Transfer processing failed: {str(e)}")
                insertion_results["Transfer"] = {"inserts": 0, "updates": 0}
        else:
            _sync_logger.warning("⚠ Skipping Transfer - no source data")
            insertion_results["Transfer"] = {"inserts": 0, "updates": 0}

        # ── Final summary ────────────────────────────────────────────────────
        _sync_logger.info("=" * 60)
        _sync_logger.info("FINAL RESULTS")
        _sync_logger.info("=" * 60)

        try:
            with engine.begin() as conn:
                final_count_result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
                final_count = final_count_result.fetchone()[0]

                total_inserts = sum(r["inserts"] for r in insertion_results.values())
                total_updates = sum(r["updates"] for r in insertion_results.values())

                _sync_logger.info(f"Initial record count: {initial_count}")
                _sync_logger.info(f"Records inserted this cycle: {total_inserts}")
                _sync_logger.info(f"Records updated this cycle: {total_updates}")
                _sync_logger.info(f"Final record count: {final_count}")

                type_result = conn.execute(text("""
                    SELECT document_type, COUNT(*)
                    FROM document_data
                    GROUP BY document_type
                    ORDER BY document_type
                """))
                _sync_logger.info("Final document types breakdown:")
                for doc_type, count in type_result.fetchall():
                    _sync_logger.info(f"  {doc_type}: {count} records")

                sample_result = conn.execute(text("""
                    SELECT document_no, total_quantity, document_type
                    FROM document_data
                    WHERE total_quantity IS NOT NULL
                    ORDER BY document_no DESC
                    LIMIT 5
                """))
                _sync_logger.info("Sample total_quantity values (to verify aggregation):")
                for doc_no, qty, doc_type in sample_result.fetchall():
                    _sync_logger.info(f"  {doc_no} ({doc_type}): {qty}")

                _sync_logger.info("Processing Summary:")
                for doc_type, stats in insertion_results.items():
                    _sync_logger.info(f"  {doc_type}: {stats['inserts']} inserts, {stats['updates']} updates")

        except Exception as e:
            _sync_logger.error(f"Error in final results check: {str(e)}")

        _sync_logger.info("Successfully completed aggregated data push with updates to document_data.")
        print(f"Data processing complete: {total_inserts} inserts, {total_updates} updates")

    except Exception as e:
        _sync_logger.error(f"Error during data processing: {str(e)}")
        print(f"Data processing failed: {str(e)}")


# ---------------------------------------------------------------------------
# Entry point for standalone runs: python csv_to_DB.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    push_to_document_data()
