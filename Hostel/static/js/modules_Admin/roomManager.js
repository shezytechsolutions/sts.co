// ============================================
// ROOMMANAGER.JS - Accommodation Management
// ============================================

class RoomManager {
    constructor() {
        this.currentRoomFilter = 'all';
        this.currentAllotmentFilter = 'all';
        this.currentManagementType = 'rooms';
        this.currentRoomId = null;
        this.isEditing = false;
        this.allRooms = [];
        this.allStudents = [];
        this.allotments = [];
        this.roomStats = {
            total: 0,
            occupied: 0,
            available: 0,
            maintenance: 0
        };
        this.currentStudentId = null;
        this.changeMode = false;
        this.currentChangeAllotment = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateButtonVisibility();
        this.loadRooms();
        this.loadAllotmentData();
    }

    setupEventListeners() {
        const managementTypeSelect = document.getElementById('managementType');
        if (managementTypeSelect) {
            managementTypeSelect.addEventListener('change', () => this.handleManagementTypeChange());
        }

        const roomFilterSelect = document.getElementById('roomManagementFilter');
        if (roomFilterSelect) {
            roomFilterSelect.addEventListener('change', () => this.handleRoomFilterChange());
        }

        const allotmentFilterSelect = document.getElementById('allotmentFilter');
        if (allotmentFilterSelect) {
            allotmentFilterSelect.addEventListener('change', () => this.handleAllotmentFilterChange());
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.header-actions') && e.target.closest('.fa-sync-alt')) {
                e.preventDefault();
                e.stopPropagation();
                this.handleRefresh();
                return;
            }

            if (e.target.id === 'printAllotmentsBtn' || e.target.closest('#printAllotmentsBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.openPrintModal();
                return;
            }

            if (e.target.id === 'createRoomBtn' || e.target.closest('#createRoomBtn')) {
                e.preventDefault();
                this.openCreateRoomModal();
                return;
            }
        });
    }

    updateButtonVisibility() {
        const createRoomBtn = document.getElementById('createRoomBtn');
        const printAllotmentsBtn = document.getElementById('printAllotmentsBtn');
        const roomFilter = document.getElementById('roomManagementFilter');
        const allotmentFilter = document.getElementById('allotmentFilter');

        if (this.currentManagementType === 'rooms') {
            if (createRoomBtn) createRoomBtn.style.display = 'inline-block';
            if (printAllotmentsBtn) printAllotmentsBtn.style.display = 'none';
            if (roomFilter) roomFilter.style.display = 'inline-block';
            if (allotmentFilter) allotmentFilter.style.display = 'none';
        } else {
            if (createRoomBtn) createRoomBtn.style.display = 'none';
            if (printAllotmentsBtn) printAllotmentsBtn.style.display = 'inline-block';
            if (roomFilter) roomFilter.style.display = 'none';
            if (allotmentFilter) allotmentFilter.style.display = 'inline-block';
        }
    }

    handleManagementTypeChange() {
        const managementTypeSelect = document.getElementById('managementType');
        if (managementTypeSelect) {
            this.currentManagementType = managementTypeSelect.value;
            this.updateButtonVisibility();
            this.updateManagementView();
        }
    }

    updateManagementView() {
        const roomContent = document.getElementById('roomManagementContent');
        const allotmentContent = document.getElementById('allotmentManagementContent');

        if (this.currentManagementType === 'rooms') {
            if (roomContent) roomContent.style.display = 'block';
            if (allotmentContent) allotmentContent.style.display = 'none';
            this.loadRooms();
        } else {
            if (roomContent) roomContent.style.display = 'none';
            if (allotmentContent) allotmentContent.style.display = 'block';
            this.loadAllotmentData();
        }
    }

    handleRoomFilterChange() {
        const filterSelect = document.getElementById('roomManagementFilter');
        if (filterSelect) {
            this.currentRoomFilter = filterSelect.value;
            this.renderRooms(this.allRooms);
        }
    }

    handleAllotmentFilterChange() {
        const filterSelect = document.getElementById('allotmentFilter');
        if (filterSelect) {
            this.currentAllotmentFilter = filterSelect.value;
            this.renderAllotmentTable(this.allStudents);
        }
    }

    async loadRooms() {
        const tableBody = document.getElementById('roomsTable');
        if (!tableBody) return;

        try {
            tableBody.innerHTML = this.getLoadingHTML();
            const response = await fetch('/api/admin/rooms');
            const result = await response.json();

            if (result.success && result.rooms) {
                this.allRooms = result.rooms;
                this.renderRooms(this.allRooms);
                this.updateStatistics(this.allRooms);
            } else {
                this.showRoomsError('No rooms found');
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            this.showRoomsError('Failed to load rooms');
        }
    }

    renderRooms(rooms) {
        const tableBody = document.getElementById('roomsTable');
        if (!tableBody) return;

        const filteredRooms = this.filterRooms(rooms);

        if (filteredRooms.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="empty-state">
                            <i class="fas fa-door-closed"></i>
                            <h4>No Rooms Found</h4>
                            <p>Try changing the filter criteria or create a new room</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredRooms.map((room) => `
            <tr>
                <td>
                    <strong>${escapeHtml(room.room_number)}</strong>
                </td>
                <td>
                    <span class="room-type-badge ${room.room_type}">${this.formatRoomType(room.room_type)}</span>
                </td>
                <td>Floor ${room.floor}</td>
                <td>${room.beds_count} beds</td>
                <td>${room.available_beds} available</td>
                <td>
                    <span class="status ${this.getStatusClass(room.status)}">${this.formatStatus(room.status)}</span>
                </td>
                <td>
                    <div class="action-buttons-simple">
                        <button class="btn-simple btn-delete" onclick="window.roomManager.deleteRoom(${room.id}, '${escapeHtml(room.room_number)}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    openCreateRoomModal() {
        console.log('🚀 Opening create room modal');
        this.isEditing = false;
        this.currentRoomId = null;

        const roomNumber = document.getElementById('roomNumber');
        const roomType = document.getElementById('roomType');
        const roomFloor = document.getElementById('roomFloor');
        const bedsCount = document.getElementById('bedsCount');
        const roomStatus = document.getElementById('roomStatus');
        const roomAmenities = document.getElementById('roomAmenities');
        const modalTitle = document.getElementById('roomModalTitle');

        if (roomNumber) roomNumber.value = '';
        if (roomType) roomType.value = '';
        if (roomFloor) roomFloor.value = '';
        if (bedsCount) bedsCount.value = '';
        if (roomStatus) roomStatus.value = 'available';
        if (roomAmenities) roomAmenities.value = '';
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Create New Room';

        this.openRoomModal();
    }

    openRoomModal() {
        const modal = document.getElementById('roomModalOverlay');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeRoomModal() {
        const modal = document.getElementById('roomModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.currentRoomId = null;
        this.isEditing = false;
    }

    async saveRoom() {
        const saveBtn = document.getElementById('saveRoomBtn');
        if (!saveBtn || saveBtn.disabled) return;

        try {
            const roomNumber = document.getElementById('roomNumber').value.trim();
            const roomType = document.getElementById('roomType').value;
            const roomFloor = document.getElementById('roomFloor').value;
            const bedsCount = document.getElementById('bedsCount').value;
            const roomStatus = document.getElementById('roomStatus').value;
            const roomAmenities = document.getElementById('roomAmenities').value.trim();

            if (!roomNumber || !roomType || !roomFloor || !bedsCount || !roomStatus) {
                throw new Error('Please fill all required fields');
            }

            const formData = {
                room_number: roomNumber,
                room_type: roomType,
                floor: parseInt(roomFloor),
                beds_count: parseInt(bedsCount),
                status: roomStatus,
                amenities: roomAmenities
            };

            if (formData.beds_count < 1 || formData.beds_count > 10) {
                throw new Error('Number of beds must be between 1 and 10');
            }

            if (formData.floor < 0 || formData.floor > 20) {
                throw new Error('Floor must be between 0 and 20');
            }

            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Room...';
            saveBtn.disabled = true;

            await new Promise(resolve => setTimeout(resolve, 300));

            const response = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message || 'Room created successfully!', 'success');
                this.closeRoomModal();
                setTimeout(() => this.loadRooms(), 800);
            } else {
                throw new Error(result.error || 'Failed to create room');
            }
        } catch (error) {
            console.error('❌ Error saving room:', error);
            showNotification(error.message, 'error');
        } finally {
            setTimeout(() => {
                const saveBtn = document.getElementById('saveRoomBtn');
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Room';
                    saveBtn.disabled = false;
                }
            }, 1000);
        }
    }

    async deleteRoom(roomId, roomNumber) {
        if (!confirm(`Are you sure you want to permanently delete room ${roomNumber}? This will remove the room and any related allocations.`)) {
            return;
        }

        try {
            showNotification(`Deleting room ${roomNumber}...`, 'info');

            const response = await fetch(`/api/admin/rooms/${roomId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                showNotification(`Room ${roomNumber} deleted permanently!`, 'success');
                this.loadRooms();
                this.loadAllotmentData();
            } else {
                throw new Error(result.error || 'Failed to delete room');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            showNotification(error.message, 'error');
        }
    }

    async loadAllotmentData() {
        const tableBody = document.getElementById('allotmentTable');
        if (!tableBody) return;

        try {
            tableBody.innerHTML = this.getLoadingHTML();

            const [studentsResponse, allotmentsResponse] = await Promise.all([
                fetch('/api/admin/approved_students'),
                fetch('/api/admin/allotments')
            ]);

            const studentsResult = await studentsResponse.json();
            const allotmentsResult = await allotmentsResponse.json();

            if (studentsResult.success && studentsResult.students) {
                this.allStudents = studentsResult.students;
                this.allotments = (allotmentsResult.success && allotmentsResult.allotments) ? allotmentsResult.allotments : [];
                this.renderAllotmentTable(this.allStudents);
            } else {
                this.showAllotmentError('No students found');
            }
        } catch (error) {
            console.error('Error loading allotment data:', error);
            this.showAllotmentError('Failed to load allotment data');
        }
    }

    renderAllotmentTable(students) {
        const tableBody = document.getElementById('allotmentTable');
        if (!tableBody) return;

        const filteredStudents = this.filterAllotments(students);

        if (filteredStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h4>No Students Found</h4>
                            <p>Try changing the filter criteria</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredStudents.map(student => {
            const allotment = this.allotments.find(a => a.student_id === student.user_id && a.status === 'active');
            const isAllotted = !!allotment;
            const roomNumber = isAllotted ? allotment.room_number : 'N/A';
            const bedNumber = isAllotted ? allotment.bed_number : 'N/A';

            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(student.name)}</strong>
                    </td>
                    <td>${escapeHtml(student.roll_number || 'N/A')}</td>
                    <td>${escapeHtml(student.department || 'N/A')}</td>
                    <td>${student.batch_year || 'N/A'}</td>
                    <td>
                        <span class="allotment-status ${isAllotted ? 'allotted' : 'unallotted'}">
                            ${isAllotted ? 'Allotted' : 'Unallotted'}
                        </span>
                    </td>
                    <td>${roomNumber}</td>
                    <td>${bedNumber}</td>
                    <td>
                        <div class="action-buttons-simple">
                            ${isAllotted ? `
                                <button class="btn-simple btn-unallot" onclick="window.roomManager.unallotStudent(${student.user_id}, '${escapeHtml(student.name)}')">
                                    <i class="fas fa-sign-out-alt"></i> Unallot
                                </button>
                                <button class="btn-simple btn-change" onclick="window.roomManager.changeRoom(${student.user_id}, '${escapeHtml(student.name)}')">
                                    <i class="fas fa-exchange-alt"></i> Change
                                </button>
                            ` : `
                                <button class="btn-simple btn-allot" onclick="window.roomManager.allotStudent(${student.user_id})">
                                    <i class="fas fa-bed"></i> Allot
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async allotStudent(studentId) {
        try {
            const response = await fetch('/api/admin/available_rooms');
            const result = await response.json();

            if (result.success && result.rooms.length > 0) {
                this.openAllotmentModal(studentId, result.rooms, false, null);
            } else {
                showNotification('No available rooms found', 'error');
            }
        } catch (error) {
            console.error('Error loading available rooms:', error);
            showNotification('Failed to load available rooms', 'error');
        }
    }

    async changeRoom(studentId, studentName) {
        try {
            const allotResp = await fetch('/api/admin/allotments');
            const allotRes = await allotResp.json();
            const currentAllot = (allotRes.success && allotRes.allotments) ? allotRes.allotments.find(a => a.student_id === studentId) : null;

            const response = await fetch('/api/admin/available_rooms');
            const result = await response.json();

            if (result.success) {
                let availableRooms = result.rooms || [];
                if (currentAllot) {
                    availableRooms = availableRooms.filter(r => r.id !== currentAllot.room_id);
                }

                if (availableRooms.length > 0) {
                    this.openAllotmentModal(studentId, availableRooms, true, currentAllot);
                } else {
                    showNotification('No other available rooms found to change to', 'error');
                }
            } else {
                showNotification('No available rooms found', 'error');
            }
        } catch (error) {
            console.error('Error initiating change room:', error);
            showNotification('Failed to load data for change', 'error');
        }
    }

    openAllotmentModal(studentId, rooms, isChange = false, currentAllotment = null) {
        const student = this.allStudents.find(s => s.user_id === studentId);
        if (!student) {
            showNotification('Student not found', 'error');
            return;
        }

        const modalContent = document.getElementById('allotmentModalContent');
        modalContent.innerHTML = `
            <div class="allotment-form" style="padding: 20px;">
                <div class="student-info" style="background: var(--bg); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--brand);">Student Information</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Name:</strong> ${escapeHtml(student.name)}</div>
                        <div><strong>Roll No:</strong> ${escapeHtml(student.roll_number || 'N/A')}</div>
                        <div><strong>Department:</strong> ${escapeHtml(student.department || 'N/A')}</div>
                        <div><strong>Batch:</strong> ${student.batch_year || 'N/A'}</div>
                    </div>
                </div>

                <div class="room-selection">
                    <h4 style="margin: 0 0 15px 0; color: var(--brand);">Select Room & Bed</h4>
                    <div class="form-group">
                        <label for="selectedRoom">Available Rooms *</label>
                        <select id="selectedRoom" class="form-select" onchange="window.roomManager.loadRoomBeds(this.value)">
                            <option value="">Select a room</option>
                            ${rooms.map(room => `
                                <option value="${room.id}">
                                    ${room.room_number} - ${this.formatRoomType(room.room_type)} (${room.available_beds} beds available)
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="selectedBed">Available Beds *</label>
                        <select id="selectedBed" class="form-select" disabled>
                            <option value="">Select a room first</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        this.currentStudentId = studentId;
        this.changeMode = !!isChange;
        this.currentChangeAllotment = currentAllotment;

        const confirmBtn = document.getElementById('confirmAllotmentBtn');
        if (confirmBtn) confirmBtn.style.display = 'inline-flex';

        this.openAllotmentModalOverlay();
    }

    async loadRoomBeds(roomId) {
        const bedSelect = document.getElementById('selectedBed');
        if (!bedSelect) return;

        if (!roomId) {
            bedSelect.innerHTML = '<option value="">Select a room first</option>';
            bedSelect.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/admin/rooms/${roomId}/beds`);
            const result = await response.json();

            if (result.success && result.beds) {
                const availableBeds = result.beds.filter(bed => bed.status === 'available');
                if (availableBeds.length > 0) {
                    bedSelect.innerHTML = availableBeds.map(bed => `<option value="${bed.id}">${bed.bed_number}</option>`).join('');
                    bedSelect.disabled = false;
                } else {
                    bedSelect.innerHTML = '<option value="">No available beds</option>';
                    bedSelect.disabled = true;
                }
            } else {
                bedSelect.innerHTML = '<option value="">No beds found</option>';
                bedSelect.disabled = true;
            }
        } catch (error) {
            console.error('Error loading room beds:', error);
            bedSelect.innerHTML = '<option value="">Error loading beds</option>';
            bedSelect.disabled = true;
        }
    }

    async handleRefresh() {
        console.log('🔄 Refreshing accommodation data...');

        if (this.currentManagementType === 'rooms') {
            await this.loadRooms();
            showNotification('Rooms data refreshed successfully!', 'success');
        } else {
            await this.loadAllotmentData();
            showNotification('Allotment data refreshed successfully!', 'success');
        }
    }

    openPrintModal() {
        console.log('🖨️ Opening print modal for allotments');

        if (this.currentManagementType !== 'allotments') {
            showNotification('Please switch to allotment management to print', 'warning');
            return;
        }

        if (this.allStudents.length === 0) {
            showNotification('No student data available to print. Loading data...', 'info');
            this.loadAllotmentData().then(() => {
                if (this.allStudents.length > 0) {
                    if (window.allotmentPrintManager) {
                        window.allotmentPrintManager.openModal();
                    } else {
                        window.allotmentPrintManager = new AllotmentPrintManager();
                        window.allotmentPrintManager.openModal();
                    }
                } else {
                    showNotification('No student data available to print', 'warning');
                }
            });
            return;
        }

        if (window.allotmentPrintManager) {
            window.allotmentPrintManager.openModal();
        } else {
            window.allotmentPrintManager = new AllotmentPrintManager();
            window.allotmentPrintManager.openModal();
        }
    }

    async confirmAllotment() {
        const roomSelect = document.getElementById('selectedRoom');
        const bedSelect = document.getElementById('selectedBed');
        const studentId = this.currentStudentId;

        if (!roomSelect || !bedSelect) {
            showNotification('Modal form elements missing', 'error');
            return;
        }

        if (!roomSelect.value || !bedSelect.value) {
            showNotification('Please select both room and bed', 'error');
            return;
        }

        try {
            const payload = {
                student_id: studentId,
                room_id: parseInt(roomSelect.value),
                bed_id: parseInt(bedSelect.value)
            };

            if (this.changeMode) {
                payload.force_change = true;
            }

            const response = await fetch('/api/admin/allotments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message || 'Operation successful', 'success');
                this.closeAllotmentModal();
                setTimeout(() => {
                    this.loadAllotmentData();
                    this.loadRooms();
                }, 600);
            } else {
                throw new Error(result.error || 'Failed to allot/change');
            }
        } catch (error) {
            console.error('Error confirming allotment:', error);
            showNotification(error.message, 'error');
        } finally {
            this.changeMode = false;
            this.currentChangeAllotment = null;
            this.currentStudentId = null;
        }
    }

    async unallotStudent(studentId, studentName) {
        if (!confirm(`Are you sure you want to unallot ${studentName}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/allotments/${studentId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                showNotification(`${studentName} has been unallotted successfully`, 'success');
                this.loadAllotmentData();
                this.loadRooms();
            } else {
                throw new Error(result.error || 'Failed to unallot student');
            }
        } catch (error) {
            console.error('Error unallotting student:', error);
            showNotification(error.message, 'error');
        }
    }

    openAllotmentModalOverlay() {
        const modal = document.getElementById('allotmentModalOverlay');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeAllotmentModal() {
        const modal = document.getElementById('allotmentModalOverlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.currentStudentId = null;
        this.changeMode = false;
        this.currentChangeAllotment = null;

        const confirmBtn = document.getElementById('confirmAllotmentBtn');
        if (confirmBtn) confirmBtn.style.display = 'none';
    }

    filterRooms(rooms) {
        if (this.currentRoomFilter === 'all') return rooms;
        return rooms.filter(room => room.status === this.currentRoomFilter);
    }

    filterAllotments(students) {
        if (this.currentAllotmentFilter === 'all') return students;
        return students.filter(student => {
            const isAllotted = this.allotments.some(a => a.student_id === student.user_id && a.status === 'active');
            return this.currentAllotmentFilter === 'allotted' ? isAllotted : !isAllotted;
        });
    }

    updateStatistics(rooms) {
        this.roomStats.total = rooms.length;
        this.roomStats.occupied = rooms.filter(room => room.status === 'occupied').length;
        this.roomStats.available = rooms.filter(room => room.status === 'available').length;
        this.roomStats.maintenance = rooms.filter(room => room.status === 'maintenance').length;

        const totalRoomsEl = document.getElementById('totalRooms');
        const occupiedRoomsEl = document.getElementById('occupiedRooms');
        const availableRoomsEl = document.getElementById('availableRooms');
        const maintenanceRoomsEl = document.getElementById('maintenanceRooms');

        if (totalRoomsEl) totalRoomsEl.textContent = this.roomStats.total;
        if (occupiedRoomsEl) occupiedRoomsEl.textContent = this.roomStats.occupied;
        if (availableRoomsEl) availableRoomsEl.textContent = this.roomStats.available;
        if (maintenanceRoomsEl) maintenanceRoomsEl.textContent = this.roomStats.maintenance;
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

    showRoomsError(message) {
        const tableBody = document.getElementById('roomsTable');
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

    showAllotmentError(message) {
        const tableBody = document.getElementById('allotmentTable');
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }

    formatRoomType(type) {
        const types = { 'single': 'Single', 'double': 'Double', 'triple': 'Triple', 'quad': 'Quad' };
        return types[type] || type;
    }

    formatStatus(status) {
        const statusMap = { 'available': 'Available', 'occupied': 'Occupied', 'maintenance': 'Maintenance' };
        return statusMap[status] || status;
    }

    getStatusClass(status) {
        const classMap = { 'available': 'paid', 'occupied': 'pending', 'maintenance': 'partial' };
        return classMap[status] || 'pending';
    }

    showRoomManagement(filter = 'all') {
        const managementType = document.getElementById('managementType');
        if (managementType) {
            managementType.value = 'rooms';
            this.handleManagementTypeChange();
        }

        const roomFilter = document.getElementById('roomManagementFilter');
        if (roomFilter && filter !== 'all') {
            roomFilter.value = filter;
            this.handleRoomFilterChange();
        }

        const roomsLink = document.querySelector('[data-target="rooms-management"]');
        if (roomsLink) {
            document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
            roomsLink.classList.add('active');
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById('rooms-management').classList.add('visible');
            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }
}

window.RoomManager = RoomManager;