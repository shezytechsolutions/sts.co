// register.js - Complete working version with Google registration support
let verificationTimer = null;
let isGoogleRegistration = false;

document.addEventListener('DOMContentLoaded', function () {
    initializeFormValidation();
    setupImageUpload();
    setupRealTimeValidation();
    setupFormSubmission();
    checkForGoogleRegistration();
});

function checkForGoogleRegistration() {
    // Check if we have Google registration data in session
    fetch('/check_google_session')
        .then(response => response.json())
        .then(data => {
            if (data.has_google && data.email) {
                isGoogleRegistration = true;
                const emailField = document.getElementById('email');
                if (emailField) {
                    emailField.value = data.email;
                    emailField.disabled = true;
                    emailField.style.background = '#f5f5f5';
                    emailField.style.cursor = 'not-allowed';
                }
                
                const nameField = document.getElementById('name');
                if (nameField && data.name) {
                    nameField.value = data.name;
                }
                
                // For Google registration, password fields are still required
                // but we'll handle them differently
                const passwordField = document.getElementById('password');
                const confirmField = document.getElementById('confirmPassword');
                
                if (passwordField) passwordField.required = true;
                if (confirmField) confirmField.required = true;
                
                showNotification('Please complete your registration with Google. Set a password for your account.', 'info');
            }
        })
        .catch(err => console.log('No Google session:', err));
}
function initializeFormValidation() {
    const allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        input.style.borderColor = 'var(--border)';
        const errorElement = document.getElementById(input.id + 'Error');
        if (errorElement) errorElement.textContent = '';
    });
}
function validateProfilePicture() {
    const fileInput = document.getElementById('profilePicture');
    const errorElement = document.getElementById('profilePictureError');
    const imagePreview = document.getElementById('imagePreview');

    if (!fileInput) return true;

    const file = fileInput.files[0];

    // Clear previous error
    if (errorElement) errorElement.textContent = '';

    // Check if file is selected
    if (!file) {
        if (errorElement) errorElement.textContent = 'Profile picture is required. Please upload an image.';
        fileInput.style.borderColor = 'var(--danger)';
        return false;
    }

    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
        if (errorElement) errorElement.textContent = 'File size must be less than 2MB';
        fileInput.style.borderColor = 'var(--danger)';
        return false;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        if (errorElement) errorElement.textContent = 'Only JPEG and PNG images are allowed';
        fileInput.style.borderColor = 'var(--danger)';
        return false;
    }

    // Check if preview exists (image was actually loaded)
    if (!imagePreview || !imagePreview.src || imagePreview.src === '' || imagePreview.style.display === 'none') {
        if (errorElement) errorElement.textContent = 'Please select a valid image file';
        return false;
    }

    fileInput.style.borderColor = 'var(--success)';
    return true;
}

// Update removeImage function
function removeImage() {
    const profilePicture = document.getElementById('profilePicture');
    const imagePreview = document.getElementById('imagePreview');
    const avatarPreview = document.getElementById('avatarPreview');
    const errorElement = document.getElementById('profilePictureError');

    if (profilePicture) {
        profilePicture.value = '';
        profilePicture.style.borderColor = 'var(--border)';
    }
    if (imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.src = '';
    }
    if (avatarPreview) avatarPreview.style.display = 'flex';
    if (errorElement) errorElement.textContent = 'Profile picture is required';

    // Show notification
    showNotification('Profile picture removed. Please upload a new one.', 'warning');
}

function setupImageUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const profilePicture = document.getElementById('profilePicture');
    const imagePreview = document.getElementById('imagePreview');
    const avatarPreview = document.getElementById('avatarPreview');

    if (uploadArea && profilePicture) {
        uploadArea.addEventListener('click', () => profilePicture.click());
        profilePicture.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                showNotification('File size must be less than 2MB', 'error');
                this.value = '';
                return;
            }

            if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
                showNotification('Only JPEG and PNG images are allowed', 'error');
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (ev) {
                if (imagePreview) {
                    imagePreview.src = ev.target.result;
                    imagePreview.style.display = 'block';
                }
                if (avatarPreview) avatarPreview.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }
}

function setupRealTimeValidation() {
    const cnicField = document.getElementById('cnic');
    if (cnicField) {
        cnicField.addEventListener('input', function (e) {
            formatCNIC(this);
            this.style.borderColor = 'var(--border)';
            document.getElementById('cnicError').textContent = '';
        });
        cnicField.addEventListener('blur', () => validateField('cnic'));
    }

    const phoneFields = ['phone', 'emergency_contact'];
    phoneFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function (e) {
                formatPhone(this);
                this.style.borderColor = 'var(--border)';
                document.getElementById(fieldId + 'Error').textContent = '';
            });
            field.addEventListener('blur', () => validateField(fieldId));
        }
    });

    const otherFields = ['name', 'email', 'password', 'confirmPassword', 'father_name', 'birthdate', 'address', 'department', 'batch_year', 'roll_number'];
    otherFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', () => validateField(fieldId));
            field.addEventListener('input', () => {
                field.style.borderColor = 'var(--border)';
                const errorElement = document.getElementById(fieldId + 'Error');
                if (errorElement) errorElement.textContent = '';
            });
        }
    });
}

function setupFormSubmission() {
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleFormSubmit);
    }
}

function formatCNIC(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 13) value = value.substring(0, 13);
    if (value.length > 5) value = value.substring(0, 5) + '-' + value.substring(5);
    if (value.length > 13) value = value.substring(0, 13) + '-' + value.substring(13);
    input.value = value;

    const digitCount = value.replace(/\D/g, '').length;
    const errorElement = document.getElementById('cnicError');

    if (digitCount === 13) {
        input.style.borderColor = 'var(--success)';
        if (errorElement) errorElement.textContent = '';
    } else {
        input.style.borderColor = 'var(--border)';
        if (errorElement && value.length > 0) {
            errorElement.textContent = `${digitCount}/13 digits`;
        }
    }
}

function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    if (value.length > 4) value = value.substring(0, 4) + '-' + value.substring(4);
    input.value = value;

    const digitCount = value.replace(/\D/g, '').length;
    const errorElement = document.getElementById(input.id + 'Error');

    if (digitCount === 11) {
        input.style.borderColor = 'var(--success)';
        if (errorElement) errorElement.textContent = '';
    } else {
        input.style.borderColor = 'var(--border)';
        if (errorElement && value.length > 0) {
            errorElement.textContent = `${digitCount}/11 digits`;
        }
    }
}

function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const value = field?.value.trim() || '';
    const errorElement = document.getElementById(fieldId + 'Error');

    if (!field || !errorElement) return true;

    let isValid = true;
    let errorMessage = '';

    switch (fieldId) {
        case 'name':
        case 'father_name':
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (!/^[A-Za-z\s]{3,50}$/.test(value)) {
                errorMessage = 'Only letters and spaces (3-50 characters)';
                isValid = false;
            }
            break;

        case 'email':
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (!/^[a-z0-9._%+-]+@(gmail\.com|bbsutsd\.edu\.pk)$/i.test(value)) {
                errorMessage = 'Only @gmail.com or @bbsutsd.edu.pk email addresses are allowed';
                isValid = false;
            }
            break;

        case 'password':
            if (!value && !isGoogleRegistration) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (value && value.length < 8) {
                errorMessage = 'Password must be at least 8 characters';
                isValid = false;
            } else if (value && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                errorMessage = 'Include uppercase, lowercase and number';
                isValid = false;
            }
            break;

        case 'confirmPassword':
            const password = document.getElementById('password')?.value || '';
            if (!isGoogleRegistration && !value) {
                errorMessage = 'Please confirm your password';
                isValid = false;
            } else if (value && value !== password) {
                errorMessage = 'Passwords do not match';
                isValid = false;
            }
            break;

        case 'cnic':
            const cnicDigits = value.replace(/\D/g, '');
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (cnicDigits.length !== 13) {
                errorMessage = 'CNIC must be 13 digits (XXXXX-XXXXXXX-X)';
                isValid = false;
            }
            break;

        case 'phone':
        case 'emergency_contact':
            const phoneDigits = value.replace(/\D/g, '');
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (phoneDigits.length !== 11) {
                errorMessage = 'Phone must be 11 digits (XXXX-XXXXXXX)';
                isValid = false;
            }
            break;

        case 'birthdate':
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else {
                const birthdate = new Date(value);
                const year = birthdate.getFullYear();
                if (isNaN(year) || year < 1995 || year > 2008) {
                    errorMessage = 'Birth year must be between 1995-2008';
                    isValid = false;
                }
            }
            break;

        case 'address':
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            } else if (value.length < 10) {
                errorMessage = 'Address must be at least 10 characters';
                isValid = false;
            }
            break;

        case 'department':
        case 'batch_year':
        case 'roll_number':
            if (!value) {
                errorMessage = 'This field is required';
                isValid = false;
            }
            break;
    }

    if (!isValid && errorMessage) {
        field.style.borderColor = 'var(--danger)';
        errorElement.textContent = errorMessage;
    } else if (isValid && value) {
        field.style.borderColor = 'var(--success)';
        errorElement.textContent = '';
    } else {
        field.style.borderColor = 'var(--border)';
        errorElement.textContent = '';
    }

    return isValid;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Check if this is Google registration
    const isGoogleReg = isGoogleRegistration;
    
    // Validate profile picture FIRST for both regular and Google registration
    if (!validateProfilePicture()) {
        showNotification('Please upload a profile picture.', 'error');
        document.getElementById('profilePicture').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // For regular registration, validate all fields
    if (!isGoogleReg) {
        const requiredFields = [
            'name', 'email', 'password', 'confirmPassword',
            'father_name', 'cnic', 'phone', 'birthdate',
            'address', 'department', 'batch_year', 'roll_number', 'emergency_contact'
        ];

        let isValid = true;
        requiredFields.forEach(fieldId => {
            if (!validateField(fieldId)) {
                isValid = false;
            }
        });

        if (!isValid) {
            showNotification('Please fix all errors before submitting.', 'error');
            const firstError = document.querySelector('.error:not(:empty)');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
    }

    // Show submission overlay
    showSubmissionOverlay('Processing your registration...');

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    try {
        let response;
        let result;
        
        // Create FormData with ALL form fields including profile picture
        const formData = new FormData(e.target);
        
        // Verify profile picture is in FormData
        const profilePicture = document.getElementById('profilePicture').files[0];
        if (!profilePicture) {
            hideSubmissionOverlay();
            showNotification('Profile picture is required.', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        console.log('📸 Profile picture selected:', profilePicture.name, profilePicture.size, 'bytes');
        
        if (isGoogleReg) {
            // For Google registration, use the Google-specific endpoint
            response = await fetch('/student_register_google_submit', {
                method: 'POST',
                body: formData
            });
            
            result = await response.json();
            
            if (result.success && result.requires_verification) {
                // Show verification section
                hideSubmissionOverlay();
                const verificationSection = document.getElementById('verificationSection');
                const verifyEmailSpan = document.getElementById('verifyEmailAddress');
                const email = document.getElementById('email').value;
                
                if (verifyEmailSpan) verifyEmailSpan.textContent = email;
                if (verificationSection) {
                    verificationSection.style.display = 'block';
                    verificationSection.classList.add('active');
                }
                
                // Setup verify button event listener
                const verifyBtn = document.getElementById('verifyCodeBtn');
                if (verifyBtn && !verifyBtn.hasListener) {
                    verifyBtn.hasListener = true;
                    verifyBtn.onclick = verifyCode;
                }
                
                startTimer(10);
                showNotification('Verification code sent to your email!', 'success');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            } else if (!result.success) {
                hideSubmissionOverlay();
                showNotification(result.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            }
        } else {
            // Regular registration
            response = await fetch('/student_register', {
                method: 'POST',
                body: formData
            });
            
            result = await response.json();
        }

        hideSubmissionOverlay();

        if (result.success) {
            showSuccessOverlay('✅ Registration Submitted Successfully!<br>Your account is pending admin approval.');
            
            // Clear Google session
            if (isGoogleReg) {
                sessionStorage.removeItem('google_email');
            }
            
            setTimeout(() => {
                e.target.reset();
                removeImage();
                if (result.redirect) {
                    window.location.href = result.redirect;
                }
            }, 3000);
        } else {
            if (result.message.includes('already registered') ||
                result.message.includes('Already registered') ||
                result.message.includes('Email already')) {
                showNotification('This email is already registered. Please use a different email or check your account status.', 'error');
            } else if (result.message.includes('under approval')) {
                showNotification('Your account is already under approval process. Please wait for admin approval.', 'warning');
            } else {
                showNotification(result.message || 'Registration failed. Please try again.', 'error');
            }
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Submission error:', error);
        hideSubmissionOverlay();
        showNotification('Network error! Please check your connection and try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}
// Add this function for real-time email validation
function validateEmail(input) {
    const email = input.value.trim();
    const errorSpan = document.getElementById('emailError');
    const pattern = /^[a-z0-9._%+-]+@(gmail\.com|bbsutsd\.edu\.pk)$/i;

    if (!email) {
        errorSpan.textContent = 'Email is required';
        input.style.borderColor = 'var(--danger)';
        return false;
    } else if (!pattern.test(email)) {
        errorSpan.textContent = 'Only @gmail.com or @bbsutsd.edu.pk email addresses are allowed';
        input.style.borderColor = 'var(--danger)';
        return false;
    } else {
        errorSpan.textContent = '';
        input.style.borderColor = 'var(--success)';
        return true;
    }
}

function setupVerificationListener() {
    const verifyBtn = document.getElementById('verifyCodeBtn');
    if (verifyBtn && !verifyBtn.hasListener) {
        verifyBtn.hasListener = true;
        verifyBtn.addEventListener('click', verifyCode);
    }
}

async function verifyCode() {
    const code = document.getElementById('verificationCode').value.trim();

    if (!code || code.length !== 6) {
        showNotification('Please enter the 6-digit verification code.', 'warning');
        return;
    }

    const verifyBtn = document.getElementById('verifyCodeBtn');
    const originalText = verifyBtn.innerHTML;
    verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/verify_registration_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Email verified successfully! Registration complete.', 'success');

            if (verificationTimer) {
                clearInterval(verificationTimer);
            }

            // Clear Google session
            isGoogleRegistration = false;
            
            setTimeout(() => {
                window.location.href = result.redirect || '/student_login';
            }, 2000);
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('Verification failed. Please try again.', 'error');
    } finally {
        verifyBtn.innerHTML = originalText;
        verifyBtn.disabled = false;
    }
}

function startTimer(minutes) {
    let timeLeft = minutes * 60;
    const timerElement = document.getElementById('timer');
    const minutesSpan = document.getElementById('timerMinutes');
    const secondsSpan = document.getElementById('timerSeconds');

    if (verificationTimer) {
        clearInterval(verificationTimer);
    }

    function updateTimer() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;

        minutesSpan.textContent = mins.toString().padStart(2, '0');
        secondsSpan.textContent = secs.toString().padStart(2, '0');

        if (timeLeft <= 0) {
            clearInterval(verificationTimer);
            timerElement.classList.add('warning');
            timerElement.innerHTML = 'Code expired. Please <a href="#" onclick="location.reload()">click here</a> to register again.';
        } else if (timeLeft <= 60) {
            timerElement.classList.add('warning');
        }

        timeLeft--;
    }

    updateTimer();
    verificationTimer = setInterval(updateTimer, 1000);
}

function removeImage() {
    const profilePicture = document.getElementById('profilePicture');
    const imagePreview = document.getElementById('imagePreview');
    const avatarPreview = document.getElementById('avatarPreview');
    if (profilePicture) profilePicture.value = '';
    if (imagePreview) { imagePreview.style.display = 'none'; imagePreview.src = ''; }
    if (avatarPreview) avatarPreview.style.display = 'flex';
}

function clearForm() {
    if (confirm('Are you sure you want to clear all form data?')) {
        document.getElementById('registrationForm').reset();
        removeImage();
        const allInputs = document.querySelectorAll('input, select, textarea');
        allInputs.forEach(input => {
            input.style.borderColor = 'var(--border)';
            const errorElement = document.getElementById(input.id + 'Error');
            if (errorElement) errorElement.textContent = '';
        });
    }
}

function togglePassword() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const icon = document.getElementById('toggleIcon');

    if (password) {
        const isHidden = password.type === 'password';
        password.type = isHidden ? 'text' : 'password';
        if (confirmPassword) confirmPassword.type = isHidden ? 'text' : 'password';
        if (icon) icon.classList.toggle('fa-eye', isHidden);
        if (icon) icon.classList.toggle('fa-eye-slash', !isHidden);
    }
}
// Add these missing functions to register.js

function showSubmissionOverlay(message) {
    let overlay = document.getElementById('submissionOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'submissionOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-size: 18px;
            flex-direction: column;
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 20px;"></i>
            <div>${message}</div>
        </div>
    `;
    overlay.style.display = 'flex';
}

function hideSubmissionOverlay() {
    const overlay = document.getElementById('submissionOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showSuccessOverlay(message) {
    let overlay = document.getElementById('successOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'successOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-size: 20px;
            flex-direction: column;
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div style="text-align: center; background: var(--panel); padding: 40px; border-radius: 16px; color: var(--text); max-width: 400px;">
            <i class="fas fa-check-circle" style="font-size: 64px; color: var(--success); margin-bottom: 20px;"></i>
            <div style="font-weight: bold; margin-bottom: 10px;">Success!</div>
            <div style="color: var(--muted); line-height: 1.5;">${message}</div>
        </div>
    `;
    overlay.style.display = 'flex';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
    }, 3000);
}

function validateBirthdate(input) {
    const value = input.value;
    if (!value) return;
    
    const birthdate = new Date(value);
    const year = birthdate.getFullYear();
    const errorSpan = document.getElementById('birthdateError');
    
    if (year < 1995 || year > 2008) {
        errorSpan.textContent = 'Birth year must be between 1995-2008';
        input.style.borderColor = 'var(--danger)';
        return false;
    } else {
        errorSpan.textContent = '';
        input.style.borderColor = 'var(--success)';
        return true;
    }
}

// Make functions globally available
window.showNotification = showNotification;
window.validateBirthdate = validateBirthdate;
window.formatCNIC = formatCNIC;
window.formatPhone = formatPhone;
window.removeImage = removeImage;
window.clearForm = clearForm;
window.togglePassword = togglePassword;
window.validateEmail = validateEmail;

function showNotification(message, type = 'info') {
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(notification);
    setTimeout(() => { if (notification.parentElement) notification.remove(); }, 5000);
}