// ============================================
// MAIN.JS - Core Initialization & Global Utilities
// ============================================

// Global notification history
let notificationHistory = [];
const NOTIFICATION_HISTORY_LIMIT = 10;
const NOTIFICATION_COOLDOWN = 2000;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Hostel Management System...');
    
    // Initialize mobile avatar click handler
    initMobileAvatar();
    
    // Clear any stored notification state
    localStorage.removeItem('lastNotificationMessage');
    sessionStorage.removeItem('pendingNotifications');
    
    // Initialize all managers
    initializeManagers();
    
    // Setup sidebar behavior
    initSidebar();
    
    // Setup theme
    initTheme();
    
    // Setup image overlay
    initImageOverlay();
    
    // Setup page routing
    initPageRouting();
    
    // Lazy load images
    lazyLoadImages();
    
    console.log('🎉 All systems initialized successfully');
});

// Initialize all managers
function initializeManagers() {
    try {
        // Order matters - some managers depend on others
        window.modalManager = new ModalManager();
        window.dashboardManager = new DashboardManager();
        window.studentManager = new StudentManager();
        window.roomManager = new RoomManager();
        window.printManager = new PrintManager();
        window.adminComplaintManager = new AdminComplaintManager();
        window.announcementManager = new AnnouncementManager();
        window.allotmentPrintManager = new AllotmentPrintManager();
        
        console.log('✅ All managers initialized');
    } catch (error) {
        console.error('❌ Error during manager initialization:', error);
    }
}

// Mobile avatar click handler
function initMobileAvatar() {
    const avatar = document.getElementById('avatarRoot');
    const avatarMenu = document.getElementById('avatarMenu');
    const avatarImage = document.getElementById('avatarImage');

    if (avatar && avatarMenu) {
        avatar.addEventListener('click', function (e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                e.stopPropagation();

                const isVisible = avatarMenu.classList.contains('show');

                if (isVisible) {
                    avatarMenu.classList.remove('show');
                    if (avatarImage) avatarImage.style.borderColor = 'var(--brand)';
                } else {
                    avatarMenu.classList.add('show');
                    if (avatarImage) avatarImage.style.borderColor = 'var(--brand-2)';

                    setTimeout(() => {
                        const closeMenu = function (clickE) {
                            if (!avatar.contains(clickE.target) && !avatarMenu.contains(clickE.target)) {
                                avatarMenu.classList.remove('show');
                                if (avatarImage) avatarImage.style.borderColor = 'var(--brand)';
                                document.removeEventListener('click', closeMenu);
                            }
                        };
                        document.addEventListener('click', closeMenu);
                    }, 10);
                }
            }
        });

        avatarMenu.addEventListener('click', function (e) {
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    avatarMenu.classList.remove('show');
                    if (avatarImage) avatarImage.style.borderColor = 'var(--brand)';
                }, 300);
            }
        });
    }
}

// Sidebar behavior
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('collapseSidebar');
    const openSidebar = document.getElementById('openSidebar');

    openSidebar?.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !openSidebar.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

// Theme initialization
function initTheme() {
    const themeKey = 'hms-admin-theme';
    const savedTheme = localStorage.getItem(themeKey);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }

    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem(themeKey, document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
}

// Page routing
function initPageRouting() {
    const links = document.querySelectorAll('.menu-link');
    const pages = document.querySelectorAll('.page');

    links.forEach(l => {
        l.addEventListener('click', (e) => {
            e.preventDefault();

            links.forEach(x => x.classList.remove('active'));
            l.classList.add('active');

            const target = l.dataset.target;

            pages.forEach(p => p.classList.remove('visible'));
            const targetPage = document.getElementById(target);
            if (targetPage) {
                targetPage.classList.add('visible');
            }

            document.querySelector('.sidebar').classList.remove('open');
            loadPageData(target);
        });
    });
}

// Load page data based on page ID
function loadPageData(pageId) {
    console.log(`📄 Loading page data for: ${pageId}`);

    switch (pageId) {
        case 'student-id':
            window.studentManager?.loadData();
            break;
        case 'rooms-management':
            window.roomManager?.updateManagementView();
            break;
        case 'home':
            window.dashboardManager?.loadStats();
            break;
        case 'complaints':
            window.adminComplaintManager?.loadComplaints();
            break;
        case 'announcements':
            window.announcementManager?.loadAnnouncements();
            break;
    }
}

// Image overlay initialization
function initImageOverlay() {
    const overlayHTML = `
    <div class="simple-image-overlay" id="simpleImageOverlay" style="
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
            <button id="closeImageOverlay" style="
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
            <img id="overlayImage" src="" alt="Enlarged view" style="
                max-width: 100%;
                max-height: 80vh;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            ">
        </div>
    </div>
    `;

    if (!document.getElementById('simpleImageOverlay')) {
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }

    const imageOverlay = document.getElementById('simpleImageOverlay');
    const overlayImage = document.getElementById('overlayImage');
    const closeButton = document.getElementById('closeImageOverlay');

    window.openImageOverlay = function(imageSrc) {
        overlayImage.src = imageSrc;
        imageOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeImageOverlay = function() {
        imageOverlay.style.display = 'none';
        document.body.style.overflow = '';
        overlayImage.src = '';
    };

    closeButton?.addEventListener('click', window.closeImageOverlay);

    imageOverlay?.addEventListener('click', function (e) {
        if (e.target === imageOverlay) {
            window.closeImageOverlay();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && imageOverlay.style.display === 'flex') {
            window.closeImageOverlay();
        }
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info', persistent = false) {
    const now = Date.now();

    const isDuplicate = notificationHistory.some(notif =>
        notif.message === message &&
        notif.type === type &&
        (now - notif.timestamp) < NOTIFICATION_COOLDOWN
    );

    if (isDuplicate && !persistent) {
        return;
    }

    notificationHistory.push({
        message,
        type,
        timestamp: now
    });

    if (notificationHistory.length > NOTIFICATION_HISTORY_LIMIT) {
        notificationHistory = notificationHistory.slice(-NOTIFICATION_HISTORY_LIMIT);
    }

    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('data-timestamp', now);

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span class="notification-message">${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notification);

    const duration = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function clearAllNotifications() {
    const container = document.getElementById('notificationContainer');
    if (container) {
        container.innerHTML = '';
    }
    notificationHistory = [];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatNumber(n) {
    return n.toLocaleString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(element) {
    if (element) {
        element.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading...</p>
            </div>
        `;
    }
}

function hideLoading(element, content = '') {
    if (element) {
        element.innerHTML = content;
    }
}

function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    images.forEach(img => imageObserver.observe(img));
}

// Make global functions available
window.showNotification = showNotification;
window.clearAllNotifications = clearAllNotifications;
window.formatNumber = formatNumber;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.debounce = debounce;
window.loadPageData = loadPageData;