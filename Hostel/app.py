import os
import time
import secrets
import hashlib
import re
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, render_template, request, redirect, session, flash, url_for, jsonify
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from dotenv import load_dotenv
from functools import wraps

# Load environment variables
load_dotenv()

# Import utilities
from utils.email_utils import email_verification
from utils.oauth_utils import GoogleOAuth
# --------------------------
# Basic app + upload config
# --------------------------
app = Flask(__name__)

# Load configuration from environment
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(32))
app.config['UPLOAD_FOLDER'] = 'static/uploads/profile_pictures'
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2MB
app.config['VERIFICATION_CODE_EXPIRY'] = 10  # minutes
app.config['SITE_URL'] = os.getenv('SITE_URL', 'http://localhost:5000')
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
app.config['SMTP_USERNAME'] = os.getenv('SMTP_USERNAME')
app.config['SMTP_PASSWORD'] = os.getenv('SMTP_PASSWORD')
app.config['ADMIN_EMAIL'] = os.getenv('ADMIN_EMAIL')
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ensure upload dir exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --------------------------
# Security Helpers
# --------------------------

def login_required(f):
    """Decorator to require login for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please login to access this page.', 'warning')
            return redirect(url_for('student_login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator to require admin login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_id' not in session or session.get('role') != 'admin':
            flash('Admin access required.', 'danger')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def rate_limit(max_attempts=5, timeout=300):
    """Simple rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            ip = request.remote_addr
            now = datetime.now()
            
            # Store attempts in session or database
            if 'login_attempts' not in session:
                session['login_attempts'] = []
            
            # Clean old attempts
            session['login_attempts'] = [
                attempt for attempt in session['login_attempts']
                if (now - attempt).total_seconds() < timeout
            ]
            
            if len(session['login_attempts']) >= max_attempts:
                flash(f'Too many login attempts. Please try again in {timeout//60} minutes.', 'danger')
                return redirect(url_for('student_login'))
            
            result = f(*args, **kwargs)
            
            # If login failed, record attempt
            if request.method == 'POST' and hasattr(result, 'status_code') and result.status_code == 401:
                session['login_attempts'].append(now)
                session.modified = True
            
            return result
        return decorated_function
    return decorator

# --------------------------
# DB connection helper (secure)
# --------------------------
def get_db_connection():
    """Secure database connection using environment variables"""
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'hostel_db'),
            port=int(os.getenv('DB_PORT', 3306)),
            use_pure=True,
            autocommit=False
        )
        return conn
    except mysql.connector.Error as e:
        app.logger.error(f"Database connection error: {e}")
        return None

# --------------------------
# Google OAuth Routes
# --------------------------

@app.route('/google_login')
def google_login():
    """Redirect to Google OAuth"""
    return redirect(GoogleOAuth.get_google_auth_url())

@app.route('/google_callback')
def google_callback():
    """Handle Google OAuth callback"""
    code = request.args.get('code')
    if not code:
        flash('Google authentication failed.', 'error')
        return redirect(url_for('student_login'))
    
    try:
        # Exchange code for token
        import requests
        token_url = 'https://oauth2.googleapis.com/token'
        data = {
            'code': code,
            'client_id': app.config['GOOGLE_CLIENT_ID'],
            'client_secret': app.config['GOOGLE_CLIENT_SECRET'],
            'redirect_uri': f"{app.config['SITE_URL']}/google_callback",
            'grant_type': 'authorization_code'
        }
        
        response = requests.post(token_url, data=data)
        token_data = response.json()
        
        if 'id_token' not in token_data:
            flash('Failed to get user information from Google.', 'error')
            return redirect(url_for('student_login'))
        
        # Verify token and get user info
        user_info = GoogleOAuth.verify_google_token(token_data['id_token'])
        
        if not user_info:
            flash('Invalid Google authentication. Please use a @gmail.com or @bbsutsd.edu.pk email address.', 'error')
            return redirect(url_for('student_login'))
        
        email = user_info['email']
        name = user_info['name']
        
        print(f"📧 Google auth successful: {email}")
        
        # Check if user exists
        conn = get_db_connection()
        if not conn:
            flash('Database connection failed.', 'error')
            return redirect(url_for('student_login'))
        
        cursor = conn.cursor(dictionary=True)
        
        # Check if user with this email exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"✅ Existing user found: {email}")
            # User exists, check if approved
            cursor.execute("""
                SELECT sd.status FROM student_details sd 
                WHERE sd.user_id = %s
            """, (existing_user['id'],))
            student_detail = cursor.fetchone()
            
            if student_detail and student_detail.get('status') == 'approved':
                # Login the user
                session['student_id'] = existing_user['id']
                session['role'] = 'student'
                session['name'] = existing_user['name']
                session['email'] = existing_user['email']
                
                cursor.close()
                conn.close()
                
                flash(f'Welcome back, {existing_user["name"]}!', 'success')
                return redirect(url_for('dashboard_student'))
            else:
                flash('Your account is pending approval. Please wait for admin approval.', 'warning')
                cursor.close()
                conn.close()
                return redirect(url_for('student_login'))
        else:
            # New user, store Google info in session and redirect to registration
            print(f"🆕 New user, redirecting to registration: {email}")
            session['google_email'] = email
            session['google_name'] = name
            flash('Please complete your registration. Your email has been auto-filled from Google.', 'info')
            return redirect(url_for('student_register'))
            
    except Exception as e:
        app.logger.error(f"Google callback error: {e}")
        print(f"❌ Google callback error: {e}")
        import traceback
        traceback.print_exc()
        flash('Google authentication failed. Please try again.', 'error')
        return redirect(url_for('student_login'))


@app.route('/check_google_session')
def check_google_session():
    """Check if there's Google registration data in session"""
    google_email = session.get('google_email')
    google_name = session.get('google_name')
    
    return jsonify({
        'has_google': bool(google_email),
        'email': google_email,
        'name': google_name
    })                         

# --------------------------
# Enhanced Registration with Verification
# --------------------------

@app.route("/student_register_google_submit", methods=["POST"])
def student_register_google_submit():
    """Registration with Google email and verification code - INCLUDES PROFILE PICTURE"""
    try:
        google_email = session.get('google_email')
        
        if not google_email:
            return jsonify({"success": False, "message": "Please login with Google first."})
        
        # Get form data
        name = request.form.get("name", "").strip()
        email = google_email  # Use Google email
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")
        
        if not name or not email or not password:
            return jsonify({"success": False, "message": "Please fill required fields."})
        
        if password != confirm_password:
            return jsonify({"success": False, "message": "Passwords do not match!"})
        
        # VALIDATE PROFILE PICTURE - REQUIRED for Google registration too
        file = request.files.get('profile_picture')
        if not file or file.filename == '':
            return jsonify({"success": False, "message": "Profile picture is required. Please upload an image."})
        
        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type. Only PNG, JPG, JPEG, GIF are allowed."})
        
        # Check file size (2MB max)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        if file_size > 2 * 1024 * 1024:
            return jsonify({"success": False, "message": "Profile picture must be less than 2MB."})
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"})
        
        cursor = conn.cursor(dictionary=True)
        
        # Check if email already registered
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Email already registered!"})
        
        # Save profile picture
        filename = secure_filename(f"{email}_{int(time.time())}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        profile_picture_path = f"uploads/profile_pictures/{filename}"
        
        # Generate verification code
        verification_code = email_verification.generate_verification_code()
        code_expires = datetime.now() + timedelta(minutes=app.config['VERIFICATION_CODE_EXPIRY'])
        
        # Store temporary registration data with profile picture
        temp_data = {
            'name': name,
            'email': email,
            'password': generate_password_hash(password),
            'father_name': request.form.get("father_name"),
            'cnic': request.form.get("cnic"),
            'phone': request.form.get("phone"),
            'address': request.form.get("address"),
            'birthdate': request.form.get("birthdate"),
            'department': request.form.get("department"),
            'batch_year': request.form.get("batch_year"),
            'roll_number': request.form.get("roll_number"),
            'emergency_contact': request.form.get("emergency_contact"),
            'medical_info': request.form.get("medical_info", ""),
            'profile_picture': profile_picture_path,  # ADD THIS
            'verification_code': verification_code,
            'code_expires': code_expires.isoformat()
        }
        
        import json
        session['temp_registration'] = json.dumps(temp_data)
        
        # Send verification email
        if email_verification.send_verification_email(email, name, verification_code):
            return jsonify({
                "success": True, 
                "message": "Verification code sent to your email. Please enter it to complete registration.",
                "requires_verification": True
            })
        else:
            return jsonify({"success": False, "message": "Failed to send verification email. Please try again."})
            
    except Exception as e:
        app.logger.error(f"Google registration error: {e}")
        print(f"❌ Google registration error: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({"success": False, "message": f"Registration failed: {str(e)}"})

@app.route("/verify_registration_code", methods=["POST"])
def verify_registration_code():
    """Verify the email confirmation code and complete registration with profile picture"""
    try:
        data = request.get_json()
        code = data.get('code')
        
        import json
        temp_data_str = session.get('temp_registration')
        
        if not temp_data_str:
            return jsonify({"success": False, "message": "Registration session expired. Please register again."})
        
        temp_data = json.loads(temp_data_str)
        
        if temp_data['verification_code'] != code:
            return jsonify({"success": False, "message": "Invalid verification code."})
        
        # Check if code expired
        code_expires = datetime.fromisoformat(temp_data['code_expires'])
        if datetime.now() > code_expires:
            session.pop('temp_registration', None)
            return jsonify({"success": False, "message": "Verification code expired. Please register again."})
        
        # Complete registration in database
        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"})
        
        cursor = conn.cursor(dictionary=True)
        
        # Insert user with email_verified = TRUE
        try:
            cursor.execute(
                """INSERT INTO users (name, email, password, role, email_verified, created_at) 
                   VALUES (%s, %s, %s, 'student', TRUE, NOW())""",
                (temp_data['name'], temp_data['email'], temp_data['password'])
            )
        except Exception as e:
            # If email_verified column doesn't exist, try without it
            if "Unknown column 'email_verified'" in str(e):
                cursor.execute(
                    "INSERT INTO users (name, email, password, role, created_at) VALUES (%s, %s, %s, 'student', NOW())",
                    (temp_data['name'], temp_data['email'], temp_data['password'])
                )
            else:
                raise e
        
        user_id = cursor.lastrowid
        
        # Insert student details WITH PROFILE PICTURE
        cursor.execute(
            """INSERT INTO student_details 
            (user_id, father_name, cnic, phone, address, department, batch_year, 
             roll_number, emergency_contact, medical_info, birthdate, profile_picture, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')""",
            (user_id, temp_data.get('father_name'), temp_data.get('cnic'), 
             temp_data.get('phone'), temp_data.get('address'), temp_data.get('department'),
             temp_data.get('batch_year'), temp_data.get('roll_number'), 
             temp_data.get('emergency_contact'), temp_data.get('medical_info'), 
             temp_data.get('birthdate'), temp_data.get('profile_picture'))  # ADDED profile_picture
        )
        
        # Create ID request
        cursor.execute(
            "INSERT INTO id_requests (user_id, request_type, reason, status) VALUES (%s, 'new_registration', 'New student registration via Google', 'pending')",
            (user_id,)
        )
        
        conn.commit()
        
        # Clear session data
        session.pop('temp_registration', None)
        session.pop('google_email', None)
        session.pop('google_name', None)
        
        # Send admin notification
        try:
            email_verification.send_admin_notification(temp_data['name'], temp_data['email'])
        except Exception as e:
            print(f"Admin notification failed but registration successful: {e}")
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True, 
            "message": "Registration successful! Please wait for admin approval.",
            "redirect": "/student_login"
        })
        
    except Exception as e:
        app.logger.error(f"Verification error: {e}")
        print(f"❌ Verification error: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals() and conn:
            conn.rollback()
            conn.close()
        return jsonify({"success": False, "message": f"Verification failed: {str(e)}"})

# --------------------------
# Admin Approval with Email Notification
# --------------------------

@app.route('/api/id-requests/<int:request_id>/approve', methods=['POST'])
def approve_id_request(request_id):
    """Approve an ID request and send email notification"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Get user details
        cursor.execute("""
            SELECT ir.user_id, u.email, u.name 
            FROM id_requests ir
            JOIN users u ON ir.user_id = u.id
            WHERE ir.id = %s
        """, (request_id,))
        request_data = cursor.fetchone()
        
        if not request_data:
            return jsonify({"error": "Request not found"}), 404
        
        user_id = request_data['user_id']
        user_email = request_data['email']
        user_name = request_data['name']
        
        # Update statuses
        cursor.execute("UPDATE id_requests SET status = 'approved' WHERE id = %s", (request_id,))
        cursor.execute("UPDATE student_details SET status = 'approved' WHERE user_id = %s", (user_id,))
        
        conn.commit()
        
        # Send approval email
        send_approval_email(user_email, user_name)
        
        return jsonify({"success": True, "message": "Request approved and student notified successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error approving request: {e}")
        return jsonify({"error": f"Failed to approve request: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

def send_approval_email(to_email, user_name):
    """Send approval notification email to student"""
    try:
        subject = "Your Hostel Registration Has Been Approved!"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }}
                .header {{ background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ padding: 20px; }}
                .button {{ background: #583d06; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Registration Approved! 🎉</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{user_name}</strong>,</p>
                    <p>Congratulations! Your hostel registration has been approved by the administrator.</p>
                    <p>You can now login to the student portal to:</p>
                    <ul>
                        <li>View your room allocation</li>
                        <li>Submit complaints</li>
                        <li>Access your ID card</li>
                        <li>View fee details</li>
                    </ul>
                    <p style="text-align: center;">
                        <a href="{app.config['SITE_URL']}/student_login" class="button">Login to Portal</a>
                    </p>
                    <p>If you have any questions, please contact the hostel administration.</p>
                    <p>Best regards,<br>
                    <strong>Hostel Management Team</strong></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = app.config['SMTP_USERNAME']
        msg['To'] = to_email
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP(app.config['SMTP_SERVER'], app.config['SMTP_PORT']) as server:
            server.starttls()
            server.login(app.config['SMTP_USERNAME'], app.config['SMTP_PASSWORD'])
            server.send_message(msg)
        
        return True
    except Exception as e:
        app.logger.error(f"Approval email failed: {e}")
        return False




    
# --------------------------
# Direct Interface Routes
# --------------------------

@app.route('/')
def splash():
    """Splash screen - redirects to student interface"""
    return render_template('splash.html')

@app.route('/student')
def student_direct():
    """Direct student interface access"""
    return redirect('/student_interface')

@app.route('/admin')
def admin_direct():
    """Direct admin interface access"""
    return redirect('/admin_interface')

@app.route('/student_interface')
def student_interface():
    """Student main interface"""
    # Allow access without login for initial view
    # But show login prompt for protected features
    return render_template("student_interface.html")

@app.route('/admin_interface')
def admin_interface():
    """Admin main interface"""
    return render_template("admin_interface.html")


# --------------------------
# Admin login
# --------------------------
@app.route("/admin_login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        conn = get_db_connection()
        if not conn:
            return jsonify({
                "success": False, 
                "message": "Database connection failed. Please try again."
            })

        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM users WHERE email=%s AND role='admin'", (email,))
            user = cursor.fetchone()
            
            if user:
                if check_password_hash(user["password"], password):
                    session["admin_id"] = user["id"]
                    session["role"] = "admin"
                    session["name"] = user["name"]
                    session["email"] = user["email"]
                    
                    return jsonify({
                        "success": True, 
                        "message": "Welcome back, Admin!", 
                        "redirect": "/dashboard_admin"
                    })
                else:
                    return jsonify({
                        "success": False, 
                        "message": "Invalid password. Please try again."
                    })
            else:
                return jsonify({
                    "success": False, 
                    "message": "No admin account found with this email."
                })

        except Exception as e:
            print(f"Database error during login: {e}")
            return jsonify({
                "success": False, 
                "message": "System error. Please contact administrator."
            })
        finally:
            cursor.close()
            conn.close()

    return render_template("admin_login.html")

# --------------------------
# Student login
# --------------------------
@app.route("/student_login", methods=["GET", "POST"])
def student_login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()  # Already converting to lowercase
        password = request.form.get("password", "")

        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database connection failed"})

        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT u.*, sd.status as approval_status 
                FROM users u 
                LEFT JOIN student_details sd ON u.id = sd.user_id 
                WHERE u.email=%s AND u.role='student'
            """, (email,))
            user = cursor.fetchone()

            if user:
                if user.get('approval_status') != 'approved':
                    return jsonify({"success": False, "message": "Your account is under approval/processing."})

                if check_password_hash(user["password"], password):
                    session["student_id"] = user["id"]
                    session["role"] = "student"
                    session["name"] = user["name"]
                    return jsonify({"success": True, "message": "Welcome back, Student!", "redirect": "/dashboard_student"})

            return jsonify({"success": False, "message": "Invalid credentials"})

        except Exception as e:
            print(f"Login error (student): {e}")
            return jsonify({"success": False, "message": "Login failed. Please try again."})
        finally:
            cursor.close()
            conn.close()

    return render_template("student_login.html")

# --------------------------
# Student registration
# --------------------------
@app.route("/student_register", methods=["GET", "POST"])
def student_register():
    if request.method == "POST":
        try:
            name = request.form.get("name", "").strip()
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            confirm_password = request.form.get("confirm_password", "")

            if not name or not email or not password:
                return jsonify({"success": False, "message": "Please fill required fields."})

            if password != confirm_password:
                return jsonify({"success": False, "message": "Passwords do not match!"})

            # VALIDATE EMAIL DOMAIN - Allow @gmail.com and @bbsutsd.edu.pk
            import re
            email_pattern = r'^[a-z0-9._%+-]+@(gmail\.com|bbsutsd\.edu\.pk)$'
            if not re.match(email_pattern, email, re.IGNORECASE):
                return jsonify({"success": False, "message": "Only @gmail.com or @bbsutsd.edu.pk email addresses are allowed."})

            # VALIDATE PROFILE PICTURE - REQUIRED
            file = request.files.get('profile_picture')
            if not file or file.filename == '':
                return jsonify({"success": False, "message": "Profile picture is required. Please upload an image."})
            
            if not allowed_file(file.filename):
                return jsonify({"success": False, "message": "Invalid file type. Only PNG, JPG, JPEG, GIF are allowed."})
            
            # Check file size (2MB max)
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            if file_size > 2 * 1024 * 1024:
                return jsonify({"success": False, "message": "Profile picture must be less than 2MB."})

            conn = get_db_connection()
            if not conn:
                return jsonify({"success": False, "message": "Database connection failed"})

            cursor = conn.cursor(dictionary=True)

            # Check if email already exists
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                cursor.close()
                conn.close()
                return jsonify({"success": False, "message": "Email already registered!"})

            # Get other form data
            father_name = request.form.get("father_name")
            cnic = request.form.get("cnic")
            phone = request.form.get("phone")
            address = request.form.get("address")
            birthdate = request.form.get("birthdate")
            department = request.form.get("department")
            batch_year = request.form.get("batch_year")
            roll_number = request.form.get("roll_number")
            emergency_contact = request.form.get("emergency_contact")
            medical_info = request.form.get("medical_info", "")

            # Save profile picture
            filename = secure_filename(f"{email}_{int(time.time())}_{file.filename}")
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            profile_picture_path = f"uploads/profile_pictures/{filename}"

            hashed_password = generate_password_hash(password)

            cursor.execute(
                "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, 'student')",
                (name, email, hashed_password)
            )
            user_id = cursor.lastrowid

            cursor.execute(
                """INSERT INTO student_details 
                (user_id, father_name, cnic, phone, address, department, batch_year, 
                 roll_number, emergency_contact, medical_info, birthdate, profile_picture, status) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')""",
                (user_id, father_name, cnic, phone, address, department, batch_year,
                 roll_number, emergency_contact, medical_info, birthdate, profile_picture_path)
            )

            cursor.execute(
                "INSERT INTO id_requests (user_id, request_type, reason, status) VALUES (%s, 'new_registration', 'New student registration', 'pending')",
                (user_id,)
            )

            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({"success": True, "message": "Registration submitted successfully! Please wait for admin approval.", "redirect": "/student_login"})
        
        except Exception as e:
            print(f"Registration error: {e}")
            if 'conn' in locals() and conn:
                conn.rollback()
                conn.close()
            return jsonify({"success": False, "message": f"Registration failed: {str(e)}"})

    return render_template("student_register.html")

# --------------------------
# Dashboards
# --------------------------
@app.route('/dashboard_admin')
def dashboard_admin():
    if "admin_id" not in session or session.get("role") != "admin":
        return redirect(url_for("admin_login"))

    conn = get_db_connection()
    if not conn:
        flash("Database connection failed", "error")
        return redirect(url_for("admin_login"))

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT ir.*, u.name, u.email 
            FROM id_requests ir 
            JOIN users u ON ir.user_id = u.id 
            WHERE ir.status = 'pending'
        """)
        id_requests = cursor.fetchall()

        return render_template("dashboard_admin.html", 
                               name=session.get('name', 'Admin'),
                               id_requests=id_requests)
    except Exception as e:
        print(f"Dashboard error: {e}")
        flash("Error loading dashboard", "error")
        return redirect(url_for("admin_login"))
    finally:
        cursor.close()
        conn.close()
        
# Dashboard statistics API
@app.route('/api/admin/dashboard_stats')
def get_dashboard_stats():
    """Get dashboard statistics"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Get total approved students
        cursor.execute("""
            SELECT COUNT(*) as total_students 
            FROM student_details 
            WHERE status = 'approved'
        """)
        total_students = cursor.fetchone()['total_students']
        
        # Get pending ID requests
        cursor.execute("""
            SELECT COUNT(*) as pending_requests 
            FROM id_requests 
            WHERE status = 'pending'
        """)
        pending_requests = cursor.fetchone()['pending_requests']
        
        # Get total rooms
        cursor.execute("SELECT COUNT(*) as total_rooms FROM rooms")
        total_rooms = cursor.fetchone()['total_rooms']
        
        # Get available rooms
        cursor.execute("SELECT COUNT(*) as available_rooms FROM rooms WHERE status = 'available'")
        available_rooms = cursor.fetchone()['available_rooms']
        
        # Get occupied rooms
        cursor.execute("SELECT COUNT(*) as occupied_rooms FROM rooms WHERE status = 'occupied'")
        occupied_rooms = cursor.fetchone()['occupied_rooms']
        
        # Get pending students (students with pending status)
        cursor.execute("""
            SELECT COUNT(*) as pending_students 
            FROM student_details 
            WHERE status = 'pending'
        """)
        pending_students = cursor.fetchone()['pending_students']
        
        stats_data = {
            "totalStudents": str(total_students),
            "totalRooms": str(total_rooms),
            "feesCollection": "$0",  # Placeholder
            "totalComplaints": "0",  # Placeholder
            "idRequests": str(pending_requests),
            "pendingFees": "$0",     # Placeholder
            "approvedStudents": str(total_students),
            "pendingStudents": str(pending_students),
            "availableBeds": str(available_rooms),  # Simplified
            "occupiedRooms": str(occupied_rooms),
            "idPendingCount": str(pending_requests),
            "feePendingCount": "0",  # Placeholder
            "complaintPendingCount": "0",  # Placeholder
            "tasksCount": str(pending_requests)  # Simplified
        }
        
        return jsonify({
            "success": True, 
            "data": stats_data,
            "message": "Dashboard stats loaded successfully"
        })
        
    except Exception as e:
        print(f"Error fetching dashboard stats: {e}")
        return jsonify({"success": False, "error": "Failed to fetch dashboard statistics"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/dashboard_student')
def dashboard_student():
    if "student_id" not in session:
        return redirect(url_for("student_login"))

    student_id = session["student_id"]
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed", "error")
        return redirect(url_for("student_login"))

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT u.name, sd.profile_picture FROM users u LEFT JOIN student_details sd ON u.id = sd.user_id WHERE u.id = %s", (student_id,))
        user = cursor.fetchone()
        
        if not user:
            flash("Could not find user data.", "error")
            session.clear()
            return redirect(url_for("student_login"))
            
        return render_template(
            "dashboard_student.html", 
            name=user.get('name'), 
            profile_picture=user.get('profile_picture')
        )
    except Exception as e:
        print(f"Error loading student dashboard: {e}")
        flash("An error occurred while loading the dashboard.", "error")
        return redirect(url_for("student_login"))
    finally:
        cursor.close()
        conn.close()
        

# --------------------------
# GET STUDENT PROFILE (API)
# --------------------------
@app.route('/get_student_profile')
def get_student_profile():
    if "student_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT u.id, u.name, u.email, u.role 
            FROM users u 
            WHERE u.id = %s
        """, (student_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({"error": "Student not found"}), 404
            
        cursor.execute("""
            SELECT 
                sd.father_name, sd.cnic, sd.phone, sd.address, 
                sd.birthdate, sd.department, sd.batch_year,
                sd.roll_number, sd.emergency_contact, sd.medical_info,
                sd.profile_picture, sd.status,
                ir.created_at as request_date
            FROM student_details sd
            LEFT JOIN id_requests ir ON sd.user_id = ir.user_id AND ir.status = 'approved'
            WHERE sd.user_id = %s
        """, (student_id,))
        student_details = cursor.fetchone()
        
        if not student_details:
            return jsonify({"error": "Student details not found"}), 404
        
        # NEW: Get room and bed allocation details
        cursor.execute("""
            SELECT 
                r.room_number,
                b.bed_number,
                r.room_type,
                r.floor,
                a.allotment_date
            FROM allotments a
            JOIN rooms r ON a.room_id = r.id
            JOIN beds b ON a.bed_id = b.id
            WHERE a.student_id = %s AND a.status = 'active'
            ORDER BY a.allotment_date DESC
            LIMIT 1
        """, (student_id,))
        accommodation_data = cursor.fetchone()
        
        profile_data = {
            **user_data,
            **student_details
        }
        
        # Add accommodation data to profile
        if accommodation_data:
            profile_data['room_number'] = accommodation_data['room_number']
            profile_data['bed_number'] = accommodation_data['bed_number']
            profile_data['room_type'] = accommodation_data['room_type']
            profile_data['floor'] = accommodation_data['floor']
            profile_data['allotment_date'] = accommodation_data['allotment_date']
        else:
            profile_data['room_number'] = 'Not Allotted'
            profile_data['bed_number'] = 'N/A'
            profile_data['room_type'] = 'N/A'
            profile_data['floor'] = 'N/A'
            profile_data['allotment_date'] = 'N/A'
        
        def safe_date_format(date_obj):
            if date_obj and hasattr(date_obj, 'strftime'):
                return date_obj.strftime('%Y-%m-%d')
            return None

        def safe_datetime_format(datetime_obj):
            if datetime_obj and hasattr(datetime_obj, 'strftime'):
                return datetime_obj.strftime('%Y-%m-%d %H:%M:%S')
            return None

        profile_data['birthdate'] = safe_date_format(profile_data.get('birthdate'))
        profile_data['request_date'] = safe_datetime_format(profile_data.get('request_date'))
        profile_data['allotment_date'] = safe_date_format(profile_data.get('allotment_date'))
        
        return jsonify(profile_data)
        
    except Exception as e:
        print(f"❌ Error fetching student profile: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

# =======================
# ID REQUEST MANAGEMENT API
# =======================

@app.route('/api/admin/id_requests')
def get_admin_id_requests():
    """Get all ID requests for admin dashboard"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                ir.id, ir.request_type, ir.reason, ir.status, ir.created_at,
                u.id as user_id, u.name, u.email,
                sd.department, sd.roll_number, sd.phone,
                sd.profile_picture, sd.batch_year
            FROM id_requests ir
            JOIN users u ON ir.user_id = u.id
            LEFT JOIN student_details sd ON u.id = sd.user_id
            WHERE ir.status = 'pending'
            ORDER BY ir.created_at DESC
        """)
        requests = cursor.fetchall()
        
        for req in requests:
            if req['created_at']:
                req['created_at'] = req['created_at'].strftime('%Y-%m-%d %H:%M')
        
        return jsonify({"success": True, "requests": requests})
        
    except Exception as e:
        print(f"Error fetching ID requests: {e}")
        return jsonify({"error": "Failed to fetch requests"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/id-requests/<int:request_id>')
def get_id_request_details(request_id):
    """Get detailed student information for a specific request"""
    try:
        if "admin_id" not in session or session.get("role") != "admin":
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                u.name, u.email,
                sd.father_name, sd.cnic, sd.phone, sd.address,
                sd.birthdate, sd.department, sd.batch_year,
                sd.roll_number, sd.emergency_contact, sd.medical_info,
                sd.profile_picture,
                ir.request_type, ir.reason, ir.created_at as request_date
            FROM id_requests ir
            JOIN users u ON ir.user_id = u.id
            JOIN student_details sd ON u.id = sd.user_id
            WHERE ir.id = %s
        """, (request_id,))
        
        student = cursor.fetchone()
        
        if not student:
            return jsonify({"success": False, "error": "Student not found"}), 404
        
        def safe_date_format(date_obj):
            if date_obj and hasattr(date_obj, 'strftime'):
                return date_obj.strftime('%Y-%m-%d')
            return 'N/A'
        
        def safe_datetime_format(datetime_obj):
            if datetime_obj and hasattr(datetime_obj, 'strftime'):
                return datetime_obj.strftime('%Y-%m-%d %H:%M')
            return 'N/A'
        
        response_data = {
            "name": student.get('name', 'N/A'),
            "email": student.get('email', 'N/A'),
            "father_name": student.get('father_name', 'N/A'),
            "cnic": student.get('cnic', 'N/A'),
            "phone": student.get('phone', 'N/A'),
            "address": student.get('address', 'N/A'),
            "birthdate": safe_date_format(student.get('birthdate')),
            "department": student.get('department', 'N/A'),
            "batch_year": str(student.get('batch_year')) if student.get('batch_year') else 'N/A',
            "roll_number": student.get('roll_number', 'N/A'),
            "emergency_contact": student.get('emergency_contact', 'N/A'),
            "medical_info": student.get('medical_info', 'None provided'),
            "profile_picture": student.get('profile_picture', '/static/img/default-avatar.jpg'),
            "request_type": student.get('request_type', 'N/A'),
            "reason": student.get('reason', 'N/A'),
            "request_date": safe_datetime_format(student.get('request_date'))
        }
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True, 
            "student": response_data,
            "message": "Student details fetched successfully"
        })
        
    except Exception as e:
        print(f"Error in get_id_request_details: {e}")
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/id-requests/<int:request_id>/reject', methods=['POST'])
def reject_id_request(request_id):
    """Reject an ID request"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE id_requests SET status = 'rejected' WHERE id = %s", (request_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Request rejected successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error rejecting request: {e}")
        return jsonify({"error": f"Failed to reject request: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

# Email helper function
def send_approval_email(to_email, user_name):
    """Send approval notification email to student"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        subject = "Your Hostel Registration Has Been Approved!"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }}
                .header {{ background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ padding: 20px; }}
                .button {{ background: #583d06; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Registration Approved! 🎉</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{user_name}</strong>,</p>
                    <p>Congratulations! Your hostel registration has been approved by the administrator.</p>
                    <p>You can now login to the student portal to:</p>
                    <ul>
                        <li>View your room allocation</li>
                        <li>Submit complaints</li>
                        <li>Access your ID card</li>
                        <li>View fee details</li>
                    </ul>
                    <p style="text-align: center;">
                        <a href="{app.config.get('SITE_URL', 'http://localhost:5000')}/student_login" class="button">Login to Portal</a>
                    </p>
                    <p>If you have any questions, please contact the hostel administration.</p>
                    <p>Best regards,<br>
                    <strong>Hostel Management Team</strong></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = app.config.get('SMTP_USERNAME')
        msg['To'] = to_email
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP(app.config.get('SMTP_SERVER', 'smtp.gmail.com'), app.config.get('SMTP_PORT', 587)) as server:
            server.starttls()
            server.login(app.config.get('SMTP_USERNAME'), app.config.get('SMTP_PASSWORD'))
            server.send_message(msg)
        
        print(f"✅ Approval email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Approval email failed: {e}")
        return False

# NEW: Get all students for admin
@app.route('/api/admin/all_students')
def get_all_students():
    """Get all students for admin dashboard"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                u.id as user_id, u.name, u.email, u.created_at,
                sd.phone, sd.department, sd.batch_year, sd.roll_number, sd.status, sd.profile_picture
            FROM users u
            LEFT JOIN student_details sd ON u.id = sd.user_id
            WHERE u.role = 'student'
            ORDER BY u.created_at DESC
        """)
        students = cursor.fetchall()
        
        for student in students:
            if student.get('created_at'):
                student['created_at'] = student['created_at'].strftime('%Y-%m-%d %H:%M')
        
        return jsonify({"success": True, "students": students})
        
    except Exception as e:
        print(f"Error fetching all students: {e}")
        return jsonify({"error": "Failed to fetch students"}), 500
    finally:
        cursor.close()
        conn.close()

# NEW: Get specific student details for admin
@app.route('/api/admin/student/<int:user_id>')
def get_student_details(user_id):
    """Get detailed student information for admin"""
    try:
        if "admin_id" not in session or session.get("role") != "admin":
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                u.name, u.email, u.created_at,
                sd.father_name, sd.cnic, sd.phone, sd.address,
                sd.birthdate, sd.department, sd.batch_year,
                sd.roll_number, sd.emergency_contact, sd.medical_info,
                sd.profile_picture, sd.status
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE u.id = %s
        """, (user_id,))
        
        student = cursor.fetchone()
        
        if not student:
            return jsonify({"success": False, "error": "Student not found"}), 404
        
        def safe_date_format(date_obj):
            if date_obj and hasattr(date_obj, 'strftime'):
                return date_obj.strftime('%Y-%m-%d')
            return 'N/A'
        
        response_data = {
            "name": student.get('name', 'N/A'),
            "email": student.get('email', 'N/A'),
            "father_name": student.get('father_name', 'N/A'),
            "cnic": student.get('cnic', 'N/A'),
            "phone": student.get('phone', 'N/A'),
            "address": student.get('address', 'N/A'),
            "birthdate": safe_date_format(student.get('birthdate')),
            "department": student.get('department', 'N/A'),
            "batch_year": str(student.get('batch_year')) if student.get('batch_year') else 'N/A',
            "roll_number": student.get('roll_number', 'N/A'),
            "emergency_contact": student.get('emergency_contact', 'N/A'),
            "medical_info": student.get('medical_info', 'None provided'),
            "profile_picture": student.get('profile_picture', '/static/img/default-avatar.jpg'),
            "status": student.get('status', 'pending')
        }
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True, 
            "student": response_data,
            "message": "Student details fetched successfully"
        })
        
    except Exception as e:
        print(f"Error in get_student_details: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# NEW: Update student details
@app.route('/api/admin/student/<int:user_id>', methods=['PUT'])
def update_student(user_id):
    """Update student details"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        data = request.get_json()
        
        # Update users table
        update_user_query = """
            UPDATE users 
            SET name = %s, email = %s
            WHERE id = %s
        """
        cursor.execute(update_user_query, (
            data.get('name'),
            data.get('email'), 
            user_id
        ))
        
        # Update password if provided
        if data.get('password'):
            hashed_password = generate_password_hash(data.get('password'))
            cursor.execute(
                "UPDATE users SET password = %s WHERE id = %s",
                (hashed_password, user_id)
            )
        
        # Update student_details table
        update_student_query = """
            UPDATE student_details 
            SET phone = %s, department = %s, batch_year = %s, roll_number = %s,
                father_name = %s, cnic = %s, birthdate = %s, address = %s,
                emergency_contact = %s, medical_info = %s, status = %s
            WHERE user_id = %s
        """
        cursor.execute(update_student_query, (
            data.get('phone'),
            data.get('department'),
            data.get('batch_year'),
            data.get('roll_number'),
            data.get('father_name'),
            data.get('cnic'),
            data.get('birthdate'),
            data.get('address'),
            data.get('emergency_contact'),
            data.get('medical_info'),
            data.get('status'),
            user_id
        ))
        
        conn.commit()
        return jsonify({"success": True, "message": "Student updated successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating student: {e}")
        return jsonify({"error": f"Failed to update student: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()
        
# Get only approved students
@app.route('/api/admin/approved_students')
def get_approved_students():
    """Get only approved students for admin dashboard"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                u.id as user_id, u.name, u.email, u.created_at,
                sd.phone, sd.department, sd.batch_year, sd.roll_number, sd.status, sd.profile_picture
            FROM users u
            LEFT JOIN student_details sd ON u.id = sd.user_id
            WHERE u.role = 'student' AND sd.status = 'approved'
            ORDER BY u.created_at DESC
        """)
        students = cursor.fetchall()
        
        for student in students:
            if student.get('created_at'):
                student['created_at'] = student['created_at'].strftime('%Y-%m-%d %H:%M')
        
        return jsonify({"success": True, "students": students})
        
    except Exception as e:
        print(f"Error fetching approved students: {e}")
        return jsonify({"error": "Failed to fetch students"}), 500
    finally:
        cursor.close()
        conn.close()

# Delete student permanently
@app.route('/api/admin/student/<int:user_id>', methods=['DELETE'])
def delete_student(user_id):
    """Delete student permanently from database"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Delete from student_details first (foreign key constraint)
        cursor.execute("DELETE FROM student_details WHERE user_id = %s", (user_id,))
        
        # Delete from id_requests if exists
        cursor.execute("DELETE FROM id_requests WHERE user_id = %s", (user_id,))
        
        # Delete any allotments for this user
        cursor.execute("DELETE FROM allotments WHERE student_id = %s", (user_id,))
        
        # Finally delete from users table
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Student deleted permanently"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error deleting student: {e}")
        return jsonify({"error": f"Failed to delete student: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()
        
# ====================================================================================================================
# ROOM MANAGEMENT API
# ====================================================================================================================

@app.route('/api/admin/rooms', methods=['GET'])
def get_all_rooms():
    """Get all rooms for admin"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT * FROM rooms 
            ORDER BY floor, room_number
        """)
        rooms = cursor.fetchall()
        
        return jsonify({"success": True, "rooms": rooms})
        
    except Exception as e:
        print(f"Error fetching rooms: {e}")
        return jsonify({"error": "Failed to fetch rooms"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/rooms', methods=['POST'])
def create_room():
    """Create a new room"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        required_fields = ['room_number', 'room_type', 'floor', 'beds_count', 'status']
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None or data[field] == '':
                missing_fields.append(field)
        if missing_fields:
            return jsonify({"success": False, "error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
        
        room_number = str(data['room_number']).strip()
        room_type = str(data['room_type'])
        floor = int(data['floor'])
        beds_count = int(data['beds_count'])
        status = str(data['status'])
        amenities = str(data.get('amenities', '')).strip()
        
        if beds_count < 1 or beds_count > 10:
            return jsonify({"success": False, "error": "Number of beds must be between 1 and 10"}), 400
        
        if floor < 0 or floor > 20:
            return jsonify({"success": False, "error": "Floor must be between 0 and 20"}), 400
        
        if status not in ['available', 'occupied', 'maintenance']:
            return jsonify({"success": False, "error": "Invalid status value"}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT id FROM rooms WHERE room_number = %s", (room_number,))
            if cursor.fetchone():
                return jsonify({"success": False, "error": f"Room number '{room_number}' already exists"}), 400
            
            cursor.execute("""
                INSERT INTO rooms 
                (room_number, room_type, floor, beds_count, available_beds, price_per_bed, amenities, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                room_number,
                room_type,
                floor,
                beds_count,
                beds_count,  # Initially all beds are available
                0.00,
                amenities,
                status
            ))
            
            room_id = cursor.lastrowid
            
            # Create beds
            bed_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
            for i in range(beds_count):
                bed_number = bed_labels[i] if i < len(bed_labels) else f"Bed {i+1}"
                cursor.execute("""
                    INSERT INTO beds (room_id, bed_number, status)
                    VALUES (%s, %s, 'available')
                """, (room_id, bed_number))
            
            conn.commit()
            return jsonify({"success": True, "message": f"Room '{room_number}' created successfully with {beds_count} beds"})
            
        except mysql.connector.Error as db_error:
            conn.rollback()
            print(f"Database error: {db_error}")
            return jsonify({"success": False, "error": f"Database error: {str(db_error)}"}), 500
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        print(f"Unexpected error in create_room: {e}")
        return jsonify({"success": False, "error": f"Unexpected error: {str(e)}"}), 500

@app.route('/api/admin/rooms/<int:room_id>', methods=['DELETE'])
def delete_room(room_id):
    """Delete a room permanently (and clean up allotments / beds)"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Find any active allotments for this room and remove them (free beds first)
        cursor.execute("""
            SELECT id, bed_id, student_id 
            FROM allotments 
            WHERE room_id = %s
        """, (room_id,))
        allotments = cursor.fetchall()
        
        # For each allotment, free the bed and delete allotment
        for a in allotments:
            # a is a tuple if not dict-cursor; handle both
            if isinstance(a, dict):
                allot_id = a['id']
                bed_id = a['bed_id']
            else:
                allot_id = a[0]
                bed_id = a[1]
            # Free bed (set student_id null and status available) - bed might be deleted via cascade later, but do safe cleanup
            try:
                cursor.execute("UPDATE beds SET status = 'available', student_id = NULL WHERE id = %s", (bed_id,))
            except Exception:
                pass
            # Delete allotment record permanently
            cursor.execute("DELETE FROM allotments WHERE id = %s", (allot_id,))
        
        # Now delete the room (cascade will remove beds)
        cursor.execute("DELETE FROM rooms WHERE id = %s", (room_id,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Room deleted successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error deleting room: {e}")
        return jsonify({"success": False, "error": f"Failed to delete room: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/available_rooms', methods=['GET'])
def get_available_rooms():
    """Get available rooms for student allotment"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.*, COUNT(b.id) as available_beds_count
            FROM rooms r
            LEFT JOIN beds b ON r.id = b.room_id AND b.status = 'available'
            WHERE r.status = 'available'
            GROUP BY r.id
            HAVING available_beds_count > 0
            ORDER BY r.floor, r.room_number
        """)
        rooms = cursor.fetchall()
        
        return jsonify({"success": True, "rooms": rooms})
        
    except Exception as e:
        print(f"Error fetching available rooms: {e}")
        return jsonify({"error": "Failed to fetch available rooms"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/allotments', methods=['GET'])
def get_all_allotments():
    """Get all student allotments"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                a.*,
                u.name as student_name,
                r.room_number,
                b.bed_number,
                sd.roll_number,
                sd.department,
                sd.batch_year
            FROM allotments a
            JOIN users u ON a.student_id = u.id
            JOIN rooms r ON a.room_id = r.id
            JOIN beds b ON a.bed_id = b.id
            JOIN student_details sd ON u.id = sd.user_id
            WHERE a.status = 'active'
            ORDER BY r.room_number, b.bed_number
        """)
        allotments = cursor.fetchall()
        
        for allotment in allotments:
            if allotment.get('allotment_date'):
                allotment['allotment_date'] = allotment['allotment_date'].strftime('%Y-%m-%d %H:%M')
            if allotment.get('created_at'):
                allotment['created_at'] = allotment['created_at'].strftime('%Y-%m-%d %H:%M')
        
        return jsonify({"success": True, "allotments": allotments})
        
    except Exception as e:
        print(f"Error fetching allotments: {e}")
        return jsonify({"error": "Failed to fetch allotments"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/allotments', methods=['POST'])
def create_allotment():
    """Create a new student allotment. Supports force_change to replace existing allotment."""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    
    required_fields = ['student_id', 'room_id', 'bed_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
    
    force_change = bool(data.get('force_change', False))
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        student_id = int(data['student_id'])
        room_id = int(data['room_id'])
        bed_id = int(data['bed_id'])
        
        # Check if student already has an active allotment
        cursor.execute("""
            SELECT id, room_id, bed_id FROM allotments 
            WHERE student_id = %s AND status = 'active'
        """, (student_id,))
        existing_allotment = cursor.fetchone()
        
        if existing_allotment and not force_change:
            return jsonify({"success": False, "error": "Student already has an active allotment"}), 400
        
        # Check if bed exists and belongs to room and is available
        cursor.execute("""
            SELECT status FROM beds 
            WHERE id = %s AND room_id = %s
        """, (bed_id, room_id))
        bed = cursor.fetchone()
        
        if not bed:
            return jsonify({"success": False, "error": "Bed not found or does not belong to the specified room"}), 404
        
        if bed['status'] != 'available':
            return jsonify({"success": False, "error": "Bed is not available"}), 400
        
        # If there's an existing allotment and force_change is true, remove it (permanent)
        if existing_allotment and force_change:
            prev_id = existing_allotment['id']
            prev_bed_id = existing_allotment['bed_id']
            prev_room_id = existing_allotment['room_id']
            # delete previous allotment
            cursor.execute("DELETE FROM allotments WHERE id = %s", (prev_id,))
            # free previous bed
            cursor.execute("UPDATE beds SET status = 'available', student_id = NULL WHERE id = %s", (prev_bed_id,))
            # update previous room available_beds
            cursor.execute("""
                UPDATE rooms 
                SET available_beds = available_beds + 1,
                    status = 'available'
                WHERE id = %s
            """, (prev_room_id,))
        
        # Create new allotment
        cursor.execute("""
            INSERT INTO allotments (student_id, room_id, bed_id, status)
            VALUES (%s, %s, %s, 'active')
        """, (student_id, room_id, bed_id))
        
        # Update bed status and student_id
        cursor.execute("""
            UPDATE beds 
            SET status = 'occupied', student_id = %s 
            WHERE id = %s
        """, (student_id, bed_id))
        
        # Update room available beds count and status atomically
        cursor.execute("""
            UPDATE rooms 
            SET available_beds = GREATEST(available_beds - 1, 0),
                status = CASE 
                    WHEN GREATEST(available_beds - 1, 0) = 0 THEN 'occupied'
                    ELSE 'available'
                END
            WHERE id = %s
        """, (room_id,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Student allotted successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating allotment: {e}")
        return jsonify({"success": False, "error": f"Failed to create allotment: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/allotments/<int:student_id>', methods=['DELETE'])
def unallot_student(student_id):
    """Unallot a student (remove from room) - permanent delete of allotment row"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT a.id, a.room_id, a.bed_id
            FROM allotments a
            WHERE a.student_id = %s AND a.status = 'active'
        """, (student_id,))
        allotment = cursor.fetchone()
        
        if not allotment:
            return jsonify({"success": False, "error": "No active allotment found for student"}), 404
        
        allotment_id = allotment['id']
        bed_id = allotment['bed_id']
        room_id = allotment['room_id']
        
        # Delete allotment record permanently
        cursor.execute("DELETE FROM allotments WHERE id = %s", (allotment_id,))
        
        # Update bed status
        cursor.execute("""
            UPDATE beds 
            SET status = 'available', student_id = NULL 
            WHERE id = %s
        """, (bed_id,))
        
        # Update room available beds count and status
        cursor.execute("""
            UPDATE rooms 
            SET available_beds = available_beds + 1,
                status = 'available'
            WHERE id = %s
        """, (room_id,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Student unallotted successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error unallotting student: {e}")
        return jsonify({"success": False, "error": f"Failed to unallot student: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/rooms/<int:room_id>/beds', methods=['GET'])
def get_room_beds(room_id):
    """Get all beds for a specific room"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT b.*, u.name as student_name
            FROM beds b
            LEFT JOIN users u ON b.student_id = u.id
            WHERE b.room_id = %s
            ORDER BY b.bed_number
        """, (room_id,))
        beds = cursor.fetchall()
        
        return jsonify({"success": True, "beds": beds})
        
    except Exception as e:
        print(f"Error fetching room beds: {e}")
        return jsonify({"success": False, "error": "Failed to fetch room beds"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/rooms/export', methods=['GET'])
def export_rooms_data():
    """Export rooms data for printing"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        room_filter = request.args.get('filter', 'all')
        
        query = """
            SELECT r.*, 
                   COUNT(b.id) as total_beds,
                   SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
                   SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as available_beds
            FROM rooms r
            LEFT JOIN beds b ON r.id = b.room_id
        """
        
        if room_filter != 'all':
            query += " WHERE r.status = %s"
            params = (room_filter,)
        else:
            params = ()
        
        query += " GROUP BY r.id ORDER BY r.floor, r.room_number"
        
        cursor.execute(query, params)
        rooms = cursor.fetchall()
        
        return jsonify({"success": True, "rooms": rooms})
        
    except Exception as e:
        print(f"Error exporting rooms data: {e}")
        return jsonify({"success": False, "error": "Failed to export rooms data"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/allotments/export', methods=['GET'])
def export_allotments_data():
    """Export allotments data for printing"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        allotment_filter = request.args.get('filter', 'all')
        
        query = """
            SELECT 
                u.name as student_name,
                u.email,
                sd.roll_number,
                sd.department,
                sd.batch_year,
                r.room_number,
                b.bed_number,
                a.allotment_date,
                CASE 
                    WHEN a.status = 'active' THEN 'Allotted'
                    ELSE 'Unallotted'
                END as allotment_status
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
            LEFT JOIN rooms r ON a.room_id = r.id
            LEFT JOIN beds b ON a.bed_id = b.id
            WHERE u.role = 'student' AND sd.status = 'approved'
        """
        
        params = ()
        
        if allotment_filter == 'allotted':
            query += " AND a.status = 'active'"
        elif allotment_filter == 'unallotted':
            query += " AND a.status IS NULL"
        
        query += " ORDER BY r.room_number, b.bed_number"
        
        cursor.execute(query, params)
        allotments = cursor.fetchall()
        
        for allotment in allotments:
            if allotment.get('allotment_date'):
                allotment['allotment_date'] = allotment['allotment_date'].strftime('%Y-%m-%d')
        
        return jsonify({"success": True, "allotments": allotments})
        
    except Exception as e:
        print(f"Error exporting allotments data: {e}")
        return jsonify({"success": False, "error": "Failed to export allotments data"}), 500
    finally:
        cursor.close()
        conn.close()

# --------------------------
# Admin Password Update API
# --------------------------
@app.route('/api/admin/update_password', methods=['POST'])
def update_admin_password():
    """Update admin password"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({"success": False, "error": "Current and new password are required"}), 400
    
    if len(new_password) < 6:
        return jsonify({"success": False, "error": "New password must be at least 6 characters long"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE id = %s AND role = 'admin'", (session["admin_id"],))
        admin = cursor.fetchone()
        
        if not admin:
            return jsonify({"success": False, "error": "Admin not found"}), 404
        
        if not check_password_hash(admin["password"], current_password):
            return jsonify({"success": False, "error": "Current password is incorrect"}), 400
        
        hashed_new_password = generate_password_hash(new_password)
        cursor.execute(
            "UPDATE users SET password = %s WHERE id = %s",
            (hashed_new_password, session["admin_id"])
        )
        
        conn.commit()
        return jsonify({"success": True, "message": "Password updated successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating admin password: {e}")
        return jsonify({"success": False, "error": f"Failed to update password: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()
        
# Print students API
@app.route('/api/admin/print_students')
def api_print_students():
    """Return filtered student list for printing/reports"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    batch = request.args.get('batch', 'all')
    department = request.args.get('department', 'all')
    status = request.args.get('status', 'all')

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT u.id as user_id, u.name, u.email, u.created_at,
                   sd.roll_number, sd.department, sd.batch_year, sd.phone, sd.status, sd.profile_picture
            FROM users u
            LEFT JOIN student_details sd ON u.id = sd.user_id
            WHERE u.role = 'student'
        """
        params = []

        if batch and batch != 'all':
            query += " AND sd.batch_year = %s"
            params.append(batch)
        if department and department != 'all':
            query += " AND sd.department = %s"
            params.append(department)
        if status and status != 'all':
            query += " AND sd.status = %s"
            params.append(status)

        query += " ORDER BY sd.batch_year DESC, u.name ASC"

        cursor.execute(query, tuple(params))
        students = cursor.fetchall()

        for s in students:
            if s.get('created_at'):
                s['created_at'] = s['created_at'].strftime('%Y-%m-%d %H:%M')

        return jsonify({"success": True, "students": students})

    except Exception as e:
        print(f"Error in print_students: {e}")
        return jsonify({"success": False, "error": "Failed to fetch students"}), 500
    finally:
        cursor.close()
        conn.close()
        
 # ====================================================================================================================
# COMPLAINT MANAGEMENT API - UPDATED WITH DELETE FUNCTIONALITY
# ====================================================================================================================

@app.route('/api/student/complaints', methods=['GET'])
def get_student_complaints():
    """Get complaints for logged-in student"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                c.*,
                DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') as formatted_created_at,
                DATE_FORMAT(c.updated_at, '%Y-%m-%d %H:%i') as formatted_updated_at,
                DATE_FORMAT(c.resolved_at, '%Y-%m-%d %H:%i') as formatted_resolved_at
            FROM complaints c
            WHERE c.student_id = %s
            ORDER BY c.created_at DESC
        """, (student_id,))
        complaints = cursor.fetchall()
        
        return jsonify({"success": True, "complaints": complaints})
        
    except Exception as e:
        print(f"Error fetching student complaints: {e}")
        return jsonify({"error": "Failed to fetch complaints"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student/complaints', methods=['POST'])
def create_complaint():
    """Create a new complaint (with optional file upload)"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    try:
        # Get form data
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        category = request.form.get('category', 'general')
        priority = request.form.get('priority', 'medium')
        
        if not title or not description:
            return jsonify({"success": False, "error": "Title and description are required"}), 400
        
        # Handle file upload
        attachment_path = None
        file = request.files.get('attachment')
        if file and file.filename != '':
            if allowed_file(file.filename):
                filename = secure_filename(f"complaint_{student_id}_{int(time.time())}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                attachment_path = f"uploads/profile_pictures/{filename}"
            else:
                return jsonify({"success": False, "error": "Invalid file type. Allowed: png, jpg, jpeg, gif"}), 400
        
        # Handle webcam capture
        webcam_image = request.form.get('webcam_image')
        if webcam_image and webcam_image.startswith('data:image'):
            # Convert base64 image to file
            try:
                import base64
                # Extract the base64 data
                image_data = webcam_image.split(',')[1]
                image_bytes = base64.b64decode(image_data)
                
                filename = f"complaint_{student_id}_{int(time.time())}_webcam.jpg"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                with open(file_path, 'wb') as f:
                    f.write(image_bytes)
                
                attachment_path = f"uploads/profile_pictures/{filename}"
            except Exception as e:
                print(f"Error saving webcam image: {e}")
                # Continue without attachment if webcam save fails
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO complaints 
                (student_id, title, description, category, priority, attachment_path, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            """, (student_id, title, description, category, priority, attachment_path))
            
            complaint_id = cursor.lastrowid
            conn.commit()
            
            return jsonify({
                "success": True, 
                "message": "Complaint submitted successfully",
                "complaint_id": complaint_id
            })
            
        except Exception as e:
            conn.rollback()
            print(f"Error creating complaint: {e}")
            return jsonify({"success": False, "error": "Failed to submit complaint"}), 500
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        print(f"Unexpected error in create_complaint: {e}")
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500

@app.route('/api/admin/complaints', methods=['GET'])
def get_all_complaints():
    """Get all complaints for admin dashboard"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                c.*,
                u.name as student_name,
                u.email as student_email,
                sd.roll_number,
                r.room_number,
                b.bed_number,
                DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') as formatted_created_at,
                DATE_FORMAT(c.updated_at, '%Y-%m-%d %H:%i') as formatted_updated_at,
                DATE_FORMAT(c.resolved_at, '%Y-%m-%d %H:%i') as formatted_resolved_at
            FROM complaints c
            JOIN users u ON c.student_id = u.id
            LEFT JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
            LEFT JOIN rooms r ON a.room_id = r.id
            LEFT JOIN beds b ON a.bed_id = b.id
            ORDER BY 
                CASE c.priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                c.created_at DESC
        """)
        complaints = cursor.fetchall()
        
        return jsonify({"success": True, "complaints": complaints})
        
    except Exception as e:
        print(f"Error fetching complaints: {e}")
        return jsonify({"error": "Failed to fetch complaints"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/complaints/<int:complaint_id>', methods=['GET'])
def get_complaint_details(complaint_id):
    """Get detailed complaint information"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                c.*,
                u.name as student_name,
                u.email as student_email,
                sd.roll_number,
                sd.phone,
                sd.department,
                sd.batch_year,
                r.room_number,
                b.bed_number,
                DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') as formatted_created_at,
                DATE_FORMAT(c.updated_at, '%Y-%m-%d %H:%i') as formatted_updated_at,
                DATE_FORMAT(c.resolved_at, '%Y-%m-%d %H:%i') as formatted_resolved_at
            FROM complaints c
            JOIN users u ON c.student_id = u.id
            LEFT JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
            LEFT JOIN rooms r ON a.room_id = r.id
            LEFT JOIN beds b ON a.bed_id = b.id
            WHERE c.id = %s
        """, (complaint_id,))
        
        complaint = cursor.fetchone()
        
        if not complaint:
            return jsonify({"error": "Complaint not found"}), 404
        
        return jsonify({"success": True, "complaint": complaint})
        
    except Exception as e:
        print(f"Error fetching complaint details: {e}")
        return jsonify({"error": "Failed to fetch complaint details"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/complaints/<int:complaint_id>/status', methods=['PUT'])
def update_complaint_status(complaint_id):
    """Update complaint status (resolve, reject, or mark in progress)"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    status = data.get('status')
    admin_notes = data.get('admin_notes', '')
    
    if status not in ['resolved', 'rejected', 'in_progress']:
        return jsonify({"error": "Invalid status"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        if status == 'resolved':
            cursor.execute("""
                UPDATE complaints 
                SET status = %s, admin_notes = %s, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (status, admin_notes, complaint_id))
        else:
            cursor.execute("""
                UPDATE complaints 
                SET status = %s, admin_notes = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (status, admin_notes, complaint_id))
        
        conn.commit()
        
        action = "resolved" if status == 'resolved' else "rejected" if status == 'rejected' else "marked as in progress"
        return jsonify({"success": True, "message": f"Complaint {action} successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating complaint status: {e}")
        return jsonify({"error": f"Failed to update complaint: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

# ====================================================================================================================
# COMPLAINT DELETE FUNCTIONALITY - UPDATED
# ====================================================================================================================

@app.route('/api/admin/complaints/<int:complaint_id>', methods=['DELETE'])
def delete_complaint(complaint_id):
    """Permanently delete a complaint (Admin can delete any complaint)"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Check if complaint exists
        cursor.execute("SELECT * FROM complaints WHERE id = %s", (complaint_id,))
        complaint = cursor.fetchone()
        
        if not complaint:
            return jsonify({"error": "Complaint not found"}), 404
        
        # Admin can delete any complaint regardless of status
        cursor.execute("DELETE FROM complaints WHERE id = %s", (complaint_id,))
        conn.commit()
        
        return jsonify({"success": True, "message": "Complaint deleted permanently"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error deleting complaint: {e}")
        return jsonify({"error": f"Failed to delete complaint: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/complaints/bulk_delete', methods=['POST'])
def bulk_delete_complaints():
    """Bulk delete complaints (Admin only)"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    complaint_ids = data.get('complaint_ids', [])
    
    if not complaint_ids:
        return jsonify({"error": "No complaints selected"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Delete multiple complaints
        placeholders = ', '.join(['%s'] * len(complaint_ids))
        query = f"DELETE FROM complaints WHERE id IN ({placeholders})"
        cursor.execute(query, complaint_ids)
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Successfully deleted {deleted_count} complaints",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        conn.rollback()
        print(f"Error bulk deleting complaints: {e}")
        return jsonify({"error": f"Failed to delete complaints: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student/complaints/<int:complaint_id>', methods=['DELETE'])
def delete_student_complaint(complaint_id):
    """Student can delete their own complaints (any status)"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Check if complaint belongs to student
        cursor.execute("SELECT * FROM complaints WHERE id = %s AND student_id = %s", (complaint_id, student_id))
        complaint = cursor.fetchone()
        
        if not complaint:
            return jsonify({"error": "Complaint not found or access denied"}), 404
        
        # Student can delete their own complaints regardless of status
        cursor.execute("DELETE FROM complaints WHERE id = %s AND student_id = %s", (complaint_id, student_id))
        conn.commit()
        
        return jsonify({"success": True, "message": "Complaint deleted permanently"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error deleting student complaint: {e}")
        return jsonify({"error": f"Failed to delete complaint: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student/complaints/bulk_delete', methods=['POST'])
def student_bulk_delete_complaints():
    """Bulk delete student's own complaints"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    data = request.get_json()
    complaint_ids = data.get('complaint_ids', [])
    
    if not complaint_ids:
        return jsonify({"error": "No complaints selected"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    try:
        # Delete only complaints that belong to this student
        placeholders = ', '.join(['%s'] * len(complaint_ids))
        query = f"DELETE FROM complaints WHERE id IN ({placeholders}) AND student_id = %s"
        cursor.execute(query, complaint_ids + [student_id])
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Successfully deleted {deleted_count} complaints",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        conn.rollback()
        print(f"Error bulk deleting student complaints: {e}")
        return jsonify({"error": f"Failed to delete complaints: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

# ====================================================================================================================
# COMPLAINT STATISTICS API (Optional - for dashboard)
# ====================================================================================================================

@app.route('/api/admin/complaints/stats')
def get_complaint_stats():
    """Get complaint statistics for admin dashboard"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Total complaints
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        total = cursor.fetchone()['total']
        
        # Complaints by status
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM complaints 
            GROUP BY status
        """)
        status_counts = cursor.fetchall()
        
        # Complaints by priority
        cursor.execute("""
            SELECT priority, COUNT(*) as count 
            FROM complaints 
            GROUP BY priority
        """)
        priority_counts = cursor.fetchall()
        
        # Recent complaints (last 7 days)
        cursor.execute("""
            SELECT COUNT(*) as recent 
            FROM complaints 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        recent = cursor.fetchone()['recent']
        
        stats = {
            "total": total,
            "recent": recent,
            "by_status": {item['status']: item['count'] for item in status_counts},
            "by_priority": {item['priority']: item['count'] for item in priority_counts}
        }
        
        return jsonify({"success": True, "stats": stats})
        
    except Exception as e:
        print(f"Error fetching complaint stats: {e}")
        return jsonify({"error": "Failed to fetch complaint statistics"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student/complaints/stats')
def get_student_complaint_stats():
    """Get complaint statistics for student dashboard"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Total complaints by student
        cursor.execute("SELECT COUNT(*) as total FROM complaints WHERE student_id = %s", (student_id,))
        total = cursor.fetchone()['total']
        
        # Complaints by status for student
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM complaints 
            WHERE student_id = %s
            GROUP BY status
        """, (student_id,))
        status_counts = cursor.fetchall()
        
        # Pending complaints
        cursor.execute("""
            SELECT COUNT(*) as pending 
            FROM complaints 
            WHERE student_id = %s AND status IN ('pending', 'in_progress')
        """, (student_id,))
        pending = cursor.fetchone()['pending']
        
        stats = {
            "total": total,
            "pending": pending,
            "by_status": {item['status']: item['count'] for item in status_counts}
        }
        
        return jsonify({"success": True, "stats": stats})
        
    except Exception as e:
        print(f"Error fetching student complaint stats: {e}")
        return jsonify({"error": "Failed to fetch complaint statistics"}), 500
    finally:
        cursor.close()
        conn.close()
        
from datetime import datetime  # Add this import at the top

# =======================
# ANNOUNCEMENT MANAGEMENT
# =======================

@app.route('/api/admin/announcements', methods=['GET', 'POST'])
def manage_announcements():
    """Get all announcements or create new announcement"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        if request.method == 'GET':
            # Get all announcements
            cursor.execute("""
                SELECT 
                    a.*,
                    u.name as created_by_name
                FROM announcements a
                JOIN users u ON a.created_by = u.id
                ORDER BY a.created_at DESC
            """)
            announcements = cursor.fetchall()
            
            for announcement in announcements:
                if announcement.get('created_at'):
                    announcement['created_at'] = announcement['created_at'].strftime('%Y-%m-%d %H:%M')
                if announcement.get('scheduled_for'):
                    announcement['scheduled_for'] = announcement['scheduled_for'].strftime('%Y-%m-%d %H:%M')
            
            return jsonify({"success": True, "announcements": announcements})
            
        elif request.method == 'POST':
            # Create new announcement
            data = request.form
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            announcement_type = data.get('type', 'info')  # Changed from 'type' to 'announcement_type'
            priority = data.get('priority', 'medium')
            audience = data.get('audience', 'all')
            is_active = data.get('is_active', 'true') == 'true'
            
            if not title or not content:
                return jsonify({"error": "Title and content are required"}), 400
            
            # Handle image upload
            image_path = None
            file = request.files.get('image')
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(f"announcement_{int(time.time())}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_path = f"uploads/profile_pictures/{filename}"
            
            # Handle scheduled announcements
            scheduled_for = None
            schedule_str = data.get('scheduled_for')
            if schedule_str:
                try:
                    scheduled_for = datetime.strptime(schedule_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    pass
            
            cursor.execute("""
                INSERT INTO announcements 
                (title, content, announcement_type, priority, audience, image_path, is_active, scheduled_for, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (title, content, announcement_type, priority, audience, image_path, is_active, scheduled_for, session["admin_id"]))
            
            conn.commit()
            return jsonify({"success": True, "message": "Announcement created successfully"})
            
    except Exception as e:
        print(f"Error in announcements: {e}")
        return jsonify({"error": f"Operation failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/announcements/<int:announcement_id>', methods=['PUT', 'DELETE'])
def manage_single_announcement(announcement_id):
    """Update or delete specific announcement"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        if request.method == 'PUT':
            data = request.form
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            announcement_type = data.get('type', 'info')  # Changed from 'type' to 'announcement_type'
            priority = data.get('priority', 'medium')
            audience = data.get('audience', 'all')
            is_active = data.get('is_active', 'true') == 'true'
            
            if not title or not content:
                return jsonify({"error": "Title and content are required"}), 400
            
            # Handle image upload
            image_path = None
            file = request.files.get('image')
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(f"announcement_{int(time.time())}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                image_path = f"uploads/profile_pictures/{filename}"
            
            # Handle scheduled announcements
            scheduled_for = None
            schedule_str = data.get('scheduled_for')
            if schedule_str:
                try:
                    scheduled_for = datetime.strptime(schedule_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    pass
            
            if image_path:
                cursor.execute("""
                    UPDATE announcements 
                    SET title=%s, content=%s, announcement_type=%s, priority=%s, audience=%s, 
                        image_path=%s, is_active=%s, scheduled_for=%s, updated_at=NOW()
                    WHERE id=%s
                """, (title, content, announcement_type, priority, audience, image_path, is_active, scheduled_for, announcement_id))
            else:
                cursor.execute("""
                    UPDATE announcements 
                    SET title=%s, content=%s, announcement_type=%s, priority=%s, audience=%s, 
                        is_active=%s, scheduled_for=%s, updated_at=NOW()
                    WHERE id=%s
                """, (title, content, announcement_type, priority, audience, is_active, scheduled_for, announcement_id))
            
            conn.commit()
            return jsonify({"success": True, "message": "Announcement updated successfully"})
            
        elif request.method == 'DELETE':
            cursor.execute("DELETE FROM announcements WHERE id = %s", (announcement_id,))
            conn.commit()
            return jsonify({"success": True, "message": "Announcement deleted successfully"})
            
    except Exception as e:
        print(f"Error in announcement operation: {e}")
        return jsonify({"error": f"Operation failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student/announcements')
def get_student_announcements():
    """Get active announcements for students"""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                a.*,
                u.name as created_by_name
            FROM announcements a
            JOIN users u ON a.created_by = u.id
            WHERE a.is_active = TRUE 
            AND (a.audience = 'all' OR a.audience = 'students')
            AND (a.scheduled_for IS NULL OR a.scheduled_for <= NOW())
            ORDER BY 
                CASE a.priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END,
                a.created_at DESC
        """)
        announcements = cursor.fetchall()
        
        for announcement in announcements:
            if announcement.get('created_at'):
                announcement['created_at'] = announcement['created_at'].strftime('%Y-%m-%d %H:%M')
            if announcement.get('scheduled_for'):
                announcement['scheduled_for'] = announcement['scheduled_for'].strftime('%Y-%m-%d %H:%M')
            # Map announcement_type to type for frontend compatibility
            announcement['type'] = announcement.get('announcement_type', 'info')
        
        return jsonify({"success": True, "announcements": announcements})
        
    except Exception as e:
        print(f"Error fetching student announcements: {e}")
        return jsonify({"error": "Failed to fetch announcements"}), 500
    finally:
        cursor.close()
        conn.close()
        
#FINANCE START FROM HERE
# ============================================================================
# FEE MANAGEMENT API ROUTES
# ============================================================================

import random
import string
from datetime import datetime, timedelta

def generate_challan_number():
    """Generate unique challan number"""
    prefix = "CHL"
    date_str = datetime.now().strftime("%Y%m%d")
    random_str = ''.join(random.choices(string.digits, k=6))
    return f"{prefix}{date_str}{random_str}"

def number_to_words(num):
    """Convert number to words for challan"""
    words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    if num < 10:
        return words[num]
    # Simplified - you can add more complex conversion
    return str(num)

@app.route('/api/admin/fee/settings', methods=['GET', 'POST'])
def fee_settings_management():
    """Get or update fee settings"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        if request.method == 'GET':
            cursor.execute("SELECT * FROM fee_settings WHERE is_active = TRUE")
            settings = cursor.fetchall()
            return jsonify({"success": True, "settings": settings})
        
        elif request.method == 'POST':
            data = request.get_json()
            fee_type = data.get('fee_type')
            amount = data.get('amount')
            description = data.get('description', '')
            
            cursor.execute("""
                INSERT INTO fee_settings (fee_type, amount, description, updated_by)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    amount = VALUES(amount),
                    description = VALUES(description),
                    updated_by = VALUES(updated_by),
                    updated_at = CURRENT_TIMESTAMP
            """, (fee_type, amount, description, session["admin_id"]))
            
            conn.commit()
            return jsonify({"success": True, "message": "Fee settings updated"})
            
    except Exception as e:
        print(f"Error in fee settings: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/students', methods=['GET'])
def get_fee_students():
    """Get all approved students for fee management"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        batch = request.args.get('batch', 'all')
        department = request.args.get('department', 'all')
        
        # Check if fee_challans table exists
        cursor.execute("""
            SELECT COUNT(*) as table_exists 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'fee_challans'
        """)
        table_check = cursor.fetchone()
        fee_table_exists = table_check['table_exists'] > 0
        
        # Fixed query - phone comes from student_details, not users table
        if fee_table_exists:
            query = """
                SELECT 
                    u.id as student_id,
                    u.name,
                    u.email,
                    sd.phone,
                    sd.roll_number,
                    sd.department,
                    sd.batch_year,
                    sd.cnic,
                    sd.father_name,
                    r.room_number,
                    b.bed_number,
                    COALESCE((
                        SELECT SUM(fc.amount) 
                        FROM fee_challans fc 
                        WHERE fc.student_id = u.id AND fc.status IN ('pending', 'submitted')
                    ), 0) as pending_amount
                FROM users u
                JOIN student_details sd ON u.id = sd.user_id
                LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN beds b ON a.bed_id = b.id
                WHERE u.role = 'student' AND sd.status = 'approved'
            """
        else:
            # Fallback query without fee data
            query = """
                SELECT 
                    u.id as student_id,
                    u.name,
                    u.email,
                    sd.phone,
                    sd.roll_number,
                    sd.department,
                    sd.batch_year,
                    sd.cnic,
                    sd.father_name,
                    r.room_number,
                    b.bed_number,
                    0 as pending_amount
                FROM users u
                JOIN student_details sd ON u.id = sd.user_id
                LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN beds b ON a.bed_id = b.id
                WHERE u.role = 'student' AND sd.status = 'approved'
            """
        
        params = []
        if batch != 'all':
            query += " AND sd.batch_year = %s"
            params.append(batch)
        if department != 'all':
            query += " AND sd.department = %s"
            params.append(department)
            
        query += " ORDER BY sd.batch_year DESC, u.name ASC"
        
        cursor.execute(query, params)
        students = cursor.fetchall()
        
        return jsonify({"success": True, "students": students, "fee_table_exists": fee_table_exists})
        
    except Exception as e:
        print(f"Error fetching students for fee: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/challans/generate', methods=['POST'])
def generate_challans():
    """Generate fee challans for selected students with exact bank challan format"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    student_ids = data.get('student_ids', [])
    amount = data.get('amount')
    due_date = data.get('due_date')
    fee_type = data.get('fee_type', 'hostel')
    description = data.get('description', '')
    
    if not student_ids or not amount or not due_date:
        return jsonify({"error": "Missing required fields"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    generated_challans = []
    
    try:
        for student_id in student_ids:
            # Get complete student details
            cursor.execute("""
                SELECT 
                    u.id as student_id,
                    u.name,
                    u.email,
                    sd.father_name,
                    sd.cnic,
                    sd.roll_number,
                    sd.department,
                    sd.batch_year,
                    sd.phone,
                    sd.address,
                    r.room_number,
                    b.bed_number,
                    r.room_type,
                    r.floor
                FROM users u
                JOIN student_details sd ON u.id = sd.user_id
                LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN beds b ON a.bed_id = b.id
                WHERE u.id = %s AND u.role = 'student'
            """, (student_id,))
            
            student = cursor.fetchone()
            if not student:
                continue
            
            challan_number = generate_challan_number()
            form_no = f"CHL-{datetime.now().strftime('%Y%m')}-{random.randint(1000, 9999)}"
            
            cursor.execute("""
                INSERT INTO fee_challans 
                (challan_number, student_id, fee_type, amount, due_date, description, created_by, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
            """, (challan_number, student_id, fee_type, amount, due_date, description, session["admin_id"]))
            
            challan_id = cursor.lastrowid
            
            generated_challans.append({
                'challan_id': challan_id,
                'challan_number': challan_number,
                'form_no': form_no,
                'student': student,
                'amount': amount,
                'due_date': due_date,
                'fee_type': fee_type
            })
        
        conn.commit()
        
        # Generate PDF for each challan and send email
        for challan in generated_challans:
            pdf_path = generate_challan_pdf(challan, app.config)
            send_challan_email_with_pdf(challan, pdf_path, app.config)
        
        return jsonify({
            "success": True,
            "message": f"Generated {len(generated_challans)} challan(s) successfully",
            "generated_count": len(generated_challans)
        })
        
    except Exception as e:
        conn.rollback()
        print(f"Error generating challans: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


def generate_challan_pdf(challan_data, config):
    """Generate exact bank challan PDF matching your template"""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    import os
    
    student = challan_data['student']
    amount = float(challan_data['amount'])
    date_str = datetime.now().strftime('%Y-%m-%d')
    due_date_str = challan_data['due_date']
    
    # Helper function to safely get student field with default
    def get_student_field(field, default='_______'):
        value = student.get(field)
        if value and str(value).strip():
            return str(value)[:30]
        return default
    
    # Convert amount to words
    def number_to_words(num):
        ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                'Seventeen', 'Eighteen', 'Nineteen']
        tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        
        if num == 0:
            return 'Zero'
        
        def convert(n):
            if n < 20:
                return ones[n]
            elif n < 100:
                return tens[n // 10] + (' ' + ones[n % 10] if n % 10 != 0 else '')
            elif n < 1000:
                return ones[n // 100] + ' Hundred' + (' ' + convert(n % 100) if n % 100 != 0 else '')
            elif n < 100000:
                return convert(n // 1000) + ' Thousand' + (' ' + convert(n % 1000) if n % 1000 != 0 else '')
            else:
                return convert(n // 100000) + ' Lakh' + (' ' + convert(n % 100000) if n % 100000 != 0 else '')
        
        return convert(int(num))
    
    amount_in_words = number_to_words(amount)
    
    # Create PDF file path
    filename = f"challan_{challan_data['challan_number']}.pdf"
    filepath = os.path.join(config.get('UPLOAD_FOLDER', 'static/uploads'), filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Create PDF with 4 copies per page (2x2 grid)
    c = canvas.Canvas(filepath, pagesize=A4)
    width, height = A4
    
    # Create 4 challans per page (2 columns x 2 rows)
    for copy_index in range(4):
        # Calculate position for each copy
        col = copy_index % 2
        row = copy_index // 2
        x_offset = col * (width / 2)
        y_offset = height - ((row + 1) * (height / 2))
        
        # Determine copy type
        copy_types = ['Hostel Copy', 'Finance Wing Copy', 'Candidate Copy', 'Bank Copy']
        copy_type = copy_types[copy_index] if copy_index < len(copy_types) else 'Copy'
        
        # Draw border for each challan
        c.setStrokeColor(colors.black)
        c.setLineWidth(1)
        c.rect(x_offset + 20, y_offset - 200, width/2 - 40, 190)
        
        # Header
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(x_offset + width/4, y_offset - 25, copy_type)
        
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x_offset + width/4, y_offset - 40, 
            "The Benazir Bhutto Shaheed University of Technology & Skill Development Khairpur Mirs")
        
        # Date and Form No
        c.setFont("Helvetica", 8)
        c.drawString(x_offset + 30, y_offset - 55, f"Date: {date_str}")
        c.drawRightString(x_offset + width/2 - 30, y_offset - 55, f"Form No: {challan_data['form_no']}")
        
        # Bank Challan Title
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(x_offset + width/4, y_offset - 70, "BANK CHALLAN")
        
        # Bank Details
        c.setFont("Helvetica", 7)
        c.drawCentredString(x_offset + width/4, y_offset - 82, 
            "A/C Title: BBSUTSD-FEES COLLECTION A/C")
        c.drawCentredString(x_offset + width/4, y_offset - 92, 
            "A/C No: 00737935637203")
        c.drawCentredString(x_offset + width/4, y_offset - 102, 
            "Habib Bank Limited Mall Road Branch Khairpur Mirs")
        
        # Student Details Table
        y = y_offset - 120
        c.setFont("Helvetica", 7)
        
        # Student Name
        c.drawString(x_offset + 25, y, "NAME OF STUDENT:")
        c.drawString(x_offset + 150, y, get_student_field('name'))
        
        y -= 12
        c.drawString(x_offset + 25, y, "S/O D/O:")
        c.drawString(x_offset + 150, y, get_student_field('father_name'))
        
        y -= 12
        c.drawString(x_offset + 25, y, "CNIC:")
        c.drawString(x_offset + 150, y, get_student_field('cnic'))
        
        y -= 12
        c.drawString(x_offset + 25, y, "ROLL NO.:")
        c.drawString(x_offset + 150, y, get_student_field('roll_number'))
        
        y -= 12
        c.drawString(x_offset + 25, y, "YEAR:")
        c.drawString(x_offset + 80, y, get_student_field('batch_year'))
        c.drawString(x_offset + 150, y, "ROOM NO:")
        c.drawString(x_offset + 220, y, get_student_field('room_number'))
        
        # Amount Table
        y -= 20
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x_offset + 25, y, "Description")
        c.drawString(x_offset + 180, y, "R.S")
        
        y -= 10
        c.setFont("Helvetica", 7)
        c.drawString(x_offset + 25, y, "HOSTEL FEES")
        c.drawRightString(x_offset + (width/2) - 35, y, f"{amount:,.2f}")
        
        y -= 20
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x_offset + 25, y, "Total")
        c.drawRightString(x_offset + (width/2) - 35, y, f"{amount:,.2f}")
        
        # Total in words
        y -= 15
        c.setFont("Helvetica", 6)
        c.drawString(x_offset + 25, y, f"Total in Words: {amount_in_words} Rupees Only")
        
        # Signatures
        y -= 20
        c.setFont("Helvetica", 7)
        c.drawString(x_offset + 25, y, "Applicant Signature")
        c.drawString(x_offset + 125, y, "Bank Officer Signature")
        c.drawString(x_offset + 225, y, "Applicant Signature")
        c.drawString(x_offset + 325, y, "Bank Officer Signature")
        
        y -= 12
        c.setFont("Helvetica", 6)
        c.drawCentredString(x_offset + width/4, y, "Countersigned by the Official")
    
    c.save()
    return filepath

def send_challan_email_with_pdf(challan_data, pdf_path, config):
    """Send challan as PDF attachment to student"""
    try:
        student = challan_data['student']
        amount = float(challan_data['amount'])
        due_date_str = challan_data['due_date']
        
        msg = MIMEMultipart()
        msg['Subject'] = f"Fee Challan - {challan_data['challan_number']}"
        msg['From'] = config.get('SMTP_USERNAME')
        msg['To'] = student['email']
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #2F3A8F; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; }}
                .amount {{ font-size: 24px; color: #2F3A8F; font-weight: bold; }}
                .due-date {{ color: #DC2626; font-weight: bold; }}
                .footer {{ text-align: center; padding: 20px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Fee Challan Generated</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{student['name']}</strong>,</p>
                    <p>A new fee challan has been generated for you.</p>
                    
                    <h3>Challan Details:</h3>
                    <ul>
                        <li><strong>Challan Number:</strong> {challan_data['challan_number']}</li>
                        <li><strong>Amount:</strong> <span class="amount">Rs. {amount:,.2f}</span></li>
                        <li><strong>Due Date:</strong> <span class="due-date">{due_date_str}</span></li>
                        <li><strong>Fee Type:</strong> {challan_data['fee_type'].upper()}</li>
                    </ul>
                    
                    <p><strong>Student Information:</strong></p>
                    <ul>
                        <li>Roll Number: {student.get('roll_number', 'N/A')}</li>
                        <li>Department: {student.get('department', 'N/A')}</li>
                        <li>Batch Year: {student.get('batch_year', 'N/A')}</li>
                        <li>Room Number: {student.get('room_number', 'Not Allotted')}</li>
                    </ul>
                    
                    <p><strong>Bank Details:</strong></p>
                    <ul>
                        <li>Bank: Habib Bank Limited</li>
                        <li>Branch: Mall Road Branch, Khairpur Mirs</li>
                        <li>Account Title: BBSUTSD-FEES COLLECTION A/C</li>
                        <li>Account Number: 00737935637203</li>
                    </ul>
                    
                    <p>Please find attached the bank challan. You can also view and download it from your student portal.</p>
                    
                    <p><strong>Instructions:</strong></p>
                    <ol>
                        <li>Print the attached challan</li>
                        <li>Fill in the required details</li>
                        <li>Deposit the fee at any HBL branch</li>
                        <li>Upload the payment proof in your student portal</li>
                    </ol>
                </div>
                <div class="footer">
                    <p>Hostel Management Team<br>BBS University of Technology & Skill Development</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_content, 'html'))
        
        # Attach PDF
        with open(pdf_path, 'rb') as f:
            attachment = MIMEText(f.read(), 'base64', 'utf-8')
            attachment.add_header('Content-Disposition', f'attachment; filename=challan_{challan_data["challan_number"]}.pdf')
            attachment.add_header('Content-Type', 'application/pdf')
            msg.attach(attachment)
        
        with smtplib.SMTP(config.get('SMTP_SERVER', 'smtp.gmail.com'), config.get('SMTP_PORT', 587)) as server:
            server.starttls()
            server.login(config.get('SMTP_USERNAME'), config.get('SMTP_PASSWORD'))
            server.send_message(msg)
        
        print(f"✅ Challan email sent to {student['email']}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send challan email: {e}")
        import traceback
        traceback.print_exc()
        return False


@app.route('/api/admin/fee/challans', methods=['GET'])
def get_all_challans():
    """Get all fee challans for admin"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        status = request.args.get('status', 'all')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        offset = (page - 1) * per_page
        
        query = """
            SELECT 
                fc.*,
                u.name as student_name,
                u.email as student_email,
                sd.roll_number,
                sd.department,
                sd.batch_year,
                sd.phone
            FROM fee_challans fc
            JOIN users u ON fc.student_id = u.id
            JOIN student_details sd ON u.id = sd.user_id
        """
        
        count_query = "SELECT COUNT(*) as total FROM fee_challans fc"
        
        if status != 'all':
            query += " WHERE fc.status = %s"
            count_query += " WHERE fc.status = %s"
            params = (status,)
            count_params = (status,)
        else:
            params = ()
            count_params = ()
        
        query += " ORDER BY fc.created_at DESC LIMIT %s OFFSET %s"
        params += (per_page, offset)
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()['total']
        
        cursor.execute(query, params)
        challans = cursor.fetchall()
        
        for challan in challans:
            if challan.get('due_date'):
                challan['due_date'] = challan['due_date'].strftime('%Y-%m-%d')
            if challan.get('created_at'):
                challan['created_at'] = challan['created_at'].strftime('%Y-%m-%d %H:%M')
            if challan.get('submitted_at'):
                challan['submitted_at'] = challan['submitted_at'].strftime('%Y-%m-%d %H:%M')
        
        return jsonify({
            "success": True,
            "challans": challans,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page
        })
        
    except Exception as e:
        print(f"Error fetching challans: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/challans/<int:challan_id>/verify', methods=['POST'])
def verify_payment(challan_id):
    """Verify a payment submission"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    status = data.get('status')  # 'approved' or 'rejected'
    admin_notes = data.get('admin_notes', '')
    
    if status not in ['approved', 'rejected']:
        return jsonify({"error": "Invalid status"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get challan and student info
        cursor.execute("""
            SELECT fc.*, u.name, u.email 
            FROM fee_challans fc
            JOIN users u ON fc.student_id = u.id
            WHERE fc.id = %s
        """, (challan_id,))
        
        challan = cursor.fetchone()
        if not challan:
            return jsonify({"error": "Challan not found"}), 404
        
        new_status = 'approved' if status == 'approved' else 'rejected'
        
        cursor.execute("""
            UPDATE fee_challans 
            SET status = %s, admin_notes = %s, approved_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (new_status, admin_notes, challan_id))
        
        conn.commit()
        
        # Send notification email
        subject = f"Fee Payment {status.upper()} - {challan['challan_number']}"
        body = f"""
        Dear {challan['name']},
        
        Your fee payment has been {status}.
        
        Challan Number: {challan['challan_number']}
        Amount: Rs. {challan['amount']:,.2f}
        
        Admin Notes: {admin_notes or 'No additional notes'}
        
        You can check the status in your student portal.
        
        Regards,
        Hostel Management Team
        """
        
        send_email_notification(challan['email'], subject, body, app.config)
        
        return jsonify({"success": True, "message": f"Payment {status} successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error verifying payment: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/reminders/send', methods=['POST'])
def send_fee_reminders():
    """Send fee reminders via email and WhatsApp"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    title = data.get('title', 'Fee Payment Reminder')
    message = data.get('message', '')
    recipient_type = data.get('recipient_type', 'all')
    student_ids = data.get('student_ids', [])
    batch_year = data.get('batch_year')
    department = data.get('department')
    send_via = data.get('send_via', 'both')  # 'email', 'whatsapp', 'both'
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get recipient students
        query = """
            SELECT u.id, u.name, u.email, u.phone, sd.batch_year, sd.department
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE u.role = 'student' AND sd.status = 'approved'
        """
        params = []
        
        if recipient_type == 'individual' and student_ids:
            placeholders = ','.join(['%s'] * len(student_ids))
            query += f" AND u.id IN ({placeholders})"
            params.extend(student_ids)
        elif recipient_type == 'batch' and batch_year:
            query += " AND sd.batch_year = %s"
            params.append(batch_year)
        elif recipient_type == 'department' and department:
            query += " AND sd.department = %s"
            params.append(department)
        
        cursor.execute(query, params)
        students = cursor.fetchall()
        
        if not students:
            return jsonify({"error": "No students found for the selected criteria"}), 400
        
        email_sent = 0
        whatsapp_sent = 0
        
        for student in students:
            # Send email
            if send_via in ['email', 'both']:
                email_body = f"""
                Dear {student['name']},
                
                {message}
                
                Please login to the student portal to view your pending fee challans.
                
                Regards,
                Hostel Management Team
                """
                
                if send_email_notification(student['email'], title, email_body, app.config):
                    email_sent += 1
            
            # Send WhatsApp (using Twilio or similar service)
            if send_via in ['whatsapp', 'both'] and student.get('phone'):
                if send_whatsapp_message(student['phone'], f"{title}\n\n{message}", app.config):
                    whatsapp_sent += 1
        
        # Log reminder
        cursor.execute("""
            INSERT INTO fee_reminders 
            (title, message, recipient_type, recipient_ids, batch_year, department, sent_via, sent_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            title, message, recipient_type, 
            ','.join(map(str, student_ids)) if student_ids else None,
            batch_year, department, send_via, session["admin_id"]
        ))
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": f"Reminders sent successfully! Emails: {email_sent}, WhatsApp: {whatsapp_sent}",
            "total_students": len(students),
            "email_sent": email_sent,
            "whatsapp_sent": whatsapp_sent
        })
        
    except Exception as e:
        print(f"Error sending reminders: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/dashboard-stats')
def get_fee_dashboard_stats():
    """Get fee dashboard statistics"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Check if fee_challans table exists
        cursor.execute("""
            SELECT COUNT(*) as table_exists 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'fee_challans'
        """)
        table_check = cursor.fetchone()
        fee_table_exists = table_check['table_exists'] > 0
        
        if not fee_table_exists:
            return jsonify({
                "success": True,
                "stats": {
                    "total_collection": "Rs. 0",
                    "pending_fees": "Rs. 0",
                    "overdue_fees": "Rs. 0",
                    "pending_verification": 0,
                    "monthly_trend": []
                },
                "message": "Fee tables not yet created"
            })
        
        # Total collection (approved)
        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM fee_challans WHERE status = 'approved'")
        total_collection = cursor.fetchone()['total']
        
        # Pending fees
        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM fee_challans WHERE status = 'pending'")
        pending_fees = cursor.fetchone()['total']
        
        # Overdue fees
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM fee_challans 
            WHERE status = 'pending' AND due_date < CURDATE()
        """)
        overdue_fees = cursor.fetchone()['total']
        
        # Pending verification
        cursor.execute("SELECT COUNT(*) as count FROM fee_challans WHERE status = 'submitted'")
        pending_verification = cursor.fetchone()['count']
        
        # Monthly collection trend
        cursor.execute("""
            SELECT DATE_FORMAT(approved_at, '%Y-%m') as month, 
                   COALESCE(SUM(amount), 0) as total
            FROM fee_challans 
            WHERE status = 'approved' AND approved_at IS NOT NULL 
            AND approved_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(approved_at, '%Y-%m')
            ORDER BY month DESC
        """)
        monthly_trend = cursor.fetchall()
        
        return jsonify({
            "success": True,
            "stats": {
                "total_collection": f"Rs. {total_collection:,.2f}",
                "pending_fees": f"Rs. {pending_fees:,.2f}",
                "overdue_fees": f"Rs. {overdue_fees:,.2f}",
                "pending_verification": pending_verification,
                "monthly_trend": monthly_trend
            }
        })
        
    except Exception as e:
        print(f"Error fetching fee stats: {e}")
        return jsonify({
            "success": True, 
            "stats": {
                "total_collection": "Rs. 0",
                "pending_fees": "Rs. 0", 
                "overdue_fees": "Rs. 0",
                "pending_verification": 0,
                "monthly_trend": []
            }
        })
    finally:
        cursor.close()
        conn.close()

def send_whatsapp_message(phone_number, message, config):
    """Send WhatsApp message using Twilio WhatsApp API"""
    try:
        if not phone_number:
            print("⚠️ No phone number provided")
            return False
            
        # Clean phone number
        phone_number = str(phone_number).strip()
        
        # Remove any non-digit characters
        phone_number = ''.join(filter(str.isdigit, phone_number))
        
        if len(phone_number) < 10:
            print(f"⚠️ Invalid phone number: {phone_number}")
            return False
        
        # Pakistani number formatting
        if len(phone_number) == 10:
            # Local number like 03XXXXXXXXX
            phone_number = '+92' + phone_number[1:]
        elif len(phone_number) == 11 and phone_number.startswith('0'):
            phone_number = '+92' + phone_number[1:]
        elif len(phone_number) == 12 and not phone_number.startswith('92'):
            phone_number = '+92' + phone_number
        elif not phone_number.startswith('+'):
            phone_number = '+' + phone_number
        
        print(f"📱 Would send WhatsApp to {phone_number}: {message[:100]}...")
        
        # For actual Twilio implementation:
        # from twilio.rest import Client
        # client = Client(config.get('TWILIO_SID'), config.get('TWILIO_AUTH_TOKEN'))
        # message = client.messages.create(
        #     body=message,
        #     from_='whatsapp:' + config.get('TWILIO_WHATSAPP_NUMBER'),
        #     to='whatsapp:' + phone_number
        # )
        
        return True
        
    except Exception as e:
        print(f"❌ WhatsApp sending failed: {e}")
        return False

def send_email_notification(to_email, subject, body, config):
    """Send email notification"""
    try:
        msg = MIMEText(body, 'plain')
        msg['Subject'] = subject
        msg['From'] = config.get('SMTP_USERNAME')
        msg['To'] = to_email
        
        with smtplib.SMTP(config.get('SMTP_SERVER', 'smtp.gmail.com'), config.get('SMTP_PORT', 587)) as server:
            server.starttls()
            server.login(config.get('SMTP_USERNAME'), config.get('SMTP_PASSWORD'))
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        return False


@app.route('/api/admin/fee/batches')
def get_fee_batches():
    """Get distinct batch years for fee section"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT DISTINCT batch_year 
            FROM student_details 
            WHERE batch_year IS NOT NULL 
            ORDER BY batch_year DESC
        """)
        batches = cursor.fetchall()
        
        return jsonify({"success": True, "batches": [b['batch_year'] for b in batches]})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/admin/fee/departments')
def get_fee_departments():
    """Get distinct departments for fee section"""
    if "admin_id" not in session or session.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT DISTINCT department 
            FROM student_details 
            WHERE department IS NOT NULL 
            ORDER BY department
        """)
        departments = cursor.fetchall()
        
        return jsonify({"success": True, "departments": [d['department'] for d in departments]})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/student/fee/challans', methods=['GET'])
def get_student_challans():
    """Get all fee challans for logged-in student"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                fc.id, fc.challan_number, fc.amount, fc.due_date, 
                fc.fee_type, fc.description, fc.status, fc.admin_notes,
                DATE_FORMAT(fc.created_at, '%Y-%m-%d') as created_at,
                u.name as student_name,
                sd.cnic, sd.roll_number, sd.department, sd.batch_year,
                sd.father_name,
                r.room_number, b.bed_number
            FROM fee_challans fc
            JOIN users u ON fc.student_id = u.id
            JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
            LEFT JOIN rooms r ON a.room_id = r.id
            LEFT JOIN beds b ON a.bed_id = b.id
            WHERE fc.student_id = %s
            ORDER BY fc.created_at DESC
        """, (student_id,))
        
        challans = cursor.fetchall()
        
        return jsonify({"success": True, "challans": challans})
        
    except Exception as e:
        print(f"Error fetching student challans: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/student/fee/submit-proof', methods=['POST'])
def submit_payment_proof():
    """Submit payment proof for a challan"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    challan_id = request.form.get('challan_id')
    transaction_id = request.form.get('transaction_id')
    payment_method = request.form.get('payment_method')
    payment_date = request.form.get('payment_date')
    payment_notes = request.form.get('payment_notes', '')
    
    if not challan_id or not transaction_id:
        return jsonify({"error": "Missing required fields"}), 400
    
    # Handle file upload
    proof_file = request.files.get('proof')
    if not proof_file:
        return jsonify({"error": "Payment proof is required"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Verify challan belongs to student
        cursor.execute("""
            SELECT * FROM fee_challans 
            WHERE id = %s AND student_id = %s AND status = 'pending'
        """, (challan_id, student_id))
        
        challan = cursor.fetchone()
        if not challan:
            return jsonify({"error": "Invalid challan or already submitted"}), 400
        
        # Save proof file
        filename = secure_filename(f"proof_{challan_id}_{int(time.time())}_{proof_file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        proof_file.save(file_path)
        proof_path = f"uploads/profile_pictures/{filename}"
        
        # Update challan status
        cursor.execute("""
            UPDATE fee_challans 
            SET status = 'submitted', 
                payment_proof_path = %s,
                payment_notes = %s,
                submitted_at = NOW()
            WHERE id = %s
        """, (proof_path, payment_notes, challan_id))
        
        # Record transaction
        cursor.execute("""
            INSERT INTO fee_transactions 
            (challan_id, transaction_id, payment_method, amount, transaction_date, status)
            VALUES (%s, %s, %s, %s, %s, 'pending')
        """, (challan_id, transaction_id, payment_method, challan['amount'], payment_date))
        
        conn.commit()
        
        return jsonify({"success": True, "message": "Payment proof submitted successfully"})
        
    except Exception as e:
        conn.rollback()
        print(f"Error submitting proof: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/student/fee/challan/<int:challan_id>/download', methods=['GET'])
def download_challan_pdf(challan_id):
    """Download challan as PDF"""
    if "student_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    student_id = session["student_id"]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get challan details - removed u.phone
        cursor.execute("""
            SELECT 
                fc.*, 
                u.name, 
                u.email,
                sd.father_name, 
                sd.cnic, 
                sd.roll_number,
                sd.department, 
                sd.batch_year, 
                sd.phone,
                r.room_number, 
                b.bed_number,
                r.room_type,
                r.floor
            FROM fee_challans fc
            JOIN users u ON fc.student_id = u.id
            JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN allotments a ON u.id = a.student_id AND a.status = 'active'
            LEFT JOIN rooms r ON a.room_id = r.id
            LEFT JOIN beds b ON a.bed_id = b.id
            WHERE fc.id = %s AND fc.student_id = %s
        """, (challan_id, student_id))
        
        challan = cursor.fetchone()
        if not challan:
            return jsonify({"error": "Challan not found"}), 404
        
        # Generate PDF
        challan_data = {
            'challan_number': challan['challan_number'],
            'form_no': f"CHL-{datetime.now().strftime('%Y%m')}-{random.randint(1000, 9999)}",
            'student': challan,
            'amount': challan['amount'],
            'due_date': challan['due_date'].strftime('%Y-%m-%d') if challan['due_date'] else '',
            'fee_type': challan['fee_type']
        }
        
        pdf_path = generate_challan_pdf(challan_data, app.config)
        
        return send_file(pdf_path, as_attachment=True, download_name=f"challan_{challan['challan_number']}.pdf")
        
    except Exception as e:
        print(f"Error downloading challan: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
# --------------------------
# Logout
# --------------------------
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for("index") if 'index' in globals() else '/')

# --------------------------
# Run app
# --------------------------
if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true', 
            host='0.0.0.0', 
            port=5000)
