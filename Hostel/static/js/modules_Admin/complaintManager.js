// ============================================
// COMPLAINTMANAGER.JS - Complaint Management
// ============================================

class AdminComplaintManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadComplaints();
    }

    setupEventListeners() {
        document.getElementById('refreshComplaints')?.addEventListener('click', () => this.loadComplaints());
        document.getElementById('complaintFilter')?.addEventListener('change', () => this.loadComplaints());
        document.getElementById('complaintPriorityFilter')?.addEventListener('change', () => this.loadComplaints());
        document.getElementById('complaintSearch')?.addEventListener('input', () => this.searchComplaints());
    }

    async loadComplaints() {
        const tableBody = document.getElementById('complaintsTable');
        if (!tableBody) return;

        try {
            tableBody.innerHTML = this.getLoadingHTML();

            const filter = document.getElementById('complaintFilter')?.value || 'all';
            const response = await fetch(`/api/admin/complaints`);
            const result = await response.json();

            if (result.success) {
                this.renderComplaints(result.complaints, filter);
            } else {
                throw new Error(result.error || 'Failed to load complaints');
            }
        } catch (error) {
            console.error('Error loading complaints:', error);
            this.showComplaintsError('Failed to load complaints');
        }
    }

    renderComplaints(complaints, filter) {
        const tableBody = document.getElementById('complaintsTable');
        if (!tableBody) return;

        let filteredComplaints = complaints;
        if (filter !== 'all') {
            filteredComplaints = complaints.filter(complaint => complaint.status === filter);
        }

        const priorityFilter = document.getElementById('complaintPriorityFilter')?.value;
        if (priorityFilter && priorityFilter !== 'all') {
            filteredComplaints = filteredComplaints.filter(complaint => complaint.priority === priorityFilter);
        }

        if (filteredComplaints.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="empty-state">
                            <i class="fas fa-comments"></i>
                            <h4>No Complaints Found</h4>
                            <p>No complaints match the selected filter.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredComplaints.map((complaint, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${escapeHtml(complaint.student_name)}</strong>
                    <div class="student-details">
                        <small>ID: ${complaint.roll_number || 'N/A'}</small>
                        <small>Room: ${complaint.room_number || 'N/A'}</small>
                    </div>
                </td>
                <td>
                    <div class="complaint-title">
                        <strong>${escapeHtml(complaint.title)}</strong>
                        <small class="complaint-category">${escapeHtml(complaint.category)}</small>
                    </div>
                </td>
                <td>
                    <span class="priority-badge ${complaint.priority}">
                        ${complaint.priority}
                    </span>
                </td>
                <td>${complaint.formatted_created_at}</td>
                <td>
                    <span class="status ${this.getStatusClass(complaint.status)}">
                        ${this.formatStatus(complaint.status)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons-simple">
                        <button class="btn-simple btn-view" onclick="window.adminComplaintManager.viewComplaintDetails(${complaint.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${complaint.status === 'pending' || complaint.status === 'in_progress' ? `
                            <button class="btn-simple btn-approve" onclick="window.adminComplaintManager.resolveComplaint(${complaint.id})">
                                <i class="fas fa-check"></i> Solve
                            </button>
                            <button class="btn-simple btn-reject" onclick="window.adminComplaintManager.rejectComplaint(${complaint.id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        ` : ''}
                        ${complaint.status === 'rejected' ? `
                            <button class="btn-simple btn-delete" onclick="window.adminComplaintManager.deleteComplaint(${complaint.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    searchComplaints() {
        const searchTerm = document.getElementById('complaintSearch')?.value.toLowerCase();
        if (!searchTerm) {
            this.loadComplaints();
            return;
        }

        const tableBody = document.getElementById('complaintsTable');
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    async viewComplaintDetails(complaintId) {
        try {
            const response = await fetch(`/api/admin/complaints/${complaintId}`);
            const result = await response.json();

            if (result.success) {
                this.renderComplaintModal(result.complaint);
            } else {
                throw new Error(result.error || 'Failed to load complaint details');
            }
        } catch (error) {
            console.error('Error loading complaint details:', error);
            showNotification(error.message, 'error');
        }
    }

    renderComplaintModal(complaint) {
        const modalHTML = `
            <div class="modal-overlay active" id="complaintModalOverlay">
                <div class="modal-container" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2>
                            <i class="fas fa-comment-dots"></i>
                            Complaint Details
                        </h2>
                        <button class="modal-close" onclick="window.adminComplaintManager.closeComplaintModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="complaint-details">
                            <div class="detail-section">
                                <h4><i class="fas fa-user"></i> Student Information</h4>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Name:</label>
                                        <span>${escapeHtml(complaint.student_name)}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Roll Number:</label>
                                        <span>${complaint.roll_number || 'N/A'}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Room:</label>
                                        <span>${complaint.room_number || 'N/A'} (Bed ${complaint.bed_number || 'N/A'})</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Department:</label>
                                        <span>${complaint.department || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h4><i class="fas fa-file-alt"></i> Complaint Details</h4>
                                <div class="complaint-content">
                                    <div class="complaint-meta">
                                        <span class="priority-badge ${complaint.priority}">${complaint.priority}</span>
                                        <span class="status ${this.getStatusClass(complaint.status)}">${this.formatStatus(complaint.status)}</span>
                                        <span class="date">Submitted: ${complaint.formatted_created_at}</span>
                                    </div>
                                    
                                    <h5>${escapeHtml(complaint.title)}</h5>
                                    <p>${escapeHtml(complaint.description)}</p>
                                    
                                    ${complaint.attachment_path ? `
                                        <div class="attachment-section">
                                            <strong>Attachment:</strong>
                                            <div class="attachment-preview">
                                                <img src="/static/${complaint.attachment_path}" 
                                                     alt="Complaint Attachment" 
                                                     onclick="openImageOverlay('/static/${complaint.attachment_path}')"
                                                     style="max-width: 200px; cursor: pointer; border-radius: 8px;">
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            
                            ${complaint.status === 'pending' || complaint.status === 'in_progress' ? `
                                <div class="detail-section">
                                    <h4><i class="fas fa-cog"></i> Admin Actions</h4>
                                    <div class="action-section">
                                        <textarea id="adminNotes" placeholder="Add notes or response..." rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></textarea>
                                        <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 10px;">
                                            <button class="btn btn-success" onclick="window.adminComplaintManager.resolveComplaint(${complaint.id}, document.getElementById('adminNotes').value)">
                                                <i class="fas fa-check"></i> Mark as Resolved
                                            </button>
                                            <button class="btn btn-danger" onclick="window.adminComplaintManager.rejectComplaint(${complaint.id}, document.getElementById('adminNotes').value)">
                                                <i class="fas fa-times"></i> Reject Complaint
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${complaint.admin_notes ? `
                                <div class="detail-section">
                                    <h4><i class="fas fa-sticky-note"></i> Admin Notes</h4>
                                    <div class="admin-notes">
                                        <p>${escapeHtml(complaint.admin_notes)}</p>
                                        <small>Last updated: ${complaint.formatted_updated_at}</small>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    closeComplaintModal() {
        const modal = document.getElementById('complaintModalOverlay');
        if (modal) {
            modal.remove();
        }
    }

    async resolveComplaint(complaintId, notes = '') {
        if (!confirm('Mark this complaint as resolved?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/complaints/${complaintId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'resolved',
                    admin_notes: notes
                })
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Complaint marked as resolved', 'success');
                this.closeComplaintModal();
                this.loadComplaints();
            } else {
                throw new Error(result.error || 'Failed to resolve complaint');
            }
        } catch (error) {
            console.error('Error resolving complaint:', error);
            showNotification(error.message, 'error');
        }
    }

    async rejectComplaint(complaintId, notes = '') {
        if (!confirm('Reject this complaint? Student will be able to delete it permanently.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/complaints/${complaintId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'rejected',
                    admin_notes: notes
                })
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Complaint rejected', 'success');
                this.closeComplaintModal();
                this.loadComplaints();
            } else {
                throw new Error(result.error || 'Failed to reject complaint');
            }
        } catch (error) {
            console.error('Error rejecting complaint:', error);
            showNotification(error.message, 'error');
        }
    }

    async deleteComplaint(complaintId) {
        if (!confirm('Are you sure you want to permanently delete this complaint?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/complaints/${complaintId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Complaint deleted permanently', 'success');
                this.loadComplaints();
            } else {
                throw new Error(result.error || 'Failed to delete complaint');
            }
        } catch (error) {
            console.error('Error deleting complaint:', error);
            showNotification(error.message, 'error');
        }
    }

    getStatusClass(status) {
        const classMap = {
            'pending': 'pending',
            'in_progress': 'partial',
            'resolved': 'paid',
            'rejected': 'pending'
        };
        return classMap[status] || 'pending';
    }

    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'in_progress': 'In Progress',
            'resolved': 'Resolved',
            'rejected': 'Rejected'
        };
        return statusMap[status] || status;
    }

    getLoadingHTML() {
        return `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading complaints...</p>
                    </div>
                </td>
            </tr>
        `;
    }

    showComplaintsError(message) {
        const tableBody = document.getElementById('complaintsTable');
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }
}

window.AdminComplaintManager = AdminComplaintManager;