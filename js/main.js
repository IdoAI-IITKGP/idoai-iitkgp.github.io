/* ==========================================================================
   IdoAI - Main JavaScript Logic
   Theme Switcher, Search Filters, Accordion, Lightbox & Animations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initMobileNav();
    initAccordions();
    initSearchAndFilter();
    initLightbox();
    initCountdown();
    initCounterAnimation();
});

/* ==========================================================================
   1. Theme Switcher (Dark & Light Mode)
   ========================================================================== */
function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    
    // Read the current active theme set by early head script
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeIcon(activeTheme);

    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('idoai-theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;
    const icon = themeBtn.querySelector('i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            themeBtn.setAttribute('title', 'Switch to Light Mode');
        } else {
            icon.className = 'fa-solid fa-moon';
            themeBtn.setAttribute('title', 'Switch to Dark Mode');
        }
    }
}

/* ==========================================================================
   2. Mobile Navigation Drawer
   ========================================================================== */
function initMobileNav() {
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (mobileBtn && navMenu) {
        mobileBtn.addEventListener('click', () => {
            navMenu.classList.toggle('open');
            const icon = mobileBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-xmark');
            }
        });
    }
}

/* ==========================================================================
   3. Accordion & Expandable Cards
   ========================================================================== */
function initAccordions() {
    const eventCards = document.querySelectorAll('.event-card');
    
    eventCards.forEach(card => {
        const summary = card.querySelector('.event-summary');
        if (summary) {
            summary.addEventListener('click', (e) => {
                // If click originated from a link inside summary (like speaker profile), don't toggle accordion
                if (e.target.closest('a')) {
                    return;
                }
                const isExpanded = card.classList.contains('expanded');
                
                // Optionally close other expanded cards
                // eventCards.forEach(c => c.classList.remove('expanded'));
                
                if (!isExpanded) {
                    card.classList.add('expanded');
                } else {
                    card.classList.remove('expanded');
                }
            });
        }
    });
}

/* ==========================================================================
   4. Interactive Search & Category Filtering
   ========================================================================== */
function initSearchAndFilter() {
    const searchInput = document.getElementById('search-input');
    const categoryBtns = document.querySelectorAll('.pill-btn');
    const filterableItems = document.querySelectorAll('.filterable-item');

    let currentCategory = 'all';
    let currentSearchQuery = '';

    function filterItems() {
        filterableItems.forEach(item => {
            const rawCategory = item.dataset.category || 'all';
            const categories = rawCategory.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const textContent = item.textContent.toLowerCase();

            const matchesCategory = (currentCategory === 'all' || categories.includes(currentCategory.toLowerCase()));
            const matchesSearch = textContent.includes(currentSearchQuery.toLowerCase());

            if (matchesCategory && matchesSearch) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            filterItems();
        });
    }

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentCategory = btn.dataset.filter || 'all';
            filterItems();
        });
    });
}

/* ==========================================================================
   5. Gallery Lightbox Modal
   ========================================================================== */
function initLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const posterTriggers = document.querySelectorAll('.lightbox-trigger, #talk-poster-trigger');
    const lightboxModal = document.getElementById('lightbox-modal');
    
    if (!lightboxModal) return;

    const lightboxImg = lightboxModal.querySelector('.lightbox-img');
    const lightboxCaption = lightboxModal.querySelector('.lightbox-caption');
    const closeBtn = lightboxModal.querySelector('.lightbox-close');

    function openLightbox(src, alt, captionHtml) {
        if (lightboxImg) {
            lightboxImg.src = src;
            lightboxImg.alt = alt || '';
        }
        if (lightboxCaption) {
            lightboxCaption.innerHTML = captionHtml || '';
        }
        lightboxModal.classList.add('active');
    }

    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            if (!img) return;

            // Check if structured data attributes exist
            const speaker = item.dataset.speaker;
            const title = item.dataset.title;
            const date = item.dataset.date;
            const venue = item.dataset.venue;

            let captionHtml = '';
            if (speaker || title || date || venue) {
                captionHtml = `
                    <div class="lightbox-info">
                        ${title ? `<div class="lightbox-title">${title}</div>` : ''}
                        <div class="lightbox-meta">
                            ${speaker ? `<span class="lightbox-speaker"><i class="fa-solid fa-circle-user"></i> ${speaker}</span>` : ''}
                            ${date ? `<span class="lightbox-date"><i class="fa-regular fa-calendar"></i> ${date}</span>` : ''}
                            ${venue ? `<span class="lightbox-venue"><i class="fa-solid fa-location-dot"></i> ${venue}</span>` : ''}
                        </div>
                    </div>
                `;
            } else {
                const caption = item.querySelector('.gallery-caption')?.textContent || '';
                const sub = item.querySelector('.gallery-sub')?.textContent || '';
                captionHtml = `<strong>${caption}</strong><br><span style="font-size:0.85rem; color: #94a3b8;">${sub}</span>`;
            }

            openLightbox(
                img.src,
                img.alt || title || speaker || 'Photo View',
                captionHtml
            );
        });
    });

    posterTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const img = trigger.querySelector('img');
            const href = trigger.getAttribute('href');
            const isImgHref = href && /\.(png|jpe?g|webp|gif|svg)$/i.test(href);
            const src = img?.src || (isImgHref ? href : null);
            const caption = trigger.dataset.caption || img?.alt || 'Event Poster Preview';
            
            if (src) {
                if (trigger.tagName === 'A') {
                    e.preventDefault();
                }
                openLightbox(
                    src,
                    img?.alt || caption,
                    `<strong>${caption}</strong>`
                );
            }
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            lightboxModal.classList.remove('active');
        });
    }

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            lightboxModal.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxModal.classList.contains('active')) {
            lightboxModal.classList.remove('active');
        }
    });
}

/* ==========================================================================
   6. Countdown Timer for Next Upcoming Seminar
   ========================================================================== */
function initCountdown() {
    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minsEl = document.getElementById('timer-mins');
    const secsEl = document.getElementById('timer-secs');

    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    // Helper to get the exact next Tuesday at 17:00 (05:00 PM IST)
    function getNextTuesday() {
        const now = new Date();
        const target = new Date();
        
        // Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        let daysToAdd = (2 - now.getDay() + 7) % 7;
        
        target.setDate(now.getDate() + daysToAdd);
        target.setHours(17, 0, 0, 0); // 05:00 PM IST
        
        // If today is Tuesday and we are already past 17:00 IST, target next week's Tuesday
        if (daysToAdd === 0 && now.getTime() >= target.getTime()) {
            target.setDate(target.getDate() + 7);
        }
        
        return target;
    }

    function updateTimer() {
        const now = new Date();
        const target = getNextTuesday();
        const diff = target.getTime() - now.getTime();

        if (diff <= 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            secsEl.textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minsEl.textContent = String(mins).padStart(2, '0');
        secsEl.textContent = String(secs).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

/* ==========================================================================
   7. Animated Counter for Stat Numbers
   ========================================================================== */
function initCounterAnimation() {
    const statNumbers = document.querySelectorAll('.stat-number');
    if (!statNumbers.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const countTo = parseInt(target.dataset.count, 10);
                if (!isNaN(countTo) && !target.classList.contains('counted')) {
                    target.classList.add('counted');
                    animateValue(target, 0, countTo, 1500);
                }
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(num => observer.observe(num));
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const suffix = obj.dataset.suffix || '';
        obj.textContent = Math.floor(progress * (end - start) + start) + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
