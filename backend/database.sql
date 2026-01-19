
-- Create Database
CREATE DATABASE IF NOT EXISTS wareflow_db;
USE wareflow_db;

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255)
);

-- Sectors Table
CREATE TABLE IF NOT EXISTS sectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Divisions Table
CREATE TABLE IF NOT EXISTS divisions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sector_id VARCHAR(50),
    FOREIGN KEY (sector_id) REFERENCES sectors(id)
);

-- Maintenance Plans
CREATE TABLE IF NOT EXISTS maintenance_plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Items Table
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
    brand VARCHAR(100)
);

-- Machines Table
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    machine_name VARCHAR(255) NOT NULL, -- Mapped to 'category' in frontend
    local_no VARCHAR(50),
    status ENUM('Working', 'Not Working', 'Outside Maintenance') DEFAULT 'Working',
    brand VARCHAR(100),
    model_no VARCHAR(100),
    chase_no VARCHAR(100),
    location_id VARCHAR(50),
    sector_id VARCHAR(50),
    division_id VARCHAR(50),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Issues (Transactions) Table
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(50) PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_id VARCHAR(50),
    machine_id VARCHAR(50),
    item_id VARCHAR(50),
    item_name VARCHAR(255),
    quantity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    notes TEXT,
    maintenance_plan VARCHAR(100),
    sector_name VARCHAR(100),
    division_name VARCHAR(100),
    machine_name VARCHAR(255),
    warehouse_email VARCHAR(255),
    requester_email VARCHAR(255),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Initial Seed Data
INSERT INTO locations (id, name, email) VALUES 
('WH-001', 'Main Warehouse', 'main@site.com'),
('WH-002', 'Production Line', 'prod@site.com');

INSERT INTO sectors (id, name) VALUES ('SEC-001', 'Production');
INSERT INTO divisions (id, name, sector_id) VALUES ('DIV-001', 'Heavy Machinery', 'SEC-001');
INSERT INTO maintenance_plans (id, name) VALUES ('MP-001', 'Preventive Maintenance');
