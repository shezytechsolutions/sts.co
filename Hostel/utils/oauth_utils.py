from google.oauth2 import id_token
from google.auth.transport import requests
from flask import current_app, session
import re

class GoogleOAuth:
    """Handle Google OAuth authentication"""
    
    @staticmethod
    def verify_google_token(token):
        """Verify Google ID token and return user info - allows Gmail and bbsutsd.edu.pk accounts"""
        try:
            # Verify token with Google
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                current_app.config['GOOGLE_CLIENT_ID']
            )
            
            # Check if token is valid
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
            
            # Get user information
            email = idinfo.get('email')
            
            # Check email domain - Allow @gmail.com AND @bbsutsd.edu.pk
            if not re.search(r'@(gmail\.com|bbsutsd\.edu\.pk)$', email, re.IGNORECASE):
                current_app.logger.warning(f"Invalid domain attempted: {email}")
                print(f"❌ Invalid domain: {email}. Only @gmail.com or @bbsutsd.edu.pk allowed.")
                return None
            
            # Check if email is verified by Google
            if not idinfo.get('email_verified', False):
                current_app.logger.warning(f"Unverified email attempted: {email}")
                return None
            
            user_info = {
                'email': email,
                'name': idinfo.get('name'),
                'google_id': idinfo.get('sub'),
                'email_verified': True
            }
            
            print(f"✅ Google auth successful for: {email}")
            return user_info
            
        except ValueError as e:
            current_app.logger.error(f"Invalid Google token: {e}")
            print(f"❌ Google token error: {e}")
            return None
    
    @staticmethod
    def get_google_auth_url():
        """Get Google OAuth authorization URL"""
        return f"https://accounts.google.com/o/oauth2/v2/auth?client_id={current_app.config['GOOGLE_CLIENT_ID']}&redirect_uri={current_app.config['SITE_URL']}/google_callback&response_type=code&scope=email%20profile"