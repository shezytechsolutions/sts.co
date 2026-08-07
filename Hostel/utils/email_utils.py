import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class EmailVerification:
    """Handle email verification codes and sending"""
    
    def __init__(self, app=None):
        self.app = app
    
    def generate_verification_code(self, length=6):
        """Generate a numeric verification code"""
        return ''.join(random.choices(string.digits, k=length))
    
    def send_verification_email(self, to_email, user_name, verification_code):
        """Send verification code to user's email"""
        try:
            # Get SMTP configuration from app.config
            smtp_server = current_app.config.get('SMTP_SERVER', 'smtp.gmail.com')
            smtp_port = current_app.config.get('SMTP_PORT', 587)
            smtp_username = current_app.config.get('SMTP_USERNAME')
            smtp_password = current_app.config.get('SMTP_PASSWORD')
            
            print(f"📧 Attempting to send email to {to_email}")
            print(f"   SMTP Server: {smtp_server}:{smtp_port}")
            print(f"   Username: {smtp_username}")
            
            if not smtp_username or not smtp_password:
                logger.error("SMTP credentials not configured")
                print("❌ SMTP credentials not configured in .env file")
                print("Please set SMTP_USERNAME and SMTP_PASSWORD in .env")
                return False
            
            subject = "Verify Your Email - Hostel Management System"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 10px;
                        background: #f9f9f9;
                    }}
                    .header {{
                        background: #583d06;
                        padding: 20px;
                        color: white;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }}
                    .content {{
                        padding: 30px;
                        background: white;
                        border-radius: 0 0 10px 10px;
                    }}
                    .code {{
                        font-size: 32px;
                        font-weight: bold;
                        color: #583d06;
                        text-align: center;
                        padding: 20px;
                        background: #f0f0f0;
                        border-radius: 5px;
                        margin: 20px 0;
                        letter-spacing: 5px;
                    }}
                    .footer {{
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        color: #888;
                        font-size: 12px;
                    }}
                    .warning {{
                        background: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 10px;
                        margin: 20px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Hostel Management System</h2>
                    </div>
                    <div class="content">
                        <h3>Welcome {user_name}!</h3>
                        <p>Thank you for registering with our Hostel Management System.</p>
                        <p>Please use the verification code below to complete your registration:</p>
                        
                        <div class="code">
                            {verification_code}
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Important:</strong>
                            <p>This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
                        </div>
                        
                        <p>If you didn't request this verification, please ignore this email.</p>
                        
                        <p>Best regards,<br>
                        <strong>Hostel Management Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; 2024 Hostel Management System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = smtp_username
            msg['To'] = to_email
            msg['Reply-To'] = smtp_username
            
            # Attach HTML content
            msg.attach(MIMEText(html_content, 'html'))
            
            # Send email with proper error handling
            try:
                # Create SMTP connection
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.set_debuglevel(False)
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
                server.quit()
                
                print(f"✅ Verification email sent to {to_email}")
                return True
                
            except smtplib.SMTPAuthenticationError:
                logger.error("SMTP Authentication failed - Check your email and app password")
                print("❌ SMTP Authentication failed!")
                print("   If using Gmail, you need to:")
                print("   1. Enable 2-Factor Authentication on your Google account")
                print("   2. Generate an App Password at https://myaccount.google.com/apppasswords")
                print("   3. Use that 16-character app password in .env file")
                return False
                
            except smtplib.SMTPException as e:
                logger.error(f"SMTP error: {e}")
                print(f"❌ SMTP error: {e}")
                return False
                
        except Exception as e:
            logger.error(f"Email sending failed: {e}")
            print(f"❌ Email sending failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def send_admin_notification(self, user_name, user_email):
        """Send notification to admin about new registration"""
        try:
            smtp_server = current_app.config.get('SMTP_SERVER', 'smtp.gmail.com')
            smtp_port = current_app.config.get('SMTP_PORT', 587)
            smtp_username = current_app.config.get('SMTP_USERNAME')
            smtp_password = current_app.config.get('SMTP_PASSWORD')
            admin_email = current_app.config.get('ADMIN_EMAIL', smtp_username)
            
            if not smtp_username or not smtp_password:
                print("❌ SMTP credentials not configured")
                return False
            
            subject = "New Student Registration - Pending Approval"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 10px;
                    }}
                    .header {{ background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ padding: 20px; }}
                    .button {{ background: #583d06; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>New Student Registration</h2>
                    </div>
                    <div class="content">
                        <p>A new student has registered and completed email verification:</p>
                        <ul>
                            <li><strong>Name:</strong> {user_name}</li>
                            <li><strong>Email:</strong> {user_email}</li>
                        </ul>
                        <p>Please login to the admin panel to review and approve this registration.</p>
                        <p style="text-align: center;">
                            <a href="{current_app.config.get('SITE_URL', 'http://localhost:5000')}/admin_login" class="button">Go to Admin Panel</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = smtp_username
            msg['To'] = admin_email
            msg.attach(MIMEText(html_content, 'html'))
            
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
            
            print(f"✅ Admin notification sent to {admin_email}")
            return True
        except Exception as e:
            logger.error(f"Admin notification failed: {e}")
            print(f"❌ Admin notification failed: {e}")
            return False

email_verification = EmailVerification()