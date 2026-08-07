// ============================================
// DASHBOARD.JS - Dashboard Manager
// ============================================

class DashboardManager {
    constructor() {
        this.init();
    }

    init() {
        this.loadStats();
        this.setupEventListeners();
    }

    setupEventListeners() {
        setInterval(() => {
            this.loadStats(true);
        }, 300000);
    }

    async loadStats(silent = false) {
        try {
            this.showLoadingStates();
            await this.loadRealStats(silent);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            this.showErrorStates();
            if (!silent) {
                showNotification('Failed to load dashboard data', 'error');
            }
        }
    }

    async loadRealStats(silent = false) {
        try {
            const response = await fetch('/api/admin/dashboard_stats');

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const result = await response.json();

            if (result.success) {
                this.updateStats(result.data);
                this.updateRecentActivity();
                if (!silent) {
                    showNotification('Dashboard updated successfully!', 'success');
                }
            } else {
                throw new Error(result.error || 'Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Error loading real stats:', error);
            await this.simulateDataLoading(silent);
        }
    }

    async simulateDataLoading(silent = false) {
        try {
            let studentCount = '0';
            let pendingRequests = '0';

            try {
                const studentResponse = await fetch('/api/admin/approved_students');
                if (studentResponse.ok) {
                    const studentResult = await studentResponse.json();
                    if (studentResult.success && studentResult.students) {
                        studentCount = studentResult.students.length.toString();
                    }
                }

                const requestsResponse = await fetch('/api/admin/id_requests');
                if (requestsResponse.ok) {
                    const requestsResult = await requestsResponse.json();
                    if (requestsResult.success && requestsResult.requests) {
                        pendingRequests = requestsResult.requests.length.toString();
                    }
                }
            } catch (e) {
                console.log('Using default counts for simulation');
            }

            this.updateStats({
                totalStudents: studentCount,
                totalRooms: '156',
                feesCollection: '$124,580',
                totalComplaints: '23',
                idRequests: pendingRequests,
                pendingFees: '$12,450',
                approvedStudents: studentCount,
                pendingStudents: '97',
                availableBeds: '42',
                occupiedRooms: '114',
                idPendingCount: pendingRequests,
                feePendingCount: '28',
                complaintPendingCount: '23',
                tasksCount: '63'
            });

            this.updateRecentActivity();
            
            if (!silent) {
                showNotification('Dashboard updated with simulated data', 'info');
            }
        } catch (error) {
            console.error('Error in simulated data loading:', error);
            this.updateStats({
                totalStudents: '0',
                totalRooms: '0',
                feesCollection: '$0',
                totalComplaints: '0',
                idRequests: '0',
                pendingFees: '$0',
                approvedStudents: '0',
                pendingStudents: '0',
                availableBeds: '0',
                occupiedRooms: '0',
                idPendingCount: '0',
                feePendingCount: '0',
                complaintPendingCount: '0',
                tasksCount: '0'
            });
        }
    }

    showLoadingStates() {
        const elements = [
            'totalStudents', 'totalRoomsDash', 'feesCollection',
            'totalComplaints', 'idRequests', 'pendingFees',
            'approvedStudents', 'pendingStudents', 'availableBeds',
            'occupiedRoomsDash', 'idPendingCount', 'feePendingCount',
            'complaintPendingCount', 'tasksCount'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '...';
        });

        const activityList = document.getElementById('recentActivity');
        if (activityList) {
            activityList.innerHTML = `
                <div class="activity-item loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading recent activity...</span>
                </div>
            `;
        }
    }

    showErrorStates() {
        const elements = [
            'totalStudents', 'totalRoomsDash', 'feesCollection',
            'totalComplaints', 'idRequests', 'pendingFees'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = 'Error';
        });
    }

    updateStats(data) {
        const elements = {
            'totalStudents': data.totalStudents,
            'totalRoomsDash': data.totalRooms,
            'feesCollection': data.feesCollection,
            'totalComplaints': data.totalComplaints,
            'idRequests': data.idRequests,
            'pendingFees': data.pendingFees,
            'approvedStudents': data.approvedStudents,
            'pendingStudents': data.pendingStudents,
            'availableBeds': data.availableBeds,
            'occupiedRoomsDash': data.occupiedRooms,
            'idPendingCount': data.idPendingCount,
            'feePendingCount': data.feePendingCount,
            'complaintPendingCount': data.complaintPendingCount,
            'tasksCount': data.tasksCount
        };

        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = elements[id];
        });
    }

    updateRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        activityList.innerHTML = `
            <div class="activity-item">
                <i class="fas fa-user-plus text-success"></i>
                <span><strong>John Doe</strong> registered as new student</span>
            </div>
            <div class="activity-item">
                <i class="fas fa-id-card text-warning"></i>
                <span>ID card approved for <strong>Sarah Smith</strong></span>
            </div>
            <div class="activity-item">
                <i class="fas fa-money-bill-wave text-info"></i>
                <span>Fee payment received - <strong>$1,200</strong></span>
            </div>
            <div class="activity-item">
                <i class="fas fa-comment text-danger"></i>
                <span>New complaint submitted - <strong>Room Maintenance</strong></span>
            </div>
            <div class="activity-item">
                <i class="fas fa-door-open text-brand"></i>
                <span>Room <strong>201</strong> assigned to <strong>Michael Brown</strong></span>
            </div>
        `;
    }

    // Navigation methods
    viewStudents() {
        if (!window.studentManager) {
            window.studentManager = new StudentManager();
        }

        const studentLink = document.querySelector('[data-target="student-id"]');
        if (studentLink) {
            document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
            studentLink.classList.add('active');
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById('student-id').classList.add('visible');

            const filter = document.getElementById('studentFilter');
            if (filter) {
                filter.value = 'all';
                setTimeout(() => {
                    window.studentManager.handleFilterChange();
                    window.studentManager.loadData();
                }, 100);
            }
            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }

    viewRooms() {
        const roomsLink = document.querySelector('[data-target="rooms-management"]');
        if (roomsLink) {
            document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
            roomsLink.classList.add('active');
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById('rooms-management').classList.add('visible');

            if (window.roomManager) {
                window.roomManager.loadRooms();
            }

            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }

    viewIDRequests() {
        if (!window.studentManager) {
            window.studentManager = new StudentManager();
        }

        const studentLink = document.querySelector('[data-target="student-id"]');
        if (studentLink) {
            document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
            studentLink.classList.add('active');
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById('student-id').classList.add('visible');

            const filter = document.getElementById('studentFilter');
            if (filter) {
                filter.value = 'requests';
                setTimeout(() => {
                    window.studentManager.handleFilterChange();
                    window.studentManager.loadData();
                }, 100);
            }

            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }

    viewComplaints() {
        showNotification('Complaints management coming soon!', 'info');
    }

    viewPendingFees() {
        showNotification('Fee management system coming soon!', 'info');
    }

    viewFinance() {
        showNotification('Financial reports coming soon!', 'info');
    }

    manageStudents() {
        showNotification('Student management panel opening...', 'info');
        this.viewStudents();
    }

    manageRooms() {
        if (window.roomManager) {
            window.roomManager.openCreateRoomModal();
        }
    }

    processRequests() {
        this.viewIDRequests();
    }

    generateReports() {
        showNotification('Report generation feature coming soon!', 'info');
    }

    viewAllActivity() {
        showNotification('Activity log coming soon!', 'info');
    }

    exportReport() {
        showNotification('Export feature coming soon!', 'info');
    }
}

// Initialize dashboard manager
window.DashboardManager = DashboardManager;