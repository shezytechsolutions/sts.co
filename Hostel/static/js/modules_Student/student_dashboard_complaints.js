// student_dashboard_complaints.js
// Complaint Management Module

// ============================================
// COMPLAINT MANAGEMENT SYSTEM - STUDENT
// ============================================

class ComplaintManager {
    constructor() {
        this.stream = null;
        this.capturedImage = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadComplaints();
    }

    setupEventListeners() {
        // Webcam functionality
        this.setupWebcam();

        // Form submission
        document.getElementById('complaintForm')?.addEventListener('submit', (e) => this.submitComplaint(e));

        // File input change
        document.getElementById('complaintAttachment')?.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    setupWebcam() {
        const startWebcamBtn = document.getElementById('startWebcam');
        const captureBtn = document.getElementById('captureImage');
        const webcamVideo = document.getElementById('webcamVideo');
        const webcamCanvas = document.getElementById('webcamCanvas');
        const webcamPreview = document.getElementById('webcamPreview');

        if (startWebcamBtn) {
            startWebcamBtn.addEventListener('click', () => this.startWebcam(webcamVideo, captureBtn));
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.captureImage(webcamVideo, webcamCanvas, webcamPreview, captureBtn));
        }
    }

    async startWebcam(videoElement, captureBtn) {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'environment'
                }
            });

            videoElement.srcObject = this.stream;
            videoElement.style.display = 'block';
            captureBtn.style.display = 'block';

            showNotification('Webcam started successfully', 'success');
        } catch (error) {
            console.error('Error accessing webcam:', error);
            showNotification('Failed to access webcam. Please check permissions.', 'error');
        }
    }

    captureImage(videoElement, canvasElement, previewElement, captureBtn) {
        if (!this.stream) return;

        const context = canvasElement.getContext('2d');
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        this.capturedImage = canvasElement.toDataURL('image/jpeg');
        previewElement.src = this.capturedImage;
        previewElement.style.display = 'block';

        // Stop webcam
        this.stopWebcam();
        videoElement.style.display = 'none';
        captureBtn.style.display = 'none';

        showNotification('Image captured successfully', 'success');
    }

    stopWebcam() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('filePreview');

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    }

    async submitComplaint(event) {
        event.preventDefault();

        const formData = new FormData(event.target);

        // Add webcam image if captured
        if (this.capturedImage) {
            formData.append('webcam_image', this.capturedImage);
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            submitBtn.disabled = true;

            const response = await fetch('/api/student/complaints', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Complaint submitted successfully!', 'success');
                event.target.reset();
                this.resetWebcam();
                this.loadComplaints();
            } else {
                throw new Error(result.error || 'Failed to submit complaint');
            }
        } catch (error) {
            console.error('Error submitting complaint:', error);
            showNotification(error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    resetWebcam() {
        this.stopWebcam();
        this.capturedImage = null;

        const webcamVideo = document.getElementById('webcamVideo');
        const captureBtn = document.getElementById('captureImage');
        const webcamPreview = document.getElementById('webcamPreview');
        const filePreview = document.getElementById('filePreview');

        if (webcamVideo) webcamVideo.style.display = 'none';
        if (captureBtn) captureBtn.style.display = 'none';
        if (webcamPreview) webcamPreview.style.display = 'none';
        if (filePreview) filePreview.style.display = 'none';
    }

    async loadComplaints() {
        const complaintsContainer = document.getElementById('complaintsList');
        if (!complaintsContainer) return;

        try {
            complaintsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading complaints...</p>
                </div>
            `;

            const response = await fetch('/api/student/complaints');
            const result = await response.json();

            if (result.success) {
                this.renderComplaints(result.complaints);
            } else {
                throw new Error(result.error || 'Failed to load complaints');
            }
        } catch (error) {
            console.error('Error loading complaints:', error);
            complaintsContainer.innerHTML = `
                <div class="error-state-simple">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load complaints</p>
                    <button class="btn-retry-simple" onclick="window.complaintManager.loadComplaints()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    renderComplaints(complaints) {
        const container = document.getElementById('complaintsList');
        if (!container) return;

        if (complaints.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <h4>No Complaints Yet</h4>
                    <p>You haven't submitted any complaints yet.</p>
                </div>
            `;
            return;
        }

        // Add bulk actions for student
        const bulkActionsHTML = `
            <div class="bulk-actions" id="studentComplaintBulkActions" style="margin-bottom: 15px; display: none;">
                <button class="btn-simple btn-danger" id="studentBulkDeleteComplaints" onclick="window.complaintManager.deleteSelectedComplaints()">
                    <i class="fas fa-trash"></i> Delete Selected
                </button>
            </div>
        `;

        container.innerHTML = bulkActionsHTML + complaints.map(complaint => `
            <div class="complaint-item ${complaint.status}">
                <div class="complaint-header">
                    <div class="complaint-checkbox" style="display: flex; align-items: flex-start; gap: 10px;">
                        <input type="checkbox" class="student-complaint-checkbox" value="${complaint.id}" 
                               onchange="window.complaintManager.updateStudentBulkActions()">
                        <div class="complaint-title">
                            <h4>${this.escapeHtml(complaint.title)}</h4>
                            <span class="complaint-category">${this.escapeHtml(complaint.category)}</span>
                        </div>
                    </div>
                    <div class="complaint-meta">
                        <span class="complaint-date">${complaint.formatted_created_at}</span>
                        <span class="complaint-priority ${complaint.priority}">${complaint.priority}</span>
                        <span class="complaint-status ${complaint.status}">${this.formatStatus(complaint.status)}</span>
                    </div>
                </div>
                
                <div class="complaint-body">
                    <p>${this.escapeHtml(complaint.description)}</p>
                    
                    ${complaint.attachment_path ? `
                        <div class="complaint-attachment">
                            <i class="fas fa-paperclip"></i>
                            <a href="/static/${complaint.attachment_path}" target="_blank" class="attachment-link">
                                View Attachment
                            </a>
                        </div>
                    ` : ''}
                    
                    ${complaint.admin_notes ? `
                        <div class="admin-notes">
                            <strong>Admin Response:</strong>
                            <p>${this.escapeHtml(complaint.admin_notes)}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="complaint-footer">
                    <!-- Show delete button for all complaints (student can only delete their own) -->
                    <button class="btn-simple btn-delete" onclick="window.complaintManager.deleteComplaint(${complaint.id})">
                        <i class="fas fa-trash"></i> Delete Complaint
                    </button>
                    
                    ${complaint.status === 'resolved' ? `
                        <span class="resolved-date">Resolved on: ${complaint.formatted_resolved_at}</span>
                    ` : ''}
                </div>
            </div>
        `).join('');
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async deleteComplaint(complaintId) {
        if (!confirm('Are you sure you want to permanently delete this complaint?')) {
            return;
        }

        try {
            const response = await fetch(`/api/student/complaints/${complaintId}`, {
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

    async deleteSelectedComplaints() {
        const selectedComplaints = this.getSelectedComplaints();
        if (selectedComplaints.length === 0) {
            showNotification('Please select complaints to delete', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedComplaints.length} selected complaints? This action cannot be undone.`)) {
            return;
        }

        try {
            showNotification(`Deleting ${selectedComplaints.length} complaints...`, 'info');

            for (const complaintId of selectedComplaints) {
                await this.deleteSingleComplaint(complaintId);
            }

            showNotification(`Successfully deleted ${selectedComplaints.length} complaints`, 'success');
            this.clearSelections();
            this.loadComplaints();

        } catch (error) {
            console.error('Error deleting selected complaints:', error);
            showNotification('Error deleting some complaints', 'error');
        }
    }

    async deleteSingleComplaint(complaintId) {
        const response = await fetch(`/api/student/complaints/${complaintId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }
    }

    getSelectedComplaints() {
        const checkboxes = document.querySelectorAll('.student-complaint-checkbox:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    clearSelections() {
        document.querySelectorAll('.student-complaint-checkbox').forEach(cb => cb.checked = false);
        this.updateStudentBulkActions();
    }

    updateStudentBulkActions() {
        const selectedCount = this.getSelectedComplaints().length;
        const bulkActionsDiv = document.getElementById('studentComplaintBulkActions');
        const bulkDeleteBtn = document.getElementById('studentBulkDeleteComplaints');

        if (bulkActionsDiv) {
            bulkActionsDiv.style.display = selectedCount > 0 ? 'block' : 'none';
        }
        
        if (bulkDeleteBtn) {
            bulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i> Delete Selected (${selectedCount})`;
        }
    }
}

// Initialize complaint manager
window.complaintManager = new ComplaintManager();