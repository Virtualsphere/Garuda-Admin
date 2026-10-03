-- Garuda database schema & relationships
-- Generated from live introspection of the local Postgres "garuda" DB
-- (information_schema.columns / table_constraints / key_column_usage / referential_constraints)
-- Source: Garuda-Backend-2, 2026-09-16
-- 55 tables, 66 foreign keys, grouped by business domain below.

-- ============================================================
-- Auth & RBAC
-- ============================================================

CREATE TABLE employees (
    id INTEGER NOT NULL DEFAULT nextval('employees_id_seq'::regclass),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    password VARCHAR(255),
    secondary_role JSONB,
    email VARCHAR(255),
    phone VARCHAR(255),
    other_phone VARCHAR(255),
    blood_group VARCHAR(255),
    about TEXT,
    photo TEXT,
    status ENUM DEFAULT 'ACTIVE'::enum_employees_status,
    aadhar_number VARCHAR(255),
    aadhar_photo VARCHAR(255),
    bank_name VARCHAR(255),
    account_number VARCHAR(255),
    ifsc_code VARCHAR(255),
    phone_pe_number VARCHAR(255),
    google_pay_number VARCHAR(255),
    upi_id VARCHAR(255),
    address TEXT,
    shirt_size VARCHAR(255),
    work_state VARCHAR(255),
    work_district JSONB,
    work_mandal JSONB,
    work_village JSONB,
    new_land_price DOUBLE PRECISION,
    verification_price DOUBLE PRECISION,
    buyer_visit_price DOUBLE PRECISION,
    referal_price DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    gender VARCHAR(255),
    date_of_birth DATE,
    house_no VARCHAR(255),
    colony VARCHAR(255),
    home_village VARCHAR(255),
    home_mandal VARCHAR(255),
    home_town VARCHAR(255),
    home_district VARCHAR(255),
    assigned_hub VARCHAR(255),
    contract_start_date DATE,
    contract_end_date DATE,
    cadre VARCHAR(255),
    duty_status VARCHAR(255) DEFAULT 'offline'::character varying,
    PRIMARY KEY (id)
);

CREATE TABLE employee_permissions (
    id INTEGER NOT NULL DEFAULT nextval('employee_permissions_id_seq'::regclass),
    employee_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    type ENUM NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE permissions (
    id INTEGER NOT NULL DEFAULT nextval('permissions_id_seq'::regclass),
    key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE roles (
    id INTEGER NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE role_permissions (
    id INTEGER NOT NULL DEFAULT nextval('role_permissions_id_seq'::regclass),
    role_name VARCHAR(255) NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE refresh_tokens (
    id INTEGER NOT NULL DEFAULT nextval('refresh_tokens_id_seq'::regclass),
    user_id INTEGER,
    role VARCHAR(255),
    token TEXT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE access (
    id INTEGER NOT NULL DEFAULT nextval('access_id_seq'::regclass),
    app_type ENUM,
    role VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE session (
    id INTEGER NOT NULL DEFAULT nextval('session_id_seq'::regclass),
    employee_id INTEGER NOT NULL,
    start_km INTEGER,
    end_km INTEGER,
    session_start_time TIMESTAMPTZ,
    session_end_time TIMESTAMPTZ,
    start_photo JSONB,
    end_photo JSONB,
    petrol_charges DOUBLE PRECISION,
    status ENUM DEFAULT 'ACTIVE'::enum_session_status,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE session_expense (
    id INTEGER NOT NULL DEFAULT nextval('session_expense_id_seq'::regclass),
    session_id INTEGER,
    type ENUM,
    amount DOUBLE PRECISION,
    description TEXT,
    photo TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updatedAt TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Location hierarchy
-- ============================================================

CREATE TABLE state (
    id INTEGER NOT NULL DEFAULT nextval('state_id_seq'::regclass),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE district (
    id INTEGER NOT NULL DEFAULT nextval('district_id_seq'::regclass),
    state_id INTEGER,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE mandal (
    id INTEGER NOT NULL DEFAULT nextval('mandal_id_seq'::regclass),
    district_id INTEGER,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    PRIMARY KEY (id)
);

CREATE TABLE town (
    id INTEGER NOT NULL DEFAULT nextval('town_id_seq'::regclass),
    district_id INTEGER,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE village (
    id INTEGER NOT NULL DEFAULT nextval('village_id_seq'::regclass),
    mandal_id INTEGER,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    PRIMARY KEY (id)
);

CREATE TABLE employee_town (
    id INTEGER NOT NULL DEFAULT nextval('employee_town_id_seq'::regclass),
    employee_id INTEGER,
    town1 VARCHAR(255) NOT NULL,
    town2 VARCHAR(255) NOT NULL,
    town3 VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE path (
    id INTEGER NOT NULL DEFAULT nextval('path_id_seq'::regclass),
    employee_id INTEGER NOT NULL,
    path_type ENUM,
    path VARCHAR(255),
    photo JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Land
-- ============================================================

CREATE TABLE land (
    id INTEGER NOT NULL DEFAULT nextval('land_id_seq'::regclass),
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255),
    nearest_town_1 VARCHAR(255),
    nearest_town_1_km BIGINT,
    nearest_town_2 VARCHAR(255),
    nearest_town_2_km BIGINT,
    nearest_town_3 VARCHAR(255),
    nearest_town_3_km BIGINT,
    trainee BOOLEAN,
    location_latitude TEXT,
    location_longitude TEXT,
    land_sale_available_status JSONB,
    mortage_availability_status JSONB,
    urgency_listing JSONB,
    verification_package BOOLEAN,
    created_by INTEGER,
    verified_by INTEGER,
    call_verification_by INTEGER,
    agent_id INTEGER,
    call_verification_status ENUM DEFAULT 'pending'::enum_land_call_verification_status,
    form_status ENUM DEFAULT 'complete'::enum_land_form_status,
    physcial_verification_status ENUM DEFAULT 'pending'::enum_land_physcial_verification_status,
    verification_status ENUM DEFAULT 'pending'::enum_land_verification_status,
    availablity ENUM DEFAULT 'available'::enum_land_availablity,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_details (
    id INTEGER NOT NULL DEFAULT nextval('land_details_id_seq'::regclass),
    land_id INTEGER,
    total_acres DOUBLE PRECISION,
    guntas DOUBLE PRECISION,
    price_per_acres DOUBLE PRECISION,
    total_value DOUBLE PRECISION,
    nearest_road_type VARCHAR(255),
    land_attached_to_road ENUM,
    path_ownership VARCHAR(255),
    land_entry_latitude TEXT,
    land_entry_longitude TEXT,
    land_boundary_latitude TEXT,
    land_boundary_longitude TEXT,
    soil_type VARCHAR(255),
    fencing_status VARCHAR(255),
    electricity JSONB,
    residence JSONB,
    poultry_shed_number INTEGER,
    cow_shed_number INTEGER,
    water_source JSONB,
    number_of_bores INTEGER,
    farm_pond BOOLEAN,
    complaints JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_documents (
    id INTEGER NOT NULL DEFAULT nextval('land_documents_id_seq'::regclass),
    land_id INTEGER,
    doc_type ENUM,
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_feedback (
    id INTEGER NOT NULL DEFAULT nextval('land_feedback_id_seq'::regclass),
    employee_id INTEGER,
    user_id INTEGER,
    buyer_aggrement TEXT,
    land_id INTEGER,
    land_feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_gps (
    id INTEGER NOT NULL DEFAULT nextval('land_gps_id_seq'::regclass),
    land_id INTEGER,
    latitude TEXT,
    longitude TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_media (
    id INTEGER NOT NULL DEFAULT nextval('land_media_id_seq'::regclass),
    land_id INTEGER,
    category ENUM,
    type ENUM,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_observation (
    id INTEGER NOT NULL DEFAULT nextval('land_observation_id_seq'::regclass),
    land_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    frequency VARCHAR(255) DEFAULT 'ONE_TIME'::character varying,
    status VARCHAR(255) DEFAULT 'ACTIVE'::character varying,
    next_due_date DATE,
    last_submitted_at TIMESTAMPTZ,
    notes TEXT,
    assigned_by INTEGER,
    PRIMARY KEY (id)
);

CREATE TABLE land_observation_submission (
    id INTEGER NOT NULL DEFAULT nextval('land_observation_submission_id_seq'::regclass),
    observation_id INTEGER NOT NULL,
    land_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    is_available VARCHAR(255) DEFAULT 'NOT_SURE'::character varying,
    owner_willing_to_sell VARCHAR(255) DEFAULT 'NEED_CONFIRMATION'::character varying,
    reported_price_per_acre NUMERIC,
    previous_price_per_acre NUMERIC,
    verified_price_per_acre NUMERIC,
    price_change_status VARCHAR(255) DEFAULT 'NO_CHANGE'::character varying,
    buyer_activity VARCHAR(255) DEFAULT 'UNKNOWN'::character varying,
    land_sold VARCHAR(255) DEFAULT 'NO'::character varying,
    agreement_made VARCHAR(255) DEFAULT 'UNKNOWN'::character varying,
    condition_change VARCHAR(255) DEFAULT 'NO_CHANGE'::character varying,
    local_issue VARCHAR(255) DEFAULT 'NO'::character varying,
    remarks TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    gps_latitude VARCHAR(255),
    gps_longitude VARCHAR(255),
    verification_status VARCHAR(255) DEFAULT 'PENDING'::character varying,
    verified_by INTEGER,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_shed_Dimensions (
    id INTEGER NOT NULL DEFAULT nextval('"land_shed_Dimensions_id_seq"'::regclass),
    land_id INTEGER,
    poultry_shed_length BIGINT,
    poultry_shed_width BIGINT,
    cow_shed_length BIGINT,
    cow_shed_width BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE land_tree (
    id INTEGER NOT NULL DEFAULT nextval('land_tree_id_seq'::regclass),
    land_id INTEGER,
    type VARCHAR(255),
    count BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE primary_visit (
    id INTEGER NOT NULL DEFAULT nextval('primary_visit_id_seq'::regclass),
    land_id INTEGER,
    employee_id INTEGER,
    user_id INTEGER,
    visit_date TIMESTAMPTZ,
    time TIME WITHOUT TIME ZONE,
    meeting_status ENUM DEFAULT 'Scheduled'::enum_primary_visit_meeting_status,
    land_visit_photos JSONB,
    fee_receipt JSONB,
    buyer_visit JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE availibility (
    id INTEGER NOT NULL DEFAULT nextval('availibility_id_seq'::regclass),
    land_id INTEGER,
    user_id INTEGER,
    status ENUM DEFAULT 'available'::enum_availibility_status,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Farmers
-- ============================================================

CREATE TABLE farmer_details (
    id INTEGER NOT NULL DEFAULT nextval('farmer_details_id_seq'::regclass),
    land_id INTEGER,
    name VARCHAR(255),
    phone VARCHAR(255),
    whatsapp_status BOOLEAN,
    whatsapp VARCHAR(255),
    ownership_type ENUM,
    locality ENUM,
    ownership_status ENUM,
    age ENUM,
    literacy ENUM,
    nature ENUM,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Buyers
-- ============================================================

CREATE TABLE buyers (
    id INTEGER NOT NULL DEFAULT nextval('buyers_id_seq'::regclass),
    name VARCHAR(255) NOT NULL,
    buyer_code VARCHAR(255),
    executive_id INTEGER,
    email VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(255),
    photo VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMPTZ,
    otp_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    budget_range VARCHAR(255),
    required_extent VARCHAR(255),
    preferred_location VARCHAR(255),
    notes TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE cart (
    id INTEGER NOT NULL DEFAULT nextval('cart_id_seq'::regclass),
    land_id INTEGER,
    user_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE wish_list (
    id INTEGER NOT NULL DEFAULT nextval('wish_list_id_seq'::regclass),
    land_id INTEGER,
    user_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE final_list (
    id INTEGER NOT NULL DEFAULT nextval('final_list_id_seq'::regclass),
    land_id INTEGER,
    user_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE shortlisting (
    id INTEGER NOT NULL DEFAULT nextval('shortlisting_id_seq'::regclass),
    land_id INTEGER,
    user_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE payment (
    id INTEGER NOT NULL DEFAULT nextval('payment_id_seq'::regclass),
    amount DOUBLE PRECISION,
    payment_status ENUM DEFAULT 'pending'::enum_payment_payment_status,
    user_id INTEGER,
    land_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Agents / Recruitment
-- ============================================================

CREATE TABLE agent (
    id INTEGER NOT NULL DEFAULT nextval('agent_id_seq'::regclass),
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(255),
    refered_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    alternate_phone VARCHAR(255),
    email VARCHAR(255),
    address TEXT,
    joining_date DATE,
    status VARCHAR(255) DEFAULT 'ACTIVE'::character varying,
    membership_status VARCHAR(255) DEFAULT 'PENDING'::character varying,
    membership_amount NUMERIC DEFAULT 0,
    commission_earned NUMERIC DEFAULT 0,
    commission_paid NUMERIC DEFAULT 0,
    lead_source VARCHAR(255),
    rating NUMERIC,
    source_candidate_id INTEGER,
    photo VARCHAR(255),
    id_proof_url VARCHAR(255),
    id_proof_uploaded BOOLEAN DEFAULT false,
    address_proof_url VARCHAR(255),
    address_proof_uploaded BOOLEAN DEFAULT false,
    agreement_url VARCHAR(255),
    agreement_uploaded BOOLEAN DEFAULT false,
    security_deposit NUMERIC DEFAULT 0,
    onboarded_by INTEGER,
    onboarding_completed_at TIMESTAMPTZ,
    agreement_date DATE,
    receipt_no VARCHAR(255),
    native_village_queued BOOLEAN DEFAULT false,
    native_village_queue_reason TEXT,
    coordination_executive_id INTEGER,
    PRIMARY KEY (id)
);

CREATE TABLE agent_candidate (
    id INTEGER NOT NULL DEFAULT nextval('agent_candidate_id_seq'::regclass),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL,
    alternate_phone VARCHAR(255),
    email VARCHAR(255),
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255),
    lead_source VARCHAR(255) DEFAULT 'DIRECT'::character varying,
    candidate_type VARCHAR(255) DEFAULT 'NATIVE'::character varying,
    status VARCHAR(255) NOT NULL DEFAULT 'NEW_LEAD'::character varying,
    call_status VARCHAR(255),
    assigned_employee_id INTEGER,
    team_leader_id INTEGER,
    converted_agent_id INTEGER,
    selected_village VARCHAR(255),
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    photo VARCHAR(255),
    call_attempts INTEGER DEFAULT 0,
    last_call_status VARCHAR(255),
    last_call_note TEXT,
    last_attempt_at TIMESTAMPTZ,
    last_attempt_by INTEGER,
    follow_up_date DATE,
    follow_up_time VARCHAR(255),
    follow_up_by INTEGER,
    assigned_team_id INTEGER,
    assigned_team_name VARCHAR(255),
    allotted_at TIMESTAMPTZ,
    referring_agent_id INTEGER,
    diverted_to_department VARCHAR(255),
    diverted_at TIMESTAMPTZ,
    diverted_by INTEGER,
    PRIMARY KEY (id)
);

CREATE TABLE agent_call_attempt (
    id INTEGER NOT NULL DEFAULT nextval('agent_call_attempt_id_seq'::regclass),
    candidate_id INTEGER NOT NULL,
    queue VARCHAR(255) DEFAULT 'first-call'::character varying,
    answer_status VARCHAR(255) NOT NULL,
    result VARCHAR(255),
    note TEXT,
    recording_url VARCHAR(255),
    duration_seconds INTEGER,
    employee_id INTEGER,
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE agent_enquiry (
    id INTEGER NOT NULL DEFAULT nextval('agent_enquiry_id_seq'::regclass),
    enquiry_code VARCHAR(255),
    caller_name VARCHAR(255) NOT NULL,
    caller_phone VARCHAR(255) NOT NULL,
    caller_type VARCHAR(255) DEFAULT 'NEW_CANDIDATE'::character varying,
    enquiry_type VARCHAR(255) DEFAULT 'BECOME_AGENT'::character varying,
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255),
    preferred_village VARCHAR(255),
    status VARCHAR(255) DEFAULT 'NEW'::character varying,
    notes TEXT,
    assigned_employee_id INTEGER,
    matched_record_type VARCHAR(255),
    matched_record_id INTEGER,
    converted_candidate_id INTEGER,
    callback_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE agent_lead_escalation (
    id INTEGER NOT NULL DEFAULT nextval('agent_lead_escalation_id_seq'::regclass),
    candidate_id INTEGER NOT NULL,
    telecaller_id INTEGER,
    telecaller_note TEXT,
    call_recording_url VARCHAR(255),
    call_duration VARCHAR(255),
    call_datetime TIMESTAMPTZ,
    forwarded_at TIMESTAMPTZ,
    team_leader_id INTEGER,
    status VARCHAR(255) NOT NULL DEFAULT 'Pending'::character varying,
    tl_note TEXT,
    tl_recording_url VARCHAR(255),
    tl_result VARCHAR(255),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE agent_office_visit (
    id INTEGER NOT NULL DEFAULT nextval('agent_office_visit_id_seq'::regclass),
    candidate_id INTEGER NOT NULL,
    regional_office VARCHAR(255) NOT NULL,
    visit_date DATE NOT NULL,
    visit_time VARCHAR(255),
    status VARCHAR(255) NOT NULL DEFAULT 'Scheduled'::character varying,
    interested_village VARCHAR(255),
    assigned_employee_id INTEGER,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE agent_transaction (
    id INTEGER NOT NULL DEFAULT nextval('agent_transaction_id_seq'::regclass),
    transaction_code VARCHAR(255),
    agent_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status VARCHAR(255) DEFAULT 'PENDING'::character varying,
    payment_mode VARCHAR(255),
    reference_no VARCHAR(255),
    land_id INTEGER,
    transaction_date DATE,
    notes TEXT,
    receipt_url VARCHAR(255),
    created_by INTEGER,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE agent_village (
    id INTEGER NOT NULL DEFAULT nextval('agent_village_id_seq'::regclass),
    agent_id INTEGER NOT NULL,
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE assigned_village (
    id INTEGER NOT NULL DEFAULT nextval('assigned_village_id_seq'::regclass),
    target INTEGER,
    assigned_status ENUM DEFAULT 'ongoing'::enum_assigned_village_assigned_status,
    listed INTEGER,
    assigned_employee_id INTEGER,
    village VARCHAR(255),
    mandal VARCHAR(255),
    land_created JSONB,
    complete_details JSONB,
    verified JSONB,
    physical_verified JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE candidate_status_history (
    id INTEGER NOT NULL DEFAULT nextval('candidate_status_history_id_seq'::regclass),
    candidate_id INTEGER NOT NULL,
    from_status VARCHAR(255),
    to_status VARCHAR(255) NOT NULL,
    employee_id INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE candidate_village_interest (
    id INTEGER NOT NULL DEFAULT nextval('candidate_village_interest_id_seq'::regclass),
    candidate_id INTEGER NOT NULL,
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255) NOT NULL,
    is_native BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(255) NOT NULL DEFAULT 'INTERESTED'::character varying,
    interested_since DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE department_leaders (
    id INTEGER NOT NULL DEFAULT nextval('department_leaders_id_seq'::regclass),
    leader_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    department_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE village_agent_position (
    id INTEGER NOT NULL DEFAULT nextval('village_agent_position_id_seq'::regclass),
    position_number INTEGER NOT NULL DEFAULT 1,
    state VARCHAR(255),
    district VARCHAR(255),
    mandal VARCHAR(255),
    village VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'VACANT'::character varying,
    agent_id INTEGER,
    selected_candidate_id INTEGER,
    is_native BOOLEAN,
    opened_to_waiting_at TIMESTAMPTZ,
    opened_by INTEGER,
    opened_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE training (
    id INTEGER NOT NULL DEFAULT nextval('training_id_seq'::regclass),
    land_verification VARCHAR(255) NOT NULL,
    new_land_entry VARCHAR(255),
    buyer_visit_assistant VARCHAR(255),
    session_management VARCHAR(255),
    path_logging VARCHAR(255),
    wallet_features VARCHAR(255),
    profile_settings VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- HR & Ops
-- ============================================================

CREATE TABLE attendance (
    id INTEGER NOT NULL DEFAULT nextval('attendance_id_seq'::regclass),
    employee_id INTEGER,
    date DATE NOT NULL,
    status ENUM NOT NULL,
    marked_by ENUM DEFAULT 'EMPLOYEE'::enum_attendance_marked_by,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    verified BOOLEAN DEFAULT false,
    exit_type ENUM,
    note VARCHAR(255),
    createdAt TIMESTAMPTZ NOT NULL,
    updatedAt TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE petrol_advance (
    id INTEGER NOT NULL DEFAULT nextval('petrol_advance_id_seq'::regclass),
    employee_id INTEGER NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updatedAt TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE work_wallet (
    id INTEGER NOT NULL DEFAULT nextval('work_wallet_id_seq'::regclass),
    employee_id INTEGER NOT NULL,
    amount_type ENUM,
    amount DOUBLE PRECISION,
    status ENUM DEFAULT 'PENDING'::enum_work_wallet_status,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE calendar (
    id INTEGER NOT NULL DEFAULT nextval('calendar_id_seq'::regclass),
    date DATE NOT NULL,
    type ENUM DEFAULT 'WORKING'::enum_calendar_type,
    description VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE call_signals (
    id INTEGER NOT NULL DEFAULT nextval('call_signals_id_seq'::regclass),
    employee_id INTEGER,
    department_type VARCHAR(255) NOT NULL,
    direction ENUM DEFAULT 'outbound'::enum_call_signals_direction,
    caller_name VARCHAR(255),
    caller_phone VARCHAR(255),
    caller_type VARCHAR(255),
    mission_context VARCHAR(255),
    land_id INTEGER,
    duration_seconds INTEGER,
    missed BOOLEAN DEFAULT false,
    status VARCHAR(255) DEFAULT 'pending'::character varying,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Settings
-- ============================================================

CREATE TABLE settings (
    id INTEGER NOT NULL DEFAULT nextval('settings_id_seq'::regclass),
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================
-- Foreign key relationships
-- ============================================================

ALTER TABLE agent
    ADD CONSTRAINT agent_refered_by_fkey
    FOREIGN KEY (refered_by) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_call_attempt
    ADD CONSTRAINT agent_call_attempt_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_call_attempt
    ADD CONSTRAINT agent_call_attempt_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_candidate
    ADD CONSTRAINT agent_candidate_assigned_employee_id_fkey
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_candidate
    ADD CONSTRAINT agent_candidate_converted_agent_id_fkey
    FOREIGN KEY (converted_agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_candidate
    ADD CONSTRAINT agent_candidate_referring_agent_id_fkey
    FOREIGN KEY (referring_agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_candidate
    ADD CONSTRAINT agent_candidate_team_leader_id_fkey
    FOREIGN KEY (team_leader_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_enquiry
    ADD CONSTRAINT agent_enquiry_assigned_employee_id_fkey
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_enquiry
    ADD CONSTRAINT agent_enquiry_converted_candidate_id_fkey
    FOREIGN KEY (converted_candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_lead_escalation
    ADD CONSTRAINT agent_lead_escalation_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_lead_escalation
    ADD CONSTRAINT agent_lead_escalation_team_leader_id_fkey
    FOREIGN KEY (team_leader_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_lead_escalation
    ADD CONSTRAINT agent_lead_escalation_telecaller_id_fkey
    FOREIGN KEY (telecaller_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_office_visit
    ADD CONSTRAINT agent_office_visit_assigned_employee_id_fkey
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE agent_office_visit
    ADD CONSTRAINT agent_office_visit_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_transaction
    ADD CONSTRAINT agent_transaction_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_transaction
    ADD CONSTRAINT agent_transaction_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE agent_village
    ADD CONSTRAINT agent_village_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE assigned_village
    ADD CONSTRAINT assigned_village_assigned_employee_id_fkey
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attendance
    ADD CONSTRAINT attendance_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE availibility
    ADD CONSTRAINT availibility_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE availibility
    ADD CONSTRAINT availibility_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE buyers
    ADD CONSTRAINT buyers_executive_id_fkey
    FOREIGN KEY (executive_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE candidate_status_history
    ADD CONSTRAINT candidate_status_history_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE candidate_village_interest
    ADD CONSTRAINT candidate_village_interest_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cart
    ADD CONSTRAINT cart_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cart
    ADD CONSTRAINT cart_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE district
    ADD CONSTRAINT district_state_id_fkey
    FOREIGN KEY (state_id) REFERENCES state (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE employee_town
    ADD CONSTRAINT employee_town_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE farmer_details
    ADD CONSTRAINT farmer_details_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE final_list
    ADD CONSTRAINT final_list_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE final_list
    ADD CONSTRAINT final_list_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land
    ADD CONSTRAINT land_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE land
    ADD CONSTRAINT land_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land
    ADD CONSTRAINT land_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_details
    ADD CONSTRAINT land_details_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_documents
    ADD CONSTRAINT land_documents_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_feedback
    ADD CONSTRAINT land_feedback_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_feedback
    ADD CONSTRAINT land_feedback_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_gps
    ADD CONSTRAINT land_gps_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_media
    ADD CONSTRAINT land_media_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_observation
    ADD CONSTRAINT land_observation_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_observation
    ADD CONSTRAINT land_observation_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_observation_submission
    ADD CONSTRAINT land_observation_submission_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_observation_submission
    ADD CONSTRAINT land_observation_submission_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_observation_submission
    ADD CONSTRAINT land_observation_submission_observation_id_fkey
    FOREIGN KEY (observation_id) REFERENCES land_observation (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_shed_Dimensions
    ADD CONSTRAINT land_shed_Dimensions_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE land_tree
    ADD CONSTRAINT land_tree_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE mandal
    ADD CONSTRAINT mandal_district_id_fkey
    FOREIGN KEY (district_id) REFERENCES district (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE path
    ADD CONSTRAINT path_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payment
    ADD CONSTRAINT payment_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payment
    ADD CONSTRAINT payment_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE petrol_advance
    ADD CONSTRAINT petrol_advance_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE primary_visit
    ADD CONSTRAINT primary_visit_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE primary_visit
    ADD CONSTRAINT primary_visit_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE primary_visit
    ADD CONSTRAINT primary_visit_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE session
    ADD CONSTRAINT session_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE session_expense
    ADD CONSTRAINT session_expense_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES session (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE shortlisting
    ADD CONSTRAINT shortlisting_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE shortlisting
    ADD CONSTRAINT shortlisting_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE town
    ADD CONSTRAINT town_district_id_fkey
    FOREIGN KEY (district_id) REFERENCES district (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE village
    ADD CONSTRAINT village_mandal_id_fkey
    FOREIGN KEY (mandal_id) REFERENCES mandal (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE village_agent_position
    ADD CONSTRAINT village_agent_position_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE village_agent_position
    ADD CONSTRAINT village_agent_position_selected_candidate_id_fkey
    FOREIGN KEY (selected_candidate_id) REFERENCES agent_candidate (id)
    ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE wish_list
    ADD CONSTRAINT wish_list_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES land (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE wish_list
    ADD CONSTRAINT wish_list_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES buyers (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE work_wallet
    ADD CONSTRAINT work_wallet_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

