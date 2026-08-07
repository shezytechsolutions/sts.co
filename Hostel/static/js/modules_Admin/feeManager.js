// ============================================
// FEE MANAGER - Complete Fee Management Module
// ============================================

class FeeManager {
    constructor() {
        this.selectedStudents = new Set();
        this.currentChallanId = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.init();
    }

    init() {
        this.loadFeeStats();
        this.loadStudents();
        this.loadBatchesAndDepartments();
        this.setupEventListeners();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadFeeStats(true);
        }, 30000);
    }

    setupEventListeners() {
        document.getElementById('feeStudentFilter')?.addEventListener('change', () => this.loadStudents());
        document.getElementById('feeBatchFilter')?.addEventListener('change', () => this.loadStudents());
        document.getElementById('feeDepartmentFilter')?.addEventListener('change', () => this.loadStudents());
        document.getElementById('feePrevBtn')?.addEventListener('click', () => this.previousPage());
        document.getElementById('feeNextBtn')?.addEventListener('click', () => this.nextPage());
    }

    async loadFeeStats(silent = false) {
        try {
            const response = await fetch('/api/admin/fee/dashboard-stats');
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('totalCollection').textContent = result.stats.total_collection;
                document.getElementById('pendingFees').textContent = result.stats.pending_fees;
                document.getElementById('overdueFees').textContent = result.stats.overdue_fees;
                document.getElementById('pendingVerification').textContent = result.stats.pending_verification;
                
                if (!silent) {
                    this.showNotification('Fee stats updated', 'success');
                }
            }
        } catch (error) {
            console.error('Error loading fee stats:', error);
        }
    }

    async loadStudents() {
        const filter = document.getElementById('feeStudentFilter').value;
        const batch = document.getElementById('feeBatchFilter').value;
        const department = document.getElementById('feeDepartmentFilter').value;
        
        const tableBody = document.getElementById('feeStudentsTable');
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading students...</td></tr>';
        
        try {
            const response = await fetch(`/api/admin/fee/students?batch=${batch}&department=${department}`);
            const result = await response.json();
            
            if (result.success) {
                let students = result.students;
                
                // Apply filter
                if (filter === 'pending_fees') {
                    students = students.filter(s => parseFloat(s.pending_amount) > 0);
                } else if (filter === 'overdue') {
                    // Filter logic for overdue (simplified)
                    students = students.filter(s => parseFloat(s.pending_amount) > 0);
                }
                
                this.renderStudentsTable(students);
                this.updatePagination(students.length);
            }
        } catch (error) {
            console.error('Error loading students:', error);
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load students</td></tr>';
        }
    }

    renderStudentsTable(students) {
    const tableBody = document.getElementById('feeStudentsTable');
    
    if (students.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No students found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = students.map(student => `
        <tr>
            <td>
                <input type="checkbox" class="student-checkbox" 
                       value="${student.student_id}" 
                       onchange="feeManager.toggleStudentSelection(this)">
            </td>
            <td>
                <strong>${this.escapeHtml(student.name)}</strong><br>
                <small class="text-muted">${student.email || 'No email'}</small><br>
                <small class="text-muted">Phone: ${student.phone || 'N/A'}</small>
            </td>
            <td>${student.roll_number || 'N/A'}</td>
            <td>${student.batch_year || 'N/A'} / ${student.department || 'N/A'}</td>
            <td class="amount">Rs. ${parseFloat(student.pending_amount || 0).toLocaleString()}</td>
            <td>
                <span class="status ${parseFloat(student.pending_amount || 0) > 0 ? 'pending' : 'paid'}">
                    ${parseFloat(student.pending_amount || 0) > 0 ? 'Pending' : 'Paid'}
                </span>
            </td>
            <td>
                <div class="action-buttons-simple">
                    <button class="btn-simple btn-primary" onclick="feeManager.showGenerateChallan([${student.student_id}])">
                        <i class="fas fa-file-invoice"></i> Challan
                    </button>
                    <button class="btn-simple btn-edit" onclick="feeManager.showReminderModal([${student.student_id}])">
                        <i class="fas fa-bell"></i> Remind
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}
    
    updatePagination(totalStudents) {
        const paginationDiv = document.getElementById('feePagination');
        if (totalStudents <= 20) {
            paginationDiv.style.display = 'none';
        } else {
            paginationDiv.style.display = 'flex';
            document.getElementById('feeTotalStudents').textContent = totalStudents;
            this.totalPages = Math.ceil(totalStudents / 20);
            document.getElementById('feeTotalPages').textContent = this.totalPages;
        }
    }
    
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadStudents();
        }
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadStudents();
        }
    }
    
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllStudents');
        const checkboxes = document.querySelectorAll('.student-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
            if (selectAll.checked) {
                this.selectedStudents.add(checkbox.value);
            } else {
                this.selectedStudents.delete(checkbox.value);
            }
        });
        
        this.updateSelectedCount();
    }
    
    toggleStudentSelection(checkbox) {
        const studentId = checkbox.value;
        if (checkbox.checked) {
            this.selectedStudents.add(studentId);
        } else {
            this.selectedStudents.delete(studentId);
        }
        this.updateSelectedCount();
    }
    
    updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = this.selectedStudents.size;
        }
        const reminderCount = document.getElementById('reminderSelectedCount');
        if (reminderCount) {
            reminderCount.textContent = this.selectedStudents.size;
        }
    }
    
    openGenerateChallanModal() {
        document.getElementById('generateChallanModal').classList.add('active');
        this.updateChallanAmount();
        this.setDefaultDueDate();
    }
    
    closeGenerateChallanModal() {
        document.getElementById('generateChallanModal').classList.remove('active');
    }
    
    showGenerateChallan(studentIds) {
        this.selectedStudents.clear();
        studentIds.forEach(id => this.selectedStudents.add(id.toString()));
        this.updateSelectedCount();
        this.openGenerateChallanModal();
    }
    
    updateChallanAmount() {
        const feeType = document.getElementById('challanFeeType').value;
        const amountInput = document.getElementById('challanAmount');
        
        const feeAmounts = {
            'hostel': 25000,
            'mess': 15000,
            'security': 5000,
            'library': 2000,
            'sports': 1500
        };
        
        if (feeType !== 'custom' && feeAmounts[feeType]) {
            amountInput.value = feeAmounts[feeType];
            amountInput.readOnly = true;
        } else {
            amountInput.value = '';
            amountInput.readOnly = false;
        }
    }
    
    setDefaultDueDate() {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + 1); // Due in 1 month
        document.getElementById('challanDueDate').value = dueDate.toISOString().split('T')[0];
    }
    
    updateStudentSelection() {
        const selectionType = document.getElementById('challanStudentFilter').value;
        
        document.getElementById('batchSelection').style.display = 
            selectionType === 'batch' ? 'block' : 'none';
        document.getElementById('departmentSelection').style.display = 
            selectionType === 'department' ? 'block' : 'none';
    }
    
    async loadBatchesAndDepartments() {
        try {
            const [batchesRes, deptsRes] = await Promise.all([
                fetch('/api/admin/fee/batches'),
                fetch('/api/admin/fee/departments')
            ]);
            
            const batches = await batchesRes.json();
            const departments = await deptsRes.json();
            
            if (batches.success) {
                const batchSelects = ['feeBatchFilter', 'challanBatch', 'reminderBatch'];
                batchSelects.forEach(selectId => {
                    const select = document.getElementById(selectId);
                    if (select) {
                        select.innerHTML = '<option value="all">All Batches</option>' + 
                            batches.batches.map(b => `<option value="${b}">${b}</option>`).join('');
                    }
                });
            }
            
            if (departments.success) {
                const deptSelects = ['feeDepartmentFilter', 'challanDepartment', 'reminderDepartment'];
                deptSelects.forEach(selectId => {
                    const select = document.getElementById(selectId);
                    if (select) {
                        select.innerHTML = '<option value="all">All Departments</option>' + 
                            departments.departments.map(d => `<option value="${d}">${d}</option>`).join('');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading filters:', error);
        }
    }
    
    async generateChallans() {
        if (this.selectedStudents.size === 0) {
            this.showNotification('Please select at least one student', 'warning');
            return;
        }
        
        const amount = document.getElementById('challanAmount').value;
        const dueDate = document.getElementById('challanDueDate').value;
        const feeType = document.getElementById('challanFeeType').value;
        const description = document.getElementById('challanDescription').value;
        
        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid amount', 'warning');
            return;
        }
        
        if (!dueDate) {
            this.showNotification('Please select a due date', 'warning');
            return;
        }
        
        const studentIds = Array.from(this.selectedStudents);
        
        this.showNotification(`Generating ${studentIds.length} challan(s)...`, 'info');
        
        try {
            const response = await fetch('/api/admin/fee/challans/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_ids: studentIds,
                    amount: parseFloat(amount),
                    due_date: dueDate,
                    fee_type: feeType,
                    description: description
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                this.closeGenerateChallanModal();
                this.selectedStudents.clear();
                this.updateSelectedCount();
                this.loadFeeStats();
                this.loadStudents();
            } else {
                this.showNotification(result.error || 'Failed to generate challans', 'error');
            }
        } catch (error) {
            console.error('Error generating challans:', error);
            this.showNotification('Failed to generate challans', 'error');
        }
    }
    
    showReminderModal(studentIds = null) {
        if (studentIds) {
            this.selectedStudents.clear();
            studentIds.forEach(id => this.selectedStudents.add(id.toString()));
            this.updateSelectedCount();
        }
        
        document.getElementById('sendReminderModal').classList.add('active');
    }
    
    closeReminderModal() {
        document.getElementById('sendReminderModal').classList.remove('active');
    }
    
    updateReminderRecipients() {
        const recipientType = document.getElementById('reminderRecipientType').value;
        
        document.getElementById('reminderBatchSelection').style.display = 
            recipientType === 'batch' ? 'block' : 'none';
        document.getElementById('reminderDepartmentSelection').style.display = 
            recipientType === 'department' ? 'block' : 'none';
    }
    
    async sendReminders() {
        const recipientType = document.getElementById('reminderRecipientType').value;
        const title = document.getElementById('reminderTitle').value;
        const message = document.getElementById('reminderMessage').value;
        const sendViaEmail = document.getElementById('sendViaEmail').checked;
        const sendViaWhatsApp = document.getElementById('sendViaWhatsApp').checked;
        
        if (!title || !message) {
            this.showNotification('Please enter title and message', 'warning');
            return;
        }
        
        if (!sendViaEmail && !sendViaWhatsApp) {
            this.showNotification('Please select at least one notification method', 'warning');
            return;
        }
        
        let studentIds = [];
        let batchYear = null;
        let department = null;
        
        if (recipientType === 'selected') {
            studentIds = Array.from(this.selectedStudents);
            if (studentIds.length === 0) {
                this.showNotification('Please select students to send reminders', 'warning');
                return;
            }
        } else if (recipientType === 'batch') {
            batchYear = document.getElementById('reminderBatch').value;
        } else if (recipientType === 'department') {
            department = document.getElementById('reminderDepartment').value;
        }
        
        const sendVia = sendViaEmail && sendViaWhatsApp ? 'both' : 
                       sendViaEmail ? 'email' : 'whatsapp';
        
        this.showNotification('Sending reminders...', 'info');
        
        try {
            const response = await fetch('/api/admin/fee/reminders/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    message: message,
                    recipient_type: recipientType,
                    student_ids: studentIds,
                    batch_year: batchYear,
                    department: department,
                    send_via: sendVia
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                this.closeReminderModal();
            } else {
                this.showNotification(result.error || 'Failed to send reminders', 'error');
            }
        } catch (error) {
            console.error('Error sending reminders:', error);
            this.showNotification('Failed to send reminders', 'error');
        }
    }
    
    async viewStudentFees(studentId) {
        this.showNotification('Viewing student fee details...', 'info');
        // Implement detailed view modal
    }
    
    manageFeeSettings() {
        this.showNotification('Fee settings panel coming soon', 'info');
    }
    
    viewCollectionReport() {
        this.showNotification('Collection report feature coming soon', 'info');
    }
    
    viewPendingFees() {
        document.getElementById('feeStudentFilter').value = 'pending_fees';
        this.loadStudents();
    }
    
    viewOverdueFees() {
        document.getElementById('feeStudentFilter').value = 'overdue';
        this.loadStudents();
    }
    
    viewVerificationRequests() {
        this.showNotification('Verification panel coming soon', 'info');
    }
    
    exportFeeData() {
        this.showNotification('Export feature coming soon', 'info');
    }
    
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize fee manager when page loads
window.feeManager = new FeeManager();