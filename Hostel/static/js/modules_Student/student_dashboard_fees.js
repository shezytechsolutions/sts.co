// ============================================
// STUDENT FEE MANAGER
// ============================================

class StudentFeeManager {
    constructor() {
        this.currentChallan = null;
        this.challans = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.loadFees();
        // Refresh every 30 seconds
        setInterval(() => this.loadFees(true), 30000);
    }

    async loadFees(silent = false) {
        try {
            const response = await fetch('/api/student/fee/challans');
            const result = await response.json();
            
            if (result.success) {
                this.challans = result.challans;
                this.updateStats();
                this.renderFees();
                if (!silent && this.challans.length > 0) {
                    this.showNotification('Fee data updated', 'success');
                }
            } else {
                throw new Error(result.error || 'Failed to load fees');
            }
        } catch (error) {
            console.error('Error loading fees:', error);
            if (!silent) {
                this.showNotification('Failed to load fee data', 'error');
            }
            document.getElementById('feesList').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Unable to Load Fees</h4>
                    <p>Please try again later.</p>
                    <button class="btn-primary" onclick="studentFeeManager.loadFees()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    updateStats() {
        const pending = this.challans.filter(c => c.status === 'pending').length;
        const submitted = this.challans.filter(c => c.status === 'submitted').length;
        const approved = this.challans.filter(c => c.status === 'approved').length;
        const totalAmount = this.challans.reduce((sum, c) => sum + parseFloat(c.amount), 0);
        
        document.getElementById('pendingFeesCount').textContent = pending;
        document.getElementById('submittedCount').textContent = submitted;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('totalAmount').textContent = `Rs. ${totalAmount.toLocaleString()}`;
    }

    filterFees(status) {
        this.currentFilter = status;
        
        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.filter === status) {
                tab.classList.add('active');
            }
        });
        
        // Update select dropdown
        const select = document.getElementById('feeStatusFilter');
        if (select) select.value = status;
        
        this.renderFees();
    }

    renderFees() {
        const container = document.getElementById('feesList');
        let filtered = this.challans;
        
        if (this.currentFilter !== 'all') {
            filtered = this.challans.filter(c => c.status === this.currentFilter);
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h4>No Fee Challans Found</h4>
                    <p>You don't have any ${this.currentFilter !== 'all' ? this.currentFilter : ''} fee challans at the moment.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(challan => `
            <div class="fee-challan-card ${challan.status}">
                <div class="challan-header">
                    <div class="challan-info">
                        <h4>Challan #${challan.challan_number}</h4>
                        <span class="challan-date">Generated: ${challan.created_at}</span>
                    </div>
                    <div class="challan-status ${challan.status}">
                        ${this.getStatusText(challan.status)}
                    </div>
                </div>
                
                <div class="challan-details">
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value amount">Rs. ${parseFloat(challan.amount).toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Due Date:</span>
                        <span class="detail-value due-date ${this.isOverdue(challan) ? 'overdue' : ''}">
                            ${challan.due_date}
                            ${this.isOverdue(challan) ? ' (Overdue!)' : ''}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fee Type:</span>
                        <span class="detail-value">${challan.fee_type.toUpperCase()}</span>
                    </div>
                    ${challan.description ? `
                    <div class="detail-row">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">${this.escapeHtml(challan.description)}</span>
                    </div>
                    ` : ''}
                    ${challan.admin_notes ? `
                    <div class="admin-notes">
                        <strong>Admin Note:</strong>
                        <p>${this.escapeHtml(challan.admin_notes)}</p>
                    </div>
                    ` : ''}
                </div>
                
                <div class="challan-actions">
                    <button class="btn-outline" onclick="studentFeeManager.viewChallan(${challan.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn-outline" onclick="studentFeeManager.downloadChallan(${challan.id})">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                    ${challan.status === 'pending' && !this.isOverdue(challan) ? `
                    <button class="btn-primary" onclick="studentFeeManager.openUploadModal(${challan.id})">
                        <i class="fas fa-upload"></i> Submit Payment Proof
                    </button>
                    ` : ''}
                    ${challan.status === 'submitted' ? `
                    <button class="btn-secondary" disabled>
                        <i class="fas fa-hourglass-half"></i> Under Review
                    </button>
                    ` : ''}
                    ${challan.status === 'approved' ? `
                    <button class="btn-success" disabled>
                        <i class="fas fa-check-circle"></i> Payment Verified
                    </button>
                    ` : ''}
                    ${challan.status === 'rejected' ? `
                    <button class="btn-danger" disabled>
                        <i class="fas fa-times-circle"></i> Payment Rejected
                    </button>
                    ` : ''}
                    ${this.isOverdue(challan) && challan.status === 'pending' ? `
                    <button class="btn-danger" disabled>
                        <i class="fas fa-exclamation-triangle"></i> Overdue - Contact Admin
                    </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
    
    isOverdue(challan) {
        const dueDate = new Date(challan.due_date);
        const today = new Date();
        return dueDate < today && challan.status === 'pending';
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending Payment',
            'submitted': 'Under Review',
            'approved': 'Approved ✓',
            'rejected': 'Rejected ✗',
            'overdue': 'Overdue ⚠'
        };
        return statusMap[status] || status;
    }

    async viewChallan(challanId) {
        const challan = this.challans.find(c => c.id === challanId);
        if (!challan) return;
        
        this.currentChallan = challan;
        
        const modal = document.getElementById('viewChallanModal');
        const content = document.getElementById('challanViewContent');
        
        content.innerHTML = `
            <div class="challan-detail-view">
                <div class="challan-header-detail">
                    <h3>Fee Challan</h3>
                    <p>${challan.challan_number}</p>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-user"></i> Student Information</h4>
                    <div class="info-grid">
                        <div><strong>Name:</strong> ${this.escapeHtml(challan.student_name)}</div>
                        <div><strong>Father's Name:</strong> ${challan.father_name || 'N/A'}</div>
                        <div><strong>CNIC:</strong> ${challan.cnic || 'N/A'}</div>
                        <div><strong>Roll Number:</strong> ${challan.roll_number || 'N/A'}</div>
                        <div><strong>Department:</strong> ${challan.department || 'N/A'}</div>
                        <div><strong>Batch Year:</strong> ${challan.batch_year || 'N/A'}</div>
                        <div><strong>Room Number:</strong> ${challan.room_number || 'Not Allotted'}</div>
                        <div><strong>Bed Number:</strong> ${challan.bed_number || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-money-bill-wave"></i> Payment Information</h4>
                    <div class="info-grid">
                        <div><strong>Amount:</strong> <span class="amount">Rs. ${parseFloat(challan.amount).toLocaleString()}</span></div>
                        <div><strong>Due Date:</strong> <span class="due-date ${this.isOverdue(challan) ? 'overdue' : ''}">${challan.due_date}</span></div>
                        <div><strong>Status:</strong> <span class="status-badge ${challan.status}">${this.getStatusText(challan.status)}</span></div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-university"></i> Bank Details</h4>
                    <div class="bank-details">
                        <p><strong>Bank:</strong> Habib Bank Limited (HBL)</p>
                        <p><strong>Branch:</strong> Mall Road Branch, Khairpur Mirs</p>
                        <p><strong>Account Title:</strong> BBSUTSD-FEES COLLECTION A/C</p>
                        <p><strong>Account Number:</strong> 00737935637203</p>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> Instructions</h4>
                    <ol class="instructions-list">
                        <li>Print this challan or show on mobile at bank</li>
                        <li>Deposit the exact amount at any HBL branch</li>
                        <li>Keep the bank receipt/slip safely</li>
                        <li>Upload payment proof here for verification</li>
                        <li>Wait for admin approval (usually 1-2 working days)</li>
                        <li>Check status regularly for updates</li>
                    </ol>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
    }

    closeChallanModal() {
        const modal = document.getElementById('viewChallanModal');
        if (modal) modal.classList.remove('active');
        this.currentChallan = null;
    }

    async downloadChallan(challanId) {
        try {
            this.showNotification('Downloading challan...', 'info');
            window.open(`/api/student/fee/challan/${challanId}/download`, '_blank');
        } catch (error) {
            this.showNotification('Download failed. Please try again.', 'error');
        }
    }

    downloadAllChallans() {
        if (this.challans.length === 0) {
            this.showNotification('No challans to download', 'warning');
            return;
        }
        
        this.challans.forEach(challan => {
            setTimeout(() => {
                window.open(`/api/student/fee/challan/${challan.id}/download`, '_blank');
            }, 500);
        });
        
        this.showNotification(`Downloading ${this.challans.length} challan(s)...`, 'info');
    }

    async openUploadModal(challanId) {
        const challan = this.challans.find(c => c.id === challanId);
        if (!challan) return;
        
        this.currentChallan = challan;
        
        const modal = document.getElementById('uploadProofModal');
        const infoDiv = document.getElementById('uploadChallanInfo');
        
        infoDiv.innerHTML = `
            <div class="challan-info-box">
                <p><strong>Challan #:</strong> ${challan.challan_number}</p>
                <p><strong>Amount:</strong> Rs. ${parseFloat(challan.amount).toLocaleString()}</p>
                <p><strong>Due Date:</strong> ${challan.due_date}</p>
            </div>
        `;
        
        // Reset form
        document.getElementById('transactionId').value = '';
        document.getElementById('paymentMethod').value = 'cash';
        document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('paymentNotes').value = '';
        document.getElementById('proofPreview').style.display = 'none';
        if (document.getElementById('proofFile')) {
            document.getElementById('proofFile').value = '';
        }
        
        modal.classList.add('active');
    }

    closeUploadModal() {
        const modal = document.getElementById('uploadProofModal');
        if (modal) modal.classList.remove('active');
        this.currentChallan = null;
    }

    previewProof(input) {
        const preview = document.getElementById('proofPreview');
        const image = document.getElementById('proofImage');
        
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                image.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    async submitProof() {
        if (!this.currentChallan) return;
        
        const transactionId = document.getElementById('transactionId').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const paymentDate = document.getElementById('paymentDate').value;
        const paymentNotes = document.getElementById('paymentNotes').value;
        const proofFile = document.getElementById('proofFile').files[0];
        
        if (!transactionId) {
            this.showNotification('Please enter transaction ID/reference number', 'warning');
            return;
        }
        
        if (!proofFile) {
            this.showNotification('Please upload payment proof (screenshot or photo)', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('challan_id', this.currentChallan.id);
        formData.append('transaction_id', transactionId);
        formData.append('payment_method', paymentMethod);
        formData.append('payment_date', paymentDate);
        formData.append('payment_notes', paymentNotes);
        formData.append('proof', proofFile);
        
        this.showNotification('Submitting payment proof...', 'info');
        
        try {
            const response = await fetch('/api/student/fee/submit-proof', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Payment proof submitted successfully!', 'success');
                this.closeUploadModal();
                this.loadFees();
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        } catch (error) {
            console.error('Error submitting proof:', error);
            this.showNotification(error.message, 'error');
        }
    }

    refreshFees() {
        this.loadFees();
    }

    showNotification(message, type) {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            // Simple toast notification
            const toast = document.createElement('div');
            toast.className = `notification ${type}`;
            toast.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when page loads
window.studentFeeManager = new StudentFeeManager();