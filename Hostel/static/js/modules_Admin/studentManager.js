// ============================================
// STUDENTMANAGER.JS - Student ID Management
// ============================================

class StudentManager {
    constructor() {
        this.currentFilter = 'all';
        this.currentStudentId = null;
        this.currentEditStudentId = null;
        this.currentRequestId = null;
        this.allStudents = [];
        this.batchFilter = 'all';
        this.filteredStudents = [];

        this.init();
        this.setupPrintButton();
    }

    init() {
        this.setupEventListeners();
        this.updateView();
    }

    setupEventListeners() {
        const filterSelect = document.getElementById('studentFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.handleFilterChange());
        }

        const batchFilterSelect = document.getElementById('batchFilter');
        if (batchFilterSelect) {
            batchFilterSelect.addEventListener('change', () => this.handleBatchFilterChange());
        }

        document.addEventListener('click', (e) => {
            if (e.target.id === 'modalClose' || e.target.closest('#modalClose')) {
                this.closeModal();
            }
            if (e.target.id === 'modalCloseBtn' || e.target.closest('#modalCloseBtn')) {
                this.closeModal();
            }
            if (e.target.id === 'editModalClose' || e.target.closest('#editModalClose')) {
                this.closeEditModal();
            }
            if (e.target.id === 'editModalCloseBtn' || e.target.closest('#editModalCloseBtn')) {
                this.closeEditModal();
            }
        });
    }

    setupPrintButton() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'printIdsButton' || e.target.closest('#printIdsButton')) {
                e.preventDefault();
                e.stopPropagation();

                if (window.printManager) {
                    window.printManager.openModal();
                } else {
                    window.printManager = new PrintManager();
                    window.printManager.openModal();
                }
            }
        });
    }

    handleFilterChange() {
        const filterSelect = document.getElementById('studentFilter');
        this.currentFilter = filterSelect.value;
        this.updateView();
        this.loadData();
    }

    handleBatchFilterChange() {
        const batchFilterSelect = document.getElementById('batchFilter');
        this.batchFilter = batchFilterSelect.value;

        if (this.currentFilter === 'all') {
            this.applyBatchFilter();
        }
    }

    updateView() {
        const allStudentsSection = document.getElementById('allStudentsSection');
        const idRequestsSection = document.getElementById('idRequestsSection');
        const batchFilter = document.getElementById('batchFilter');

        if (this.currentFilter === 'all') {
            allStudentsSection.style.display = 'block';
            idRequestsSection.style.display = 'none';
            if (batchFilter) {
                batchFilter.style.display = 'inline-block';
            }
        } else {
            allStudentsSection.style.display = 'none';
            idRequestsSection.style.display = 'block';
            if (batchFilter) {
                batchFilter.style.display = 'none';
            }
        }
    }

    async loadData() {
        if (this.currentFilter === 'all') {
            await this.loadAllStudents();
        } else {
            await this.loadIDRequests();
        }
    }

    async loadAllStudents() {
        const tableBody = document.getElementById('allStudentsTable');

        try {
            tableBody.innerHTML = this.getLoadingHTML();

            const response = await fetch('/api/admin/approved_students');

            if (!response.ok) {
                throw new Error('Failed to load approved students');
            }

            const result = await response.json();

            if (result.success && result.students) {
                this.allStudents = result.students;
                this.populateBatchFilter(result.students);
                this.applyBatchFilter();
            } else {
                this.showAllStudentsError('No approved students found');
            }
        } catch (error) {
            console.error('Error loading approved students:', error);
            this.showAllStudentsError('Failed to load approved students');
        }
    }

    populateBatchFilter(students) {
        const batchFilter = document.getElementById('batchFilter');
        if (!batchFilter) return;

        const batchYears = [...new Set(students
            .map(student => student.batch_year)
            .filter(year => year != null)
            .sort((a, b) => b - a)
        )];

        batchFilter.innerHTML = '<option value="all">All Students</option>';

        batchYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `Batch ${year}`;
            batchFilter.appendChild(option);
        });

        batchFilter.value = this.batchFilter;
    }

    applyBatchFilter() {
        if (this.batchFilter === 'all') {
            this.filteredStudents = this.allStudents;
        } else {
            this.filteredStudents = this.allStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.batchFilter
            );
        }
        this.renderAllStudents(this.filteredStudents);
    }

    renderAllStudents(students) {
        const tableBody = document.getElementById('allStudentsTable');

        if (students.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-users fa-2x text-muted mb-3"></i>
                        <p>No students found</p>
                        ${this.batchFilter !== 'all' ? '<small>Try changing the batch filter</small>' : ''}
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = students.map((student, index) => `
            <tr>
                <td>${index + 1001}</td>
                <td>
                    <strong>${escapeHtml(student.name)}</strong>
                </td>
                <td>${escapeHtml(student.roll_number || 'N/A')}</td>
                <td>${escapeHtml(student.department || 'N/A')}</td>
                <td>${student.batch_year || 'N/A'}</td>
                <td>
                    <span class="status paid">Approved</span>
                </td>
                <td>
                    <div class="action-buttons-simple">
                        <button class="btn-simple btn-view" onclick="window.studentManager.viewStudentDetails(${student.user_id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-simple btn-edit" onclick="window.studentManager.editStudent(${student.user_id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-simple btn-delete" onclick="window.studentManager.deleteStudent(${student.user_id}, '${escapeHtml(student.name)}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async deleteStudent(userId, studentName) {
        if (!confirm(`⚠️ ARE YOU SURE?\n\nYou are about to permanently delete student:\n"${studentName}"\n\nThis action cannot be undone. Type "DELETE" to confirm:`)) {
            return;
        }

        const confirmation = prompt('Please type "DELETE" to confirm permanent deletion:');
        if (confirmation !== 'DELETE') {
            showNotification('Deletion cancelled. Confirmation text did not match.', 'warning');
            return;
        }

        try {
            showNotification(`Deleting student "${studentName}"...`, 'info');

            const response = await fetch(`/api/admin/student/${userId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                showNotification(`Student "${studentName}" deleted permanently!`, 'success');
                await this.loadAllStudents();
                if (window.dashboardManager) {
                    setTimeout(() => {
                        window.dashboardManager.loadStats();
                    }, 500);
                }
            } else {
                throw new Error(result.error || 'Failed to delete student');
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            showNotification(error.message, 'error');
        }
    }

    async loadIDRequests() {
        const tableBody = document.getElementById('idRequestsTable');

        try {
            tableBody.innerHTML = this.getLoadingHTML();

            const response = await fetch('/api/admin/id_requests');

            if (!response.ok) {
                throw new Error('Failed to load ID requests');
            }

            const result = await response.json();

            if (result.success && result.requests) {
                this.renderIDRequests(result.requests);
            } else {
                this.showIDRequestsError('No ID requests found');
            }
        } catch (error) {
            console.error('Error loading ID requests:', error);
            this.showIDRequestsError('Failed to load ID requests');
        }
    }

    renderIDRequests(requests) {
        const tableBody = document.getElementById('idRequestsTable');
        const requestCount = document.getElementById('requestCount');

        if (requestCount) {
            requestCount.textContent = `${requests.length} pending`;
        }

        if (requests.length === 0) {
            tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                    <p>No pending ID requests</p>
                </td>
            </tr>
        `;
            return;
        }

        tableBody.innerHTML = requests.map((request, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <strong>${escapeHtml(request.name)}</strong>
            </td>
            <td>
                <span class="request-type">${this.formatRequestType(request.request_type)}</span>
            </td>
            <td>${escapeHtml(request.department || 'N/A')}</td>
            <td>${escapeHtml(request.roll_number || 'N/A')}</td>
            <td>${request.batch_year || 'N/A'}</td>
            <td>${request.created_at}</td>
            <td>
                <span class="status pending">Pending</span>
            </td>
            <td>
                <div class="action-buttons-simple">
                    <button class="btn-simple btn-view" onclick="window.studentManager.viewRequestDetails(${request.id})">
                        View
                    </button>
                    <button class="btn-simple btn-approve" onclick="window.studentManager.approveIDRequest(${request.id})">
                        Approve
                    </button>
                    <button class="btn-simple btn-reject" onclick="window.studentManager.rejectIDRequest(${request.id})">
                        Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    }

    formatRequestType(type) {
        const types = {
            'new_registration': 'New Registration',
            'id_card': 'ID Card',
            'card_replacement': 'Card Replacement'
        };
        return types[type] || type;
    }

    async viewRequestDetails(requestId) {
        console.log('🔍 Loading details for request ID:', requestId);
        this.currentRequestId = requestId;
        this.openModal();

        const modalBody = document.getElementById('studentModalBody');
        modalBody.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading student information...</p>
        </div>
    `;

        try {
            const response = await fetch(`/api/id-requests/${requestId}`);
            const result = await response.json();

            if (result.success && result.student) {
                this.renderStudentDetails(result.student, true);
            } else {
                throw new Error(result.error || 'Failed to load student data');
            }
        } catch (error) {
            console.error('Error loading student details:', error);
            this.showModalError(error.message);
        }
    }

    async viewStudentDetails(userId) {
        console.log('🔍 Loading details for student ID:', userId);
        this.currentStudentId = userId;
        this.openModal();

        const modalBody = document.getElementById('studentModalBody');
        modalBody.innerHTML = `
    <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading student information...</p>
    </div>
    `;

        try {
            const response = await fetch(`/api/admin/student/${userId}`);
            const result = await response.json();

            if (result.success && result.student) {
                this.renderStudentDetails(result.student, false);
            } else {
                throw new Error(result.error || 'Failed to load student data');
            }
        } catch (error) {
            console.error('Error loading student details:', error);
            this.showModalError(error.message);
        }
    }

    renderStudentDetails(student, isIDRequest = false) {
        const modalBody = document.getElementById('studentModalBody');
        const approveBtn = document.getElementById('modalApproveBtn');
        const rejectBtn = document.getElementById('modalRejectBtn');

        if (approveBtn && rejectBtn) {
            approveBtn.style.display = isIDRequest ? 'inline-flex' : 'none';
            rejectBtn.style.display = isIDRequest ? 'inline-flex' : 'none';
        }

        modalBody.innerHTML = `
            <div class="student-profile-simple">
                <div class="profile-header-simple">
                    <img src="${student.profile_picture ? '/static/' + student.profile_picture : '/static/img/default-avatar.jpg'}" 
                         class="profile-avatar-simple" 
                         onerror="this.src='/static/img/default-avatar.jpg'"
                         alt="Student Photo">
                    <div class="profile-info-simple">
                        <h3>${escapeHtml(student.name)}</h3>
                        <div class="profile-meta-simple">
                            <div class="meta-item">
                                <strong>Email:</strong> ${escapeHtml(student.email || 'N/A')}
                            </div>
                            <div class="meta-item">
                                <strong>Phone:</strong> ${escapeHtml(student.phone || 'N/A')}
                            </div>
                            <div class="meta-item">
                                <strong>Status:</strong> 
                                <span class="status ${student.status === 'approved' ? 'paid' : 'pending'}">
                                    ${student.status === 'approved' ? 'Approved' : 'Pending'}
                                </span>
                            </div>
                            ${isIDRequest ? `
                            <div class="meta-item">
                                <strong>Request Date:</strong> ${student.request_date || 'N/A'}
                            </div>
                            <div class="meta-item">
                                <strong>Request Type:</strong> ${this.formatRequestType(student.request_type || 'new_registration')}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="info-sections-simple">
                    <div class="info-section-simple">
                        <h4>Personal Information</h4>
                        <div class="info-grid-simple">
                            <div class="info-item-simple">
                                <label>Father's Name:</label>
                                <span>${escapeHtml(student.father_name || 'N/A')}</span>
                            </div>
                            <div class="info-item-simple">
                                <label>CNIC:</label>
                                <span>${escapeHtml(student.cnic || 'N/A')}</span>
                            </div>
                            <div class="info-item-simple">
                                <label>Date of Birth:</label>
                                <span>${student.birthdate || 'N/A'}</span>
                            </div>
                            <div class="info-item-simple">
                                <label>Emergency Contact:</label>
                                <span>${escapeHtml(student.emergency_contact || 'N/A')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="info-section-simple">
                        <h4>Academic Information</h4>
                        <div class="info-grid-simple">
                            <div class="info-item-simple">
                                <label>Department:</label>
                                <span>${escapeHtml(student.department || 'N/A')}</span>
                            </div>
                            <div class="info-item-simple">
                                <label>Batch Year:</label>
                                <span>${student.batch_year || 'N/A'}</span>
                            </div>
                            <div class="info-item-simple">
                                <label>Roll Number:</label>
                                <span>${escapeHtml(student.roll_number || 'N/A')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="info-section-simple">
                        <h4>Additional Information</h4>
                        <div class="info-grid-simple">
                            <div class="info-item-simple full-width">
                                <label>Address:</label>
                                <div class="info-value-block">${escapeHtml(student.address || 'N/A')}</div>
                            </div>
                            <div class="info-item-simple full-width">
                                <label>Medical Information:</label>
                                <div class="info-value-block">${escapeHtml(student.medical_info || 'None provided')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const profileImages = document.querySelectorAll('.profile-avatar-simple');
            profileImages.forEach(img => {
                img.style.cursor = 'pointer';
                img.addEventListener('click', function (e) {
                    e.preventDefault();
                    openImageOverlay(this.src);
                });
            });
        }, 100);
    }

    async editStudent(userId) {
        console.log('✏️ Editing student ID:', userId);
        this.currentEditStudentId = userId;
        this.openEditModal();

        const modalBody = document.getElementById('editStudentModalBody');
        modalBody.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading student information for editing...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/admin/student/${userId}`);
            const result = await response.json();

            if (result.success && result.student) {
                this.renderEditForm(result.student);
            } else {
                throw new Error(result.error || 'Failed to load student data');
            }
        } catch (error) {
            console.error('Error loading student for editing:', error);
            this.showEditModalError(error.message);
        }
    }

    renderEditForm(student) {
        const modalBody = document.getElementById('editStudentModalBody');

        const departments = [
            'Computer Science', 'Electrical Engineering', 'Mechanical Engineering',
            'Civil Engineering', 'Business Administration', 'Software Engineering',
            'Information Technology', 'Data Science', 'Artificial Intelligence',
            'Cyber Security', 'Biotechnology', 'Pharmacy', 'Architecture',
            'Economics', 'Mathematics', 'Physics', 'Chemistry',
            'English Literature', 'Psychology', 'Other'
        ];

        const departmentOptions = departments.map(dept =>
            `<option value="${dept}" ${student.department === dept ? 'selected' : ''}>${dept}</option>`
        ).join('');

        modalBody.innerHTML = `
        <div class="edit-student-form">
            <div class="form-section">
                <h4><i class="fas fa-user"></i> Basic Information</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="editName">Full Name *</label>
                        <input type="text" id="editName" value="${escapeHtml(student.name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmail">Email *</label>
                        <input type="email" id="editEmail" value="${escapeHtml(student.email || '')}" required>
                    </div>
                    <div class="form-group">
                        <label for="editPhone">Phone</label>
                        <input type="text" id="editPhone" value="${escapeHtml(student.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label for="editPassword">New Password (leave blank to keep current)</label>
                        <input type="password" id="editPassword" placeholder="Enter new password">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-graduation-cap"></i> Academic Information</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="editDepartment">Department</label>
                        <select id="editDepartment" class="form-select">
                            <option value="">Select Department</option>
                            ${departmentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editBatchYear">Batch Year</label>
                        <input type="number" id="editBatchYear" value="${student.batch_year || ''}" min="2000" max="2030">
                    </div>
                    <div class="form-group">
                        <label for="editRollNumber">Roll Number</label>
                        <input type="text" id="editRollNumber" value="${escapeHtml(student.roll_number || '')}">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-address-book"></i> Personal Information</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="editFatherName">Father's Name</label>
                        <input type="text" id="editFatherName" value="${escapeHtml(student.father_name || '')}">
                    </div>
                    <div class="form-group">
                        <label for="editCNIC">CNIC</label>
                        <input type="text" id="editCNIC" value="${escapeHtml(student.cnic || '')}" placeholder="XXXXX-XXXXXXX-X">
                    </div>
                    <div class="form-group">
                        <label for="editBirthdate">Date of Birth</label>
                        <input type="date" id="editBirthdate" value="${student.birthdate || ''}">
                    </div>
                    <div class="form-group full-width">
                        <label for="editAddress">Address</label>
                        <textarea id="editAddress" rows="3">${escapeHtml(student.address || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="editEmergencyContact">Emergency Contact</label>
                        <input type="text" id="editEmergencyContact" value="${escapeHtml(student.emergency_contact || '')}">
                    </div>
                    <div class="form-group full-width">
                        <label for="editMedicalInfo">Medical Information</label>
                        <textarea id="editMedicalInfo" rows="2" placeholder="Any medical conditions or allergies...">${escapeHtml(student.medical_info || '')}</textarea>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-user-check"></i> Account Status</h4>
                <div class="form-group">
                    <label for="editStatus">Status</label>
                    <select id="editStatus">
                        <option value="pending" ${student.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${student.status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="rejected" ${student.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    }

    async saveStudentChanges() {
        const saveBtn = document.getElementById('saveStudentBtn');
        const originalText = saveBtn.innerHTML;

        try {
            const studentId = this.currentEditStudentId;
            if (!studentId) {
                throw new Error('No student selected for editing');
            }

            const formData = {
                name: document.getElementById('editName').value.trim(),
                email: document.getElementById('editEmail').value.trim(),
                phone: document.getElementById('editPhone').value.trim(),
                password: document.getElementById('editPassword').value,
                department: document.getElementById('editDepartment').value.trim(),
                batch_year: document.getElementById('editBatchYear').value,
                roll_number: document.getElementById('editRollNumber').value.trim(),
                father_name: document.getElementById('editFatherName').value.trim(),
                cnic: document.getElementById('editCNIC').value.trim(),
                birthdate: document.getElementById('editBirthdate').value,
                address: document.getElementById('editAddress').value.trim(),
                emergency_contact: document.getElementById('editEmergencyContact').value.trim(),
                medical_info: document.getElementById('editMedicalInfo').value.trim(),
                status: document.getElementById('editStatus').value
            };

            if (!formData.name || !formData.email) {
                throw new Error('Name and email are required fields');
            }

            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            const response = await fetch(`/api/admin/student/${studentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Student details updated successfully!', 'success');
                this.closeEditModal();
                this.loadData();
            } else {
                throw new Error(result.error || 'Failed to update student');
            }

        } catch (error) {
            console.error('Error saving student changes:', error);
            showNotification(error.message, 'error');
        } finally {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            saveBtn.disabled = false;
        }
    }

    async approveIDRequest(requestId) {
        if (!confirm('Are you sure you want to approve this ID request?')) {
            return;
        }

        try {
            const response = await fetch(`/api/id-requests/${requestId}/approve`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                showNotification('ID request approved successfully!', 'success');
                this.loadData();
                this.closeModal();

                if (window.dashboardManager) {
                    window.dashboardManager.loadStats();
                }
            } else {
                throw new Error(result.error || 'Approval failed');
            }
        } catch (error) {
            console.error('Error approving request:', error);
            showNotification(error.message, 'error');
        }
    }

    async rejectIDRequest(requestId) {
        if (!confirm('Are you sure you want to reject this ID request?')) {
            return;
        }

        try {
            const response = await fetch(`/api/id-requests/${requestId}/reject`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                showNotification('ID request rejected successfully!', 'success');
                this.loadData();
                this.closeModal();

                if (window.dashboardManager) {
                    window.dashboardManager.loadStats();
                }
            } else {
                throw new Error(result.error || 'Rejection failed');
            }
        } catch (error) {
            console.error('Error rejecting request:', error);
            showNotification(error.message, 'error');
        }
    }

    // Modal methods
    openModal() {
        document.getElementById('studentModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('studentModalOverlay').classList.remove('active');
        document.body.style.overflow = '';
        this.currentStudentId = null;
        this.currentRequestId = null;
    }

    openEditModal() {
        document.getElementById('editStudentModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeEditModal() {
        document.getElementById('editStudentModalOverlay').classList.remove('active');
        document.body.style.overflow = '';
        this.currentEditStudentId = null;
    }

    // Error and loading states
    showModalError(message) {
        const modalBody = document.getElementById('studentModalBody');
        modalBody.innerHTML = `
            <div class="error-state-simple">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Unable to Load Student</h4>
                <p>${message}</p>
                <button class="btn-retry-simple" onclick="window.studentManager.viewStudentDetails(${this.currentStudentId})">
                    Try Again
                </button>
            </div>
        `;
    }

    showEditModalError(message) {
        const modalBody = document.getElementById('editStudentModalBody');
        modalBody.innerHTML = `
            <div class="error-state-simple">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Unable to Load Student for Editing</h4>
                <p>${message}</p>
                <button class="btn-retry-simple" onclick="window.studentManager.editStudent(${this.currentEditStudentId})">
                    Try Again
                </button>
            </div>
        `;
    }

    showAllStudentsError(message) {
        const tableBody = document.getElementById('allStudentsTable');
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }

    showIDRequestsError(message) {
        const tableBody = document.getElementById('idRequestsTable');
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }

    getLoadingHTML() {
        return `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

window.StudentManager = StudentManager;