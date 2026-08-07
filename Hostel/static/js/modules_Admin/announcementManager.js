// ============================================
// ANNOUNCEMENTMANAGER.JS - Announcement Management
// ============================================

class AnnouncementManager {
    constructor() {
        this.currentAnnouncementId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAnnouncements();
    }

    bindEvents() {
        document.getElementById('createAnnouncementBtn')?.addEventListener('click', () => {
            this.openCreateModal();
        });

        document.getElementById('refreshAnnouncements')?.addEventListener('click', () => {
            this.loadAnnouncements();
        });

        document.getElementById('announcementImage')?.addEventListener('change', (e) => {
            this.previewImage(e.target);
        });
    }

    async loadAnnouncements() {
        try {
            const response = await fetch('/api/admin/announcements');
            const data = await response.json();

            if (data.success) {
                const announcements = data.announcements.map(announcement => ({
                    ...announcement,
                    type: announcement.announcement_type || 'info'
                }));
                this.renderAnnouncements(announcements);
            } else {
                this.showNotification('Failed to load announcements', 'error');
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
            this.showNotification('Error loading announcements', 'error');
        }
    }

    renderAnnouncements(announcements) {
        const tbody = document.getElementById('announcementsTable');
        if (!tbody) return;

        if (announcements.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-bullhorn fa-2x mb-2"></i>
                            <p>No announcements found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = announcements.map((announcement, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div>
                        <strong>${escapeHtml(announcement.title)}</strong>
                        <div class="announcement-meta">
                            <span class="announcement-type ${announcement.type}">${announcement.type}</span>
                            <span class="announcement-audience">${announcement.audience}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="announcement-preview">
                        ${announcement.content.substring(0, 100)}${announcement.content.length > 100 ? '...' : ''}
                    </div>
                </td>
                <td>${announcement.created_by_name}</td>
                <td>${announcement.created_at}</td>
                <td>
                    <span class="status ${announcement.is_active ? 'paid' : 'pending'}">
                        ${announcement.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    ${announcement.scheduled_for ?
                `<small>${announcement.scheduled_for}</small>` :
                '<small>Immediate</small>'
            }
                </td>
                <td>
                    <div class="action-buttons-simple">
                        <button class="btn-simple btn-view" onclick="announcementManager.viewAnnouncement(${announcement.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-simple btn-edit" onclick="announcementManager.editAnnouncement(${announcement.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-simple btn-delete" onclick="announcementManager.deleteAnnouncement(${announcement.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    openCreateModal() {
        this.currentAnnouncementId = null;
        const modal = document.getElementById('announcementModalOverlay');
        const title = document.getElementById('announcementModalTitle');
        const form = document.getElementById('announcementForm');

        if (modal && title && form) {
            title.innerHTML = '<i class="fas fa-plus-circle"></i> Create New Announcement';
            form.reset();
            document.getElementById('announcementImagePreview').style.display = 'none';
            modal.classList.add('active');
        }
    }

    previewImage(input) {
        const preview = document.getElementById('announcementImagePreview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    async viewAnnouncement(id) {
        try {
            const response = await fetch(`/api/admin/announcements`);
            const data = await response.json();

            if (data.success) {
                const announcement = data.announcements.find(a => a.id === id);
                if (announcement) {
                    announcement.type = announcement.announcement_type || 'info';
                    this.showAnnouncementDetails(announcement);
                }
            }
        } catch (error) {
            console.error('Error viewing announcement:', error);
            this.showNotification('Error viewing announcement', 'error');
        }
    }

    showAnnouncementDetails(announcement) {
        const modal = document.getElementById('announcementDetailModalOverlay');
        const content = document.getElementById('announcementDetailContent');

        if (modal && content) {
            content.innerHTML = `
                <div class="announcement-detail">
                    <div class="announcement-header">
                        <h3>${escapeHtml(announcement.title)}</h3>
                        <div class="announcement-meta-detail">
                            <span class="announcement-type ${announcement.type}">${announcement.type}</span>
                            <span class="announcement-audience">${announcement.audience}</span>
                            <span class="priority-badge ${announcement.priority}">${announcement.priority}</span>
                        </div>
                    </div>
                    
                    <div class="announcement-content">
                        <p>${escapeHtml(announcement.content).replace(/\n/g, '<br>')}</p>
                    </div>
                    
                    ${announcement.image_path ? `
                    <div class="attachment-section">
                        <strong>Attached Image:</strong>
                        <div class="attachment-preview">
                            <img src="/static/${announcement.image_path}" alt="Announcement Image" 
                                 style="max-width: 100%; border-radius: 8px; margin-top: 10px; cursor: pointer;"
                                 onclick="openImageOverlay('/static/${announcement.image_path}')">
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="announcement-footer">
                        <div class="announcement-info">
                            <div>
                                <strong>Created By:</strong>
                                <span>${escapeHtml(announcement.created_by_name)}</span>
                            </div>
                            <div>
                                <strong>Created At:</strong>
                                <span>${announcement.created_at}</span>
                            </div>
                            <div>
                                <strong>Status:</strong>
                                <span class="status ${announcement.is_active ? 'paid' : 'pending'}">
                                    ${announcement.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            ${announcement.scheduled_for ? `
                            <div>
                                <strong>Scheduled For:</strong>
                                <span>${announcement.scheduled_for}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            modal.classList.add('active');
        }
    }

    async editAnnouncement(id) {
        try {
            const response = await fetch(`/api/admin/announcements`);
            const data = await response.json();

            if (data.success) {
                const announcement = data.announcements.find(a => a.id === id);
                if (announcement) {
                    announcement.type = announcement.announcement_type || 'info';
                    this.openEditModal(announcement);
                }
            }
        } catch (error) {
            console.error('Error editing announcement:', error);
            this.showNotification('Error editing announcement', 'error');
        }
    }

    openEditModal(announcement) {
        this.currentAnnouncementId = announcement.id;
        const modal = document.getElementById('announcementModalOverlay');
        const title = document.getElementById('announcementModalTitle');
        const form = document.getElementById('announcementForm');

        if (modal && title && form) {
            title.innerHTML = '<i class="fas fa-edit"></i> Edit Announcement';

            document.getElementById('announcementTitle').value = announcement.title;
            document.getElementById('announcementContent').value = announcement.content;
            document.getElementById('announcementType').value = announcement.type;
            document.getElementById('announcementPriority').value = announcement.priority;
            document.getElementById('announcementAudience').value = announcement.audience;
            document.getElementById('announcementActive').checked = announcement.is_active;

            if (announcement.scheduled_for) {
                const scheduledDate = new Date(announcement.scheduled_for + 'Z').toISOString().slice(0, 16);
                document.getElementById('announcementSchedule').value = scheduledDate;
            }

            const preview = document.getElementById('announcementImagePreview');
            if (announcement.image_path) {
                preview.src = `/static/${announcement.image_path}`;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }

            modal.classList.add('active');
        }
    }

    async deleteAnnouncement(id) {
        if (!confirm('Are you sure you want to delete this announcement?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/announcements/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                this.showNotification('Announcement deleted successfully', 'success');
                this.loadAnnouncements();
            } else {
                this.showNotification('Failed to delete announcement', 'error');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            this.showNotification('Error deleting announcement', 'error');
        }
    }

    async handleAnnouncementSubmit(event) {
        event.preventDefault();

        const formData = new FormData();
        formData.append('title', document.getElementById('announcementTitle').value);
        formData.append('content', document.getElementById('announcementContent').value);
        formData.append('type', document.getElementById('announcementType').value);
        formData.append('priority', document.getElementById('announcementPriority').value);
        formData.append('audience', document.getElementById('announcementAudience').value);
        formData.append('is_active', document.getElementById('announcementActive').checked);

        const schedule = document.getElementById('announcementSchedule').value;
        if (schedule) {
            formData.append('scheduled_for', schedule);
        }

        const imageFile = document.getElementById('announcementImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const url = this.currentAnnouncementId
                ? `/api/admin/announcements/${this.currentAnnouncementId}`
                : '/api/admin/announcements';

            const method = this.currentAnnouncementId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(
                    this.currentAnnouncementId ? 'Announcement updated successfully' : 'Announcement created successfully',
                    'success'
                );
                this.closeAnnouncementModal();
                this.loadAnnouncements();
            } else {
                this.showNotification(data.error || 'Operation failed', 'error');
            }
        } catch (error) {
            console.error('Error saving announcement:', error);
            this.showNotification('Error saving announcement', 'error');
        }
    }

    closeAnnouncementModal() {
        const modal = document.getElementById('announcementModalOverlay');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentAnnouncementId = null;
    }

    showNotification(message, type) {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

window.AnnouncementManager = AnnouncementManager;