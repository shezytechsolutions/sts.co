// student_dashboard_announcements.js
// Announcement Management Module

// ============================================
// ANNOUNCEMENT CARD MANAGER
// ============================================

class AnnouncementCard {
    constructor() {
        this.announcements = [];
        this.currentIndex = 0;
        this.slideInterval = null;
        this.init();
    }

    async init() {
        console.log('AnnouncementCard: Initializing...');
        await this.loadAnnouncements();
        if (this.announcements.length > 0) {
            console.log(`AnnouncementCard: Loaded ${this.announcements.length} announcements`);
            this.startAutoSlide();
            this.bindEvents();
        } else {
            console.log('AnnouncementCard: No announcements found');
            this.showWelcomeCard();
        }
    }

    async loadAnnouncements() {
        try {
            const response = await fetch('/api/student/announcements');
            const data = await response.json();
            
            if (data.success && data.announcements && data.announcements.length > 0) {
                // Map announcement_type to type for frontend
                this.announcements = data.announcements.map(announcement => ({
                    ...announcement,
                    type: announcement.announcement_type || 'info'
                }));
                this.renderAnnouncementCard();
                this.hideWelcomeCard();
            } else {
                this.hideAnnouncementCard();
                this.showWelcomeCard();
            }
        } catch (error) {
            console.error('AnnouncementCard: Error loading announcements:', error);
            this.hideAnnouncementCard();
            this.showWelcomeCard();
        }
    }

    renderAnnouncementCard() {
        const container = document.getElementById('announcementCardMain');
        
        if (!container || this.announcements.length === 0) {
            this.hideAnnouncementCard();
            return;
        }

        const currentAnnouncement = this.announcements[this.currentIndex];
        
        container.style.display = 'block';
        container.innerHTML = `
            <div class="announcement-card-content">
                <!-- Text Content -->
                <div class="announcement-text">
                    <div class="announcement-badge ${currentAnnouncement.type}">
                        <i class="${this.getIconForType(currentAnnouncement.type)}"></i>
                        ${currentAnnouncement.type}
                    </div>
                    <h2 class="announcement-title">${currentAnnouncement.title}</h2>
                    <p class="announcement-message">${currentAnnouncement.content}</p>
                    
                    <div class="announcement-meta">
                        <span>
                            <i class="fas fa-user"></i>
                            By ${currentAnnouncement.created_by_name}
                        </span>
                        <span>
                            <i class="fas fa-clock"></i>
                            ${currentAnnouncement.created_at}
                        </span>
                        <span class="priority-badge ${currentAnnouncement.priority}">
                            <i class="fas ${this.getPriorityIcon(currentAnnouncement.priority)}"></i>
                            ${currentAnnouncement.priority}
                        </span>
                    </div>
                </div>
                
                <!-- Image Side - Fixed Size -->
                <div class="announcement-image-side">
                    <div class="announcement-image-container">
                        ${currentAnnouncement.image_path ? `
                            <img src="/static/${currentAnnouncement.image_path}" 
                                 alt="Announcement Image" 
                                 class="announcement-image"
                                 onclick="enlargeImage('/static/${currentAnnouncement.image_path}')">
                        ` : `
                            <div class="announcement-image-placeholder">
                                <i class="fas fa-image"></i>
                                <span>No Image</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Controls -->
            ${this.announcements.length > 1 ? `
            <div class="announcement-controls">
                <div class="announcement-nav">
                    <button class="announcement-nav-btn" onclick="announcementCard.prevAnnouncement()" title="Previous">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="announcement-counter">
                        ${this.currentIndex + 1} / ${this.announcements.length}
                    </span>
                    <button class="announcement-nav-btn" onclick="announcementCard.nextAnnouncement()" title="Next">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="announcement-dots">
                    ${this.announcements.map((_, index) => `
                        <button class="announcement-dot ${index === this.currentIndex ? 'active' : ''}" 
                                onclick="announcementCard.goToAnnouncement(${index})"
                                title="Go to announcement ${index + 1}"></button>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;
    }

    getIconForType(type) {
        const icons = {
            'info': 'fas fa-info-circle',
            'warning': 'fas fa-exclamation-triangle',
            'urgent': 'fas fa-exclamation-circle',
            'event': 'fas fa-calendar-star'
        };
        return icons[type] || 'fas fa-bullhorn';
    }

    getPriorityIcon(priority) {
        const icons = {
            'low': 'fa-arrow-down',
            'medium': 'fa-minus',
            'high': 'fa-arrow-up',
            'urgent': 'fa-bolt'
        };
        return icons[priority] || 'fa-circle';
    }

    nextAnnouncement() {
        if (this.announcements.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.announcements.length;
        this.renderAnnouncementCard();
        this.resetAutoSlide();
    }

    prevAnnouncement() {
        if (this.announcements.length <= 1) return;
        this.currentIndex = this.currentIndex === 0 ? this.announcements.length - 1 : this.currentIndex - 1;
        this.renderAnnouncementCard();
        this.resetAutoSlide();
    }

    goToAnnouncement(index) {
        this.currentIndex = index;
        this.renderAnnouncementCard();
        this.resetAutoSlide();
    }

    startAutoSlide() {
        if (this.announcements.length <= 1) return;
        this.slideInterval = setInterval(() => {
            this.nextAnnouncement();
        }, 5000); // 5 seconds
    }

    resetAutoSlide() {
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
            this.startAutoSlide();
        }
    }

    hideAnnouncementCard() {
        const container = document.getElementById('announcementCardMain');
        if (container) {
            container.style.display = 'none';
        }
    }

    showWelcomeCard() {
        const container = document.getElementById('welcomeCardFallback');
        if (container) {
            container.style.display = 'block';
            this.loadStudentProfile();
        }
    }

    hideWelcomeCard() {
        const container = document.getElementById('welcomeCardFallback');
        if (container) {
            container.style.display = 'none';
        }
    }

    async loadStudentProfile() {
        try {
            const response = await fetch('/get_student_profile');
            const profile = await response.json();
            
            // Update the fallback welcome card
            if (document.getElementById('studentName')) {
                document.getElementById('studentName').textContent = profile.name || 'Student';
                document.getElementById('studentID').textContent = profile.roll_number || 'N/A';
                document.getElementById('studentDept').textContent = profile.department || 'N/A';
                document.getElementById('studentStatus').textContent = profile.status || 'Pending';
                
                // Update avatar if available
                if (profile.profile_picture && document.getElementById('dashboardAvatar')) {
                    document.getElementById('dashboardAvatar').src = `/static/${profile.profile_picture}`;
                }
                
                // Update current date
                const now = new Date();
                document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            
        } catch (error) {
            console.error('Error loading student profile:', error);
        }
    }

    bindEvents() {
        // Pause auto-slide on hover
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.announcement-card-main')) {
                if (this.slideInterval) {
                    clearInterval(this.slideInterval);
                }
            }
        });

        // Resume auto-slide when mouse leaves
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.announcement-card-main')) {
                this.startAutoSlide();
            }
        });
    }
}

// ============================================
// ANNOUNCEMENT SLIDER (Alternative)
// ============================================

class AnnouncementSlider {
    constructor() {
        this.announcements = [];
        this.currentIndex = 0;
        this.slideInterval = null;
        this.init();
    }

    async init() {
        console.log('AnnouncementSlider: Initializing...');
        await this.loadAnnouncements();
        if (this.announcements.length > 0) {
            console.log(`AnnouncementSlider: Loaded ${this.announcements.length} announcements`);
            this.startAutoSlide();
            this.bindEvents();
        } else {
            console.log('AnnouncementSlider: No announcements found');
            this.showNoAnnouncements();
        }
    }

    async loadAnnouncements() {
        try {
            const response = await fetch('/api/student/announcements');
            const data = await response.json();

            if (data.success && data.announcements && data.announcements.length > 0) {
                // Map announcement_type to type for frontend
                this.announcements = data.announcements.map(announcement => ({
                    ...announcement,
                    type: announcement.announcement_type || 'info'
                }));
                this.renderSlider();
                this.hideNoAnnouncements();
            } else {
                this.hideSlider();
                this.showNoAnnouncements();
            }
        } catch (error) {
            console.error('AnnouncementSlider: Error loading announcements:', error);
            this.hideSlider();
            this.showNoAnnouncements();
        }
    }

    renderSlider() {
        const container = document.getElementById('announcementSlider');

        if (!container || this.announcements.length === 0) {
            this.hideSlider();
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="announcement-slider-container">
                <div class="announcement-header">
                    <h3>
                        <i class="fas fa-bullhorn"></i>
                        Latest Announcements
                        <span style="font-size: 14px; color: var(--muted); margin-left: 8px;">
                            (${this.announcements.length} announcement${this.announcements.length > 1 ? 's' : ''})
                        </span>
                    </h3>
                    ${this.announcements.length > 1 ? `
                    <div class="announcement-controls">
                        <button onclick="announcementSlider.prevSlide()" title="Previous">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="announcement-counter">
                            ${this.currentIndex + 1} / ${this.announcements.length}
                        </span>
                        <button onclick="announcementSlider.nextSlide()" title="Next">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
                
                <div class="announcement-slider-track">
                    ${this.announcements.map((announcement, index) => `
                        <div class="announcement-slide ${index === this.currentIndex ? 'active' : ''}">
                            <div class="announcement-card ${announcement.type}">
                                <div class="announcement-icon">
                                    <i class="${this.getIconForType(announcement.type)}"></i>
                                </div>
                                <div class="announcement-content">
                                    <h4>${announcement.title}</h4>
                                    <p>${announcement.content}</p>
                                    ${announcement.image_path ? `
                                        <div class="announcement-image">
                                            <img src="/static/${announcement.image_path}" 
                                                 alt="Announcement Image" 
                                                 onclick="enlargeImage('/static/${announcement.image_path}')">
                                        </div>
                                    ` : ''}
                                    <div class="announcement-meta">
                                        <span>
                                            <i class="fas fa-user"></i>
                                            By ${announcement.created_by_name}
                                        </span>
                                        <span>
                                            <i class="fas fa-clock"></i>
                                            ${announcement.created_at}
                                        </span>
                                        <span class="priority-badge ${announcement.priority}">
                                            <i class="fas ${this.getPriorityIcon(announcement.priority)}"></i>
                                            ${announcement.priority}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${this.announcements.length > 1 ? `
                <div class="announcement-dots">
                    ${this.announcements.map((_, index) => `
                        <button class="announcement-dot ${index === this.currentIndex ? 'active' : ''}" 
                                onclick="announcementSlider.goToSlide(${index})"
                                title="Go to announcement ${index + 1}"></button>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }

    getIconForType(type) {
        const icons = {
            'info': 'fas fa-info-circle',
            'warning': 'fas fa-exclamation-triangle',
            'urgent': 'fas fa-exclamation-circle',
            'event': 'fas fa-calendar-star'
        };
        return icons[type] || 'fas fa-bullhorn';
    }

    getPriorityIcon(priority) {
        const icons = {
            'low': 'fa-arrow-down',
            'medium': 'fa-minus',
            'high': 'fa-arrow-up',
            'urgent': 'fa-bolt'
        };
        return icons[priority] || 'fa-circle';
    }

    nextSlide() {
        if (this.announcements.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.announcements.length;
        this.renderSlider();
        this.resetAutoSlide();
    }

    prevSlide() {
        if (this.announcements.length <= 1) return;
        this.currentIndex = this.currentIndex === 0 ? this.announcements.length - 1 : this.currentIndex - 1;
        this.renderSlider();
        this.resetAutoSlide();
    }

    goToSlide(index) {
        this.currentIndex = index;
        this.renderSlider();
        this.resetAutoSlide();
    }

    startAutoSlide() {
        if (this.announcements.length <= 1) return;
        this.slideInterval = setInterval(() => {
            this.nextSlide();
        }, 5000); // 5 seconds
    }

    resetAutoSlide() {
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
            this.startAutoSlide();
        }
    }

    hideSlider() {
        const container = document.getElementById('announcementSlider');
        if (container) {
            container.style.display = 'none';
        }
    }

    showNoAnnouncements() {
        const container = document.getElementById('noAnnouncements');
        if (container) {
            container.style.display = 'block';
        }
    }

    hideNoAnnouncements() {
        const container = document.getElementById('noAnnouncements');
        if (container) {
            container.style.display = 'none';
        }
    }

    bindEvents() {
        // Pause auto-slide on hover
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.announcement-slider-container')) {
                if (this.slideInterval) {
                    clearInterval(this.slideInterval);
                }
            }
        });

        // Resume auto-slide when mouse leaves
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.announcement-slider-container')) {
                this.startAutoSlide();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('.announcement-slider-container')) {
                if (e.key === 'ArrowLeft') {
                    this.prevSlide();
                } else if (e.key === 'ArrowRight') {
                    this.nextSlide();
                }
            }
        });
    }
}