-- Create database
CREATE DATABASE IF NOT EXISTS hostel_db;
USE hostel_db;

-- Users table (for both admin and students)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'student') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student details table (for registration requests)
CREATE TABLE IF NOT EXISTS student_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    father_name VARCHAR(100),
    cnic VARCHAR(15),
    phone VARCHAR(15),
    address TEXT,
    birthdate DATE,
    department VARCHAR(100),
    batch_year INT,
    roll_number VARCHAR(20),
    emergency_contact VARCHAR(15),
    medical_info TEXT,
    profile_picture VARCHAR(255),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ID requests table for admin approval system
CREATE TABLE IF NOT EXISTS id_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    request_type ENUM('new_registration', 'id_card') DEFAULT 'new_registration',
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    room_type ENUM('single', 'double', 'triple', 'quad') NOT NULL,
    floor INT NOT NULL,
    beds_count INT NOT NULL,
    available_beds INT NOT NULL,
    price_per_bed DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amenities TEXT,
    status ENUM('available', 'occupied', 'maintenance') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Beds table
CREATE TABLE IF NOT EXISTS beds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    bed_number VARCHAR(10) NOT NULL,
    status ENUM('available', 'occupied', 'maintenance') DEFAULT 'available',
    student_id INT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Allotments table: tracks student-room-bed allotments (active records only)
CREATE TABLE IF NOT EXISTS allotments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    room_id INT NOT NULL,
    bed_id INT NOT NULL,
    allotment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    attachment_path VARCHAR(500),
    status ENUM('pending', 'in_progress', 'resolved', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    announcement_type ENUM('info', 'warning', 'urgent', 'event') DEFAULT 'info',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    audience ENUM('all', 'students', 'admin') DEFAULT 'all',
    image_path VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    scheduled_for DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
-- Fee Management Tables
CREATE TABLE IF NOT EXISTS fee_challans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    student_id INT NOT NULL,
    fee_type VARCHAR(50) DEFAULT 'hostel',
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    status ENUM('pending', 'submitted', 'approved', 'rejected', 'overdue') DEFAULT 'pending',
    payment_proof_path VARCHAR(255),
    payment_notes TEXT,
    submitted_at DATETIME,
    approved_at DATETIME,
    admin_notes TEXT,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_student_status (student_id, status),
    INDEX idx_due_date (due_date)
);

CREATE TABLE IF NOT EXISTS fee_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fee_type VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INT,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fee_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    challan_id INT NOT NULL,
    transaction_id VARCHAR(100),
    payment_method VARCHAR(50),
    amount DECIMAL(10,2),
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    bank_reference VARCHAR(100),
    status ENUM('pending', 'verified', 'failed') DEFAULT 'pending',
    verified_by INT,
    verified_at DATETIME,
    FOREIGN KEY (challan_id) REFERENCES fee_challans(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fee_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    recipient_type ENUM('all', 'batch', 'department', 'individual') DEFAULT 'all',
    recipient_ids TEXT,
    batch_year INT,
    department VARCHAR(100),
    sent_via ENUM('email', 'whatsapp', 'both') DEFAULT 'both',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_by INT,
    FOREIGN KEY (sent_by) REFERENCES users(id)
);

-- Insert default fee settings
INSERT INTO fee_settings (fee_type, amount, description) VALUES 
('hostel', 25000.00, 'Hostel Fee per semester'),
('mess', 15000.00, 'Mess Fee per semester'),
('security', 5000.00, 'Security Deposit (Refundable)'),
('library', 2000.00, 'Library Fee'),
('sports', 1500.00, 'Sports Fee')
ON DUPLICATE KEY UPDATE amount = VALUES(amount);

-- Add email_verified and verification_code columns to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN verification_code VARCHAR(10);
ALTER TABLE users ADD COLUMN verification_code_expires DATETIME;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN temp_registration_data TEXT;

-- Create index for faster lookups
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_verification_code ON users(verification_code);

-- Insert default admin user (if not exists)
INSERT INTO users (name, email, password, role)
SELECT * FROM (SELECT 'Admin User' AS name, 'admin@gmail.com' AS email, '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj89OFGVHFyG' AS password, 'admin' AS role) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@gmail.com'
);
-- Password: admin123