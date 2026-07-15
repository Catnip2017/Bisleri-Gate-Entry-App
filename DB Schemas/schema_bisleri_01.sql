-- ============================================================
--  BISLERI GATE ENTRY APP — Database 1 of 3: Bisleri_01 (MAIN)
--  PostgreSQL >= 14
--
--  AUTO-GENERATED from the SQLAlchemy ORM models (app/models/*).
--  This is the authoritative structure the application expects.
--  Generated: 2026-07-15
--  Updated:   pipeline_masters_migration applied (gate_pass_parties +4 cols,
--             gate_pass_items uom/item_type dropped + fa_class_code added,
--             gate_pass_lines fa_class_code added)
--
--  Provision:
--    psql -U postgres -c "CREATE DATABASE \"Bisleri_01\";"
--    psql -U postgres -d Bisleri_01 -f schema_bisleri_01.sql
--
--  Tables (25):
--     1. copacker_entries
--     2. copacker_locations
--     3. copacker_sessions
--     4. document_data
--     5. gate_pass_cancel_reasons
--     6. gate_pass_items
--     7. gate_pass_locations
--     8. gate_pass_parties
--     9. gate_pass_sequences
--    10. insights_data
--    11. item_master
--    12. location_master
--    13. mfabric_deliverychallan_data
--    14. mfabric_invoice_data
--    15. mfabric_transferorder_rgp_data
--    16. raw_materials_data
--    17. copacker_assets
--    18. copacker_captures
--    19. copacker_quantity_edit_log
--    20. gate_pass_headers
--    21. users_master
--    22. copacker_capture_edit_log
--    23. gate_pass_events
--    24. gate_pass_lines
--    25. user_gate_pass_locations
-- ============================================================

CREATE TABLE copacker_entries (
	id SERIAL NOT NULL, 
	copacker_location VARCHAR(255) NOT NULL, 
	line_no INTEGER NOT NULL, 
	asset_model_id VARCHAR(255) NOT NULL, 
	entry_date DATE NOT NULL, 
	entry_time TIME WITHOUT TIME ZONE NOT NULL, 
	image_path TEXT, 
	sku_name VARCHAR(255), 
	sku_itemid VARCHAR(255), 
	username VARCHAR(255) NOT NULL, 
	extracted_quantity INTEGER, 
	extracted_quantity_raw INTEGER, 
	preform_total BIGINT, 
	preform_shift BIGINT, 
	bottles_total BIGINT, 
	bottles_shift BIGINT, 
	operating_hours INTEGER, 
	recipe VARCHAR(500), 
	asset_model_no VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE TABLE copacker_locations (
	id SERIAL NOT NULL, 
	location_name VARCHAR(255) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (location_name)
);

CREATE TABLE copacker_sessions (
	id SERIAL NOT NULL, 
	copacker_location VARCHAR(200) NOT NULL, 
	line_no INTEGER NOT NULL, 
	sku_name VARCHAR(500), 
	sku_item_id VARCHAR(100), 
	status VARCHAR(20) NOT NULL, 
	submitted_by VARCHAR(100) NOT NULL, 
	shift_no INTEGER, 
	shift_start_time VARCHAR(10), 
	shift_end_time VARCHAR(10), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	completed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE document_data (
	document_no VARCHAR(100) NOT NULL, 
	site VARCHAR(100), 
	document_type VARCHAR(100), 
	document_date TIMESTAMP WITHOUT TIME ZONE, 
	e_way_bill_no VARCHAR(100), 
	transporter_name VARCHAR(100), 
	vehicle_no VARCHAR(100), 
	irn_no VARCHAR(100), 
	warehouse_code VARCHAR(100), 
	warehouse_name VARCHAR(100), 
	route_code VARCHAR(100), 
	route_no VARCHAR(100), 
	customer_code VARCHAR(100), 
	customer_name VARCHAR(100), 
	direct_dispatch VARCHAR(100), 
	total_quantity VARCHAR(100), 
	gate_entry_no VARCHAR(20), 
	from_warehouse_code VARCHAR(100), 
	to_warehouse_code VARCHAR(100), 
	sub_document_type VARCHAR(100), 
	salesman VARCHAR(100), 
	PRIMARY KEY (document_no)
);

CREATE TABLE gate_pass_cancel_reasons (
	id SERIAL NOT NULL, 
	reason_text VARCHAR(255) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (reason_text)
);

CREATE TABLE gate_pass_items (
	item_code    VARCHAR(50)  NOT NULL,
	item_name    VARCHAR(255) NOT NULL,
	fa_class_code VARCHAR(50),
	is_active    BOOLEAN      NOT NULL,
	PRIMARY KEY (item_code)
);

CREATE TABLE gate_pass_locations (
	id SERIAL NOT NULL, 
	location_code VARCHAR(10) NOT NULL, 
	location_name VARCHAR(255) NOT NULL, 
	warehouse_code VARCHAR(50), 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (location_code)
);

CREATE TABLE gate_pass_parties (
	party_code  VARCHAR(50)  NOT NULL,
	party_name  VARCHAR(255) NOT NULL,
	city        VARCHAR(100),
	post_code   VARCHAR(20),
	phone_no    VARCHAR(20),
	contact     VARCHAR(255),
	is_active   BOOLEAN      NOT NULL,
	PRIMARY KEY (party_code)
);

CREATE TABLE gate_pass_sequences (
	id SERIAL NOT NULL, 
	location_code VARCHAR(10) NOT NULL, 
	pass_type VARCHAR(3) NOT NULL, 
	last_number INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_gate_pass_seq_loc_type UNIQUE (location_code, pass_type)
);

CREATE TABLE insights_data (
	id SERIAL NOT NULL, 
	gate_entry_no VARCHAR(50), 
	document_type VARCHAR(50), 
	sub_document_type VARCHAR(50), 
	document_no VARCHAR(100), 
	vehicle_no VARCHAR(50), 
	warehouse_name VARCHAR(100), 
	date TIMESTAMP WITHOUT TIME ZONE, 
	time TIME WITHOUT TIME ZONE, 
	movement_type VARCHAR(20), 
	remarks TEXT, 
	warehouse_code VARCHAR(50), 
	site_code VARCHAR(50), 
	security_name VARCHAR(255), 
	security_username VARCHAR(255), 
	document_date TIMESTAMP WITHOUT TIME ZONE, 
	driver_name VARCHAR(100), 
	km_reading VARCHAR(10), 
	loader_count INTEGER, 
	loader_names VARCHAR(200), 
	last_edited_at TIMESTAMP WITHOUT TIME ZONE, 
	edit_count INTEGER, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_insights_data_warehouse_code ON insights_data (warehouse_code);
CREATE INDEX ix_insights_data_movement_type ON insights_data (movement_type);
CREATE INDEX ix_insights_warehouse_date ON insights_data (warehouse_code, date);
CREATE INDEX ix_insights_data_date ON insights_data (date);

CREATE TABLE item_master (
	item_number VARCHAR(255) NOT NULL, 
	product_name VARCHAR(255), 
	product_type VARCHAR(255), 
	product_subtype VARCHAR(255), 
	net_weight VARCHAR(255), 
	PRIMARY KEY (item_number)
);

CREATE TABLE location_master (
	warehouse_code VARCHAR(50) NOT NULL, 
	warehouse_name VARCHAR(255), 
	site_code VARCHAR(50), 
	warehouse_id VARCHAR(50), 
	PRIMARY KEY (warehouse_code)
);

CREATE TABLE mfabric_deliverychallan_data (
	document_type VARCHAR(255), 
	document_no VARCHAR(255) NOT NULL, 
	document_date TIMESTAMP WITH TIME ZONE, 
	e_way_bill_no VARCHAR(255), 
	transporter_name VARCHAR(255), 
	vehicle_no VARCHAR(255), 
	irn_no VARCHAR(255), 
	route_no VARCHAR(255), 
	total_quantity INTEGER, 
	site VARCHAR(255), 
	customer_code VARCHAR(255), 
	customer_name VARCHAR(255), 
	itemid VARCHAR(255), 
	linenum NUMERIC, 
	PRIMARY KEY (document_no)
);

CREATE TABLE mfabric_invoice_data (
	document_type VARCHAR(255), 
	document_no VARCHAR(255) NOT NULL, 
	document_date TIMESTAMP WITH TIME ZONE, 
	e_way_bill_no VARCHAR(255), 
	transporter_name VARCHAR(255), 
	vehicle_no VARCHAR(255), 
	irn_no VARCHAR(255), 
	customer_code VARCHAR(255), 
	customer_name VARCHAR(255), 
	total_quantity INTEGER, 
	site VARCHAR(255), 
	itemid VARCHAR(255), 
	linenum NUMERIC, 
	PRIMARY KEY (document_no)
);

CREATE TABLE mfabric_transferorder_rgp_data (
	document_type VARCHAR(255), 
	sub_document_type VARCHAR(255), 
	document_no VARCHAR(255) NOT NULL, 
	document_date TIMESTAMP WITH TIME ZONE, 
	e_way_bill_no VARCHAR(255), 
	transporter_name VARCHAR(255), 
	vehicle_no VARCHAR(255), 
	irn_no VARCHAR(255), 
	from_warehouse_code VARCHAR(255), 
	to_warehouse_code VARCHAR(255), 
	route_code VARCHAR(255), 
	total_quantity INTEGER, 
	site VARCHAR(255), 
	direct_dispatch VARCHAR(255), 
	salesman VARCHAR(255), 
	itemid VARCHAR(255), 
	linenum NUMERIC, 
	PRIMARY KEY (document_no)
);

CREATE TABLE raw_materials_data (
	id SERIAL NOT NULL, 
	gate_entry_no VARCHAR(50) NOT NULL, 
	gate_type VARCHAR(20) NOT NULL, 
	vehicle_no VARCHAR(50) NOT NULL, 
	document_no VARCHAR(50) NOT NULL, 
	name_of_party VARCHAR(255) NOT NULL, 
	description_of_material VARCHAR(255) NOT NULL, 
	quantity VARCHAR(255) NOT NULL, 
	date_time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	security_name VARCHAR(100) NOT NULL, 
	security_username VARCHAR(50) NOT NULL, 
	warehouse_code VARCHAR(50) NOT NULL, 
	site_code VARCHAR(50) NOT NULL, 
	last_edited_at TIMESTAMP WITHOUT TIME ZONE, 
	edit_count INTEGER, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_raw_materials_data_warehouse_code ON raw_materials_data (warehouse_code);
CREATE INDEX ix_rm_warehouse_datetime ON raw_materials_data (warehouse_code, date_time);
CREATE INDEX ix_raw_materials_data_date_time ON raw_materials_data (date_time);
CREATE INDEX ix_raw_materials_data_gate_type ON raw_materials_data (gate_type);

CREATE TABLE copacker_assets (
	id SERIAL NOT NULL, 
	location_id INTEGER NOT NULL, 
	line_no INTEGER NOT NULL, 
	asset_model_id VARCHAR(255) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_copacker_asset_location_line UNIQUE (location_id, line_no), 
	FOREIGN KEY(location_id) REFERENCES copacker_locations (id)
);

CREATE TABLE copacker_captures (
	id SERIAL NOT NULL, 
	session_id INTEGER NOT NULL, 
	step_order INTEGER NOT NULL, 
	capture_type VARCHAR(50) NOT NULL, 
	asset_model_id VARCHAR(100), 
	image_path VARCHAR(500), 
	ocr_raw TEXT, 
	bottle_recipe VARCHAR(500), 
	last_hour_production_count BIGINT, 
	production_count_current_batch BIGINT, 
	total_production_count BIGINT, 
	good_bottles_count BIGINT, 
	preforms_processed_count BIGINT, 
	target_batch_quantity BIGINT, 
	bottles_total BIGINT, 
	production_speed_bph INTEGER, 
	labels_count BIGINT, 
	label_format VARCHAR(200), 
	packs_counter INTEGER, 
	pack_format VARCHAR(200), 
	captured_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	captured_by VARCHAR(100), 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES copacker_sessions (id) ON DELETE CASCADE
);

CREATE TABLE copacker_quantity_edit_log (
	id SERIAL NOT NULL, 
	entry_id INTEGER NOT NULL, 
	original_value INTEGER, 
	edited_value INTEGER, 
	edited_by VARCHAR(255) NOT NULL, 
	edited_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	auto_remarks TEXT, 
	field_name VARCHAR(50), 
	original_text_value TEXT, 
	edited_text_value TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(entry_id) REFERENCES copacker_entries (id)
);

CREATE TABLE gate_pass_headers (
	id SERIAL NOT NULL, 
	gate_pass_no VARCHAR(30) NOT NULL, 
	pass_type VARCHAR(3) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	location_code VARCHAR(10) NOT NULL, 
	warehouse_code VARCHAR(50), 
	document_date DATE NOT NULL, 
	document_time VARCHAR(12) NOT NULL, 
	party_code VARCHAR(50) NOT NULL, 
	party_name VARCHAR(255) NOT NULL, 
	department VARCHAR(50) NOT NULL, 
	mode_of_transport VARCHAR(30) NOT NULL, 
	vehicle_no VARCHAR(20), 
	sender_name VARCHAR(100), 
	approver_name VARCHAR(100), 
	expected_inward_date DATE, 
	remarks TEXT, 
	created_by VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	released_by VARCHAR(50), 
	released_at TIMESTAMP WITH TIME ZONE, 
	dispatched_by VARCHAR(50), 
	dispatched_at TIMESTAMP WITH TIME ZONE, 
	dispatch_remarks TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	cancelled_by VARCHAR(50), 
	cancelled_at TIMESTAMP WITH TIME ZONE, 
	cancel_reason_id INTEGER, 
	cancel_remarks TEXT, 
	replacement_pass_no VARCHAR(30), 
	closed_by VARCHAR(50), 
	closed_at TIMESTAMP WITH TIME ZONE, 
	close_reason TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(cancel_reason_id) REFERENCES gate_pass_cancel_reasons (id)
);
CREATE INDEX ix_gate_pass_headers_expected_inward_date ON gate_pass_headers (expected_inward_date);
CREATE INDEX ix_gate_pass_headers_status ON gate_pass_headers (status);
CREATE INDEX ix_gate_pass_headers_pass_type ON gate_pass_headers (pass_type);
CREATE UNIQUE INDEX ix_gate_pass_headers_gate_pass_no ON gate_pass_headers (gate_pass_no);
CREATE INDEX ix_gate_pass_headers_department ON gate_pass_headers (department);
CREATE INDEX ix_gate_pass_headers_location_code ON gate_pass_headers (location_code);
CREATE INDEX ix_gate_pass_headers_warehouse_code ON gate_pass_headers (warehouse_code);

CREATE TABLE users_master (
	username VARCHAR(50) NOT NULL, 
	first_name VARCHAR(255), 
	last_name VARCHAR(255), 
	role VARCHAR(50), 
	warehouse_code VARCHAR(50), 
	warehouse_name VARCHAR(255), 
	site_code VARCHAR(50), 
	password VARCHAR(255), 
	email VARCHAR(255), 
	phone_number VARCHAR(20), 
	last_login TIMESTAMP WITHOUT TIME ZONE, 
	copacker_location VARCHAR(255), 
	department VARCHAR(50), 
	gate_pass_location VARCHAR(50), 
	is_active BOOLEAN, 
	PRIMARY KEY (username), 
	FOREIGN KEY(warehouse_code) REFERENCES location_master (warehouse_code)
);

CREATE TABLE copacker_capture_edit_log (
	id SERIAL NOT NULL, 
	capture_id INTEGER NOT NULL, 
	field_name VARCHAR(100) NOT NULL, 
	original_value TEXT, 
	edited_value TEXT, 
	edited_by VARCHAR(100) NOT NULL, 
	edited_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(capture_id) REFERENCES copacker_captures (id) ON DELETE CASCADE
);

CREATE TABLE gate_pass_events (
	id SERIAL NOT NULL, 
	gate_pass_id INTEGER NOT NULL, 
	event_type VARCHAR(20) NOT NULL, 
	event_by VARCHAR(50) NOT NULL, 
	event_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	remarks TEXT, 
	details_json TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(gate_pass_id) REFERENCES gate_pass_headers (id) ON DELETE CASCADE
);
CREATE INDEX ix_gate_pass_events_gate_pass_id ON gate_pass_events (gate_pass_id);

CREATE TABLE gate_pass_lines (
	id            SERIAL         NOT NULL,
	gate_pass_id  INTEGER        NOT NULL,
	line_no       INTEGER        NOT NULL,
	item_code     VARCHAR(50),
	item_type     VARCHAR(20),
	description   VARCHAR(250)   NOT NULL,
	serial_no     VARCHAR(100),
	uom           VARCHAR(20)    NOT NULL,
	quantity      INTEGER        NOT NULL,
	amount        NUMERIC(14, 2),
	chargeable    VARCHAR(20),
	received_qty  INTEGER        NOT NULL,
	fa_class_code VARCHAR(50),
	PRIMARY KEY (id),
	CONSTRAINT uq_gate_pass_line_no UNIQUE (gate_pass_id, line_no),
	FOREIGN KEY(gate_pass_id) REFERENCES gate_pass_headers (id) ON DELETE CASCADE
);
CREATE INDEX ix_gate_pass_lines_gate_pass_id ON gate_pass_lines (gate_pass_id);

CREATE TABLE user_gate_pass_locations (
	id SERIAL NOT NULL, 
	username VARCHAR(50) NOT NULL, 
	location_code VARCHAR(10) NOT NULL, 
	is_default BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (username, location_code), 
	FOREIGN KEY(username) REFERENCES users_master (username) ON DELETE CASCADE, 
	FOREIGN KEY(location_code) REFERENCES gate_pass_locations (location_code)
);
CREATE INDEX ix_user_gate_pass_locations_username ON user_gate_pass_locations (username);

