// student_dashboard_utils.js
// Shared utility functions

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return 'Not Available';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification system
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

// Data fetching functions
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