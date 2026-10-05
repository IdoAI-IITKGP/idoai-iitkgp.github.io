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
    initScrollEffects();
    initRevealOnScroll();
    assignSearchAnchors(document);
    initSiteSearch();
    revealHashTarget(true);
    window.addEventListener('hashchange', () => revealHashTarget());
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Low-end devices get a lighter build: no glass blur, no looping or scroll-in animations,
   no page transitions. Detected by the inline script in each page's <head> (before first paint). */
const isLiteMode = document.documentElement.classList.contains('lite');

if (isLiteMode) {
    // Cancel the cross-page animation before it starts (fired on the page being left)
    window.addEventListener('pageswap', (e) => { if (e.viewTransition) e.viewTransition.skipTransition(); });
}

/* How this page was reached: 'navigate', 'reload' or 'back_forward' */
const navigationType = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0] || {}).type || 'navigate';

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
        try { localStorage.setItem('idoai-theme', newTheme); } catch { /* storage blocked: theme lasts this page only */ }
        updateThemeIcon(newTheme);
    });
}

/* The sun/moon icon itself is switched by CSS from data-theme; this keeps the hover popup in step */
function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;
    const label = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    themeBtn.setAttribute('data-tooltip', label);
    themeBtn.setAttribute('aria-label', label);
}

/* ==========================================================================
   2. Mobile Navigation Drawer
   ========================================================================== */
function initMobileNav() {
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (!mobileBtn || !navMenu) return;

    mobileBtn.setAttribute('aria-expanded', 'false');
    mobileBtn.setAttribute('aria-controls', 'nav-menu');

    // Dimmed layer behind the open menu; tapping it closes the menu
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function setMenuOpen(open) {
        navMenu.classList.toggle('open', open);
        backdrop.classList.toggle('visible', open);
        document.body.classList.toggle('menu-open', open);
        mobileBtn.setAttribute('aria-expanded', String(open));
        mobileBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    mobileBtn.addEventListener('click', () => {
        setMenuOpen(!navMenu.classList.contains('open'));
    });

    // Close on link tap, tap outside the header (e.g. the backdrop), or Escape
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('open') && !e.target.closest('.site-header')) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('open')) {
            setMenuOpen(false);
            mobileBtn.focus();
        }
    });

    // Don't leave the page scroll-locked if the screen grows to desktop width
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
        if (e.matches) setMenuOpen(false);
    });
}

/* ==========================================================================
   3. Accordion & Expandable Cards
   ========================================================================== */
function initAccordions() {
    const eventCards = document.querySelectorAll('.event-card');
    
    eventCards.forEach(card => {
        const summary = card.querySelector('.event-summary');
        if (!summary) return;

        // Make the summary row keyboard- and screen-reader-friendly
        summary.setAttribute('role', 'button');
        summary.setAttribute('tabindex', '0');
        summary.setAttribute('aria-expanded', 'false');

        function toggle() {
            const isExpanded = card.classList.toggle('expanded');
            summary.setAttribute('aria-expanded', String(isExpanded));
        }

        summary.addEventListener('click', (e) => {
            // If click originated from a link inside summary (like speaker profile), don't toggle accordion
            if (e.target.closest('a')) {
                return;
            }
            toggle();
        });

        summary.addEventListener('keydown', (e) => {
            if (e.target !== summary) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
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

    // Category pills aren't useful with only a few items; they reappear automatically once more are added
    const MIN_ITEMS_FOR_FILTERS = 4;
    const pillGroup = document.querySelector('.category-pills');
    if (pillGroup && filterableItems.length < MIN_ITEMS_FOR_FILTERS) {
        pillGroup.style.display = 'none';
        const bar = pillGroup.closest('.controls-bar');
        if (bar && !bar.querySelector('.search-input')) bar.style.display = 'none';
    }

    // Same matching as the site search (word families, related terms, typos), built from each card's text
    const toEntry = item => prepareSearchEntry({
        title: cleanText(item.querySelector('.event-topic')) || item.dataset.title || '',
        speaker: cleanText(item.querySelector('.event-speaker')) || item.dataset.speaker || '',
        meta: cleanText(item.querySelector('.event-date-badge')) || item.dataset.date || '',
        tags: `${item.dataset.category || ''} ${item.dataset.keywords || ''}`,
        body: cleanText(item.querySelector('.drawer-abstract')) || item.dataset.venue || '',
        resources: [...item.querySelectorAll('.resource-links > a, .resource-links > span')].map(el => ({ label: cleanText(el) }))
    });
    const searchable = searchInput ? [...filterableItems].map(toEntry) : [];
    // Talks outside the filtered list (e.g. Recent Events 2026) stay put, but matches are linked above the results
    const otherTalks = searchInput
        ? [...document.querySelectorAll('.event-card:not(.filterable-item)')].map(card => ({ card, entry: toEntry(card) }))
        : [];

    let status = null;
    let elsewhere = null;
    let empty = null;
    let wrapper = null;
    if (searchInput) {
        wrapper = searchInput.closest('.search-input-wrapper');

        // Clear (×) button inside the box, shown once something is typed
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'archive-clear';
        clearBtn.setAttribute('aria-label', 'Clear search');
        clearBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        clearBtn.addEventListener('click', () => { searchInput.value = ''; onInput(); searchInput.focus(); });
        wrapper.appendChild(clearBtn);
        wrapper.insertAdjacentHTML('beforeend', '<span class="search-progress archive-progress" aria-hidden="true"></span>');

        status = document.createElement('p');
        status.className = 'archive-status';
        status.setAttribute('aria-live', 'polite');
        searchInput.closest('.controls-bar').after(status);

        elsewhere = document.createElement('div');
        elsewhere.className = 'archive-elsewhere';
        elsewhere.hidden = true;
        status.after(elsewhere);
        elsewhere.addEventListener('click', (e) => {
            // Re-clicking the talk already in the URL doesn't fire hashchange, so reveal it directly
            const link = e.target.closest('a[href^="#"]');
            if (link && link.getAttribute('href') === location.hash) revealHashTarget();
        });

        empty = document.createElement('div');
        empty.className = 'archive-empty';
        empty.hidden = true;
        filterableItems[0]?.parentElement.after(empty);
    }

    /* Wraps matched words in <mark> inside a card, leaving its markup intact */
    function highlightIn(item, hits) {
        item.querySelectorAll('mark.find-hit').forEach(m => m.replaceWith(m.textContent));
        item.normalize();
        if (!hits.length) return;
        const pattern = new RegExp(`(${[...hits].sort((a, b) => b.length - a.length)
            .map(h => h.length <= 3 ? `\\b${escapeRegExp(h)}\\b` : escapeRegExp(h)).join('|')})`, 'gi');
        item.querySelectorAll('.event-topic, .event-speaker a, .drawer-abstract, .resource-links').forEach(root => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                if (!pattern.test(node.nodeValue)) return;
                pattern.lastIndex = 0;
                const frag = document.createElement('span');
                frag.innerHTML = escapeHtml(node.nodeValue).replace(pattern, '<mark class="find-hit">$1</mark>');
                node.replaceWith(...frag.childNodes);
            });
        });
    }

    function filterItems() {
        const tokens = searchInput ? queryTokens(currentSearchQuery) : [];
        const rows = [...filterableItems].map((item, i) => {
            const categories = (item.dataset.category || 'all').toLowerCase().split(/[\s,]+/).filter(Boolean);
            const inCategory = currentCategory === 'all' || categories.includes(currentCategory.toLowerCase());
            const found = tokens.map(tok => matchTokenInEntry(searchable[i], tok)).filter(Boolean);
            return { item, inCategory, matched: found.length, hits: [...new Set(found.flatMap(m => m.hits))] };
        });

        // Prefer talks containing every word; otherwise show the closest partial matches
        const inScope = rows.filter(r => r.inCategory);
        const full = inScope.filter(r => r.matched === tokens.length);
        const partial = tokens.length > 0 && !full.length && inScope.some(r => r.matched > 0);
        const showRow = r => r.inCategory && (partial ? r.matched > 0 : r.matched === tokens.length);

        let shown = 0;
        rows.forEach(r => {
            const show = showRow(r);
            const wasHidden = r.item.style.display === 'none';
            r.item.style.display = show ? '' : 'none';
            if (searchInput) highlightIn(r.item, show && tokens.length ? r.hits : []);
            if (!show) return;
            shown++;
            if (wasHidden && !prefersReducedMotion) {
                // Fade back in, skipping any pending scroll-reveal so it isn't left invisible
                r.item.classList.remove('reveal', 'is-visible', 'filter-in');
                void r.item.offsetWidth;
                r.item.style.setProperty('--i', String(shown - 1));
                r.item.classList.add('filter-in');
            }
        });

        if (!status) return;

        // Matching talks from outside the list: every-word matches, or the closest ones when nothing matches fully
        const others = otherTalks.map(o => {
            const found = tokens.map(tok => matchTokenInEntry(o.entry, tok)).filter(Boolean);
            return {
                ...o,
                matched: found.length,
                score: found.reduce((sum, m) => sum + m.score, 0),
                hits: [...new Set(found.flatMap(m => m.hits))]
            };
        }).filter(o => o.matched);
        const othersFull = others.filter(o => o.matched === tokens.length);
        const othersShown = (othersFull.length ? othersFull : full.length ? [] : others)
            .sort((a, b) => (b.matched - a.matched) || (b.score - a.score));
        elsewhere.hidden = !othersShown.length;
        elsewhere.innerHTML = othersShown.length ? `
            <span class="archive-elsewhere-label"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Also in Recent Events:</span>
            ${othersShown.map(o => `
                <a class="archive-elsewhere-link" href="#${o.card.id}">
                    <span>${highlightMatches(o.entry.title, o.hits)}</span>
                    ${o.entry.speaker ? `<span class="archive-elsewhere-speaker">${highlightMatches(o.entry.speaker, o.hits)}</span>` : ''}
                </a>`).join('')}` : '';

        const total = inScope.length;
        if (!tokens.length) status.textContent = '';
        else if (partial) status.textContent = `No archive talk has every word. Showing the closest ${shown} of ${total}.`;
        else status.textContent = `Showing ${shown} of ${total} talk${total === 1 ? '' : 's'}`;

        empty.hidden = shown > 0;
        if (!shown) {
            empty.innerHTML = `
                <span class="search-empty-icon"><i class="fa-regular fa-face-meh-blank"></i></span>
                <div>No ${othersShown.length ? 'archive ' : ''}talks match “<strong>${escapeHtml(currentSearchQuery.trim())}</strong>”</div>
                <p>Try a speaker name or a topic like “graph”, or clear the search.</p>`;
        }
    }

    let debounce = null;
    function onInput() {
        currentSearchQuery = searchInput.value;
        wrapper.classList.toggle('has-value', !!searchInput.value);
        wrapper.classList.add('is-searching');
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            wrapper.classList.remove('is-searching');
            filterItems();
        }, prefersReducedMotion ? 0 : 160);
    }

    if (searchInput) {
        searchInput.addEventListener('input', onInput);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchInput.value) {
                e.stopPropagation();
                searchInput.value = '';
                onInput();
            }
        });
    }

    filterableItems.forEach(item => item.addEventListener('animationend', (e) => {
        if (e.animationName === 'searchItemIn') item.classList.remove('filter-in');
    }));

    // A browser that restores the typed text on reload / back gets a matching filter, not a stale list
    if (searchInput && searchInput.value) onInput();

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

    // Previous / next arrows and a counter for stepping through the gallery (hidden for posters and single photos)
    const lightboxContent = lightboxModal.querySelector('.lightbox-content');
    lightboxContent.insertAdjacentHTML('beforeend', `
        <span class="lightbox-counter" aria-live="polite"></span>
        <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous photo"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="lightbox-nav lightbox-next" aria-label="Next photo"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>`);
    const counter = lightboxContent.querySelector('.lightbox-counter');
    const prevBtn = lightboxContent.querySelector('.lightbox-prev');
    const nextBtn = lightboxContent.querySelector('.lightbox-next');

    let series = [];   // gallery photos currently shown (respects the category filter)
    let current = -1;
    let switchTimer = null;

    function setImage(src, alt, captionHtml) {
        if (lightboxImg) {
            lightboxImg.src = src;
            lightboxImg.alt = alt || '';
        }
        if (lightboxCaption) {
            lightboxCaption.innerHTML = captionHtml || '';
        }
    }

    function openLightbox(src, alt, captionHtml) {
        setImage(src, alt, captionHtml);
        lastFocused = document.activeElement;
        lightboxModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (closeBtn) closeBtn.focus();
    }

    function closeLightbox() {
        lightboxModal.classList.remove('active', 'has-series');
        document.body.style.overflow = '';
        series = [];
        current = -1;
        if (lastFocused) lastFocused.focus();
    }

    let lastFocused = null;

    function photoCaption(item) {
        const { speaker, title, date, venue } = item.dataset;
        if (speaker || title || date || venue) {
            return `
                <div class="lightbox-info">
                    ${title ? `<div class="lightbox-title">${title}</div>` : ''}
                    <div class="lightbox-meta">
                        ${speaker ? `<span class="lightbox-speaker"><i class="fa-solid fa-circle-user"></i> ${speaker}</span>` : ''}
                        ${date ? `<span class="lightbox-date"><i class="fa-regular fa-calendar"></i> ${date}</span>` : ''}
                        ${venue ? `<span class="lightbox-venue"><i class="fa-solid fa-location-dot"></i> ${venue}</span>` : ''}
                    </div>
                </div>
            `;
        }
        const caption = item.querySelector('.gallery-caption')?.textContent || '';
        const sub = item.querySelector('.gallery-sub')?.textContent || '';
        return `<strong>${caption}</strong><br><span style="font-size:0.85rem; color: #94a3b8;">${sub}</span>`;
    }

    function photoArgs(item) {
        const img = item.querySelector('img');
        return [img.currentSrc || img.src, img.alt || item.dataset.title || item.dataset.speaker || 'Photo View', photoCaption(item)];
    }

    /* Warm up the neighbouring photos so stepping feels instant */
    function preloadAround(i) {
        [i - 1, i + 1].forEach(n => {
            const img = series[(n + series.length) % series.length]?.querySelector('img');
            if (img) new Image().src = img.currentSrc || img.src;
        });
    }

    function showPhoto(i) {
        current = (i + series.length) % series.length;
        const item = series[current];
        counter.textContent = `${current + 1} / ${series.length}`;
        // Quick fade between photos
        clearTimeout(switchTimer);
        lightboxImg.classList.add('is-switching');
        switchTimer = setTimeout(() => {
            const reveal = () => lightboxImg.classList.remove('is-switching');
            lightboxImg.addEventListener('load', reveal, { once: true });
            lightboxImg.addEventListener('error', reveal, { once: true });
            setImage(...photoArgs(item));
            if (lightboxImg.complete) reveal();
        }, prefersReducedMotion ? 0 : 150);
        preloadAround(current);
    }

    function step(delta) {
        if (series.length > 1) showPhoto(current + delta);
    }

    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));

    // Swipe left / right on touch screens
    let touchX = null;
    let touchY = null;
    lightboxModal.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, { passive: true });
    lightboxModal.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        touchX = touchY = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    });

    // Let keyboard users open clickable photos/posters with Enter or Space
    document.querySelectorAll('.gallery-item, .lightbox-trigger, #talk-poster-trigger').forEach(el => {
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
            }
        });
    });

    galleryItems.forEach(item => {
        // While a photo loads (or if it fails), its alt text is shown in its place; the photo fades in once ready
        const photo = item.querySelector('img');
        if (photo && photo.alt) {
            const placeholder = document.createElement('span');
            placeholder.className = 'gallery-placeholder';
            placeholder.setAttribute('aria-hidden', 'true'); // screen readers already read the img alt
            placeholder.textContent = photo.alt;
            item.prepend(placeholder);
            if (!(photo.complete && photo.naturalWidth)) {
                item.classList.add('is-loading');
                photo.addEventListener('load', () => item.classList.remove('is-loading'), { once: true });
                photo.addEventListener('error', () => item.classList.add('is-broken'), { once: true });
            }
        }

        item.addEventListener('click', () => {
            if (!item.querySelector('img')) return;
            // Step through the photos currently shown (hidden by a category filter = skipped)
            series = [...galleryItems].filter(el => el.querySelector('img') && el.style.display !== 'none');
            if (!series.includes(item)) series = [item];
            current = series.indexOf(item);
            lightboxModal.classList.toggle('has-series', series.length > 1);
            counter.textContent = `${current + 1} / ${series.length}`;
            openLightbox(...photoArgs(item));
            preloadAround(current);
        });
    });

    posterTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const img = trigger.querySelector('img');
            const href = trigger.getAttribute('href');
            const isImgHref = href && /\.(png|jpe?g|webp|gif|svg)$/i.test(href);
            // currentSrc is the file a <picture> actually chose (e.g. WebP over GIF)
            const src = img?.currentSrc || img?.src || (isImgHref ? href : null);
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
        closeBtn.addEventListener('click', closeLightbox);
    }

    // Tapping anywhere outside the photo and its caption closes the viewer
    lightboxModal.addEventListener('click', (e) => {
        if (!e.target.closest('.lightbox-img, .lightbox-caption > *, .lightbox-close, .lightbox-nav, .lightbox-counter')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!lightboxModal.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'ArrowRight') step(1);
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

/* ==========================================================================
   8. Scroll Effects: Header Shadow, Progress Bar & Back-to-Top
   ========================================================================== */
function initScrollEffects() {
    const header = document.querySelector('.site-header');

    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    if (header) header.appendChild(progressBar);

    const topBtn = document.createElement('button');
    topBtn.className = 'back-to-top';
    topBtn.setAttribute('aria-label', 'Back to top');
    topBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    document.body.appendChild(topBtn);

    let ticking = false;

    function update() {
        const scrollY = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

        if (header) header.classList.toggle('scrolled', scrollY > 10);
        progressBar.style.transform = `scaleX(${progress})`;
        topBtn.classList.toggle('visible', scrollY > window.innerHeight * 0.6);
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });
    window.addEventListener('resize', update);

    update();
}

/* ==========================================================================
   9. Reveal-on-Scroll Animations
   ========================================================================== */
function initRevealOnScroll() {
    if (prefersReducedMotion || isLiteMode || !('IntersectionObserver' in window)) return;
    // On reload / back-forward the browser restores the scroll position; fading content in there would flicker
    if (navigationType !== 'navigate' || location.hash) return;

    const selectors = [
        '.section-title',
        '.section-subtitle',
        '.featured-card',
        '.event-card',
        '.about-card',
        '.controls-bar',
        '.gallery-item',
        '.member-card',
        '.site-footer .footer-grid > *'
    ];
    const targets = document.querySelectorAll(selectors.join(','));

    // Stagger siblings in the same list/grid (capped so long lists don't lag).
    // Anything already on screen stays as painted: hiding it to fade it back in would flicker.
    const fold = window.innerHeight;
    targets.forEach(el => {
        if (el.getBoundingClientRect().top < fold) return;
        const siblings = Array.from(el.parentElement.children).filter(c => c.matches(selectors.join(',')));
        const index = siblings.indexOf(el);
        el.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 0.08}s`);
        el.classList.add('reveal');
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('is-visible');
            const cleanup = (e) => {
                if (e.target !== el) return; // ignore bubbled child animations
                el.classList.remove('reveal', 'is-visible');
                el.style.removeProperty('--reveal-delay');
                el.removeEventListener('animationend', cleanup);
            };
            el.addEventListener('animationend', cleanup);
            observer.unobserve(el);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => { if (el.classList.contains('reveal')) observer.observe(el); });
}

/* ==========================================================================
   10. Site-wide Search (Ctrl/⌘+K or "/")
   The index is built from the site's own pages, so new talks are searchable
   automatically. Pages are fetched over HTTP; when opened as local files the
   browser blocks that, and only the current page is searched.
   ========================================================================== */
const SEARCH_PAGES = ['index.html', 'events.html', 'gallery.html', 'contact.html'];
const SEARCH_TYPES = {
    upcoming: { label: 'Upcoming Talk', icon: 'fa-bolt', order: 0 },
    talk: { label: 'Talks', icon: 'fa-microphone-lines', order: 1 },
    person: { label: 'People', icon: 'fa-user', order: 2 },
    photo: { label: 'Gallery', icon: 'fa-image', order: 3 },
    page: { label: 'Pages', icon: 'fa-file-lines', order: 4 }
};
const SEARCH_SUGGESTIONS = ['Medical imaging', 'Graph ML', 'Robotics', 'Privacy', 'Ensemble', 'Lottery ticket'];

function slugify(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function cleanText(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function normalizeText(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function currentPageName() {
    return location.pathname.split('/').pop() || 'index.html';
}

/* Gives searchable blocks stable ids. Runs on fetched pages and the live page alike, so links match. */
function assignSearchAnchors(doc) {
    doc.querySelectorAll('.event-card').forEach(card => {
        const date = cleanText(card.querySelector('.event-date-badge'));
        const topic = cleanText(card.querySelector('.event-topic'));
        if (topic && !card.id) card.id = 'talk-' + slugify(`${date} ${topic}`);
    });
    doc.querySelectorAll('.member-card').forEach(card => {
        const name = cleanText(card.querySelector('.member-name'));
        if (name && !card.id) card.id = 'member-' + slugify(name);
    });
    doc.querySelectorAll('.gallery-item').forEach(item => {
        const title = item.dataset.title || item.querySelector('img')?.alt || '';
        if (title && !item.id) item.id = 'photo-' + slugify(title);
    });
    const about = doc.querySelector('.about-section');
    if (about && !about.id) about.id = 'about';
    const upcoming = doc.querySelector('main .featured-card')?.closest('section');
    if (upcoming && !upcoming.id) upcoming.id = 'next-talk';
    const form = doc.querySelector('iframe[src*="docs.google.com/forms"]')?.closest('section');
    if (form && !form.id) form.id = 'propose';
}

/* Scrolls to #anchor targets (from search results), expanding talk cards and flashing a highlight */
/* `onLoad`: the page was opened with this #hash, so jump straight there (no visible scroll from the top) */
function revealHashTarget(onLoad = false) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    // Skip the scroll-reveal fade so the target is visible while it's highlighted
    target.classList.remove('reveal', 'is-visible');

    if (target.classList.contains('event-card') && !target.classList.contains('expanded')) {
        target.classList.add('expanded');
        target.querySelector('.event-summary')?.setAttribute('aria-expanded', 'true');
    }
    // Glow a card, not a whole section (sections glow their main card, if they have one)
    const glow = target.matches('.event-card, .member-card, .gallery-item')
        ? target : target.querySelector('.featured-card, .about-card');

    // Reload / back-forward: the browser restores the scroll position itself, so don't jump or glow
    if (onLoad && navigationType !== 'navigate') return;

    if (onLoad) {
        // Jump now, and again once web fonts have settled the layout (only if the visitor hasn't scrolled since)
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
        const landedAt = window.scrollY;
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (Math.abs(window.scrollY - landedAt) < 4) target.scrollIntoView({ behavior: 'instant', block: 'start' });
            });
        }
    }

    // Let layout (fonts, the expanding drawer) settle before scrolling
    setTimeout(() => {
        if (!onLoad) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        if (!glow) return;
        glow.classList.remove('search-hit');
        void glow.offsetWidth; // restart the highlight if it already ran
        glow.classList.add('search-hit');
        glow.addEventListener('animationend', (e) => {
            if (e.animationName === 'searchHit') glow.classList.remove('search-hit');
        });
    }, 120);
}

/* The links and labels under a talk (slides, references, papers, profile, venue) so they're searchable */
function resourcesOf(card, page) {
    return [...card.querySelectorAll('.resource-links > a, .resource-links > span')].map(el => {
        const href = el.tagName === 'A' ? el.getAttribute('href') : null;
        return {
            label: cleanText(el),
            // resolve relative file paths against the page they came from
            href: href && !/^[a-z]+:/i.test(href) ? new URL(href, new URL(page, location.href)).href : href,
            download: el.hasAttribute('download'),
            newTab: el.getAttribute('target') === '_blank'
        };
    });
}

function buildEntriesFromDoc(doc, page) {
    const entries = [];
    const add = (e) => entries.push({ ...e, url: e.url || page });

    const pageTitle = cleanText(doc.querySelector('title')).replace(/\s*•.*$/, '');
    add({
        type: 'page',
        title: page === 'index.html' ? 'Home' : pageTitle,
        meta: page,
        body: doc.querySelector('meta[name="description"]')?.content || ''
    });

    if (page === 'events.html') {
        const upcoming = doc.querySelector('#next-talk .featured-card');
        if (upcoming) {
            add({
                type: 'upcoming',
                title: cleanText(upcoming.querySelector('.featured-title')),
                speaker: cleanText(upcoming.querySelector('.presenter-name')).replace(/^Speaker:\s*/i, '').replace(/\s*Profile$/, ''),
                meta: cleanText(upcoming.querySelector('.fa-calendar')?.parentElement),
                body: cleanText(upcoming.querySelector('.abstract-box')).replace(/^Abstract\s*/i, ''),
                resources: resourcesOf(upcoming, page),
                url: `${page}#next-talk`,
                boost: 3
            });
        }
        doc.querySelectorAll('.event-card').forEach(card => {
            const archived = !!card.closest('#archive-2024');
            add({
                type: 'talk',
                title: cleanText(card.querySelector('.event-topic')),
                speaker: cleanText(card.querySelector('.event-speaker')),
                meta: cleanText(card.querySelector('.event-date-badge')) + (archived ? ' • PANDA archive' : ''),
                body: cleanText(card.querySelector('.drawer-abstract')).replace(/^(Abstract|Background & Details):\s*/i, ''),
                tags: `${card.dataset.category || ''} ${card.dataset.keywords || ''}`, // keywords: extra search terms
                resources: resourcesOf(card, page),
                url: `${page}#${card.id}`
            });
        });
    }

    if (page === 'gallery.html') {
        doc.querySelectorAll('.gallery-item').forEach(item => add({
            type: 'photo',
            title: item.dataset.title || item.querySelector('img')?.alt || 'Photo',
            speaker: item.dataset.speaker || '',
            meta: item.dataset.date || '',
            body: item.dataset.venue || '',
            tags: item.dataset.keywords || '',
            url: `${page}#${item.id}`
        }));
    }

    if (page === 'contact.html') {
        doc.querySelectorAll('.member-card').forEach(card => add({
            type: 'person',
            title: cleanText(card.querySelector('.member-name')),
            meta: cleanText(card.querySelector('.member-responsibility')),
            body: cleanText(card.querySelector('.member-affiliation')),
            tags: 'coordinator organizer contact email',
            url: `${page}#${card.id}`
        }));
        if (doc.getElementById('propose')) {
            add({
                type: 'page',
                title: 'Propose a Talk / Paper Idea',
                meta: 'Speaker proposal form',
                body: 'Submit your talk proposal or paper idea via the Google Form.',
                tags: 'speaker present research submit',
                url: `${page}#propose`,
                boost: 2
            });
        }
    }

    if (page === 'index.html' && doc.getElementById('about')) {
        add({
            type: 'page',
            title: 'About IdoAI & Venue',
            meta: 'Tuesdays • 5:00 PM IST',
            body: cleanText(doc.querySelector('#about .about-main')).replace(/^About IdoAI\s*/, ''),
            tags: cleanText(doc.querySelector('#about .venue-box')),
            url: `${page}#about`
        });
    }

    return entries;
}

async function buildSearchIndex() {
    const here = currentPageName();
    const docs = await Promise.all(SEARCH_PAGES.map(async (page) => {
        if (page === here) return [page, document];
        try {
            const res = await fetch(page);
            if (!res.ok) return null;
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            assignSearchAnchors(doc);
            return [page, doc];
        } catch {
            return null; // e.g. file:// previews block fetch
        }
    }));

    return docs.filter(Boolean).flatMap(([page, doc]) => buildEntriesFromDoc(doc, page))
        .map(e => markCurrentPage(e, here)).map(prepareSearchEntry);
}

/* Results on the page being viewed are listed first. A talk also shown here (e.g. on Home) links to this copy. */
function markCurrentPage(e, here) {
    const [page, anchor] = e.url.split('#');
    if (page === here) return { ...e, here: true };
    if (anchor && document.getElementById(anchor)) return { ...e, here: true, url: `${here}#${anchor}` };
    return e;
}

/* Adds the normalized text, words and word stems the matcher works on */
function prepareSearchEntry(e) {
    const n = {
        title: normalizeText(e.title),
        speaker: normalizeText(e.speaker),
        meta: normalizeText(`${e.meta || ''} ${e.tags || ''}`),
        body: normalizeText(e.body),
        resources: normalizeText((e.resources || []).map(r => r.label).join(' · '))
    };
    const w = {}, s = {};
    for (const field of Object.keys(n)) {
        w[field] = searchWords(n[field]);
        s[field] = w[field].map(stemWord);
    }
    return { ...e, n, w, s };
}

/* --------------------------------------------------------------------------
   Matching. Each query word is tried, strongest first, as:
   exact text → same word family (imaging ≈ image ≈ imagery) → related term
   (medical ≈ clinical) → small typo (robtics ≈ robotics).
   Every word must match; if no result has them all, the closest are shown.
   -------------------------------------------------------------------------- */
const SEARCH_FIELDS = { title: 12, speaker: 10, resources: 9, meta: 5, body: 3 };
const SEARCH_STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'for', 'with', 'in', 'on', 'to', 'by', 'at', 'from', 'about']);
const SEARCH_RELATED = [
    ['medical', 'clinical', 'clinic', 'healthcare', 'health', 'diagnosis', 'diagnostic', 'radiology', 'radiologist', 'cancer'],
    ['imaging', 'image', 'imagery', 'ultrasound', 'radiology', 'computer vision', 'visual'],
    ['vision', 'computer vision', 'image', 'visual', 'detection', 'yolo'],
    ['ml', 'machine learning', 'deep learning', 'learning'],
    ['dl', 'deep learning', 'neural network', 'neural networks'],
    ['ai', 'artificial intelligence'],
    ['cv', 'computer vision'],
    ['gnn', 'graph neural network', 'graph machine learning', 'graph learning'],
    ['llm', 'language model', 'language models'],
    ['nlp', 'language model', 'natural language'],
    ['robot', 'robotic', 'robotics', 'manipulator', 'ros'],
    ['privacy', 'eavesdropping', 'adversaries', 'security', 'encryption'],
    ['finance', 'financial', 'esg', 'investing', 'portfolio', 'asset'],
    ['fairness', 'bias', 'biasness'],
    ['pruning', 'sparse', 'sparsity', 'lottery ticket', 'subnetworks'],
    ['behaviour', 'behavior', 'gesture', 'gaze', 'social'],
    ['talk', 'seminar', 'session', 'lecture'],
    ['slides', 'slide', 'presentation', 'pptx', 'ppt', 'deck'],
    ['references', 'reference', 'bibliography', 'reading list'],
    ['paper', 'papers', 'arxiv', 'publication', 'source material'],
    ['download', 'downloads', 'file', 'files']
];

function searchWords(text) {
    return text.split(/[^a-z0-9]+/).filter(Boolean);
}

/* Light suffix stripping so word families share a stem */
function stemWord(word) {
    if (word.length <= 3) return word;
    const rules = [['ational', 'ate'], ['ization', 'ize'], ['ations', 'ate'], ['ation', 'ate'], ['ings', ''], ['ing', ''],
        ['ies', 'y'], ['ied', 'y'], ['ery', ''], ['ity', ''], ['ment', ''], ['ers', ''], ['er', ''], ['ed', ''],
        ['es', ''], ['ly', ''], ['s', '']];
    for (const [suffix, replacement] of rules) {
        if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
            word = word.slice(0, -suffix.length) + replacement;
            break;
        }
    }
    return word.length > 4 && word.endsWith('e') ? word.slice(0, -1) : word;
}

function stemsMatch(a, b) {
    return a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
}

/* Edit distance allowing insert / delete / substitute / swapped neighbours; stops early past `max` */
function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
            cur[j] = v;
            rowMin = Math.min(rowMin, v);
        }
        if (rowMin > max) return max + 1;
        prev2 = prev;
        prev = cur;
    }
    return prev[b.length];
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Whole words for short terms (so "ai" doesn't match "domain"), word starts for longer ones */
function containsTerm(text, term) {
    const t = escapeRegExp(term);
    return term.length <= 3
        ? new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(text)
        : new RegExp(`(^|[^a-z0-9])${t}`).test(text);
}

function relatedTerms(token) {
    const stem = stemWord(token);
    const out = new Set();
    SEARCH_RELATED.forEach(group => {
        const inGroup = group.some(term => term === token || (!term.includes(' ') && stemsMatch(stemWord(term), stem)));
        if (inGroup) group.forEach(term => out.add(term));
    });
    out.delete(token);
    return [...out];
}

function prepareToken(t) {
    return { t, stem: stemWord(t), related: relatedTerms(t), maxTypos: t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0 };
}

/* Typos are rarely in the first letters: whole words must share the first letter,
   word beginnings (still being typed) the first two */
function isTypoOf(t, word, k) {
    if (word.length < 3 || word[0] !== t[0]) return false;
    if (editDistance(t, word, k) <= k) return true;
    return word.length > t.length && word[1] === t[1]
        && (editDistance(t, word.slice(0, t.length), k) <= k || editDistance(t, word.slice(0, t.length + 1), k) <= k);
}

/* Kind of match, strongest first: exact text > word family > related term > typo */
const MATCH_TIER = { 1: 3, 0.7: 3, 0.85: 2, 0.5: 1, 0.45: 0 };

function matchTokenInEntry(entry, tok) {
    let best = null;
    let topTier = -1;
    let allHits = new Set(); // matched words for highlighting, from the strongest kind of match only
    for (const [field, weight] of Object.entries(SEARCH_FIELDS)) {
        const text = entry.n[field];
        if (!text) continue;
        const words = entry.w[field];
        let level = 0;
        let hits = [];

        if (tok.t.length <= 2 ? containsTerm(text, tok.t) : text.includes(tok.t)) {
            level = containsTerm(text, tok.t) ? 1 : 0.7;
            hits = [tok.t];
        } else {
            const family = tok.stem.length >= 3 ? words.filter((w, i) => stemsMatch(entry.s[field][i], tok.stem)) : [];
            const related = family.length ? [] : tok.related.filter(r => containsTerm(text, r));
            if (family.length) {
                level = 0.85;
                hits = family;
            } else if (related.length) {
                level = 0.5;
                hits = related;
            } else if (tok.maxTypos) {
                const typos = words.filter(w => isTypoOf(tok.t, w, tok.maxTypos));
                if (typos.length) {
                    level = 0.45;
                    hits = typos;
                }
            }
        }
        if (!level) continue;
        // Weaker kinds of match (e.g. a near-typo) aren't highlighted when a stronger one was found
        const tier = MATCH_TIER[level];
        if (tier > topTier) { topTier = tier; allHits = new Set(); }
        if (tier === topTier) hits.forEach(h => allHits.add(h));
        if (!best || weight * level > best.score) best = { score: weight * level };
    }
    return best && { score: best.score, hits: [...allHits] };
}

/* Query → prepared words (stopwords like "the" / "of" dropped unless that's all there is) */
function queryTokens(query) {
    let words = searchWords(normalizeText(query));
    const meaningful = words.filter(w => !SEARCH_STOPWORDS.has(w));
    if (meaningful.length) words = meaningful;
    return [...new Set(words)].map(prepareToken);
}

function searchEntries(index, query) {
    const tokens = queryTokens(query);
    if (!tokens.length) return { items: [], partial: false };

    const scored = index.map(entry => {
        const found = tokens.map(tok => matchTokenInEntry(entry, tok)).filter(Boolean);
        if (!found.length) return null;
        return {
            entry,
            matched: found.length,
            score: found.reduce((sum, m) => sum + m.score, 0) + (entry.boost || 0),
            hits: [...new Set(found.flatMap(m => m.hits))]
        };
    }).filter(Boolean);

    // Prefer results containing every word; otherwise fall back to the closest partial matches
    let pool = scored.filter(r => r.matched === tokens.length);
    const partial = !pool.length && scored.length > 0;
    if (partial) pool = scored.map(r => ({ ...r, score: r.score * (r.matched / tokens.length) }));

    // Matches on the current page come first; the rest stay grouped by type, strongest group first
    const groupBest = {};
    pool.forEach(r => { groupBest[r.entry.type] = Math.max(groupBest[r.entry.type] || 0, r.score); });
    const items = pool
        .sort((a, b) => (!!b.entry.here - !!a.entry.here)
            || (groupBest[b.entry.type] - groupBest[a.entry.type])
            || (SEARCH_TYPES[a.entry.type].order - SEARCH_TYPES[b.entry.type].order)
            || (b.score - a.score))
        .slice(0, 24)
        .map(r => ({ ...r.entry, hits: r.hits }));
    return { items, partial };
}

function fileIcon(res) {
    const s = `${res.label} ${res.href}`.toLowerCase();
    if (/\.pptx?\b|presentation|slides/.test(s) && !/\.pdf\b/.test(res.href.toLowerCase())) return 'fa-solid fa-file-powerpoint';
    if (/\.pdf\b|\(pdf\)/.test(s)) return 'fa-solid fa-file-pdf';
    if (/profile/.test(s)) return 'fa-solid fa-circle-user';
    return 'fa-solid fa-arrow-up-right-from-square';
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function highlightMatches(text, terms) {
    const html = escapeHtml(text);
    if (!terms.length) return html;
    const pattern = [...terms].sort((a, b) => b.length - a.length)
        .map(t => t.length <= 3 ? `\\b${escapeRegExp(escapeHtml(t))}\\b` : escapeRegExp(escapeHtml(t))).join('|');
    return html.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

/* A short excerpt of the body centred on the first matching word */
function matchSnippet(text, terms) {
    if (!text) return '';
    const lower = normalizeText(text);
    const hit = terms.map(t => lower.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
    if (hit === undefined) return text.length > 140 ? text.slice(0, 140).trim() + '…' : text;
    // Window around the hit, snapped to whole words
    let start = Math.max(0, hit - 50);
    let end = Math.min(text.length, hit + 90);
    if (start > 0) { const sp = text.indexOf(' ', start); if (sp > -1 && sp < hit) start = sp + 1; }
    if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > hit) end = sp; }
    return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

/* Recent searches, kept only in this browser */
const SEARCH_HISTORY_KEY = 'idoai-search-history';
const SEARCH_HISTORY_MAX = 6;

function loadSearchHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY));
        return Array.isArray(saved) ? saved.filter(q => typeof q === 'string').slice(0, SEARCH_HISTORY_MAX) : [];
    } catch {
        return [];
    }
}

function saveSearchHistory(list) {
    try {
        if (list.length) localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
        else localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch { /* storage blocked (private mode etc.): history just isn't kept */ }
}

function rememberSearch(query) {
    const q = query.trim().replace(/\s+/g, ' ');
    if (q.length < 2) return;
    const list = loadSearchHistory().filter(item => item.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    saveSearchHistory(list.slice(0, SEARCH_HISTORY_MAX));
}

function forgetSearch(query) {
    saveSearchHistory(loadSearchHistory().filter(item => item !== query));
}

function initSiteSearch() {
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

    // Header trigger is in each page's HTML (so the header never shifts on load); create it if missing
    let trigger = actions.querySelector('.search-trigger');
    if (!trigger) {
        trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'search-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.innerHTML = `<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <span class="search-trigger-label">Search</span><kbd class="search-trigger-kbd"></kbd>`;
        actions.insertBefore(trigger, actions.firstChild);
    }
    trigger.setAttribute('aria-label', `Search the site (${isMac ? '⌘' : 'Ctrl'}+K)`);
    trigger.querySelector('.search-trigger-kbd').textContent = isMac ? '⌘K' : 'Ctrl K';

    const modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.innerHTML = `
        <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search IdoAI">
            <div class="search-field">
                <span class="search-field-icon" aria-hidden="true">
                    <i class="fa-solid fa-magnifying-glass"></i><span class="search-spinner"></span>
                </span>
                <input type="search" class="search-input-global" placeholder="Search talks, speakers, topics…"
                    autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false"
                    aria-controls="search-results" aria-autocomplete="list" aria-label="Search">
                <button type="button" class="search-close" aria-label="Close search"><kbd>Esc</kbd><i
                    class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                <span class="search-progress" aria-hidden="true"></span>
            </div>
            <div class="search-body">
                <div class="search-status" aria-live="polite"></div>
                <ul id="search-results" class="search-results" role="listbox" aria-label="Search results"></ul>
            </div>
            <div class="search-footer" aria-hidden="true">
                <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                <span><kbd>Enter</kbd> open</span>
                <span><kbd>Esc</kbd> close</span>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const panel = modal.querySelector('.search-panel');
    const input = modal.querySelector('.search-input-global');
    const field = modal.querySelector('.search-field');
    const status = modal.querySelector('.search-status');
    const list = modal.querySelector('.search-results');
    const closeBtn = modal.querySelector('.search-close');

    let indexPromise = null;
    let indexReady = false;
    let results = [];
    let active = -1;
    let debounce = null;
    let lastFocused = null;

    const loadIndex = () => {
        if (!indexPromise) indexPromise = buildSearchIndex().then(index => { indexReady = true; return index; });
        return indexPromise;
    };

    function openSearch() {
        // Close the mobile menu first if it's open
        if (document.getElementById('nav-menu')?.classList.contains('open')) {
            document.getElementById('mobile-menu-toggle')?.click();
        }
        lastFocused = document.activeElement;
        modal.classList.add('open');
        document.body.classList.add('search-open');
        input.value = '';
        renderIdle();
        setTimeout(() => input.focus(), 30);
        loadIndex();
    }

    function closeSearch() {
        modal.classList.remove('open');
        document.body.classList.remove('search-open');
        input.setAttribute('aria-expanded', 'false');
        if (lastFocused) lastFocused.focus();
    }

    // Arrow keys move through results, or through recent searches when the box is empty
    const navigable = () => list.querySelectorAll('.search-result, .search-history-item:not(.removing)');

    function setActive(i) {
        const items = navigable();
        items.forEach(el => el.classList.remove('active'));
        active = items.length ? (i + items.length) % items.length : -1;
        if (active >= 0) {
            items[active].classList.add('active');
            input.setAttribute('aria-activedescendant', items[active].id);
            items[active].scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function historyHtml() {
        const history = loadSearchHistory();
        if (!history.length) return '';
        return `
            <li class="search-history">
                <div class="search-idle-head">
                    <span class="search-idle-title">Recent searches</span>
                    <button type="button" class="search-history-clear">Clear all</button>
                </div>
                <ul class="search-history-list">
                    ${history.map((q, i) => `
                        <li class="search-history-item" id="search-hist-${i}" role="option" data-query="${escapeHtml(q)}" style="--i:${i}">
                            <button type="button" class="search-history-run" tabindex="-1">
                                <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>${escapeHtml(q)}</span>
                            </button>
                            <button type="button" class="search-history-remove" aria-label="Remove “${escapeHtml(q)}” from recent searches">
                                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                        </li>`).join('')}
                </ul>
            </li>`;
    }

    function runQuery(q) {
        input.value = q;
        runSearch();
        input.focus();
    }

    /* Slide one recent search out, then drop it (and the section, once empty) */
    function removeHistoryItem(item) {
        forgetSearch(item.dataset.query);
        item.classList.add('removing');
        setTimeout(() => {
            const section = item.closest('.search-history');
            item.remove();
            if (section && !section.querySelector('.search-history-item')) section.remove();
            setActive(-1);
        }, prefersReducedMotion ? 0 : 250);
    }

    function clearHistory(section) {
        saveSearchHistory([]);
        section.classList.add('clearing');
        setTimeout(() => { section.remove(); setActive(-1); }, prefersReducedMotion ? 0 : 200);
    }

    function renderIdle() {
        results = [];
        active = -1;
        field.classList.remove('is-searching');
        status.textContent = '';
        list.innerHTML = `
            ${historyHtml()}
            <li class="search-idle">
                <div class="search-idle-title">Try searching for</div>
                <div class="search-chips">
                    ${SEARCH_SUGGESTIONS.map((s, i) => `<button type="button" class="search-chip" style="--i:${i}">${s}</button>`).join('')}
                </div>
                <div class="search-idle-title">Jump to</div>
                <div class="search-chips">
                    <a class="search-chip" style="--i:6" href="events.html#next-talk"><i class="fa-solid fa-bolt"></i> Upcoming talk</a>
                    <a class="search-chip" style="--i:7" href="events.html#archive-2024"><i class="fa-solid fa-box-archive"></i> 2024 archive</a>
                    <a class="search-chip" style="--i:8" href="contact.html#propose"><i class="fa-solid fa-paper-plane"></i> Propose a talk</a>
                </div>
            </li>`;
        list.querySelectorAll('button.search-chip').forEach(chip => chip.addEventListener('click', () => runQuery(chip.textContent)));
        list.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('mousemove', () => {
                const i = [...navigable()].indexOf(item);
                if (i >= 0 && active !== i) setActive(i);
            });
        });
    }

    function renderSkeleton() {
        list.innerHTML = Array.from({ length: 3 }, () => `
            <li class="search-skeleton" aria-hidden="true">
                <span class="sk sk-icon"></span>
                <span class="sk-lines"><span class="sk sk-line"></span><span class="sk sk-line short"></span></span>
            </li>`).join('');
    }

    function render(query, partial) {
        input.setAttribute('aria-expanded', String(results.length > 0));

        if (!results.length) {
            status.textContent = 'No results';
            list.innerHTML = `
                <li class="search-empty">
                    <span class="search-empty-icon"><i class="fa-regular fa-face-meh-blank"></i></span>
                    <div>No results for “<strong>${escapeHtml(query)}</strong>”</div>
                    <p>Try a speaker name, a topic like “vision”, or a year.</p>
                </li>`;
            return;
        }

        const count = `${results.length} result${results.length === 1 ? '' : 's'}`;
        status.textContent = partial ? `No result has every word. Showing the closest ${count}` : count;
        let html = '';
        let lastType = null;
        results.forEach((r, i) => {
            const tokens = r.hits;
            const group = r.here ? 'here' : r.type;
            if (group !== lastType) {
                html += `<li class="search-group" role="presentation" style="--i:${i}">${r.here ? 'On this page' : SEARCH_TYPES[r.type].label}</li>`;
                lastType = group;
            }
            const meta = [r.speaker, r.meta].filter(Boolean)
                .map(m => highlightMatches(m, tokens)).join(' <span class="dot">•</span> ');
            // Files and links under the talk that match the search (e.g. "slides") become direct download chips
            const files = (r.resources || [])
                .filter(res => res.href && tokens.some(t => containsTerm(normalizeText(res.label), t)))
                .slice(0, 3);
            const filesHtml = files.length ? `
                <div class="search-result-files">
                    ${files.map(res => `
                        <a class="search-file" href="${escapeHtml(res.href)}"${res.download ? ' download' : ''}${res.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>
                            <i class="${fileIcon(res)}" aria-hidden="true"></i><span>${highlightMatches(res.label, tokens)}</span>
                        </a>`).join('')}
                </div>` : '';
            html += `
                <li class="search-result type-${r.type}" id="search-opt-${i}" role="option" style="--i:${i}">
                    <a href="${r.url}" tabindex="-1">
                        <span class="search-result-icon"><i class="fa-solid ${SEARCH_TYPES[r.type].icon}"></i></span>
                        <span class="search-result-text">
                            <span class="search-result-title">${highlightMatches(r.title, tokens)}</span>
                            ${meta ? `<span class="search-result-meta">${meta}</span>` : ''}
                            ${r.body ? `<span class="search-result-snippet">${highlightMatches(matchSnippet(r.body, tokens), tokens)}</span>` : ''}
                        </span>
                        <i class="fa-solid fa-arrow-right search-result-go" aria-hidden="true"></i>
                    </a>${filesHtml}
                </li>`;
        });
        list.innerHTML = html;
        list.querySelectorAll('.search-result').forEach((el, i) => {
            el.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
        });
        setActive(0);
    }

    function runSearch() {
        const query = input.value.trim();
        clearTimeout(debounce);
        if (!query) { renderIdle(); return; }

        // Visible "searching" state: spinner in the field and a sweeping bar; skeleton rows while the index loads
        field.classList.add('is-searching');
        if (!indexReady) renderSkeleton();

        debounce = setTimeout(async () => {
            const index = await loadIndex();
            if (input.value.trim() !== query) return; // a newer keystroke took over
            const { items, partial } = searchEntries(index, query);
            results = items;
            field.classList.remove('is-searching');
            render(query, partial);
        }, prefersReducedMotion ? 0 : 220);
    }

    function go(link) {
        const url = new URL(link.href, location.href);
        const samePage = url.pathname === location.pathname
            || (url.pathname.split('/').pop() === currentPageName());
        if (input.value.trim()) rememberSearch(input.value);
        closeSearch();
        if (samePage && url.hash) {
            if (location.hash === url.hash) revealHashTarget();
            else location.hash = url.hash;
        } else {
            location.href = link.href;
        }
    }

    trigger.addEventListener('click', openSearch);
    trigger.addEventListener('mouseenter', loadIndex, { once: true }); // warm the index before the click
    closeBtn.addEventListener('click', closeSearch);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeSearch(); });
    input.addEventListener('input', runSearch);

    list.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.search-history-remove');
        if (removeBtn) {
            removeHistoryItem(removeBtn.closest('.search-history-item'));
            input.focus();
            return;
        }
        const clearBtn = e.target.closest('.search-history-clear');
        if (clearBtn) {
            clearHistory(clearBtn.closest('.search-history'));
            input.focus();
            return;
        }
        const historyItem = e.target.closest('.search-history-item');
        if (historyItem) {
            runQuery(historyItem.dataset.query);
            return;
        }
        // File chips download / open directly (default link behaviour); just remember the search
        if (e.target.closest('.search-file')) {
            if (input.value.trim()) rememberSearch(input.value);
            return;
        }
        const link = e.target.closest('a');
        if (!link) return;
        e.preventDefault();
        go(link);
    });

    input.addEventListener('keydown', (e) => {
        const current = navigable()[active];
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Enter') {
            if (current?.classList.contains('search-history-item')) {
                e.preventDefault();
                runQuery(current.dataset.query);
                return;
            }
            const link = current?.querySelector('a');
            if (link) { e.preventDefault(); go(link); }
        } else if (e.key === 'Delete' && current?.classList.contains('search-history-item')) {
            e.preventDefault();
            removeHistoryItem(current); // Delete key removes the highlighted recent search
        }
    });

    // Keep Tab inside the dialog
    panel.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = [input, ...panel.querySelectorAll('.search-history-clear, .search-history-remove, .search-chip, .search-file'), closeBtn];
        const i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
    });

    document.addEventListener('keydown', (e) => {
        const el = document.activeElement;
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;
        const isOpen = modal.classList.contains('open');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            isOpen ? closeSearch() : openSearch();
        } else if (e.key === '/' && !typing && !isOpen) {
            e.preventDefault();
            openSearch();
        } else if (e.key === 'Escape' && isOpen) {
            closeSearch();
        }
    });
}
