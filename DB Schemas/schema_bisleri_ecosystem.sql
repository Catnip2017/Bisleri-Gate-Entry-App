-- ============================================================
--  BISLERI GATE ENTRY APP -- main database schema
--  Database name: bisleri_ecosystem  (the app's primary DB, DB_NAME in .env)
--  PostgreSQL >= 14        Alembic revision: c4e8a1f7d2b9 (head)
--
--  Generated 2026-11-05 from the consolidate-branch SQLAlchemy models
--  (app/models/*) plus the 42 performance indexes that exist on the live database
--  (idx_* -- these are not defined in the models). Column-for-column
--  identical to the live bisleri_ecosystem database except one drift:
--  live gate_pass_assets.asset_name is NULLABLE, the model says NOT NULL.
--  Server-side column defaults (see the 'Column defaults' block near the end)
--  mirror the live database / model defaults.
--
--  Tables (38): alembic_version, audit_log, blinkit_stores, copacker_assets, copacker_capture_edit_log, copacker_captures, copacker_entries, copacker_locations, copacker_quantity_edit_log, copacker_sessions, document_data, gate_pass_assets, gate_pass_cancel_reasons, gate_pass_customers, gate_pass_departments, gate_pass_events, gate_pass_headers, gate_pass_items, gate_pass_lines, gate_pass_locations, gate_pass_sequences, gate_pass_vendors, insights_data, inventory_batches, inventory_entries, inventory_operator_viewers, inventory_user_warehouses, inventory_viewer_store, item_master, location_master, mfabric_deliverychallan_data, mfabric_invoice_data, mfabric_transferorder_rgp_data, raw_materials_data, security_alerts, security_settings, user_gate_pass_locations, users_master
--
--  Plain DDL only -- no psql meta-commands -- so it also runs through
--  psycopg2. It stamps alembic_version so `alembic upgrade head` is a
--  no-op afterwards.
--
--  Fresh local install:   python bisleri-backend/scripts/init_db.py
--  or by hand:
--    psql -U postgres -c "CREATE DATABASE bisleri_ecosystem;"
--    psql -U postgres -d bisleri_ecosystem -f "DB Schemas/schema_bisleri_ecosystem.sql"
--
--  NOTE: `alembic upgrade head` cannot build an EMPTY database -- the
--  first migrations assume tables that were created by hand. Use this
--  file for new databases; use Alembic only to move an existing one forward.
-- ============================================================

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: copacker_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_assets (
    id integer NOT NULL,
    location_id integer NOT NULL,
    line_no integer NOT NULL,
    asset_model_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: copacker_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_assets_id_seq OWNED BY public.copacker_assets.id;


--
-- Name: copacker_capture_edit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_capture_edit_log (
    id integer NOT NULL,
    capture_id integer NOT NULL,
    field_name character varying(100) NOT NULL,
    original_value text,
    edited_value text,
    edited_by character varying(100) NOT NULL,
    edited_at timestamp with time zone DEFAULT now()
);


--
-- Name: copacker_capture_edit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_capture_edit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_capture_edit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_capture_edit_log_id_seq OWNED BY public.copacker_capture_edit_log.id;


--
-- Name: copacker_captures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_captures (
    id integer NOT NULL,
    session_id integer NOT NULL,
    step_order integer NOT NULL,
    capture_type character varying(50) NOT NULL,
    asset_model_id character varying(100),
    image_path character varying(500),
    ocr_raw text,
    bottle_recipe character varying(500),
    last_hour_production_count bigint,
    production_count_current_batch bigint,
    total_production_count bigint,
    good_bottles_count bigint,
    preforms_processed_count bigint,
    target_batch_quantity bigint,
    bottles_total bigint,
    production_speed_bph integer,
    labels_count bigint,
    label_format character varying(200),
    packs_counter integer,
    pack_format character varying(200),
    captured_at timestamp with time zone DEFAULT now(),
    captured_by character varying(100)
);


--
-- Name: copacker_captures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_captures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_captures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_captures_id_seq OWNED BY public.copacker_captures.id;


--
-- Name: copacker_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_entries (
    id integer NOT NULL,
    copacker_location character varying(255) NOT NULL,
    line_no integer NOT NULL,
    asset_model_id character varying(255) NOT NULL,
    entry_date date NOT NULL,
    entry_time time without time zone NOT NULL,
    image_path text,
    sku_name character varying(255),
    sku_itemid character varying(255),
    username character varying(255) NOT NULL,
    extracted_quantity integer,
    extracted_quantity_raw integer,
    preform_total bigint,
    preform_shift bigint,
    bottles_total bigint,
    bottles_shift bigint,
    operating_hours integer,
    recipe character varying(500),
    asset_model_no character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: copacker_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_entries_id_seq OWNED BY public.copacker_entries.id;


--
-- Name: copacker_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_locations (
    id integer NOT NULL,
    location_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: copacker_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_locations_id_seq OWNED BY public.copacker_locations.id;


--
-- Name: copacker_quantity_edit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_quantity_edit_log (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    original_value integer,
    edited_value integer,
    edited_by character varying(255) NOT NULL,
    edited_at timestamp without time zone DEFAULT now(),
    auto_remarks text,
    field_name character varying(50),
    original_text_value text,
    edited_text_value text
);


--
-- Name: copacker_quantity_edit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_quantity_edit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_quantity_edit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_quantity_edit_log_id_seq OWNED BY public.copacker_quantity_edit_log.id;


--
-- Name: copacker_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copacker_sessions (
    id integer NOT NULL,
    copacker_location character varying(200) NOT NULL,
    line_no integer NOT NULL,
    sku_name character varying(500),
    sku_item_id character varying(100),
    status character varying(20) NOT NULL,
    submitted_by character varying(100) NOT NULL,
    shift_no integer,
    shift_start_time character varying(10),
    shift_end_time character varying(10),
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: copacker_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.copacker_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: copacker_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.copacker_sessions_id_seq OWNED BY public.copacker_sessions.id;


--
-- Name: document_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_data (
    document_no character varying(100) NOT NULL,
    site character varying(100),
    document_type character varying(100),
    document_date timestamp without time zone,
    e_way_bill_no character varying(100),
    transporter_name character varying(100),
    vehicle_no character varying(100),
    irn_no character varying(100),
    warehouse_code character varying(100),
    warehouse_name character varying(100),
    route_code character varying(100),
    route_no character varying(100),
    customer_code character varying(100),
    customer_name character varying(100),
    direct_dispatch character varying(100),
    total_quantity character varying(100),
    gate_entry_no character varying(20),
    from_warehouse_code character varying(100),
    to_warehouse_code character varying(100),
    sub_document_type character varying(100),
    salesman character varying(100)
);


--
-- Name: gate_pass_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_assets (
    asset_code character varying(50) NOT NULL,
    asset_name character varying(255) NOT NULL,
    fa_class_code character varying(50),
    is_active boolean NOT NULL
);


--
-- Name: gate_pass_cancel_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_cancel_reasons (
    id integer NOT NULL,
    reason_text character varying(255) NOT NULL,
    is_active boolean NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: gate_pass_cancel_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_cancel_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_cancel_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_cancel_reasons_id_seq OWNED BY public.gate_pass_cancel_reasons.id;


--
-- Name: gate_pass_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_customers (
    customer_code character varying(50) NOT NULL,
    customer_name character varying(255) NOT NULL,
    city character varying(100),
    post_code character varying(20),
    phone_no character varying(20),
    contact character varying(255),
    is_active boolean NOT NULL
);


--
-- Name: gate_pass_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_departments (
    id integer NOT NULL,
    department_name character varying(100) NOT NULL,
    is_active boolean NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: gate_pass_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_departments_id_seq OWNED BY public.gate_pass_departments.id;


--
-- Name: gate_pass_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_events (
    id integer NOT NULL,
    gate_pass_id integer NOT NULL,
    event_type character varying(20) NOT NULL,
    event_by character varying(50) NOT NULL,
    event_at timestamp with time zone DEFAULT now(),
    remarks text,
    details_json text
);


--
-- Name: gate_pass_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_events_id_seq OWNED BY public.gate_pass_events.id;


--
-- Name: gate_pass_headers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_headers (
    id integer NOT NULL,
    gate_pass_no character varying(30) NOT NULL,
    pass_type character varying(3) NOT NULL,
    status character varying(30) NOT NULL,
    location_code character varying(10) NOT NULL,
    warehouse_code character varying(50),
    document_date date NOT NULL,
    document_time character varying(12) NOT NULL,
    party_type character varying(10) NOT NULL,
    party_code character varying(50) NOT NULL,
    party_name character varying(255) NOT NULL,
    department character varying(50) NOT NULL,
    mode_of_transport character varying(30) NOT NULL,
    vehicle_no character varying(20),
    sender_name character varying(100),
    approver_name character varying(100),
    expected_inward_date date,
    remarks text,
    created_by character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    released_by character varying(50),
    released_at timestamp with time zone,
    dispatched_by character varying(50),
    dispatched_at timestamp with time zone,
    dispatch_remarks text,
    last_inward_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_by character varying(50),
    cancelled_at timestamp with time zone,
    cancel_reason_id integer,
    cancel_remarks text,
    replacement_pass_no character varying(30),
    closed_by character varying(50),
    closed_at timestamp with time zone,
    close_reason text
);


--
-- Name: gate_pass_headers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_headers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_headers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_headers_id_seq OWNED BY public.gate_pass_headers.id;


--
-- Name: gate_pass_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_items (
    item_id integer NOT NULL,
    item_code character varying(50),
    item_name character varying(255) NOT NULL,
    source character varying(10) NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: gate_pass_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_items_item_id_seq OWNED BY public.gate_pass_items.item_id;


--
-- Name: gate_pass_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_lines (
    id integer NOT NULL,
    gate_pass_id integer NOT NULL,
    line_no integer NOT NULL,
    item_type character varying(20),
    asset_code character varying(50),
    item_id integer,
    fa_class_code character varying(50),
    description character varying(250) NOT NULL,
    serial_no character varying(100),
    uom character varying(20) NOT NULL,
    quantity integer NOT NULL,
    amount numeric(14,2),
    chargeable character varying(20),
    received_qty integer NOT NULL
);


--
-- Name: gate_pass_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_lines_id_seq OWNED BY public.gate_pass_lines.id;


--
-- Name: gate_pass_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_locations (
    id integer NOT NULL,
    location_code character varying(10) NOT NULL,
    location_name character varying(255) NOT NULL,
    warehouse_code character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: gate_pass_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_locations_id_seq OWNED BY public.gate_pass_locations.id;


--
-- Name: gate_pass_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_sequences (
    id integer NOT NULL,
    location_code character varying(10) NOT NULL,
    pass_type character varying(3) NOT NULL,
    fy_label character varying(10) NOT NULL,
    last_number integer NOT NULL
);


--
-- Name: gate_pass_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_pass_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_pass_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_pass_sequences_id_seq OWNED BY public.gate_pass_sequences.id;


--
-- Name: gate_pass_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_pass_vendors (
    vendor_code character varying(50) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    city character varying(100),
    post_code character varying(20),
    phone_no character varying(20),
    contact character varying(255),
    is_active boolean NOT NULL
);


--
-- Name: insights_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights_data (
    id integer NOT NULL,
    gate_entry_no character varying(50),
    document_type character varying(50),
    sub_document_type character varying(50),
    document_no character varying(100),
    vehicle_no character varying(50),
    warehouse_name character varying(100),
    date timestamp without time zone,
    "time" time without time zone,
    movement_type character varying(20),
    remarks text,
    warehouse_code character varying(50),
    site_code character varying(50),
    security_name character varying(255),
    security_username character varying(255),
    document_date timestamp without time zone,
    driver_name character varying(100),
    km_reading character varying(10),
    loader_count integer,
    loader_names character varying(200),
    interlayer_sheet_count integer DEFAULT 0 NOT NULL,
    last_edited_at timestamp without time zone,
    edit_count integer
);


--
-- Name: insights_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.insights_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insights_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.insights_data_id_seq OWNED BY public.insights_data.id;


--
-- Name: item_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_master (
    item_number character varying(255) NOT NULL,
    product_name character varying(255),
    product_type character varying(255),
    product_subtype character varying(255),
    net_weight character varying(255)
);


--
-- Name: location_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_master (
    warehouse_code character varying(50) NOT NULL,
    warehouse_name character varying(255),
    site_code character varying(50),
    warehouse_id character varying(50)
);


--
-- Name: mfabric_deliverychallan_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfabric_deliverychallan_data (
    document_type character varying(255),
    document_no character varying(255) NOT NULL,
    document_date timestamp with time zone,
    e_way_bill_no character varying(255),
    transporter_name character varying(255),
    vehicle_no character varying(255),
    irn_no character varying(255),
    route_no character varying(255),
    total_quantity integer,
    site character varying(255),
    customer_code character varying(255),
    customer_name character varying(255),
    itemid character varying(255),
    linenum numeric
);


--
-- Name: mfabric_invoice_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfabric_invoice_data (
    document_type character varying(255),
    document_no character varying(255) NOT NULL,
    document_date timestamp with time zone,
    e_way_bill_no character varying(255),
    transporter_name character varying(255),
    vehicle_no character varying(255),
    irn_no character varying(255),
    customer_code character varying(255),
    customer_name character varying(255),
    total_quantity integer,
    site character varying(255),
    itemid character varying(255),
    linenum numeric
);


--
-- Name: mfabric_transferorder_rgp_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfabric_transferorder_rgp_data (
    document_type character varying(255),
    sub_document_type character varying(255),
    document_no character varying(255) NOT NULL,
    document_date timestamp with time zone,
    e_way_bill_no character varying(255),
    transporter_name character varying(255),
    vehicle_no character varying(255),
    irn_no character varying(255),
    from_warehouse_code character varying(255),
    to_warehouse_code character varying(255),
    route_code character varying(255),
    total_quantity integer,
    site character varying(255),
    direct_dispatch character varying(255),
    salesman character varying(255),
    itemid character varying(255),
    linenum numeric
);


--
-- Name: raw_materials_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_materials_data (
    id integer NOT NULL,
    gate_entry_no character varying(50) NOT NULL,
    gate_type character varying(20) NOT NULL,
    vehicle_no character varying(50) NOT NULL,
    document_no character varying(50) NOT NULL,
    name_of_party character varying(255) NOT NULL,
    description_of_material character varying(255) NOT NULL,
    quantity character varying(255) NOT NULL,
    date_time timestamp without time zone NOT NULL,
    security_name character varying(100) NOT NULL,
    security_username character varying(50) NOT NULL,
    warehouse_code character varying(50) NOT NULL,
    site_code character varying(50) NOT NULL,
    last_edited_at timestamp without time zone,
    edit_count integer
);


--
-- Name: raw_materials_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raw_materials_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raw_materials_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raw_materials_data_id_seq OWNED BY public.raw_materials_data.id;


--
-- Name: user_gate_pass_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_gate_pass_locations (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    location_code character varying(10) NOT NULL,
    is_default boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_gate_pass_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_gate_pass_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_gate_pass_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_gate_pass_locations_id_seq OWNED BY public.user_gate_pass_locations.id;


--
-- Name: users_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_master (
    username character varying(50) NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    role character varying(50),
    warehouse_code character varying(50),
    warehouse_name character varying(255),
    site_code character varying(50),
    password character varying(255),
    email character varying(255),
    phone_number character varying(20),
    last_login timestamp without time zone,
    copacker_location character varying(255),
    department character varying(50),
    gate_pass_location character varying(50),
    is_active boolean
);


--
-- Name: copacker_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_assets ALTER COLUMN id SET DEFAULT nextval('public.copacker_assets_id_seq'::regclass);


--
-- Name: copacker_capture_edit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_capture_edit_log ALTER COLUMN id SET DEFAULT nextval('public.copacker_capture_edit_log_id_seq'::regclass);


--
-- Name: copacker_captures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_captures ALTER COLUMN id SET DEFAULT nextval('public.copacker_captures_id_seq'::regclass);


--
-- Name: copacker_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_entries ALTER COLUMN id SET DEFAULT nextval('public.copacker_entries_id_seq'::regclass);


--
-- Name: copacker_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_locations ALTER COLUMN id SET DEFAULT nextval('public.copacker_locations_id_seq'::regclass);


--
-- Name: copacker_quantity_edit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_quantity_edit_log ALTER COLUMN id SET DEFAULT nextval('public.copacker_quantity_edit_log_id_seq'::regclass);


--
-- Name: copacker_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_sessions ALTER COLUMN id SET DEFAULT nextval('public.copacker_sessions_id_seq'::regclass);


--
-- Name: gate_pass_cancel_reasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_cancel_reasons ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_cancel_reasons_id_seq'::regclass);


--
-- Name: gate_pass_departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_departments ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_departments_id_seq'::regclass);


--
-- Name: gate_pass_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_events ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_events_id_seq'::regclass);


--
-- Name: gate_pass_headers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_headers ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_headers_id_seq'::regclass);


--
-- Name: gate_pass_items item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_items ALTER COLUMN item_id SET DEFAULT nextval('public.gate_pass_items_item_id_seq'::regclass);


--
-- Name: gate_pass_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_lines ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_lines_id_seq'::regclass);


--
-- Name: gate_pass_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_locations ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_locations_id_seq'::regclass);


--
-- Name: gate_pass_sequences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_sequences ALTER COLUMN id SET DEFAULT nextval('public.gate_pass_sequences_id_seq'::regclass);


--
-- Name: insights_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights_data ALTER COLUMN id SET DEFAULT nextval('public.insights_data_id_seq'::regclass);


--
-- Name: raw_materials_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_materials_data ALTER COLUMN id SET DEFAULT nextval('public.raw_materials_data_id_seq'::regclass);


--
-- Name: user_gate_pass_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gate_pass_locations ALTER COLUMN id SET DEFAULT nextval('public.user_gate_pass_locations_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: copacker_assets copacker_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_assets
    ADD CONSTRAINT copacker_assets_pkey PRIMARY KEY (id);


--
-- Name: copacker_capture_edit_log copacker_capture_edit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_capture_edit_log
    ADD CONSTRAINT copacker_capture_edit_log_pkey PRIMARY KEY (id);


--
-- Name: copacker_captures copacker_captures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_captures
    ADD CONSTRAINT copacker_captures_pkey PRIMARY KEY (id);


--
-- Name: copacker_entries copacker_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_entries
    ADD CONSTRAINT copacker_entries_pkey PRIMARY KEY (id);


--
-- Name: copacker_locations copacker_locations_location_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_locations
    ADD CONSTRAINT copacker_locations_location_name_key UNIQUE (location_name);


--
-- Name: copacker_locations copacker_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_locations
    ADD CONSTRAINT copacker_locations_pkey PRIMARY KEY (id);


--
-- Name: copacker_quantity_edit_log copacker_quantity_edit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_quantity_edit_log
    ADD CONSTRAINT copacker_quantity_edit_log_pkey PRIMARY KEY (id);


--
-- Name: copacker_sessions copacker_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_sessions
    ADD CONSTRAINT copacker_sessions_pkey PRIMARY KEY (id);


--
-- Name: document_data document_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_data
    ADD CONSTRAINT document_data_pkey PRIMARY KEY (document_no);


--
-- Name: gate_pass_assets gate_pass_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_assets
    ADD CONSTRAINT gate_pass_assets_pkey PRIMARY KEY (asset_code);


--
-- Name: gate_pass_cancel_reasons gate_pass_cancel_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_cancel_reasons
    ADD CONSTRAINT gate_pass_cancel_reasons_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_cancel_reasons gate_pass_cancel_reasons_reason_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_cancel_reasons
    ADD CONSTRAINT gate_pass_cancel_reasons_reason_text_key UNIQUE (reason_text);


--
-- Name: gate_pass_customers gate_pass_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_customers
    ADD CONSTRAINT gate_pass_customers_pkey PRIMARY KEY (customer_code);


--
-- Name: gate_pass_departments gate_pass_departments_department_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_departments
    ADD CONSTRAINT gate_pass_departments_department_name_key UNIQUE (department_name);


--
-- Name: gate_pass_departments gate_pass_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_departments
    ADD CONSTRAINT gate_pass_departments_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_events gate_pass_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_events
    ADD CONSTRAINT gate_pass_events_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_headers gate_pass_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_headers
    ADD CONSTRAINT gate_pass_headers_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_items gate_pass_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_items
    ADD CONSTRAINT gate_pass_items_pkey PRIMARY KEY (item_id);


--
-- Name: gate_pass_lines gate_pass_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_lines
    ADD CONSTRAINT gate_pass_lines_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_locations gate_pass_locations_location_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_locations
    ADD CONSTRAINT gate_pass_locations_location_code_key UNIQUE (location_code);


--
-- Name: gate_pass_locations gate_pass_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_locations
    ADD CONSTRAINT gate_pass_locations_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_sequences gate_pass_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_sequences
    ADD CONSTRAINT gate_pass_sequences_pkey PRIMARY KEY (id);


--
-- Name: gate_pass_vendors gate_pass_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_vendors
    ADD CONSTRAINT gate_pass_vendors_pkey PRIMARY KEY (vendor_code);


--
-- Name: insights_data insights_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights_data
    ADD CONSTRAINT insights_data_pkey PRIMARY KEY (id);


--
-- Name: item_master item_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_master
    ADD CONSTRAINT item_master_pkey PRIMARY KEY (item_number);


--
-- Name: location_master location_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_master
    ADD CONSTRAINT location_master_pkey PRIMARY KEY (warehouse_code);


--
-- Name: mfabric_deliverychallan_data mfabric_deliverychallan_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfabric_deliverychallan_data
    ADD CONSTRAINT mfabric_deliverychallan_data_pkey PRIMARY KEY (document_no);


--
-- Name: mfabric_invoice_data mfabric_invoice_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfabric_invoice_data
    ADD CONSTRAINT mfabric_invoice_data_pkey PRIMARY KEY (document_no);


--
-- Name: mfabric_transferorder_rgp_data mfabric_transferorder_rgp_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfabric_transferorder_rgp_data
    ADD CONSTRAINT mfabric_transferorder_rgp_data_pkey PRIMARY KEY (document_no);


--
-- Name: raw_materials_data raw_materials_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_materials_data
    ADD CONSTRAINT raw_materials_data_pkey PRIMARY KEY (id);


--
-- Name: copacker_assets uq_copacker_asset_location_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_assets
    ADD CONSTRAINT uq_copacker_asset_location_line UNIQUE (location_id, line_no);


--
-- Name: gate_pass_lines uq_gate_pass_line_no; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_lines
    ADD CONSTRAINT uq_gate_pass_line_no UNIQUE (gate_pass_id, line_no);


--
-- Name: gate_pass_sequences uq_gate_pass_seq_loc_type_fy; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_sequences
    ADD CONSTRAINT uq_gate_pass_seq_loc_type_fy UNIQUE (location_code, pass_type, fy_label);


--
-- Name: user_gate_pass_locations user_gate_pass_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gate_pass_locations
    ADD CONSTRAINT user_gate_pass_locations_pkey PRIMARY KEY (id);


--
-- Name: user_gate_pass_locations user_gate_pass_locations_username_location_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gate_pass_locations
    ADD CONSTRAINT user_gate_pass_locations_username_location_code_key UNIQUE (username, location_code);


--
-- Name: users_master users_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_master
    ADD CONSTRAINT users_master_pkey PRIMARY KEY (username);


--
-- Name: idx_copacker_entries_location_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copacker_entries_location_date ON public.copacker_entries USING btree (copacker_location, entry_date);


--
-- Name: idx_copacker_qty_edit_log_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copacker_qty_edit_log_entry ON public.copacker_quantity_edit_log USING btree (entry_id);


--
-- Name: idx_cp_captures_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_captures_session ON public.copacker_captures USING btree (session_id);


--
-- Name: idx_cp_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_sessions_created ON public.copacker_sessions USING btree (created_at DESC);


--
-- Name: idx_cp_sessions_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_sessions_location ON public.copacker_sessions USING btree (copacker_location);


--
-- Name: idx_cp_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cp_sessions_user ON public.copacker_sessions USING btree (submitted_by);


--
-- Name: idx_document_data_document_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_data_document_date ON public.document_data USING btree (document_date);


--
-- Name: idx_document_data_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_data_document_type ON public.document_data USING btree (document_type);


--
-- Name: idx_document_data_gate_entry_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_data_gate_entry_no ON public.document_data USING btree (gate_entry_no);


--
-- Name: idx_document_data_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_data_vehicle_no ON public.document_data USING btree (vehicle_no);


--
-- Name: idx_document_data_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_data_warehouse_code ON public.document_data USING btree (warehouse_code);


--
-- Name: idx_gpe_pass; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gpe_pass ON public.gate_pass_events USING btree (gate_pass_id);


--
-- Name: idx_gph_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_created_at ON public.gate_pass_headers USING btree (created_at);


--
-- Name: idx_gph_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_department ON public.gate_pass_headers USING btree (department);


--
-- Name: idx_gph_expected_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_expected_date ON public.gate_pass_headers USING btree (expected_inward_date);


--
-- Name: idx_gph_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_location ON public.gate_pass_headers USING btree (location_code);


--
-- Name: idx_gph_pass_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_pass_type ON public.gate_pass_headers USING btree (pass_type);


--
-- Name: idx_gph_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_status ON public.gate_pass_headers USING btree (status);


--
-- Name: idx_gph_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gph_warehouse ON public.gate_pass_headers USING btree (warehouse_code);


--
-- Name: idx_gpl_pass; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gpl_pass ON public.gate_pass_lines USING btree (gate_pass_id);


--
-- Name: idx_insights_data_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_date ON public.insights_data USING btree (date);


--
-- Name: idx_insights_data_gate_entry_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_gate_entry_no ON public.insights_data USING btree (gate_entry_no);


--
-- Name: idx_insights_data_movement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_movement_type ON public.insights_data USING btree (movement_type);


--
-- Name: idx_insights_data_security_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_security_username ON public.insights_data USING btree (security_username);


--
-- Name: idx_insights_data_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_vehicle_no ON public.insights_data USING btree (vehicle_no);


--
-- Name: idx_insights_data_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_data_warehouse_code ON public.insights_data USING btree (warehouse_code);


--
-- Name: idx_location_master_site_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_master_site_code ON public.location_master USING btree (site_code);


--
-- Name: idx_mfabric_dc_document_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_dc_document_date ON public.mfabric_deliverychallan_data USING btree (document_date);


--
-- Name: idx_mfabric_dc_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_dc_vehicle_no ON public.mfabric_deliverychallan_data USING btree (vehicle_no);


--
-- Name: idx_mfabric_inv_document_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_inv_document_date ON public.mfabric_invoice_data USING btree (document_date);


--
-- Name: idx_mfabric_inv_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_inv_vehicle_no ON public.mfabric_invoice_data USING btree (vehicle_no);


--
-- Name: idx_mfabric_to_document_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_to_document_date ON public.mfabric_transferorder_rgp_data USING btree (document_date);


--
-- Name: idx_mfabric_to_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_to_vehicle_no ON public.mfabric_transferorder_rgp_data USING btree (vehicle_no);


--
-- Name: idx_mfabric_to_warehouse_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfabric_to_warehouse_codes ON public.mfabric_transferorder_rgp_data USING btree (from_warehouse_code, to_warehouse_code);


--
-- Name: idx_raw_materials_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_materials_date_time ON public.raw_materials_data USING btree (date_time);


--
-- Name: idx_raw_materials_gate_entry_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_materials_gate_entry_no ON public.raw_materials_data USING btree (gate_entry_no);


--
-- Name: idx_raw_materials_security_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_materials_security_username ON public.raw_materials_data USING btree (security_username);


--
-- Name: idx_raw_materials_vehicle_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_materials_vehicle_no ON public.raw_materials_data USING btree (vehicle_no);


--
-- Name: idx_raw_materials_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_materials_warehouse_code ON public.raw_materials_data USING btree (warehouse_code);


--
-- Name: idx_users_master_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_master_role ON public.users_master USING btree (role);


--
-- Name: idx_users_master_site_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_master_site_code ON public.users_master USING btree (site_code);


--
-- Name: idx_users_master_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_master_warehouse_code ON public.users_master USING btree (warehouse_code);


--
-- Name: ix_gate_pass_events_gate_pass_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_events_gate_pass_id ON public.gate_pass_events USING btree (gate_pass_id);


--
-- Name: ix_gate_pass_headers_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_department ON public.gate_pass_headers USING btree (department);


--
-- Name: ix_gate_pass_headers_expected_inward_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_expected_inward_date ON public.gate_pass_headers USING btree (expected_inward_date);


--
-- Name: ix_gate_pass_headers_gate_pass_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_gate_pass_headers_gate_pass_no ON public.gate_pass_headers USING btree (gate_pass_no);


--
-- Name: ix_gate_pass_headers_location_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_location_code ON public.gate_pass_headers USING btree (location_code);


--
-- Name: ix_gate_pass_headers_pass_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_pass_type ON public.gate_pass_headers USING btree (pass_type);


--
-- Name: ix_gate_pass_headers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_status ON public.gate_pass_headers USING btree (status);


--
-- Name: ix_gate_pass_headers_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_headers_warehouse_code ON public.gate_pass_headers USING btree (warehouse_code);


--
-- Name: ix_gate_pass_lines_gate_pass_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gate_pass_lines_gate_pass_id ON public.gate_pass_lines USING btree (gate_pass_id);


--
-- Name: ix_insights_data_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_insights_data_date ON public.insights_data USING btree (date);


--
-- Name: ix_insights_data_movement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_insights_data_movement_type ON public.insights_data USING btree (movement_type);


--
-- Name: ix_insights_data_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_insights_data_warehouse_code ON public.insights_data USING btree (warehouse_code);


--
-- Name: ix_insights_warehouse_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_insights_warehouse_date ON public.insights_data USING btree (warehouse_code, date);


--
-- Name: ix_raw_materials_data_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_raw_materials_data_date_time ON public.raw_materials_data USING btree (date_time);


--
-- Name: ix_raw_materials_data_gate_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_raw_materials_data_gate_type ON public.raw_materials_data USING btree (gate_type);


--
-- Name: ix_raw_materials_data_warehouse_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_raw_materials_data_warehouse_code ON public.raw_materials_data USING btree (warehouse_code);


--
-- Name: ix_rm_warehouse_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_rm_warehouse_datetime ON public.raw_materials_data USING btree (warehouse_code, date_time);


--
-- Name: ix_user_gate_pass_locations_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_gate_pass_locations_username ON public.user_gate_pass_locations USING btree (username);


--
-- Name: copacker_assets copacker_assets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_assets
    ADD CONSTRAINT copacker_assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.copacker_locations(id);


--
-- Name: copacker_capture_edit_log copacker_capture_edit_log_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_capture_edit_log
    ADD CONSTRAINT copacker_capture_edit_log_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.copacker_captures(id) ON DELETE CASCADE;


--
-- Name: copacker_captures copacker_captures_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_captures
    ADD CONSTRAINT copacker_captures_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.copacker_sessions(id) ON DELETE CASCADE;


--
-- Name: copacker_quantity_edit_log copacker_quantity_edit_log_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copacker_quantity_edit_log
    ADD CONSTRAINT copacker_quantity_edit_log_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.copacker_entries(id);


--
-- Name: gate_pass_events gate_pass_events_gate_pass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_events
    ADD CONSTRAINT gate_pass_events_gate_pass_id_fkey FOREIGN KEY (gate_pass_id) REFERENCES public.gate_pass_headers(id) ON DELETE CASCADE;


--
-- Name: gate_pass_headers gate_pass_headers_cancel_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_headers
    ADD CONSTRAINT gate_pass_headers_cancel_reason_id_fkey FOREIGN KEY (cancel_reason_id) REFERENCES public.gate_pass_cancel_reasons(id);


--
-- Name: gate_pass_lines gate_pass_lines_gate_pass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_pass_lines
    ADD CONSTRAINT gate_pass_lines_gate_pass_id_fkey FOREIGN KEY (gate_pass_id) REFERENCES public.gate_pass_headers(id) ON DELETE CASCADE;


--
-- Name: user_gate_pass_locations user_gate_pass_locations_location_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gate_pass_locations
    ADD CONSTRAINT user_gate_pass_locations_location_code_fkey FOREIGN KEY (location_code) REFERENCES public.gate_pass_locations(location_code);


--
-- Name: user_gate_pass_locations user_gate_pass_locations_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gate_pass_locations
    ADD CONSTRAINT user_gate_pass_locations_username_fkey FOREIGN KEY (username) REFERENCES public.users_master(username) ON DELETE CASCADE;


--
-- Name: users_master users_master_warehouse_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_master
    ADD CONSTRAINT users_master_warehouse_code_fkey FOREIGN KEY (warehouse_code) REFERENCES public.location_master(warehouse_code);


--
-- PostgreSQL database dump complete
--

-- Column defaults
-- The live database carries these server-side defaults (the SQLAlchemy models only
-- apply them in Python), so raw SQL inserts and the Fabric sync keep working.
ALTER TABLE ONLY public.copacker_quantity_edit_log ALTER COLUMN field_name SET DEFAULT 'extracted_quantity';
ALTER TABLE ONLY public.copacker_sessions ALTER COLUMN status SET DEFAULT 'in_progress';
ALTER TABLE ONLY public.gate_pass_cancel_reasons ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_cancel_reasons ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE ONLY public.gate_pass_departments ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_departments ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE ONLY public.gate_pass_vendors ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_customers ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_assets ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_items ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_items ALTER COLUMN source SET DEFAULT 'FABRIC';
ALTER TABLE ONLY public.gate_pass_locations ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE ONLY public.gate_pass_headers ALTER COLUMN status SET DEFAULT 'Open';
ALTER TABLE ONLY public.gate_pass_lines ALTER COLUMN received_qty SET DEFAULT 0;
ALTER TABLE ONLY public.gate_pass_lines ALTER COLUMN uom SET DEFAULT 'NOS';
ALTER TABLE ONLY public.gate_pass_sequences ALTER COLUMN last_number SET DEFAULT 0;
ALTER TABLE ONLY public.gate_pass_sequences ALTER COLUMN fy_label SET DEFAULT '';
ALTER TABLE ONLY public.insights_data ALTER COLUMN edit_count SET DEFAULT 0;
ALTER TABLE ONLY public.raw_materials_data ALTER COLUMN edit_count SET DEFAULT 0;
ALTER TABLE ONLY public.users_master ALTER COLUMN is_active SET DEFAULT true;

-- Audit trail / Security Settings / dormant-account alerts (Alembic b9e4d2a7c1f5, 26 Nov 2026)
--

ALTER TABLE public.users_master ADD COLUMN created_at timestamp without time zone DEFAULT now();
ALTER TABLE public.users_master ADD COLUMN last_seen_at timestamp without time zone;

CREATE TABLE public.audit_log (
    id bigserial PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor character varying(50),
    action character varying(50) NOT NULL,
    target_user character varying(50),
    details json,
    reason character varying(500),
    ip character varying(64)
);
CREATE INDEX ix_audit_log_target_created ON public.audit_log (target_user, created_at);
CREATE INDEX ix_audit_log_created ON public.audit_log (created_at);
CREATE INDEX ix_audit_log_action ON public.audit_log (action);

CREATE TABLE public.security_settings (
    key character varying(50) PRIMARY KEY,
    value text,
    updated_by character varying(50),
    updated_at timestamp with time zone DEFAULT now()
);
INSERT INTO public.security_settings (key, value, updated_by) VALUES
    ('inactive_days', '90', 'migration'), ('warning_days', '75', 'migration'),
    ('never_used_days', '30', 'migration'), ('alerts_enabled', 'true', 'migration'),
    ('alert_inapp', 'true', 'migration'), ('alert_email', 'false', 'migration'),
    ('alert_emails', '', 'migration'), ('exempt_users', '', 'migration');

CREATE TABLE public.security_alerts (
    id bigserial PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username character varying(50) NOT NULL,
    kind character varying(30) NOT NULL,
    days integer,
    message character varying(500),
    status character varying(15) DEFAULT 'open' NOT NULL,
    handled_by character varying(50),
    handled_at timestamp with time zone,
    emailed_at timestamp with time zone
);
CREATE INDEX ix_security_alerts_status ON public.security_alerts (status);
CREATE INDEX ix_security_alerts_user_kind ON public.security_alerts (username, kind);

--
-- Blinkit Inventory Portal (Alembic c4e8a1f7d2b9, 26 Nov 2026 — store master version)
--

ALTER TABLE public.item_master ADD COLUMN search_name character varying(255);
ALTER TABLE public.item_master ADD COLUMN product_service_type character varying(100);
ALTER TABLE public.item_master ADD COLUMN product_dimension_group character varying(50);
ALTER TABLE public.item_master ADD COLUMN product_lifecycle_state character varying(50);
ALTER TABLE public.item_master ADD COLUMN packing_group character varying(100);
ALTER TABLE public.item_master ADD COLUMN item_group character varying(20);

CREATE TABLE public.blinkit_stores (
    id serial PRIMARY KEY,
    store_code character varying(50) NOT NULL,
    store_name character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT uq_blinkit_stores_store_code UNIQUE (store_code)
);

CREATE TABLE public.inventory_batches (
    id bigserial PRIMARY KEY,
    source character varying(10) NOT NULL,
    file_name character varying(255),
    line_count integer DEFAULT 0 NOT NULL,
    created_by character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_entries (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.inventory_batches(id),
    inv_date date NOT NULL,
    store_code character varying(50) NOT NULL REFERENCES public.blinkit_stores(store_code),
    warehouse_code character varying(50) NOT NULL REFERENCES public.location_master(warehouse_code),
    warehouse_name character varying(255),
    sku_code character varying(255) NOT NULL REFERENCES public.item_master(item_number),
    sku_name character varying(255),
    quantity integer NOT NULL,
    batch_no character varying(100),
    mfg_date date,
    created_by character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_inventory_entries_quantity_positive CHECK (quantity > 0)
);
CREATE INDEX ix_inventory_entries_batch_id ON public.inventory_entries (batch_id);
CREATE INDEX ix_inventory_entries_date_wh ON public.inventory_entries (inv_date, warehouse_code);
CREATE INDEX ix_inventory_entries_store_date ON public.inventory_entries (store_code, inv_date);

CREATE TABLE public.inventory_user_warehouses (
    username character varying(50) NOT NULL REFERENCES public.users_master(username) ON DELETE CASCADE,
    warehouse_code character varying(50) NOT NULL REFERENCES public.location_master(warehouse_code),
    PRIMARY KEY (username, warehouse_code)
);

CREATE TABLE public.inventory_operator_viewers (
    operator_username character varying(50) NOT NULL REFERENCES public.users_master(username) ON DELETE CASCADE,
    viewer_username character varying(50) NOT NULL REFERENCES public.users_master(username) ON DELETE CASCADE,
    PRIMARY KEY (operator_username, viewer_username)
);

CREATE TABLE public.inventory_viewer_store (
    username character varying(50) PRIMARY KEY REFERENCES public.users_master(username) ON DELETE CASCADE,
    store_code character varying(50) NOT NULL REFERENCES public.blinkit_stores(store_code)
);
CREATE INDEX ix_inventory_viewer_store_store_code ON public.inventory_viewer_store (store_code);

--
-- Alembic version stamp (head)
--
INSERT INTO public.alembic_version (version_num) VALUES ('c4e8a1f7d2b9');
