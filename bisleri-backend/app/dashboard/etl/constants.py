# app/dashboard/etl/constants.py
#
# Ported unchanged from Load_management/config.py (TABLE_CONFIGS, TABLES,
# EXCLUDED_DOCUMENT_TYPES) — table names, sync columns and unique keys the
# ETL scripts rely on. Keep in sync with the Bisleri_dashboard schema.

# Table configs for Data_Sync.py: operational (Bisleri_01) -> historical
# (Bisleri_dashboard) copy, per table.
TABLE_CONFIGS = [
    {
        'source_table': 'mfabric_deliverychallan_data',
        'target_table': 'mfabric_deliverychallan_data_historical',
        'columns': [
            'document_type', 'document_no', 'document_date', 'e_way_bill_no',
            'transporter_name', 'vehicle_no', 'irn_no', 'route_no',
            'total_quantity', 'site', 'customer_code', 'customer_name',
            'itemid', 'linenum'
        ],
        'unique_keys': ['document_no', 'itemid', 'linenum'],
        'timestamp_column': 'document_date'
    },
    {
        'source_table': 'mfabric_invoice_data',
        'target_table': 'mfabric_invoice_data_historical',
        'columns': [
            'document_type', 'document_no', 'document_date', 'e_way_bill_no',
            'transporter_name', 'vehicle_no', 'irn_no', 'customer_code',
            'customer_name', 'total_quantity', 'site', 'itemid', 'linenum'
        ],
        'unique_keys': ['document_no', 'itemid', 'linenum'],
        'timestamp_column': 'document_date'
    },
    {
        'source_table': 'mfabric_transferorder_rgp_data',
        'target_table': 'mfabric_transferorder_rgp_data_historical',
        'columns': [
            'document_type', 'sub_document_type', 'document_no', 'document_date',
            'e_way_bill_no', 'transporter_name', 'vehicle_no', 'irn_no',
            'from_warehouse_code', 'to_warehouse_code', 'route_code',
            'total_quantity', 'site', 'direct_dispatch', 'salesman',
            'itemid', 'linenum'
        ],
        'unique_keys': ['document_no', 'itemid', 'linenum'],
        'timestamp_column': 'document_date'
    },
    {
        'source_table': 'insights_data',
        'target_table': 'insights_data_historical',
        'columns': [
            'id', 'gate_entry_no', 'document_type', 'sub_document_type',
            'vehicle_no', 'warehouse_name', 'date', 'time', 'movement_type',
            'remarks', 'warehouse_code', 'site_code', 'security_name',
            'security_username', 'document_date', 'document_no', 'driver_name',
            'km_reading', 'loader_names', 'last_edited_at', 'edit_count'
        ],
        'unique_keys': ['id'],
        'timestamp_column': 'last_edited_at',
        'has_source_id': True
    }
]

# Table names on the historical (Bisleri_dashboard) DB.
TABLES = {
    'consolidated': 'vehicle_load_summary',
    'insights': 'insights_data_historical',
    'vehicle_master': 'vehicle_master',
    'item_master': 'item_master',
    'dashboard': 'dashboard_data',
    'document_tat_summary': 'document_tat_summary',
    'vehicle_loading_time_summary': 'vehicle_loading_time_summary',
    'loader_details_summary': 'loader_details_summary',
}

# Excluded document types (case-insensitive) — used by the load-summary ETL.
EXCLUDED_DOCUMENT_TYPES = ['EMPTY VEHICLE', 'Empty Vehicle', 'empty vehicle']

# Dashboard API pagination (matches Load_management/config.py's RECORDS_PER_PAGE)
RECORDS_PER_PAGE = 50

# Load thresholds for color coding (matches Load_management/config.py's LOAD_THRESHOLDS)
LOAD_THRESHOLDS = {
    'warning': 80,
    'overloaded': 100,
}

# Load Management queries only consider trips from this date onward — matches
# the hardcoded cutoff in Load_management/UI_components/load_management.py
# (weight calculations weren't reliable before this date).
LOAD_DATA_START_DATE = '2026-01-02'
