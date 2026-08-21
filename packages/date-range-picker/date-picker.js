class StrDateRangePicker extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // State
        this.currentDate = new Date();
        this.startDate = null;
        this.endDate = null;
        this.hoverDate = null;
        this.busyDates = [];
        this.apiUrl = null;
        this.minStayDays = 3;
        this.maxStayDays = 28;
        this.monthsToShow = 2;
        this.showStayLengthOptions = false;
        this.displayStayNights = 3;
        this.pricingProvider = null;
        this.maxCheckInDate = null;
        this.maxSelectableDate = null;
        this._resizeObserver = null;

        // Constraints
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);

        this.minSelectableDate = new Date(this.today);
        this.minSelectableDate.setDate(this.minSelectableDate.getDate() + 1); // Tomorrow

        this.maxNavDate = new Date(this.today);
        this.maxNavDate.setFullYear(this.maxNavDate.getFullYear() + 2);
    }

    connectedCallback() {
        this.apiUrl = this.getAttribute('api-url');
        this.showStayLengthOptions = this.hasAttribute('show-stay-length-options');
        this.displayStayNights = this.readIntegerAttribute('display-stay-nights', 3, 1, 3);
        this.minStayDays = this.readIntegerAttribute('min-stay-days', this.minStayDays, 1, 3660);
        this.maxStayDays = this.readIntegerAttribute('max-stay-days', this.maxStayDays, this.minStayDays, 3660);
        this.render();
        this.loadData();
        this.addEventListeners();

        // Observe size changes to adjust number of visible months
        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    _onResize() {
        const width = this.getBoundingClientRect().width;
        let newCount;
        if (width >= 960) {
            newCount = 3;
        } else if (width >= 640) {
            newCount = 2;
        } else {
            newCount = 1;
        }
        if (newCount !== this.monthsToShow) {
            this.monthsToShow = newCount;
            this.updateCalendars();
        }
    }

    async loadData() {
        if (!this.apiUrl) {
            this.hideOverlay();
            this.updateCalendars();
            return;
        }
        this.showOverlay("Loading calendar...", false);
        try {
            await this.fetchBusyDates();
            this.hideOverlay();
        } catch (e) {
            this.showOverlay(`Calendar is not available.<br><br>Please reload the page after 1-2 minutes or request booking by email or WhatsApp.`, true);
        }
    }

    readIntegerAttribute(name, fallback, minimum, maximum) {
        const value = Number.parseInt(this.getAttribute(name), 10);
        if (!Number.isInteger(value)) return fallback;
        return Math.min(maximum, Math.max(minimum, value));
    }

    fromLocalISO(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    setPricingProvider(provider) {
        if (!provider || typeof provider.getPriceForDate !== 'function') {
            throw new TypeError('Pricing provider must define getPriceForDate(date, assumedStayNights).');
        }
        this.pricingProvider = provider;
        this.updateCalendars();
    }

    setBusyDates(ranges = []) {
        this.busyDates = ranges.map(range => ({
            startDate: range.From ? range.From.split('T')[0] : range.startDate,
            endDate: range.To ? range.To.split('T')[0] : range.endDate
        }));
        this.updateCalendars();
    }

    setSelectableBounds(from, through) {
        const first = this.fromLocalISO(from);
        const last = this.fromLocalISO(through);
        if (!first || !last || first > last) throw new TypeError('Selectable bounds must be valid ordered local dates.');

        const tomorrow = new Date(this.today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.minSelectableDate = first > tomorrow ? first : tomorrow;
        this.maxCheckInDate = last;
        const checkoutBoundary = new Date(last);
        checkoutBoundary.setDate(checkoutBoundary.getDate() + 1);
        this.maxSelectableDate = checkoutBoundary;
        this.maxNavDate = new Date(checkoutBoundary.getFullYear(), checkoutBoundary.getMonth() + 1, 1);

        const currentMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const firstMonth = new Date(first.getFullYear(), first.getMonth(), 1);
        if (currentMonth < firstMonth || currentMonth >= this.maxNavDate) this.currentDate = firstMonth;
        this.updateCalendars();
    }

    showOverlay(htmlContent, isError) {
        const overlay = this.shadowRoot.getElementById('overlay');
        const content = this.shadowRoot.getElementById('overlay-content');
        if (overlay && content) {
            content.innerHTML = htmlContent;
            if (isError) {
                content.style.color = 'var(--text-color)'; // using default color for readability
                content.style.fontWeight = 'bold';
            }
            overlay.style.display = 'flex';
        }
    }

    hideOverlay() {
        const overlay = this.shadowRoot.getElementById('overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    async fetchWithRetry(url, retries = 2, interval = 10000) {
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (e) {
                if (i === retries) throw e;
                await new Promise(res => setTimeout(res, interval));
            }
        }
    }

    async fetchBusyDates() {
        const data = await this.fetchWithRetry(this.apiUrl);
        this.busyDates = data.map(range => ({
            startDate: range.From ? range.From.split('T')[0] : range.startDate,
            endDate: range.To ? range.To.split('T')[0] : range.endDate
        }));
        this.updateCalendars();
    }

    // Helper to get YYYY-MM-DD from a Date object (Local time)
    toLocalISO(date) {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getBusyState(date) {
        const dStr = this.toLocalISO(date);
        let status = 'none';

        for (let i = 0; i < this.busyDates.length; i++) {
            const { startDate: start, endDate: end } = this.busyDates[i];

            // String comparison works for YYYY-MM-DD
            if (dStr > start && dStr < end) {
                return { status: 'full' };
            }
            if (dStr === start) {
                if (status === 'end') return { status: 'full' };
                status = 'start';
            }
            if (dStr === end) {
                if (status === 'start') return { status: 'full' };
                status = 'end';
            }
        }
        return { status };
    }

    getStyles() {
        return `
            <style>
                :host {
                    display: block;
                    --primary-color: #ff385c;
                    --hover-bg: #f7f7f7;
                    --text-color: #222222;
                    --muted-color: #717171;
                    --disabled-color: #dddddd;
                }
                .picker-container {
                    display: inline-block;
                    position: relative;
                    border: 1px solid #ddd;
                    border-radius: 32px; /* Airbnb roundness */
                    padding: 10px;
                    background: white;
                    user-select: none;
                }
                .overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255, 255, 255, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    border-radius: 32px;
                }
                .overlay-content {
                    text-align: center;
                    padding: 20px;
                    color: var(--text-color);
                    font-size: 16px;
                }
                .controls {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    align-items: center;
                    padding: 0 10px;
                }
                .controls button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 18px;
                    color: var(--text-color);
                }
                .stay-options {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 2px 10px 18px;
                }
                .stay-options-label {
                    width: 100%;
                    color: var(--muted-color);
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    text-align: center;
                    text-transform: uppercase;
                }
                .stay-option {
                    position: relative;
                }
                .stay-option input {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    opacity: 0;
                    pointer-events: none;
                }
                .stay-option label {
                    display: block;
                    min-width: 82px;
                    padding: 8px 12px;
                    border: 1px solid var(--disabled-color);
                    border-radius: 999px;
                    color: var(--text-color);
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    text-align: center;
                }
                .stay-option input:checked + label {
                    border-color: var(--primary-color);
                    background: var(--primary-color);
                    color: white;
                }
                .stay-option input:focus-visible + label {
                    outline: 3px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
                    outline-offset: 2px;
                }
                .calendars-wrapper {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 20px;
                }
                .calendar {
                    width: 300px;
                    text-align: center;
                }
                .month-name {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--text-color);
                }
                .weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    font-size: 12px;
                    color: var(--muted-color);
                    margin-bottom: 5px;
                }
                .days-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px; /* Gap for range connecting style logic */
                }
                .day {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    cursor: pointer;
                    position: relative;
                    border-radius: 50%;
                    box-sizing: border-box;
                    margin: 2px auto; /* Centered in grid cell */
                }
                .day-number {
                    line-height: 1;
                }
                .day-price {
                    font-size: 9px;
                    color: var(--muted-color);
                    line-height: 1;
                    margin-top: 2px;
                }
                .day.selected .day-price, .day.range-start .day-price, .day.range-end .day-price, .day.hover-end .day-price {
                    color: white; /* Make sure it's visible on selected background */
                }
                .day:hover:not(.disabled):not(.selected):not(.in-range) {
                    border: 1px solid var(--text-color);
                }
                .day.disabled {
                    color: var(--disabled-color);
                    cursor: not-allowed;
                    text-decoration: line-through;
                }
                .day.selected {
                    background: var(--primary-color);
                    color: white;
                }
                .day.in-range, .day.hover-range {
                    background: lightsalmon;
                    /* connecting style */
                    border-radius: 0;
                    width: 100%;
                    margin: 2px 0;
                }
                .day.hover-end {
                    background: lightsalmon;
                    color: white;
                    border-top-right-radius: 50%;
                    border-bottom-right-radius: 50%;
                }
                .day.range-start {
                    background: var(--primary-color);
                    color: white;
                    border-top-left-radius: 50%;
                    border-bottom-left-radius: 50%;
                }
                .day.range-end {
                    background: var(--primary-color);
                    color: white;
                    border-top-right-radius: 50%;
                    border-bottom-right-radius: 50%;
                }
                .day.busy-full {
                    background: #ddd; /* Fallback */
                    color: #999;
                    cursor: not-allowed;
                    text-decoration: line-through;
                }
                .day.busy-start {
                    /* Start of busy range: Morning Free, Afternoon Busy */
                    /* Trapezoid/Triangle at bottom right */
                    background: linear-gradient(135deg, white 50%, var(--disabled-color) 50%);
                }
                .day.busy-end {
                    /* End of busy range: Morning Busy, Afternoon Free */
                    /* Trapezoid/Triangle at top left */
                    background: linear-gradient(135deg, var(--disabled-color) 50%, white 50%);
                }
                .day.busy-start.selected, .day.busy-start.range-end {
                    background: linear-gradient(135deg, var(--primary-color) 50%, var(--disabled-color) 50%);
                    color: white;
                }
                .day.busy-end.selected, .day.busy-end.range-start {
                    background: linear-gradient(135deg, var(--disabled-color) 50%, var(--primary-color) 50%);
                    color: white;
                }
                .day.minimum-stay-required:not(.selected):not(.range-start):not(.range-end):not(.in-range):not(.hover-range):not(.hover-end) {
                    background: #fff0c7;
                    border-radius: 10px;
                }
                .day.checkout-only:not(.selected):not(.range-end) {
                    border: 1px dashed var(--muted-color);
                    color: var(--muted-color);
                }
                .minimum-stay-badge {
                    position: absolute;
                    top: 1px;
                    right: 2px;
                    color: #8a5a00;
                    font-size: 7px;
                    font-weight: 800;
                    line-height: 1;
                }
                .day.selected .minimum-stay-badge,
                .day.range-start .minimum-stay-badge,
                .day.range-end .minimum-stay-badge {
                    color: white;
                }
                .minimum-stay-note {
                    max-width: 760px;
                    margin: 16px auto 4px;
                    padding: 10px 14px;
                    border-left: 4px solid #d89519;
                    background: #fff8e8;
                    color: #72501a;
                    font-size: 12px;
                    line-height: 1.45;
                    text-align: left;
                }
            </style>
        `;
    }

    getStayLengthOptionsMarkup() {
        if (!this.showStayLengthOptions) return '';
        const options = [1, 2, 3].map(nights => `
            <span class="stay-option">
                <input type="radio" id="stay-${nights}" name="display-stay-nights" value="${nights}" ${this.displayStayNights === nights ? 'checked' : ''}>
                <label for="stay-${nights}">${nights} ${nights === 1 ? 'night' : 'nights'}</label>
            </span>
        `).join('');
        return `<div class="stay-options" role="radiogroup" aria-label="Calendar price assumption">
            <span class="stay-options-label">Display nightly price for</span>
            ${options}
        </div>`;
    }

    render() {
        this.shadowRoot.innerHTML = `
            ${this.getStyles()}
            <div class="picker-container">
                <div class="overlay" id="overlay" style="display: none;">
                    <div class="overlay-content" id="overlay-content"></div>
                </div>
                <div class="controls">
                    <button id="prevBtn" aria-label="Previous month">&lt;</button>
                    <button id="nextBtn" aria-label="Next month">&gt;</button>
                </div>
                ${this.getStayLengthOptionsMarkup()}
                <div class="calendars-wrapper" id="calendars"></div>
                <div class="minimum-stay-note" id="minimum-stay-note" hidden></div>
            </div>
        `;
        this.updateCalendars();
    }

    addEventListeners() {
        this.shadowRoot.getElementById('prevBtn').onclick = () => {
            // Prevent going back past current month
            const now = new Date();
            now.setDate(1); now.setHours(0, 0, 0, 0);
            const prevMonth = new Date(this.currentDate);
            prevMonth.setMonth(prevMonth.getMonth() - 1);

            if (prevMonth >= now) {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.updateCalendars();
            }
        };
        this.shadowRoot.getElementById('nextBtn').onclick = () => {
            // Prevent going too far forward
            const nextMonth = new Date(this.currentDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            if (nextMonth < this.maxNavDate) {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.updateCalendars();
            }
        };
        this.shadowRoot.querySelectorAll('input[name="display-stay-nights"]').forEach(input => {
            input.addEventListener('change', () => {
                this.displayStayNights = Number(input.value);
                this.updateCalendars();
                this.dispatchEvent(new CustomEvent('price-display-mode-changed', {
                    detail: { nights: this.displayStayNights },
                    bubbles: true,
                    composed: true
                }));
            });
        });
    }

    updateCalendars() {
        const wrapper = this.shadowRoot.getElementById('calendars');
        wrapper.innerHTML = '';

        // Render 1-3 months based on available width
        for (let i = 0; i < this.monthsToShow; i++) {
            const monthDate = new Date(this.currentDate);
            monthDate.setMonth(monthDate.getMonth() + i);
            wrapper.appendChild(this.renderMonth(monthDate));
        }

        wrapper.addEventListener('mouseleave', () => {
            this.shadowRoot.querySelectorAll('.hover-range, .hover-end').forEach(el => {
                el.classList.remove('hover-range', 'hover-end');
            });
        });

        // Update Button States
        const prevBtn = this.shadowRoot.getElementById('prevBtn');
        const nextBtn = this.shadowRoot.getElementById('nextBtn');

        const now = new Date();
        now.setDate(1); now.setHours(0, 0, 0, 0);

        // Check if previous month is valid
        const prevMonthTarget = new Date(this.currentDate);
        prevMonthTarget.setMonth(prevMonthTarget.getMonth() - 1);
        prevBtn.disabled = prevMonthTarget < now;

        // Check if next month is valid (based on last visible month)
        const nextMonthTarget = new Date(this.currentDate);
        nextMonthTarget.setMonth(nextMonthTarget.getMonth() + this.monthsToShow);
        nextBtn.disabled = nextMonthTarget >= this.maxNavDate;

        this.updateMinimumStayNote();
        this.dispatchSelectionEvent();
    }

    renderMonth(date) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'calendar';

        const year = date.getFullYear();
        const month = date.getMonth();

        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Days header
        const daysHeader = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<span>${d}</span>`).join('');

        // Days calculation
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Grid
        let gridHtml = '';
        for (let i = 0; i < firstDay; i++) {
            gridHtml += `<div></div>`;
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const currentDay = new Date(year, month, d);
            const { status } = this.getBusyState(currentDay);
            const classList = ['day'];

            if (status === 'full') {
                classList.push('busy-full', 'disabled');
            } else if (status === 'start') {
                classList.push('busy-start');
            } else if (status === 'end') {
                classList.push('busy-end');
            }

            // Constraint: Disable past dates (before tomorrow)
            // Also disable if beyond max view, though navigation should prevent reaching there.
            if (currentDay < this.minSelectableDate) {
                classList.push('disabled');
            }
            if (this.maxSelectableDate && currentDay > this.maxSelectableDate) {
                classList.push('disabled');
            }
            if (this.maxCheckInDate && currentDay > this.maxCheckInDate && !classList.includes('disabled')) {
                const isActiveCheckout = this.startDate && (!this.endDate || this.isSameDay(currentDay, this.endDate));
                if (isActiveCheckout) classList.push('checkout-only');
                else classList.push('disabled');
            }

            const minimumStay = status === 'none' ? this.getMinimumStayForDate(currentDay) : null;
            if (minimumStay && minimumStay > 1 && !classList.includes('disabled')) {
                classList.push('minimum-stay-required');
            }

            // Selection logic
            if (status !== 'full') {
                if (this.isSameDay(currentDay, this.startDate)) classList.push('selected', 'range-start');
                if (this.isSameDay(currentDay, this.endDate)) classList.push('selected', 'range-end');
                if (this.startDate && this.endDate && currentDay > this.startDate && currentDay < this.endDate) {
                    classList.push('in-range');
                }
            }

            let priceHtml = '';
            if (this.pricingProvider && !classList.includes('disabled')) {
                if (status === 'none' || status === 'end') {
                    const price = this.getDisplayPriceForDate(currentDay);
                    if (price !== null) {
                        priceHtml = `<div class="day-price">${this.formatPrice(price)}</div>`;
                    }
                }
            }

            const minimumStayHtml = minimumStay && minimumStay > 1 && !classList.includes('disabled')
                ? `<span class="minimum-stay-badge" aria-label="${minimumStay} night minimum">${minimumStay}n</span>`
                : '';
            const dateKey = this.toLocalISO(currentDay);
            const accessiblePrice = priceHtml ? `, ${this.formatPrice(this.getDisplayPriceForDate(currentDay))}` : '';
            const accessibleMinimum = minimumStay && minimumStay > 1 ? `, ${minimumStay} night minimum` : '';
            const accessibleCheckout = classList.includes('checkout-only') ? ', checkout only' : '';
            const accessibility = classList.includes('disabled')
                ? 'role="button" aria-disabled="true"'
                : `role="button" tabindex="0" aria-label="${currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${accessiblePrice}${accessibleMinimum}${accessibleCheckout}"`;

            // Data attributes for click handling
            gridHtml += `<div class="${classList.join(' ')}" data-date="${currentDay.toISOString()}" data-testid="calendar-day-${dateKey}" ${minimumStay ? `data-minimum-stay="${minimumStay}"` : ''} ${accessibility}>
                <span class="day-number">${d}</span>
                ${priceHtml}
                ${minimumStayHtml}
            </div>`;
        }

        monthDiv.innerHTML = `
            <div class="month-name">${monthName}</div>
            <div class="weekdays">${daysHeader}</div>
            <div class="days-grid">${gridHtml}</div>
        `;

        // Add click events to days
        const days = monthDiv.querySelectorAll('.day:not(.disabled)');
        days.forEach(dayEl => {
            const activate = () => {
                if (dayEl.classList.contains('checkout-only') && (!this.startDate || this.endDate)) return;
                const dateClicked = new Date(dayEl.dataset.date);
                this.handleDateClick(dateClicked);
            };
            dayEl.addEventListener('click', activate);
            dayEl.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activate();
            });
            dayEl.addEventListener('mouseenter', () => {
                const dateHovered = new Date(dayEl.dataset.date);
                this.handleDateHover(dateHovered); // For future hover effects
            });
        });

        return monthDiv;
    }

    isSameDay(d1, d2) {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    handleDateClick(date) {
        const oneDay = 24 * 60 * 60 * 1000;

        if (!this.startDate || (this.startDate && this.endDate)) {
            // New selection
            this.startDate = date;
            this.endDate = null;
        } else {
            // Determine range
            if (date < this.startDate) {
                this.startDate = date;
            } else {
                const nights = Math.round((date - this.startDate) / oneDay);

                if (nights < this.minStayDays) {
                    // Too short — start new selection
                    this.startDate = date;
                    this.endDate = null;
                } else if (nights > this.maxStayDays) {
                    // Too long — start new selection
                    this.startDate = date;
                    this.endDate = null;
                } else if (this.hasOverlap(this.startDate, date)) {
                    // Invalid range (overlaps with busy date), start new selection
                    this.startDate = date;
                    this.endDate = null;
                } else {
                    this.endDate = date;
                }
            }
        }
        this.dispatchSelectionEvent();
        this.updateCalendars();
    }

    getDisplayPriceForDate(date) {
        if (!this.pricingProvider) return null;
        return this.pricingProvider.getPriceForDate(this.toLocalISO(date), this.displayStayNights);
    }

    getMinimumStayForDate(date) {
        if (!this.pricingProvider || typeof this.pricingProvider.getMinimumStayForDate !== 'function') return null;
        const value = this.pricingProvider.getMinimumStayForDate(this.toLocalISO(date));
        return Number.isInteger(value) ? value : null;
    }

    formatPrice(value) {
        if (this.pricingProvider && typeof this.pricingProvider.formatPrice === 'function') {
            return this.pricingProvider.formatPrice(value);
        }
        return `$${value}`;
    }

    updateMinimumStayNote() {
        const note = this.shadowRoot.getElementById('minimum-stay-note');
        if (!note) return;
        const requirements = [...new Set([...this.shadowRoot.querySelectorAll('.minimum-stay-required[data-minimum-stay]')]
            .map(element => Number(element.dataset.minimumStay))
            .filter(value => value > 1))].sort((left, right) => left - right);
        note.hidden = requirements.length === 0;
        if (requirements.length === 0) {
            note.textContent = '';
            return;
        }
        const labels = requirements.map(value => `${value} nights`);
        const readable = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
        note.textContent = `Highlighted dates require a minimum stay of ${readable}. The badge on each date shows the exact requirement.`;
    }

    dispatchSelectionEvent() {
        let selectionData = {
            startDate: this.startDate,
            endDate: this.endDate,
            nights: 0,
            fullPrice: 0,
            discountedPrice: 0,
            isComplete: false
        };

        if (this.startDate && this.endDate) {
            const nights = Math.round((this.endDate - this.startDate) / (24 * 60 * 60 * 1000));
            let total = 0;
            if (this.pricingProvider) {
                let current = new Date(this.startDate);
                while (current < this.endDate) {
                    const nightlyPrice = Number(this.pricingProvider.getPriceForDate(this.toLocalISO(current), nights));
                    if (Number.isFinite(nightlyPrice)) total += nightlyPrice;
                    current.setDate(current.getDate() + 1);
                }
            }

            selectionData.nights = nights;
            selectionData.fullPrice = total;
            selectionData.discountedPrice = total;
            selectionData.isComplete = true;
        }

        this.dispatchEvent(new CustomEvent('selection-changed', {
            detail: selectionData,
            bubbles: true,
            composed: true
        }));
    }

    hasOverlap(start, end) {
        const sStr = this.toLocalISO(start);
        const eStr = this.toLocalISO(end);

        return this.busyDates.some(range => {
            // Strict overlap: Start < BusyEnd AND End > BusyStart
            return sStr < range.endDate && eStr > range.startDate;
        });
    }

    handleDateHover(date) {
        if (!this.startDate || this.endDate) return;

        let hasOverlap = false;
        if (date > this.startDate) {
            hasOverlap = this.hasOverlap(this.startDate, date);
        }

        const days = this.shadowRoot.querySelectorAll('.day:not(.disabled)');

        days.forEach(dayEl => {
            const dayDateStr = dayEl.dataset.date;
            if (!dayDateStr) return;
            const dayDate = new Date(dayDateStr);

            dayEl.classList.remove('hover-range', 'hover-end');

            if (date > this.startDate && !hasOverlap) {
                if (dayDate > this.startDate && dayDate < date) {
                    dayEl.classList.add('hover-range');
                } else if (this.isSameDay(dayDate, date)) {
                    dayEl.classList.add('hover-end');
                }
            }
        });
    }


}

customElements.define('str-date-range-picker', StrDateRangePicker);
