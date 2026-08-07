// student_dashboard_profile.js
// Profile Management Module

// ============================================
// PROFILE IMAGE OVERLAY SYSTEM
// ============================================

function initializeProfileOverlay() {
    // Create profile image overlay HTML
    const profileOverlayHTML = `
    <div class="profile-image-overlay" id="profileImageOverlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        padding: 20px;
    ">
        <div style="position: relative; max-width: 90vw; max-height: 90vh;">
            <button id="closeProfileOverlay" style="
                position: absolute;
                top: -40px;
                right: 0;
                background: #DC2626;
                border: none;
                color: white;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
            ">
                <i class="fas fa-times"></i>
            </button>
            <img id="profileOverlayImage" src="" alt="Profile Image" style="
                max-width: 100%;
                max-height: 80vh;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            ">
        </div>
    </div>
    `;

    // Inject overlay into DOM
    document.body.insertAdjacentHTML('beforeend', profileOverlayHTML);

    // Get overlay elements
    const profileOverlay = document.getElementById('profileImageOverlay');
    const profileOverlayImage = document.getElementById('profileOverlayImage');
    const closeProfileOverlay = document.getElementById('closeProfileOverlay');

    // Function to open profile image overlay
    function openProfileOverlay(imageSrc) {
        console.log('🖼️ Opening profile overlay with image:', imageSrc);
        profileOverlayImage.src = imageSrc;
        profileOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Function to close profile image overlay
    function closeProfileOverlayFunc() {
        profileOverlay.style.display = 'none';
        document.body.style.overflow = '';
        profileOverlayImage.src = '';
    }

    // Event listeners for profile overlay
    closeProfileOverlay.addEventListener('click', closeProfileOverlayFunc);

    // Close when clicking on overlay background
    profileOverlay.addEventListener('click', function (e) {
        if (e.target === profileOverlay) {
            closeProfileOverlayFunc();
        }
    });

    // Close with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && profileOverlay.style.display === 'flex') {
            closeProfileOverlayFunc();
        }
    });

    // Global function to open profile picture
    window.openActualProfilePicture = async function () {
        try {
            console.log('📸 Opening actual profile picture...');

            // Show loading state
            profileOverlayImage.src = '';
            profileOverlay.style.display = 'flex';
            profileOverlayImage.alt = 'Loading...';

            // Get the student's actual profile data
            const studentData = await getStudentProfileData();
            console.log('📊 Student data:', studentData);

            const actualProfilePicture = studentData?.profile_picture ?
                '/static/' + studentData.profile_picture :
                '/static/img/default-avatar.jpg';

            console.log('🖼️ Profile picture path:', actualProfilePicture);

            // Open overlay with actual picture
            openProfileOverlay(actualProfilePicture);

        } catch (error) {
            console.error('❌ Error loading profile picture:', error);
            // Fallback to default image
            openProfileOverlay('/static/img/default-avatar.jpg');
        }
    };
}

// ============================================
// TOPBAR AVATAR CLICKABLE
// ============================================

function initializeTopbarAvatar() {
    console.log('👤 Initializing topbar avatar click functionality...');

    // Wait for DOM to be fully loaded
    setTimeout(() => {
        const topbarAvatar = document.querySelector('.avatar img');
        if (topbarAvatar) {
            console.log('✅ Found topbar avatar, making it clickable...');

            // Make the avatar image clickable
            topbarAvatar.style.cursor = 'pointer';
            topbarAvatar.title = 'Click to view profile picture';

            // Add click event listener to topbar avatar
            topbarAvatar.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent triggering the avatar menu
                console.log('🖱️ Topbar avatar clicked!');
                openActualProfilePicture();
            });

        } else {
            console.log('❌ Topbar avatar not found, retrying...');
            // Retry after a short delay
            setTimeout(initializeTopbarAvatar, 500);
        }
    }, 100);
}

// ============================================
// PROFILE PAGE FUNCTIONS
// ============================================

async function loadStudentProfileData() {
    try {
        // Show loading state
        const profilePage = document.getElementById('profile');
        if (profilePage) {
            profilePage.innerHTML = `
                <div class="profile-loading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading your profile information...</p>
                    </div>
                </div>
            `;
        }

        // Simulate API delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        const studentData = await getStudentProfileData();

        if (!studentData || studentData.error) {
            throw new Error(studentData?.error || 'Could not load profile data');
        }

        // Update profile page with actual data
        renderStudentProfile(studentData);

    } catch (error) {
        console.error('Error loading profile data:', error);
        showProfileError(error.message);
    }
}

function renderStudentProfile(studentData) {
    const profilePage = document.getElementById('profile');
    if (!profilePage) return;

    const profilePicture = studentData.profile_picture ?
        '/static/' + studentData.profile_picture :
        '/static/img/default-avatar.jpg';

    // Format dates
    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Get academic status
    const getAcademicStatus = () => {
        if (studentData.status === 'approved') return 'Currently Enrolled';
        return 'Registered - Pending Approval';
    };

    // Get semester info
    const getCurrentSemester = () => {
        const batchYear = studentData.batch_year;
        if (!batchYear) return 'Not specified';

        const currentYear = new Date().getFullYear();
        const semester = ((currentYear - batchYear) * 2) + 1;
        return semester <= 8 ? `Semester ${semester}` : 'Final Year';
    };

    // Get accommodation status
    const getAccommodationStatus = () => {
        if (studentData.room_number && studentData.room_number !== 'Not Allotted') {
            return `Room ${studentData.room_number}, Bed ${studentData.bed_number}`;
        }
        return 'Not Allotted';
    };

    profilePage.innerHTML = `
        <div class="profile-container">
            <div class="profile-header-main">
                <div class="profile-avatar-section" onclick="openActualProfilePicture()">
                    <img src="${profilePicture}" alt="Profile" class="profile-avatar" id="profileAvatar">
                    <div class="avatar-overlay">
                        <i class="fas fa-camera"></i>
                        <span>View Photo</span>
                    </div>
                </div>
                <div class="profile-basic-info">
                    <h1>${escapeHtml(studentData.name || 'Not Available')}</h1>
                    <p class="student-id">Student ID: ${escapeHtml(studentData.roll_number || 'Pending')}</p>
                    <div class="profile-status">
                        <span class="status-badge status-approved">
                            <i class="fas fa-check-circle"></i>
                            ${getAcademicStatus()}
                        </span>
                        <span class="status-badge status-info">
                            <i class="fas fa-user-graduate"></i>
                            ${getCurrentSemester()}
                        </span>
                        <span class="status-badge ${studentData.room_number !== 'Not Allotted' ? 'status-approved' : 'status-pending'}">
                            <i class="fas fa-bed"></i>
                            ${getAccommodationStatus()}
                        </span>
                    </div>
                    <div class="profile-contact">
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <span>${escapeHtml(studentData.email || 'Not provided')}</span>
                        </div>
                        <div class="contact-item">
                            <i class="fas fa-phone"></i>
                            <span>${escapeHtml(studentData.phone || 'Not provided')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-details-grid">
                <div class="profile-detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-user-circle"></i>
                        <h3>Personal Information</h3>
                    </div>
                    <div class="detail-card-content">
                        <div class="detail-item">
                            <label>Full Name</label>
                            <span>${escapeHtml(studentData.name || 'Not Available')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Father's Name</label>
                            <span>${escapeHtml(studentData.father_name || 'Not provided')}</span>
                        </div>
                        <div class="detail-item">
                            <label>CNIC Number</label>
                            <span>${escapeHtml(studentData.cnic || 'Not provided')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Date of Birth</label>
                            <span>${formatDate(studentData.birthdate)}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-graduation-cap"></i>
                        <h3>Academic Information</h3>
                    </div>
                    <div class="detail-card-content">
                        <div class="detail-item">
                            <label>Department</label>
                            <span>${escapeHtml(studentData.department || 'Not assigned')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Batch Year</label>
                            <span>${studentData.batch_year || 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Roll Number</label>
                            <span class="roll-number">${escapeHtml(studentData.roll_number || 'Pending')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Current Status</label>
                            <span class="status-badge status-approved">${getAcademicStatus()}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-bed"></i>
                        <h3>Accommodation Details</h3>
                    </div>
                    <div class="detail-card-content">
                        <div class="detail-item">
                            <label>Room Number</label>
                            <span class="room-number">${studentData.room_number || 'Not Allotted'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Bed Number</label>
                            <span>${studentData.bed_number || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Room Type</label>
                            <span>${studentData.room_type || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Floor</label>
                            <span>${studentData.floor || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Allotment Date</label>
                            <span>${formatDate(studentData.allotment_date)}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-address-book"></i>
                        <h3>Contact Details</h3>
                    </div>
                    <div class="detail-card-content">
                        <div class="detail-item">
                            <label>Email Address</label>
                            <span>${escapeHtml(studentData.email || 'Not provided')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Phone Number</label>
                            <span>${escapeHtml(studentData.phone || 'Not provided')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Emergency Contact</label>
                            <span>${escapeHtml(studentData.emergency_contact || 'Not provided')}</span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Residential Address</label>
                            <span class="address-text">${escapeHtml(studentData.address || 'Not provided')}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-info-circle"></i>
                        <h3>Additional Information</h3>
                    </div>
                    <div class="detail-card-content">
                        <div class="detail-item full-width">
                            <label>Medical Information</label>
                            <span class="medical-info">${escapeHtml(studentData.medical_info || 'No medical conditions reported')}</span>
                        </div>
                        <div class="detail-item">
                            <label>Registration Date</label>
                            <span>${formatDate(studentData.request_date)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Last Updated</label>
                            <span>${new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-actions">
                
                <button class="btn-primary" onclick="downloadIDCardAsPDF()" style="background: #2F3A8F;">
                    <i class="fas fa-id-card"></i> Download ID Card
                </button>
            </div>
        </div>
    `;

    // Store student data globally for download functionality
    window.currentStudentData = studentData;
}

function showProfileError(message) {
    const profilePage = document.getElementById('profile');
    if (!profilePage) return;

    profilePage.innerHTML = `
        <div class="profile-error-state">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Profile Unavailable</h3>
            <p>We're unable to load your profile information at the moment.</p>
            <div class="error-details">
                <p><strong>Error:</strong> ${message}</p>
            </div>
            <div class="error-actions">
                <button class="btn-retry" onclick="loadStudentProfileData()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
                <button class="btn-outline" onclick="showBasicProfile()">
                    <i class="fas fa-eye"></i> Show Basic Info
                </button>
            </div>
        </div>
    `;
}

function showBasicProfile() {
    const profilePage = document.getElementById('profile');
    if (!profilePage) return;

    profilePage.innerHTML = `
        <div class="profile-container">
            <div class="profile-header-main">
                <div class="profile-avatar-section">
                    <img src="/static/img/default-avatar.jpg" alt="Profile" class="profile-avatar">
                </div>
                <div class="profile-basic-info">
                    <h1>${document.querySelector('.avatar img').alt || 'Student'}</h1>
                    <p class="student-id">Student ID: Retrieval Failed</p>
                    <div class="profile-status">
                        <span class="status-badge status-pending">
                            <i class="fas fa-exclamation-triangle"></i>
                            Limited Information Available
                        </span>
                    </div>
                </div>
            </div>
            <div class="profile-message">
                <p>Please contact the administration if this issue persists.</p>
            </div>
        </div>
    `;
}

// ============================================
// ID CARD DOWNLOAD FUNCTION
// ============================================

async function downloadIDCardAsPDF() {
    try {
        console.log('🪪 Generating ID Card...');
        
        // Show loading notification
        showNotification('Generating your ID card...', 'info');

        // Get student data
        const studentData = window.currentStudentData;
        if (!studentData) {
            throw new Error('No profile data available. Please refresh your profile first.');
        }

        // Get profile picture URL
        const profilePictureUrl = studentData.profile_picture ? 
            '/static/' + studentData.profile_picture : 
            '/static/img/default-avatar.jpg';

        // Generate unique ID number
        const idNumber = `${studentData.roll_number || studentData.id || 'STU'}-${studentData.batch_year || '2024'}`;
        
        // Prepare data for the card
        const cardData = {
            name: studentData.name || 'Student Name',
            fatherName: studentData.father_name || 'Not Provided',
            cnic: studentData.cnic || 'Not Provided',
            idNumber: idNumber,
            medicalInfo: studentData.medical_info || 'No medical conditions reported',
            address: studentData.address || 'Not Provided',
            phone: studentData.phone || 'Not Provided',
            emergencyContact: studentData.emergency_contact || studentData.phone || 'Not Provided',
            rollNumber: studentData.roll_number || 'Pending',
            department: studentData.department || 'Not Assigned',
            batchYear: studentData.batch_year || 'Not Specified',
            roomNumber: studentData.room_number || 'Not Allotted',
            bedNumber: studentData.bed_number || 'N/A',
            profilePicture: profilePictureUrl
        };

        // Create the ID card HTML
        const idCardHTML = generateIDCardHTML(cardData);
        
        // Create a print window
        const printWindow = window.open('', '_blank');
        
        // Generate filename
        const studentName = studentData.name ? studentData.name.replace(/\s+/g, '_') : 'Student';
        const fileName = `${studentName}_ID_Card.pdf`;

        // Write the HTML to the print window
        printWindow.document.write(idCardHTML);
        printWindow.document.close();

        // Wait for images to load then print
        printWindow.onload = function() {
            setTimeout(function() {
                printWindow.print();
                showNotification('ID Card generated successfully!', 'success');
            }, 1000);
        };

    } catch (error) {
        console.error('Error generating ID Card:', error);
        showNotification(error.message, 'error');
    }
}

function generateIDCardHTML(cardData) {
    // Create QR code data URL with student ID
    const qrData = `Student ID: ${cardData.idNumber}\nName: ${cardData.name}\nRoll No: ${cardData.rollNumber}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    
    // Create barcode data URL - increased size for better visibility
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(cardData.idNumber)}&code=Code128&dpi=150&translate-esc=on`;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student ID Card - ${cardData.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                /* FORCE COLORS FOR PDF GENERATION */
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            body {
                font-family: 'Montserrat', sans-serif;
                background-color: #e2e8f0;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 40px;
                min-height: 100vh;
                padding: 40px;
                margin: 0;
            }

            @media print {
                body {
                    background-color: white;
                    padding: 20px;
                    margin: 0;
                }
                .id-card {
                    box-shadow: none;
                    page-break-after: avoid;
                    page-break-inside: avoid;
                }
                @page {
                    size: A4;
                    margin: 0.5cm;
                }
            }

            /* Base Card Styling */
            .id-card {
                width: 300px;
                height: 470px;
                background-color: #1e293b;
                border-radius: 12px;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
            }

            /* FRONT CARD BACKGROUND - Project theme colors */
            .card-front {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 470'%3E%3Cpath d='M0,0 H300 V90 Q150,200 0,150 Z' fill='%23ffffff'/%3E%3Cpath d='M0,150 Q150,200 300,90 V120 Q150,240 0,180 Z' fill='%232F3A8F'/%3E%3C/svg%3E");
                background-size: cover;
                background-color: #1e293b;
            }

            /* BACK CARD BACKGROUND - Project theme colors */
            .card-back {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 470'%3E%3Cpath d='M0,0 H300 V150 Q150,240 0,180 Z' fill='%23ffffff'/%3E%3Cpath d='M0,180 Q150,240 300,150 V180 Q150,270 0,210 Z' fill='%232F3A8F'/%3E%3C/svg%3E");
                background-size: cover;
                background-color: #1e293b;
            }

            .absolute {
                position: absolute;
                width: 100%;
            }

            /* FRONT ELEMENTS */
            .header-front {
                top: 15px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 0 15px;
            }

            .logo-img {
                width: 38px;
                height: 38px;
                object-fit: contain;
            }

            .hostel-title {
                font-size: 14px;
                font-weight: 800;
                color: #111827;
                letter-spacing: 0.5px;
                margin: 0;
            }

            .hostel-sub {
                font-size: 9px;
                font-weight: 700;
                color: #DC2626;
                margin: 2px 0 0 0;
            }

            .photo-container {
                top: 90px;
                left: 50%;
                transform: translateX(-50%);
                width: 105px;
                height: 105px;
                border-radius: 50%;
                border: 3px solid #DC2626;
                background-color: #ffffff;
                overflow: hidden;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }

            .student-photo {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .name-container {
                top: 215px;
                text-align: center;
                width: 100%;
                padding: 0 15px;
            }

            .student-name {
                font-size: 20px;
                font-weight: 800;
                color: #ffffff;
                margin: 0;
                text-transform: uppercase;
                word-wrap: break-word;
                line-height: 1.3;
            }

            .roll-number {
                font-size: 12px;
                color: #DC2626;
                margin-top: 6px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .qr-container {
                top: 285px;
                left: 50%;
                transform: translateX(-50%);
                width: 65px;
                height: 65px;
                background: #ffffff;
                border: 2px solid #DC2626;
                padding: 4px;
                border-radius: 4px;
            }

            .qr-code {
                width: 100%;
                height: 100%;
            }

            .qr-label {
                top: 365px;
                text-align: center;
                font-size: 9px;
                font-weight: 600;
                color: #94a3b8;
                letter-spacing: 1px;
            }

            /* BACK ELEMENTS */
            .logo-back {
                top: 15px;
                text-align: center;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .logo-back img {
                width: 45px;
                height: 45px;
                object-fit: contain;
            }

            .header-back {
                top: 65px;
                text-align: center;
            }

            .details-grid {
                top: 235px;
                padding: 0 18px;
                display: grid;
                grid-template-columns: 95px 1fr;
                gap: 8px;
                font-size: 9.5px;
                line-height: 1.4;
                box-sizing: border-box;
            }

            .label {
                color: #DC2626;
                font-weight: 700;
            }

            .value {
                color: #f8fafc;
                font-weight: 400;
                word-wrap: break-word;
            }

            .barcode-container {
                bottom: 35px;
                left: 50%;
                transform: translateX(-50%);
                width: 200px;
                height: 45px;
                background: transparent;
                padding: 6px 10px;
                border-radius: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }

            .barcode {
                margin-left: 20%;
                width: 60%;
                height: 100%;
                
            }

            .footer-line {
                bottom: 0;
                background-color: #DC2626;
                color: #ffffff;
                font-size: 8.5px;
                font-weight: 700;
                text-align: center;
                padding: 10px 0;
                letter-spacing: 0.5px;
            }
        </style>
    </head>
    <body>
        <div class="id-card card-front">
            <div class="absolute header-front">
                <img src="/static/img/logo.png" alt="BBS UTECH Logo" class="logo-img">
                <div>
                    <h2 class="hostel-title">BBS UTECH HOSTEL</h2>
                    <p class="hostel-sub">Khairpur Mir's</p>
                </div>
            </div>

            <div class="absolute photo-container">
                <img class="student-photo" src="${cardData.profilePicture}" alt="Student Photo" onerror="this.src='/static/img/default-avatar.jpg'">
            </div>

            <div class="absolute name-container">
                <h1 class="student-name">${escapeHtml(cardData.name)}</h1>
                <div class="roll-number">Roll No: ${escapeHtml(cardData.rollNumber)}</div>
            </div>

            <div class="absolute qr-container">
                <img class="qr-code" src="${qrCodeUrl}" alt="QR Code">
            </div>

            <div class="absolute qr-label">
                STUDENT QR
            </div>
            <div class="absolute footer-line">
                IF FOUND, PLEASE CONTACT: ${escapeHtml(cardData.emergencyContact)}
            </div>
        </div>

        <div class="id-card card-back">
            <div class="absolute logo-back">
                <img src="/static/img/logo.png" alt="BBS UTECH Logo">
            </div>

            <div class="absolute header-back">
                <h2 class="hostel-title">BBS UTECH HOSTEL</h2>
                <p class="hostel-sub">Khairpur Mir's</p>
            </div>

            <div class="absolute details-grid">
                <div class="label">Father's Name:</div>
                <div class="value">${escapeHtml(cardData.fatherName)}</div>
                
                <div class="label">CNIC:</div>
                <div class="value">${escapeHtml(cardData.cnic)}</div>
                
                <div class="label">ID No:</div>
                <div class="value">${escapeHtml(cardData.idNumber)}</div>
                
                <div class="label">Room/Bed:</div>
                <div class="value">${escapeHtml(cardData.roomNumber)} / ${escapeHtml(cardData.bedNumber)}</div>
                
                <div class="label">Department:</div>
                <div class="value">${escapeHtml(cardData.department)}</div>
                
                <div class="label">Medical:</div>
                <div class="value">${escapeHtml(cardData.medicalInfo.substring(0, 65))}${cardData.medicalInfo.length > 65 ? '...' : ''}</div>
                
                <div class="label">Address:</div>
                <div class="value">${escapeHtml(cardData.address.substring(0, 75))}${cardData.address.length > 75 ? '...' : ''}</div>
            </div>

            <div class="absolute barcode-container">
                <img class="barcode" src="${barcodeUrl}" alt="Barcode">
            </div>

            <div class="absolute footer-line">
                IF FOUND, PLEASE CONTACT: ${escapeHtml(cardData.emergencyContact)}
            </div>
        </div>
    </body>
    </html>`;
}

function downloadProfileAsPDF() {
    try {
        console.log('📄 Generating and downloading PDF profile...');

        const studentData = window.currentStudentData;
        if (!studentData) {
            alert('No profile data available to download. Please refresh the profile first.');
            return;
        }

        // Create a printable version of the profile
        const printWindow = window.open('', '_blank');
        const profileHTML = generatePrintableProfileHTML(studentData);

        // Generate filename with student name
        const studentName = studentData.name ? studentData.name.replace(/\s+/g, '_') : 'Student_Profile';
        const fileName = `${studentName}_Profile.pdf`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Student Profile - ${studentData.name}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 40px; 
                        color: #333;
                        line-height: 1.6;
                        /* FORCE COLORS FOR PDF GENERATION */
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    .profile-header { 
                        text-align: center; 
                        margin-bottom: 30px;
                        border-bottom: 2px solid #2F3A8F;
                        padding-bottom: 20px;
                    }
                    .profile-header img.pdf-logo {
                        width: 80px;
                        height: auto;
                        margin-bottom: 15px;
                        object-fit: contain;
                    }
                    .profile-header h1 { 
                        color: #2F3A8F; 
                        margin: 0 0 10px 0;
                        font-size: 28px;
                    }
                    .student-id { 
                        color: #666; 
                        font-size: 16px;
                        margin: 0 0 20px 0;
                    }
                    .profile-grid { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 20px; 
                        margin-bottom: 30px;
                    }
                    .profile-section { 
                        background: #f8f9fa; 
                        padding: 20px; 
                        border-radius: 8px;
                        border-left: 4px solid #2F3A8F;
                    }
                    .profile-section h3 { 
                        color: #2F3A8F; 
                        margin: 0 0 15px 0;
                        font-size: 18px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 8px;
                    }
                    .detail-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 8px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #eee;
                    }
                    .detail-row:last-child { 
                        border-bottom: none; 
                    }
                    .detail-label { 
                        font-weight: bold; 
                        color: #555;
                        min-width: 150px;
                    }
                    .detail-value { 
                        color: #333;
                        text-align: right;
                        flex: 1;
                    }
                    .full-width { 
                        grid-column: 1 / -1; 
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 40px;
                        color: #666;
                        font-size: 12px;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }
                    @media print {
                        body { margin: 20px; }
                        .profile-section { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                ${profileHTML}
                <div class="footer">
                    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>BBS UTECH Student Management System</p>
                </div>
                
                <script>
                    // Auto-print and close after printing
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            // Auto-close after printing (optional)
                            setTimeout(function() {
                                window.close();
                            }, 1000);
                        }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);

        printWindow.document.close();

        // Show success message
        showNotification('Profile PDF is being generated...', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('Error generating PDF. Please try again.', 'error');
    }
}

function generatePrintableProfileHTML(studentData) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    return `
        <div class="profile-header">
            <img src="/static/img/logo.png" alt="BBS UTECH Logo" class="pdf-logo">
            <h1>${escapeHtml(studentData.name || 'Not Available')}</h1>
            <p class="student-id">Student ID: ${escapeHtml(studentData.roll_number || 'Pending')}</p>
            <p><strong>Email:</strong> ${escapeHtml(studentData.email || 'Not provided')} | 
               <strong>Phone:</strong> ${escapeHtml(studentData.phone || 'Not provided')}</p>
        </div>

        <div class="profile-grid">
            <div class="profile-section">
                <h3>Personal Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Full Name:</span>
                    <span class="detail-value">${escapeHtml(studentData.name || 'Not Available')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Father's Name:</span>
                    <span class="detail-value">${escapeHtml(studentData.father_name || 'Not provided')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">CNIC Number:</span>
                    <span class="detail-value">${escapeHtml(studentData.cnic || 'Not provided')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date of Birth:</span>
                    <span class="detail-value">${formatDate(studentData.birthdate)}</span>
                </div>
            </div>

            <div class="profile-section">
                <h3>Academic Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Department:</span>
                    <span class="detail-value">${escapeHtml(studentData.department || 'Not assigned')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Batch Year:</span>
                    <span class="detail-value">${studentData.batch_year || 'Not specified'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Roll Number:</span>
                    <span class="detail-value">${escapeHtml(studentData.roll_number || 'Pending')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${studentData.status === 'approved' ? 'Approved' : 'Pending Approval'}</span>
                </div>
            </div>

            <div class="profile-section full-width">
                <h3>Contact Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Email Address:</span>
                    <span class="detail-value">${escapeHtml(studentData.email || 'Not provided')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone Number:</span>
                    <span class="detail-value">${escapeHtml(studentData.phone || 'Not provided')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Emergency Contact:</span>
                    <span class="detail-value">${escapeHtml(studentData.emergency_contact || 'Not provided')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${escapeHtml(studentData.address || 'Not provided')}</span>
                </div>
            </div>

            <div class="profile-section full-width">
                <h3>Additional Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Medical Information:</span>
                    <span class="detail-value">${escapeHtml(studentData.medical_info || 'No medical conditions reported')}</span>
                </div>
            </div>
        </div>
    `;
}