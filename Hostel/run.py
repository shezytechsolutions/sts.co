#!/usr/bin/env python3
"""
Secure startup script for Hostel Management System
"""

import os
import sys
import secrets
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check required environment variables
required_vars = [
    'FLASK_SECRET_KEY',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'SMTP_USERNAME',
    'SMTP_PASSWORD'
]

missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    print("❌ Missing required environment variables:")
    for var in missing_vars:
        print(f"   - {var}")
    print("\nPlease set these variables in your .env file")
    sys.exit(1)

# Generate secure secret key if not set
if os.getenv('FLASK_SECRET_KEY') == 'change_this_in_production':
    new_key = secrets.token_hex(32)
    print(f"⚠️  WARNING: Using default secret key!")
    print(f"Generate a new key and add to .env: FLASK_SECRET_KEY={new_key}")

print("✅ Environment check passed!")
print("🚀 Starting Hostel Management System...")

# Import and run app
from app import app

if __name__ == '__main__':
    app.run(
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        ssl_context=None  # Set to 'adhoc' for HTTPS in production
    )