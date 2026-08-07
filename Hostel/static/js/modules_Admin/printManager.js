// ============================================
// PRINTMANAGER.JS - Print Management
// ============================================

class PrintManager {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedBatch = 'all';
        this.listType = 'simple_list';
        this.selectedFields = ['name', 'roll_number', 'department'];
        this.allFields = [
            { id: 'name', label: 'Full Name', default: true },
            { id: 'roll_number', label: 'Roll Number', default: true },
            { id: 'department', label: 'Department', default: true },
            { id: 'batch_year', label: 'Batch Year', default: false },
            { id: 'email', label: 'Email', default: false },
            { id: 'phone', label: 'Phone', default: false },
            { id: 'father_name', label: "Father's Name", default: false },
            { id: 'cnic', label: 'CNIC', default: false },
            { id: 'address', label: 'Address', default: false },
            { id: 'emergency_contact', label: 'Emergency Contact', default: false },
            { id: 'medical_info', label: 'Medical Information', default: false },
            { id: 'status', label: 'Status', default: false }
        ];
        this.lastNotificationTime = 0;
        this.notificationCooldown = 5000;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBatches();
        this.populateDetailsGrid();
        this.showStep(1);
    }

    setupEventListeners() {
        document.getElementById('nextStepBtn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('prevStepBtn')?.addEventListener('click', () => this.previousStep());
        document.getElementById('cancelPrintBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('printBatch')?.addEventListener('change', (e) => this.handleBatchChange(e.target.value));
        
        document.querySelectorAll('input[name="listType"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleListTypeChange(e.target.value));
        });

        document.getElementById('selectAllBtn')?.addEventListener('click', () => this.selectAllDetails());
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => this.deselectAllDetails());
        document.getElementById('finalPrintBtn')?.addEventListener('click', () => this.executePrint());
        document.getElementById('previewBtn')?.addEventListener('click', () => this.showPreview());
        document.getElementById('printFromPreviewBtn')?.addEventListener('click', () => this.printFromPreview());
        document.getElementById('closePreviewBtn')?.addEventListener('click', () => this.closePreview());
        document.getElementById('printModalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('previewModalClose')?.addEventListener('click', () => this.closePreview());
    }

    showStep(step) {
        for (let i = 1; i <= this.totalSteps; i++) {
            document.getElementById(`step${i}`)?.classList.remove('active');
        }
        document.getElementById(`step${step}`)?.classList.add('active');
        this.updateNavigation(step);
        if (step === 4) {
            this.updatePreview();
        }
    }

    updateNavigation(step) {
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        const finalBtn = document.getElementById('finalPrintBtn');
        const cancelBtn = document.getElementById('cancelPrintBtn');

        if (step === 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'inline-flex';
            finalBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel';
        } else if (step === this.totalSteps) {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'none';
            finalBtn.style.display = 'inline-flex';
            cancelBtn.textContent = 'Back to Start';
        } else {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'inline-flex';
            finalBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel';
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            if (this.validateStep(this.currentStep)) {
                this.currentStep++;
                this.showStep(this.currentStep);
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        } else {
            this.closeModal();
        }
    }

    validateStep(step) {
        switch (step) {
            case 3:
                if (this.listType === 'custom_details' && this.selectedFields.length === 0) {
                    this.showValidationError('Please select at least one field to print');
                    return false;
                }
                this.hideValidationError();
                return true;
            default:
                return true;
        }
    }

    showValidationError(message) {
        const validationEl = document.getElementById('validationMessage');
        if (validationEl) {
            validationEl.style.display = 'flex';
            validationEl.querySelector('span').textContent = message;
        }
    }

    hideValidationError() {
        const validationEl = document.getElementById('validationMessage');
        if (validationEl) {
            validationEl.style.display = 'none';
        }
    }

    loadBatches() {
        const batchSelect = document.getElementById('printBatch');
        if (!batchSelect) return;

        let students = [];

        if (window.roomManager && window.roomManager.currentManagementType === 'allotments') {
            students = window.roomManager.allStudents || [];
        } else {
            students = window.studentManager?.allStudents || [];
        }

        const batches = [...new Set(students
            .map(student => student.batch_year)
            .filter(year => year != null)
            .sort((a, b) => b - a)
        )];

        batchSelect.innerHTML = '<option value="all">All Students</option>';
        batches.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `Batch ${year}`;
            batchSelect.appendChild(option);
        });

        this.updateBatchStats();
    }

    handleBatchChange(batch) {
        this.selectedBatch = batch;
        this.updateBatchStats();
    }

    updateBatchStats() {
        const statsEl = document.getElementById('batchStats');
        const studentsCountEl = document.getElementById('studentsCount');
        const batchYearEl = document.getElementById('batchYear');

        let students = [];

        if (window.roomManager && window.roomManager.currentManagementType === 'allotments') {
            students = window.roomManager.allStudents || [];
        } else {
            students = window.studentManager?.allStudents || [];
        }

        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        if (statsEl) {
            statsEl.style.display = 'flex';
            studentsCountEl.textContent = `${filteredStudents.length} students`;
            batchYearEl.textContent = this.selectedBatch === 'all' ? 'All Batches' : `Batch ${this.selectedBatch}`;
        }
    }

    handleListTypeChange(type) {
        this.listType = type;

        switch (type) {
            case 'all_details':
                this.selectedFields = this.allFields.map(field => field.id);
                break;
            case 'simple_list':
                this.selectedFields = ['name', 'roll_number', 'department'];
                break;
            case 'custom_details':
                break;
        }

        this.updateDetailsGrid();

        const step3 = document.getElementById('step3');
        if (step3) {
            step3.style.display = type === 'custom_details' ? 'block' : 'none';
        }
    }

    populateDetailsGrid() {
        const grid = document.getElementById('detailsGrid');
        if (!grid) return;

        grid.innerHTML = this.allFields.map(field => `
            <div class="detail-checkbox ${this.selectedFields.includes(field.id) ? 'checked' : ''}" 
                 data-field="${field.id}">
                <input type="checkbox" id="field_${field.id}" 
                       ${this.selectedFields.includes(field.id) ? 'checked' : ''}>
                <div class="checkmark"></div>
                <span class="detail-label">${field.label}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.detail-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleDetail(checkbox.dataset.field);
            });
        });
    }

    toggleDetail(fieldId) {
        const index = this.selectedFields.indexOf(fieldId);
        if (index > -1) {
            this.selectedFields.splice(index, 1);
        } else {
            this.selectedFields.push(fieldId);
        }
        this.updateDetailsGrid();
        this.hideValidationError();
    }

    updateDetailsGrid() {
        const checkboxes = document.querySelectorAll('.detail-checkbox');
        checkboxes.forEach(checkbox => {
            const fieldId = checkbox.dataset.field;
            if (this.selectedFields.includes(fieldId)) {
                checkbox.classList.add('checked');
                checkbox.querySelector('input').checked = true;
            } else {
                checkbox.classList.remove('checked');
                checkbox.querySelector('input').checked = false;
            }
        });
    }

    selectAllDetails() {
        this.selectedFields = this.allFields.map(field => field.id);
        this.updateDetailsGrid();
        this.hideValidationError();
    }

    deselectAllDetails() {
        this.selectedFields = [];
        this.updateDetailsGrid();
        this.showValidationError('Please select at least one field to print');
    }

    updatePreview() {
        let students = [];

        if (window.roomManager && window.roomManager.currentManagementType === 'allotments') {
            students = window.roomManager.allStudents || [];
        } else {
            students = window.studentManager?.allStudents || [];
        }

        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        document.getElementById('previewBatch').textContent =
            this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`;

        document.getElementById('previewType').textContent =
            this.listType === 'all_details' ? 'All Details' :
                this.listType === 'custom_details' ? 'Custom Details' : 'Simple List';

        document.getElementById('previewStudents').textContent =
            `${filteredStudents.length} students`;

        const selectedFieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });
        document.getElementById('previewFields').textContent =
            selectedFieldLabels.join(', ') || 'No fields selected';
    }

    showPreview() {
        this.generatePreviewContent();
        document.getElementById('previewModalOverlay').classList.add('active');
    }

    closePreview() {
        document.getElementById('previewModalOverlay').classList.remove('active');
    }

    generatePreviewContent() {
        const previewContent = document.getElementById('printPreviewContent');
        if (!previewContent) return;

        let students = [];

        if (window.roomManager && window.roomManager.currentManagementType === 'allotments') {
            students = window.roomManager.allStudents || [];
        } else {
            students = window.studentManager?.allStudents || [];
        }

        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        const fieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });

        const tableHeaders = fieldLabels.map(label => `<th>${label}</th>`).join('');

        const tableRows = filteredStudents.map(student => `
        <tr>
            ${this.selectedFields.map(fieldId => {
            let value = student[fieldId] || 'N/A';
            if (fieldId === 'status') {
                value = value === 'approved' ? 'Approved' :
                    value === 'pending' ? 'Pending' : value;
            }
            return `<td>${escapeHtml(value.toString())}</td>`;
        }).join('')}
        </tr>
    `).join('');

        previewContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2F3A8F; margin-bottom: 10px;">Student List</h2>
            <p style="color: #666; margin-bottom: 5px;">
                ${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}
            </p>
            <p style="color: #666; font-size: 14px;">
                Generated on ${new Date().toLocaleDateString()} | 
                ${filteredStudents.length} students
            </p>
        </div>
        <table class="preview-table">
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    `;
    }

    executePrint() {
        if (!this.validateStep(3)) {
            this.showNotification('Please fix the validation errors before printing', 'error');
            return;
        }

        const now = Date.now();
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            return;
        }

        this.lastNotificationTime = now;

        if (this.listType === 'custom_details' && this.selectedFields.length === 0) {
            this.showNotification('Please select at least one field to print', 'error');
            return;
        }

        this.showNotification(`Preparing to print student list...`, 'info');
        this.generatePrintContent();
        this.closeModal();
    }

    generatePrintContent() {
        let students = [];

        if (window.roomManager && window.roomManager.currentManagementType === 'allotments') {
            students = window.roomManager.allStudents || [];
        } else {
            students = window.studentManager?.allStudents || [];
        }

        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showNotification('Please allow popups for printing', 'error');
            return;
        }

        const fieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });

        const tableHeaders = fieldLabels.map(label => `<th>${label}</th>`).join('');

        const tableRows = filteredStudents.map(student => `
            <tr>
                ${this.selectedFields.map(fieldId => {
            let value = student[fieldId] || 'N/A';
            if (fieldId === 'status') {
                value = value === 'approved' ? 'Approved' :
                    value === 'pending' ? 'Pending' : value;
            }
            return `<td>${escapeHtml(value.toString())}</td>`;
        }).join('')}
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Student List - ${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: white; color: #333; }
                    .print-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2F3A8F; }
                    .print-header h1 { color: #2F3A8F; margin-bottom: 10px; }
                    .print-info { color: #666; margin-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #2F3A8F; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #ddd; }
                    td { padding: 10px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f8f9fa; }
                    .no-print { display: none; }
                    @media print { body { margin: 0; } .no-print { display: none !important; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: center; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #2F3A8F; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Print</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
                <div class="print-header">
                    <h1>Student List</h1>
                    <p class="print-info">${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}</p>
                    <p class="print-info">Generated on ${new Date().toLocaleDateString()}</p>
                    <p class="print-info">Total: ${filteredStudents.length} students</p>
                </div>
                <table>
                    <thead><tr>${tableHeaders}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
            </body>
            </html>
        `);

        printWindow.document.close();

        this.showNotification(`Print window opened for ${filteredStudents.length} students`, 'success');

        if (document.getElementById('saveConfig')?.checked) {
            this.saveConfiguration();
        }
    }

    printFromPreview() {
        this.generatePrintContent();
        this.closePreview();
    }

    saveConfiguration() {
        const config = {
            batch: this.selectedBatch,
            listType: this.listType,
            fields: this.selectedFields,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('printConfiguration', JSON.stringify(config));
        this.showNotification('Print configuration saved', 'success');
    }

    loadConfiguration() {
        const saved = localStorage.getItem('printConfiguration');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                this.selectedBatch = config.batch || 'all';
                this.listType = config.listType || 'simple_list';
                this.selectedFields = config.fields || ['name', 'roll_number', 'department'];

                document.getElementById('printBatch').value = this.selectedBatch;
                document.querySelector(`input[name="listType"][value="${this.listType}"]`).checked = true;
                this.handleListTypeChange(this.listType);
                this.updateDetailsGrid();
            } catch (e) {
                console.error('Error loading saved configuration:', e);
            }
        }
    }

    openModal() {
        this.currentStep = 1;
        this.loadConfiguration();
        this.showStep(1);
        this.loadBatches();
        this.updateBatchStats();
        document.getElementById('printModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('printModalOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    showNotification(message, type = 'info') {
        const now = Date.now();
        if (now - this.lastNotificationTime < 1000) {
            return;
        }
        this.lastNotificationTime = now;

        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

class AllotmentPrintManager extends PrintManager {
    constructor() {
        super();
        this.allotmentFields = [
            { id: 'name', label: 'Student Name', default: true },
            { id: 'roll_number', label: 'Roll Number', default: false },
            { id: 'department', label: 'Department', default: false },
            { id: 'batch_year', label: 'Batch Year', default: true },
            { id: 'room_number', label: 'Room Number', default: true },
            { id: 'bed_number', label: 'Bed Number', default: true },
            { id: 'allotment_status', label: 'Allotment Status', default: true },
            { id: 'room_type', label: 'Room Type', default: false },
            { id: 'floor', label: 'Floor', default: false },
            { id: 'allotment_date', label: 'Allotment Date', default: false }
        ];
        this.allFields = this.allotmentFields;
        this.listType = 'allotment_details';
        this.selectedFields = ['name', 'room_number', 'bed_number', 'allotment_status'];
        
        this.setupAllotmentListeners();
    }

    setupAllotmentListeners() {
        document.getElementById('allotmentNextStepBtn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('allotmentPrevStepBtn')?.addEventListener('click', () => this.previousStep());
        document.getElementById('allotmentCancelPrintBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('allotmentPrintBatch')?.addEventListener('change', (e) => this.handleBatchChange(e.target.value));
        
        document.querySelectorAll('input[name="allotmentListType"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleListTypeChange(e.target.value));
        });

        document.getElementById('allotmentSelectAllBtn')?.addEventListener('click', () => this.selectAllDetails());
        document.getElementById('allotmentDeselectAllBtn')?.addEventListener('click', () => this.deselectAllDetails());
        document.getElementById('allotmentFinalPrintBtn')?.addEventListener('click', () => this.executePrint());
        document.getElementById('allotmentPreviewBtn')?.addEventListener('click', () => this.showPreview());
        document.getElementById('allotmentPrintFromPreviewBtn')?.addEventListener('click', () => this.printFromPreview());
        document.getElementById('allotmentClosePreviewBtn')?.addEventListener('click', () => this.closePreview());
        document.getElementById('allotmentPrintModalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('allotmentPreviewModalClose')?.addEventListener('click', () => this.closePreview());
    }

    showStep(step) {
        for (let i = 1; i <= this.totalSteps; i++) {
            document.getElementById(`allotmentStep${i}`)?.classList.remove('active');
        }
        document.getElementById(`allotmentStep${step}`)?.classList.add('active');
        this.updateNavigation(step);
        if (step === 4) {
            this.updatePreview();
        }
    }

    updateNavigation(step) {
        const prevBtn = document.getElementById('allotmentPrevStepBtn');
        const nextBtn = document.getElementById('allotmentNextStepBtn');
        const finalBtn = document.getElementById('allotmentFinalPrintBtn');
        const cancelBtn = document.getElementById('allotmentCancelPrintBtn');

        if (step === 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'inline-flex';
            finalBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel';
        } else if (step === this.totalSteps) {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'none';
            finalBtn.style.display = 'inline-flex';
            cancelBtn.textContent = 'Back to Start';
        } else {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'inline-flex';
            finalBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel';
        }
    }

    validateStep(step) {
        switch (step) {
            case 3:
                if (this.listType === 'allotment_custom' && this.selectedFields.length === 0) {
                    this.showValidationError('Please select at least one field to print');
                    return false;
                }
                this.hideValidationError();
                return true;
            default:
                return true;
        }
    }

    showValidationError(message) {
        const validationEl = document.getElementById('allotmentValidationMessage');
        if (validationEl) {
            validationEl.style.display = 'flex';
            validationEl.querySelector('span').textContent = message;
        }
    }

    hideValidationError() {
        const validationEl = document.getElementById('allotmentValidationMessage');
        if (validationEl) {
            validationEl.style.display = 'none';
        }
    }

    loadBatches() {
        const batchSelect = document.getElementById('allotmentPrintBatch');
        if (!batchSelect || !window.roomManager?.allStudents) return;

        const students = window.roomManager.allStudents || [];
        const batches = [...new Set(students
            .map(student => student.batch_year)
            .filter(year => year != null)
            .sort((a, b) => b - a)
        )];

        batchSelect.innerHTML = '<option value="all">All Students</option>';
        batches.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `Batch ${year}`;
            batchSelect.appendChild(option);
        });

        this.updateBatchStats();
    }

    updateBatchStats() {
        const statsEl = document.getElementById('allotmentBatchStats');
        const studentsCountEl = document.getElementById('allotmentStudentsCount');
        const batchYearEl = document.getElementById('allotmentBatchYear');

        const students = this.getAllotmentStudents();
        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        if (statsEl) {
            statsEl.style.display = 'flex';
            studentsCountEl.textContent = `${filteredStudents.length} students`;
            batchYearEl.textContent = this.selectedBatch === 'all' ? 'All Batches' : `Batch ${this.selectedBatch}`;
        }
    }

    getAllotmentStudents() {
        if (!window.roomManager?.allStudents || !window.roomManager?.allotments) {
            return [];
        }

        const students = window.roomManager.allStudents;
        const allotments = window.roomManager.allotments;

        return students.map(student => {
            const allotment = allotments.find(a => a.student_id === student.user_id && a.status === 'active');
            const isAllotted = !!allotment;

            return {
                ...student,
                room_number: isAllotted ? allotment.room_number : 'N/A',
                bed_number: isAllotted ? allotment.bed_number : 'N/A',
                allotment_status: isAllotted ? 'Allotted' : 'Unallotted',
                room_type: isAllotted ? allotment.room_type : 'N/A',
                floor: isAllotted ? allotment.floor : 'N/A',
                allotment_date: isAllotted ? allotment.allotment_date : 'N/A'
            };
        });
    }

    handleListTypeChange(type) {
        this.listType = type;

        switch (type) {
            case 'allotment_details':
                this.selectedFields = ['name', 'batch_year', 'room_number', 'bed_number', 'allotment_status'];
                break;
            case 'allotment_simple':
                this.selectedFields = ['name', 'room_number', 'bed_number', 'allotment_status'];
                break;
            case 'allotment_custom':
                break;
        }

        this.updateDetailsGrid();

        const step3 = document.getElementById('allotmentStep3');
        if (step3) {
            step3.style.display = type === 'allotment_custom' ? 'block' : 'none';
        }
    }

    populateDetailsGrid() {
        const grid = document.getElementById('allotmentDetailsGrid');
        if (!grid) return;

        grid.innerHTML = this.allotmentFields.map(field => `
            <div class="detail-checkbox ${this.selectedFields.includes(field.id) ? 'checked' : ''}" 
                 data-field="${field.id}">
                <input type="checkbox" id="allotment_field_${field.id}" 
                       ${this.selectedFields.includes(field.id) ? 'checked' : ''}>
                <div class="checkmark"></div>
                <span class="detail-label">${field.label}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.detail-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleDetail(checkbox.dataset.field);
            });
        });
    }

    updatePreview() {
        const students = this.getAllotmentStudents();
        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        document.getElementById('allotmentPreviewBatch').textContent =
            this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`;

        document.getElementById('allotmentPreviewType').textContent =
            this.listType === 'allotment_details' ? 'Allotment Details' :
                this.listType === 'allotment_custom' ? 'Custom Details' : 'Simple List';

        document.getElementById('allotmentPreviewStudents').textContent =
            `${filteredStudents.length} students`;

        const selectedFieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allotmentFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });
        document.getElementById('allotmentPreviewFields').textContent =
            selectedFieldLabels.join(', ') || 'No fields selected';
    }

    showPreview() {
        this.generatePreviewContent();
        document.getElementById('allotmentPreviewModalOverlay').classList.add('active');
    }

    closePreview() {
        document.getElementById('allotmentPreviewModalOverlay').classList.remove('active');
    }

    generatePreviewContent() {
        const previewContent = document.getElementById('allotmentPrintPreviewContent');
        if (!previewContent) return;

        const students = this.getAllotmentStudents();
        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        const fieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allotmentFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });

        const tableHeaders = fieldLabels.map(label => `<th>${label}</th>`).join('');

        const tableRows = filteredStudents.map(student => `
            <tr>
                ${this.selectedFields.map(fieldId => {
            let value = student[fieldId] || 'N/A';
            return `<td>${escapeHtml(value.toString())}</td>`;
        }).join('')}
            </tr>
        `).join('');

        previewContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #2F3A8F; margin-bottom: 10px;">Allotment List</h2>
                <p style="color: #666; margin-bottom: 5px;">
                    ${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}
                </p>
                <p style="color: #666; font-size: 14px;">
                    Generated on ${new Date().toLocaleDateString()} | 
                    ${filteredStudents.length} students
                </p>
            </div>
            <table class="preview-table">
                <thead>
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
    }

    executePrint() {
        if (!this.validateStep(3)) {
            this.showNotification('Please fix the validation errors before printing', 'error');
            return;
        }

        const now = Date.now();
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            return;
        }

        this.lastNotificationTime = now;

        if (this.listType === 'allotment_custom' && this.selectedFields.length === 0) {
            this.showNotification('Please select at least one field to print', 'error');
            return;
        }

        this.showNotification(`Preparing to print allotment list...`, 'info');
        this.generatePrintContent();
        this.closeModal();
    }

    generatePrintContent() {
        const students = this.getAllotmentStudents();
        let filteredStudents = students;
        if (this.selectedBatch !== 'all') {
            filteredStudents = filteredStudents.filter(student =>
                student.batch_year && student.batch_year.toString() === this.selectedBatch
            );
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showNotification('Please allow popups for printing', 'error');
            return;
        }

        const fieldLabels = this.selectedFields.map(fieldId => {
            const field = this.allotmentFields.find(f => f.id === fieldId);
            return field ? field.label : fieldId;
        });

        const tableHeaders = fieldLabels.map(label => `<th>${label}</th>`).join('');

        const tableRows = filteredStudents.map(student => `
            <tr>
                ${this.selectedFields.map(fieldId => {
            let value = student[fieldId] || 'N/A';
            return `<td>${escapeHtml(value.toString())}</td>`;
        }).join('')}
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Allotment List - ${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: white; color: #333; }
                    .print-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2F3A8F; }
                    .print-header h1 { color: #2F3A8F; margin-bottom: 10px; }
                    .print-info { color: #666; margin-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #2F3A8F; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #ddd; }
                    td { padding: 10px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f8f9fa; }
                    .allotment-status { padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
                    .allotted { background: #d1fae5; color: #065f46; }
                    .unallotted { background: #fef3c7; color: #92400e; }
                    .no-print { display: none; }
                    @media print { body { margin: 0; } .no-print { display: none !important; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: center; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #2F3A8F; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Print</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
                <div class="print-header">
                    <h1>Allotment List</h1>
                    <p class="print-info">${this.selectedBatch === 'all' ? 'All Students' : `Batch ${this.selectedBatch}`}</p>
                    <p class="print-info">Generated on ${new Date().toLocaleDateString()}</p>
                    <p class="print-info">Total: ${filteredStudents.length} students</p>
                </div>
                <table>
                    <thead><tr>${tableHeaders}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
            </body>
            </html>
        `);

        printWindow.document.close();
        this.showNotification(`Print window opened for ${filteredStudents.length} students`, 'success');

        if (document.getElementById('allotmentSaveConfig')?.checked) {
            this.saveConfiguration();
        }
    }

    openModal() {
        this.currentStep = 1;
        this.loadConfiguration();
        this.showStep(1);
        this.loadBatches();
        this.updateBatchStats();
        document.getElementById('allotmentPrintModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('allotmentPrintModalOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    saveConfiguration() {
        const config = {
            batch: this.selectedBatch,
            listType: this.listType,
            fields: this.selectedFields,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('allotmentPrintConfiguration', JSON.stringify(config));
        this.showNotification('Allotment print configuration saved', 'success');
    }

    loadConfiguration() {
        const saved = localStorage.getItem('allotmentPrintConfiguration');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                this.selectedBatch = config.batch || 'all';
                this.listType = config.listType || 'allotment_details';
                this.selectedFields = config.fields || ['name', 'room_number', 'bed_number', 'allotment_status'];

                document.getElementById('allotmentPrintBatch').value = this.selectedBatch;
                document.querySelector(`input[name="allotmentListType"][value="${this.listType}"]`).checked = true;
                this.handleListTypeChange(this.listType);
                this.updateDetailsGrid();
            } catch (e) {
                console.error('Error loading saved configuration:', e);
            }
        }
    }
}

window.PrintManager = PrintManager;
window.AllotmentPrintManager = AllotmentPrintManager;