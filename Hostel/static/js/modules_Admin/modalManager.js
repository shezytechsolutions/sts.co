// ============================================
// MODALMANAGER.JS - Modal Event Management
// ============================================

class ModalManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupModalEventListeners();
        this.setupGlobalModalEvents();
        this.setupDirectButtonListeners();
    }

    setupDirectButtonListeners() {
        console.log('🔧 Setting up direct button listeners...');

        // Student Modal Buttons
        this.setupDirectListener('modalClose', () => this.closeStudentModal());
        this.setupDirectListener('modalCloseBtn', () => this.closeStudentModal());
        this.setupDirectListener('modalApproveBtn', () => this.handleApproveRequest());
        this.setupDirectListener('modalRejectBtn', () => this.handleRejectRequest());

        // Edit Student Modal Buttons
        this.setupDirectListener('editModalClose', () => this.closeEditStudentModal());
        this.setupDirectListener('editModalCloseBtn', () => this.closeEditStudentModal());
        this.setupDirectListener('saveStudentBtn', () => this.handleSaveStudent());

        // Room Modal Buttons
        this.setupDirectListener('roomModalClose', () => this.closeRoomModal());
        this.setupDirectListener('roomModalCloseBtn', () => this.closeRoomModal());
        this.setupDirectListener('saveRoomBtn', () => this.handleSaveRoom());

        // Allotment Modal Buttons
        this.setupDirectListener('allotmentModalClose', () => this.closeAllotmentModal());
        this.setupDirectListener('allotmentModalCloseBtn', () => this.closeAllotmentModal());
        this.setupDirectListener('confirmAllotmentBtn', () => this.handleConfirmAllotment());

        // Admin Settings Modal Buttons
        this.setupDirectListener('settingsModalClose', () => this.closeAdminSettingsModal());
        this.setupDirectListener('settingsModalCloseBtn', () => this.closeAdminSettingsModal());
        this.setupDirectListener('saveAdminPasswordBtn', () => this.handleSaveAdminPassword());

        // Print Modal Buttons
        this.setupDirectListener('printModalClose', () => this.closePrintModal());
        this.setupDirectListener('printModalCloseBtn', () => this.closePrintModal());
        this.setupDirectListener('printExecuteBtn', () => this.handlePrintExecute());
    }

    setupDirectListener(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🎯 Direct click: ${elementId}`);
                handler();
            });
        }
    }

    setupModalEventListeners() {
        console.log('🔧 Setting up modal overlay listeners...');

        this.setupOverlayListener('studentModalOverlay', () => this.closeStudentModal());
        this.setupOverlayListener('editStudentModalOverlay', () => this.closeEditStudentModal());
        this.setupOverlayListener('roomModalOverlay', () => this.closeRoomModal());
        this.setupOverlayListener('allotmentModalOverlay', () => this.closeAllotmentModal());
        this.setupOverlayListener('adminSettingsModalOverlay', () => this.closeAdminSettingsModal());
        this.setupOverlayListener('printModalOverlay', () => this.closePrintModal());
    }

    setupOverlayListener(overlayId, closeHandler) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    console.log(`🎯 Overlay click: ${overlayId}`);
                    closeHandler();
                }
            });
        }
    }

    setupGlobalModalEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                console.log('⌨️ Escape key pressed - closing all modals');
                this.closeAllModals();
            }
        });

        document.querySelectorAll('.modal-container').forEach(container => {
            container.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    // Button Handlers
    handleApproveRequest() {
        console.log('✅ Approve button handler');
        const requestId = window.studentManager?.currentRequestId;
        if (requestId) {
            window.studentManager.approveIDRequest(requestId);
        } else {
            console.error('❌ No request ID found for approval');
        }
    }

    handleRejectRequest() {
        console.log('❌ Reject button handler');
        const requestId = window.studentManager?.currentRequestId;
        if (requestId) {
            window.studentManager.rejectIDRequest(requestId);
        } else {
            console.error('❌ No request ID found for rejection');
        }
    }

    handleSaveStudent() {
        console.log('💾 Save student button handler');
        if (window.studentManager) {
            window.studentManager.saveStudentChanges();
        } else {
            console.error('❌ StudentManager not available');
        }
    }

    handleSaveRoom() {
        console.log('💾 Save room button handler');
        if (window.roomManager) {
            window.roomManager.saveRoom();
        } else {
            console.error('❌ RoomManager not available');
        }
    }

    handleConfirmAllotment() {
        console.log('✅ Confirm allotment button handler');
        if (window.roomManager) {
            window.roomManager.confirmAllotment();
        } else {
            console.error('❌ RoomManager not available');
        }
    }

    handleSaveAdminPassword() {
        console.log('🔑 Save admin password handler');
        updateAdminPassword();
    }

    handlePrintExecute() {
        console.log('🖨️ Print execute handler');
        if (window.studentManager) {
            window.studentManager.executePrint();
        } else {
            console.error('❌ StudentManager not available');
        }
    }

    // Modal Close Methods
    closeStudentModal() {
        const modal = document.getElementById('studentModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Student modal closed');
        }
        if (window.studentManager) {
            window.studentManager.currentStudentId = null;
            window.studentManager.currentRequestId = null;
        }
    }

    closeEditStudentModal() {
        const modal = document.getElementById('editStudentModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Edit student modal closed');
        }
        if (window.studentManager) {
            window.studentManager.currentEditStudentId = null;
        }
    }

    closeRoomModal() {
        const modal = document.getElementById('roomModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Room modal closed');
        }
        if (window.roomManager) {
            window.roomManager.currentRoomId = null;
            window.roomManager.isEditing = false;
        }
    }

    closeAllotmentModal() {
        const modal = document.getElementById('allotmentModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Allotment modal closed');
        }
        if (window.roomManager) {
            window.roomManager.currentStudentId = null;
            window.roomManager.changeMode = false;
        }
    }

    closeAdminSettingsModal() {
        const modal = document.getElementById('adminSettingsModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Admin settings modal closed');
        }
    }

    closePrintModal() {
        const modal = document.getElementById('printModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Print modal closed');
        }
    }

    closeAllModals() {
        console.log('🔄 Closing all modals');
        this.closeStudentModal();
        this.closeEditStudentModal();
        this.closeRoomModal();
        this.closeAllotmentModal();
        this.closeAdminSettingsModal();
        this.closePrintModal();
    }
}

window.ModalManager = ModalManager;

// Admin Settings Functions
function openAdminSettings() {
    console.log('⚙️ Opening admin settings modal');

    if (window.modalManager) {
        window.modalManager.closeAllModals();
    }

    const modal = document.getElementById('adminSettingsModalOverlay');
    if (!modal) {
        console.error('❌ Admin settings modal not found');
        showNotification('Settings modal not found. Please refresh the page.', 'error');
        return;
    }

    setTimeout(() => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        const currentPassword = document.getElementById('currentPassword');
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');

        if (currentPassword) currentPassword.value = '';
        if (newPassword) newPassword.value = '';
        if (confirmPassword) confirmPassword.value = '';

        loadAdminInfo();

        setTimeout(() => {
            if (currentPassword) {
                currentPassword.focus();
            }
        }, 100);

    }, 10);
}

function loadAdminInfo() {
    try {
        const adminName = sessionStorage.getItem('adminName') || 'Admin User';
        const adminEmail = sessionStorage.getItem('adminEmail') || 'admin@gmail.com';

        const nameElement = document.getElementById('adminName');
        const emailElement = document.getElementById('adminEmail');

        if (nameElement) nameElement.textContent = adminName;
        if (emailElement) emailElement.textContent = adminEmail;

        console.log('✅ Admin info loaded:', { name: adminName, email: adminEmail });
    } catch (error) {
        console.error('❌ Error loading admin info:', error);
        const nameElement = document.getElementById('adminName');
        const emailElement = document.getElementById('adminEmail');
        if (nameElement) nameElement.textContent = 'Admin User';
        if (emailElement) emailElement.textContent = 'admin@university.edu';
    }
}

function updateAdminPassword() {
    console.log('🔑 Updating admin password');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill all password fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showNotification('New password must be at least 6 characters long', 'error');
        return;
    }

    const saveBtn = document.getElementById('saveAdminPasswordBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    saveBtn.disabled = true;

    fetch('/api/admin/update_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Password updated successfully!', 'success');
                window.modalManager.closeAdminSettingsModal();
            } else {
                showNotification(data.error || 'Failed to update password', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating password:', error);
            showNotification('Failed to update password', 'error');
        })
        .finally(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        });
}

window.openAdminSettings = openAdminSettings;
window.updateAdminPassword = updateAdminPassword;