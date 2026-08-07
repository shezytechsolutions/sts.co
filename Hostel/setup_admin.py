import mysql.connector
from werkzeug.security import generate_password_hash
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    """Get database connection"""
    try:
        conn = mysql.connector.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', 'Qarisahb1@admin'),
            database=os.environ.get('DB_NAME', 'hostel_db')
        )
        return conn
    except mysql.connector.Error as e:
        print(f"Database connection error: {e}")
        return None

def setup_admin():
    """Setup admin user with proper password"""
    conn = get_db_connection()
    if not conn:
        print("❌ Cannot connect to database")
        return
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Generate a proper bcrypt hash for password "Admin123!"
        password = "Admin123!"
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        
        print("=" * 60)
        print("ADMIN SETUP")
        print("=" * 60)
        print(f"Password: {password}")
        print(f"Hashed: {hashed_password}")
        print("=" * 60)
        
        # Check if admin exists
        cursor.execute("SELECT id, name FROM users WHERE name = 'Admin User'")
        admin = cursor.fetchone()
        
        if admin:
            # Update admin password
            cursor.execute(
                "UPDATE users SET password = %s, role = TRUE  WHERE name = 'Admin User'",
                (hashed_password,)
            )
            print("✅ Updated existing admin user")
        else:
            # Create new admin user
            cursor.execute(
                """INSERT INTO users (name, email, password, role) 
                VALUES (%s, %s, %s, %s)""",
                ('Admin User', 'admin@gmail.com', hashed_password, 'admin', True)
            )
            print("✅ Created new admin user")
        
        # Verify the update
        cursor.execute("SELECT name, email, role FROM users WHERE name = 'Admin User'")
        admin_data = cursor.fetchone()
        
        if admin_data:
            print("\n✅ Admin User Details:")
            print(f"   name: {admin_data['name']}")
            print(f"   Email: {admin_data['email']}")
            print(f"   role: {admin_data['role']}")
            print("\n✅ Login Credentials:")
            print(f"   URL: http://localhost:5000/admin_interface")
            print(f"   Email: admin@gmail.com")
            print(f"   Password: Admin123!")
        else:
            print("❌ Failed to verify admin creation")
        
        conn.commit()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    setup_admin()