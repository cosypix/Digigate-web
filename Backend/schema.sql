-- ============================================
-- DigiGate Tenant Schema Template
-- ============================================
-- This file is executed inside each tenant's schema
-- during provisioning (via tenantManager.js).
-- It creates all the tables a college needs.
-- ============================================

CREATE TABLE Student (
    Roll_No VARCHAR(20) NOT NULL PRIMARY KEY,
    Name VARCHAR(25) NOT NULL,
    Email VARCHAR(50) NOT NULL,
    Hostel_Name VARCHAR(50),
    Password VARCHAR(100)
);

CREATE TABLE Location (
    Place_Id VARCHAR(20) NOT NULL PRIMARY KEY,
    Place_Name VARCHAR(100) NOT NULL
);

CREATE TABLE Guard (
    Guard_Id VARCHAR(20) NOT NULL PRIMARY KEY,
    Guard_Name VARCHAR(50) NOT NULL,
    Place_Id VARCHAR(20),
    Password VARCHAR(100),
    FOREIGN KEY (Place_Id) REFERENCES Location(Place_Id)
);

CREATE TABLE Admin (
    Admin_Id VARCHAR(20) NOT NULL PRIMARY KEY,
    Name VARCHAR(50) NOT NULL,
    Department VARCHAR(50),
    Password VARCHAR(100)
);

CREATE TABLE Log (
    log_id SERIAL PRIMARY KEY,
    roll_no VARCHAR(20) NOT NULL,
    Guard_Id VARCHAR(20) NOT NULL,
    Place_Id VARCHAR(20) NOT NULL,
    log_type VARCHAR(15) NOT NULL,
    Timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (roll_no) REFERENCES Student(Roll_No),
    FOREIGN KEY (Place_Id) REFERENCES Location(Place_Id),
    FOREIGN KEY (Guard_Id) REFERENCES Guard(Guard_Id)
);
