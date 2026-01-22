-- Create Database
CREATE DATABASE IF NOT EXISTS wareflow_db;
USE wareflow_db;

-- 1. Master Data Tables
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS sectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS divisions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sector_id VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS maintenance_plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255),
    allowed_location_ids TEXT, -- JSON or CSV string
    allowed_sector_ids TEXT,
    allowed_division_ids TEXT
);

-- 2. Assets & Inventory
CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20),
    stock_quantity INT DEFAULT 0,
    part_number VARCHAR(100),
    model_no VARCHAR(100),
    full_name TEXT,
    description2 TEXT,
    brand VARCHAR(100),
    oem VARCHAR(100),
    second_id VARCHAR(50),
    third_id VARCHAR(50),
    quantities_by_location TEXT -- JSON string for location-specific stock
);

CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(255), -- Machine Name
    machine_local_no VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Working',
    brand VARCHAR(100),
    model_no VARCHAR(100),
    chase_no VARCHAR(100),
    location_id VARCHAR(50),
    sector_id VARCHAR(50),
    division_id VARCHAR(50),
    main_group VARCHAR(100),
    sub_group VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS bom (
    id VARCHAR(50) PRIMARY KEY,
    machine_category VARCHAR(255),
    model_no VARCHAR(100),
    item_id VARCHAR(50),
    quantity INT,
    notes TEXT
);

-- 3. Operational Data
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(50) PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_id VARCHAR(50),
    machine_id VARCHAR(50),
    item_id VARCHAR(50),
    item_name VARCHAR(255),
    quantity INT NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Pending',
    notes TEXT,
    maintenance_plan VARCHAR(100),
    sector_name VARCHAR(100),
    division_name VARCHAR(100),
    machine_name VARCHAR(255),
    warehouse_email VARCHAR(255),
    requester_email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS breakdowns (
    id VARCHAR(50) PRIMARY KEY,
    machine_id VARCHAR(50),
    machine_name VARCHAR(255),
    location_id VARCHAR(50),
    sector_id VARCHAR(50),
    division_id VARCHAR(50),
    machine_local_no VARCHAR(50),
    start_time DATETIME,
    end_time DATETIME,
    failure_type VARCHAR(100),
    operator_name VARCHAR(100),
    root_cause TEXT,
    action_taken TEXT,
    status VARCHAR(50)
);

-- 4. Agri Work Orders
CREATE TABLE IF NOT EXISTS agri_orders (
    id VARCHAR(50) PRIMARY KEY,
    date DATE,
    branch VARCHAR(100),
    tractor VARCHAR(100),
    machine_local_no VARCHAR(50),
    attached VARCHAR(100),
    attached_local_no VARCHAR(50),
    department VARCHAR(100),
    pivot VARCHAR(50),
    driver VARCHAR(100),
    start_counter FLOAT,
    end_counter FLOAT,
    row_number VARCHAR(50),
    unit_type VARCHAR(50),
    achievement FLOAT,
    actual_or_return FLOAT,
    calculated FLOAT,
    time_spent FLOAT,
    notes TEXT,
    sector VARCHAR(100),
    services VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS irrigation_logs (
    id VARCHAR(50) PRIMARY KEY,
    date DATE,
    location_name VARCHAR(100),
    generator_model VARCHAR(100),
    engine_start FLOAT,
    engine_end FLOAT,
    total_hours FLOAT,
    notes TEXT
);

-- 5. Forecasting
CREATE TABLE IF NOT EXISTS forecast_periods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS forecast_records (
    id VARCHAR(100) PRIMARY KEY, -- Composite key string
    period_id VARCHAR(50),
    location_id VARCHAR(50),
    sector_id VARCHAR(50),
    division_id VARCHAR(50),
    item_id VARCHAR(50),
    quantity INT,
    last_updated DATETIME,
    updated_by VARCHAR(50)
);

-- Seed Initial User
INSERT IGNORE INTO users (username, name, role, email, password) VALUES 
('admin', 'Admin User', 'admin', 'admin@daltex.com', 'admin');
