// student_dashboard_main.js
// Main entry point for Student Dashboard

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Student Dashboard...');
    
    // Initialize all systems
    initializePageRouting();
    initializeSidebar();
    initializeTheme();
    initializeProfileOverlay();
    initializeTopbarAvatar();
    fixQuickActionsDuplicates();
    updateAvatarWithActualPicture();

    // Load data for current page
    loadCurrentPageData();

    // Initialize Announcement Card
    if (typeof AnnouncementCard !== 'undefined') {
        window.announcementCard = new AnnouncementCard();
    }
});

// ============================================
// PAGE ROUTING SYSTEM
// ============================================

function initializePageRouting() {
    const links = document.querySelectorAll('.menu-link');
    const pages = document.querySelectorAll('.page');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all links
            links.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            link.classList.add('active');

            const target = link.dataset.target;

            // Hide all pages
            pages.forEach(page => page.classList.remove('visible'));
            // Show target page
            const targetPage = document.getElementById(target);
            if (targetPage) {
                targetPage.classList.add('visible');

                // Load data for the target page
                loadPageData(target);
            }

            // Close sidebar on mobile
            document.querySelector('.sidebar')?.classList.remove('open');
        });
    });
}

function loadCurrentPageData() {
    const visiblePage = document.querySelector('.page.visible');
    if (visiblePage) {
        loadPageData(visiblePage.id);
    }
}

function loadPageData(pageId) {
    switch (pageId) {
        case 'profile':
            if (typeof loadStudentProfileData === 'function') {
                loadStudentProfileData();
            }
            break;
        case 'complaints':
            if (window.complaintManager && typeof window.complaintManager.loadComplaints === 'function') {
                window.complaintManager.loadComplaints();
            }
            break;
        case 'fees':
            if (window.studentFeeManager && typeof window.studentFeeManager.loadFees === 'function') {
                window.studentFeeManager.loadFees();
            }
            break;
    }
}

// ============================================
// SIDEBAR CONTROLS
// ============================================

function initializeSidebar() {
    // Open sidebar
    document.getElementById('openSidebar')?.addEventListener('click', () => {
        document.querySelector('.sidebar')?.classList.add('open');
    });

    // Close sidebar
    document.getElementById('collapseSidebar')?.addEventListener('click', () => {
        document.querySelector('.sidebar')?.classList.remove('open');
    });
}

// ============================================
// THEME MANAGEMENT
// ============================================

function initializeTheme() {
    // Get student ID from session or use default
    const studentId = window.studentId || 'student-default';
    const themeKey = `hms-theme-${studentId}`;
    const savedTheme = localStorage.getItem(themeKey);

    // Apply saved theme
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }

    // Theme toggle
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem(themeKey, isDark ? 'dark' : 'light');

        // Update icon
        const icon = document.querySelector('#darkModeToggle i');
        if (icon) {
            icon.className = isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
        }
    });

    // Set initial icon
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
        const isDark = document.documentElement.classList.contains('dark');
        icon.className = isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
    }
}

// Set student ID from session (you'll need to set this from your template)
window.studentId = 'student-user';

// ============================================
// QUICK ACTIONS HANDLER
// ============================================

function fixQuickActionsDuplicates() {
    // Remove any existing onclick attributes from quick action buttons
    const quickActionButtons = document.querySelectorAll('.quick-action-btn');
    quickActionButtons.forEach(button => {
        button.removeAttribute('onclick');
    });

    // Use event delegation with proper prevention
    document.addEventListener('click', function (e) {
        const quickActionBtn = e.target.closest('.quick-action-btn');
        if (quickActionBtn && !e.handledQuickAction) {
            e.handledQuickAction = true;
            e.preventDefault();
            e.stopPropagation();

            const actionText = quickActionBtn.querySelector('span').textContent;
            handleQuickAction(actionText);
        }
    }, true);
}

function handleQuickAction(actionText) {
    // Prevent multiple rapid executions
    if (window.lastAction === actionText && Date.now() - (window.lastActionTime || 0) < 1000) {
        return;
    }

    window.lastAction = actionText;
    window.lastActionTime = Date.now();

    console.log('Quick action:', actionText);

    const actions = {
        'Update Profile': () => {
            const profileLink = document.querySelector('[data-target="profile"]');
            if (profileLink) {
                profileLink.click();
            }
        },
        'Download ID Card': () => {
            showNotification('ID card download feature coming soon!', 'info');
        },
        'Submit Complaint': () => {
            showNotification('Complaint submission system coming soon!', 'info');
        },
        'Fee Details': () => {
            showNotification('Fee management coming soon!', 'info');
        },
        'Room Change': () => {
            showNotification('Room change requests coming soon!', 'info');
        },
        'Leave Application': () => {
            showNotification('Leave application system coming soon!', 'info');
        }
    };

    if (actions[actionText]) {
        actions[actionText]();
    } else {
        showNotification(`${actionText} feature coming soon!`, 'info');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    if (!text) return 'Not Available';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add to notification container
    const container = document.getElementById('notificationContainer') || createNotificationContainer();
    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

async function getStudentProfileData() {
    try {
        console.log('🔍 Fetching student profile data...');
        const response = await fetch('/get_student_profile');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const studentData = await response.json();
        console.log('✅ Student profile data received:', studentData);
        return studentData;

    } catch (error) {
        console.error('❌ Error fetching student profile:', error);
        return null;
    }
}

async function updateAvatarWithActualPicture() {
    try {
        const studentData = await getStudentProfileData();
        if (!studentData) return;

        const actualProfilePicture = studentData.profile_picture ?
            '/static/' + studentData.profile_picture :
            '/static/img/default-avatar.jpg';

        const avatarImg = document.querySelector('.avatar img');
        if (avatarImg) {
            avatarImg.src = actualProfilePicture;
            avatarImg.alt = studentData.name || 'Student';
            avatarImg.style.cursor = 'pointer';
            avatarImg.title = 'Click to view profile picture';
        }
    } catch (error) {
        console.error('Error updating avatar with actual picture:', error);
    }
}