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
        this.priceRulesUrl = null;
        this.priceRules = { default: 380, days: { 5: 420, 6: 420 }, dates: { "2026-12-25": 1000 } }
        this.minStayDays = 3;
        this.maxStayDays = 28;
        this.monthsToShow = 2;
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
        this.priceRulesUrl = this.getAttribute('price-rules-url');
        this.render();
        this.fetchBusyDates();
        this.fetchPriceRules();
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

    async fetchBusyDates() {
        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            // Map new API format [{From: "...", To: "..."}] to internal UI state
            this.busyDates = data.map(range => ({
                startDate: range.From ? range.From.split('T')[0] : range.startDate,
                endDate: range.To ? range.To.split('T')[0] : range.endDate
            }));
            this.updateCalendars();
        } catch (e) {
            console.error("Failed to fetch busy dates", e);
        }
    }

    async fetchPriceRules() {
        try {
            const response = await fetch(this.priceRulesUrl);
            if (response.ok) {
                this.priceRules = await response.json();
                this.updateCalendars();
            }
        } catch (e) {
            console.error("Failed to fetch price rules", e);
        }
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
                    border: 1px solid #ddd;
                    border-radius: 32px; /* Airbnb roundness */
                    padding: 10px;
                    background: white;
                    user-select: none;
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
                .day.selected .day-price, .day.range-start .day-price, .day.range-end .day-price {
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
                .day.in-range {
                    background: #f7f7f7;
                    /* connecting style */
                    border-radius: 0;
                    width: 100%;
                    margin: 0;
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
            </style>
        `;
    }

    render() {
        this.shadowRoot.innerHTML = `
            ${this.getStyles()}
            <div class="picker-container">
                <div class="controls">
                    <button id="prevBtn">&lt;</button>
                    <button id="nextBtn">&gt;</button>
                </div>
                <div class="calendars-wrapper" id="calendars"></div>
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

            // Selection logic
            if (status !== 'full') {
                if (this.isSameDay(currentDay, this.startDate)) classList.push('selected', 'range-start');
                if (this.isSameDay(currentDay, this.endDate)) classList.push('selected', 'range-end');
                if (this.startDate && this.endDate && currentDay > this.startDate && currentDay < this.endDate) {
                    classList.push('in-range');
                }
            }

            let priceHtml = '';
            if (this.priceRules && !classList.includes('disabled')) {
                if (status === 'none' || status === 'end') {
                    const price = this.getPriceForDate(currentDay);
                    if (price !== null) {
                        priceHtml = `<div class="day-price">$${price}</div>`;
                    }
                }
            }

            // Data attributes for click handling
            gridHtml += `<div class="${classList.join(' ')}" data-date="${currentDay.toISOString()}">
                <span class="day-number">${d}</span>
                ${priceHtml}
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
            dayEl.addEventListener('click', () => {
                const dateClicked = new Date(dayEl.dataset.date);
                this.handleDateClick(dateClicked);
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

    getPriceForDate(date) {
        if (!this.priceRules) return null;
        let price = this.priceRules.default;

        // Check specific dates (MM-DD)
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateKey = `${m}-${d}`;

        if (this.priceRules.dates && this.priceRules.dates[dateKey]) {
            price = this.priceRules.dates[dateKey];
        } else {
            // Check day of week
            const day = date.getDay(); // 0-6
            if (this.priceRules.days && this.priceRules.days[String(day)]) {
                price = this.priceRules.days[String(day)];
            }
        }
        return price;
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

        if (this.startDate && this.endDate && this.priceRules) {
            let total = 0;
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            const oneDay = 24 * 60 * 60 * 1000;

            let current = new Date(start);
            while (current < end) {
                total += this.getPriceForDate(current);
                current.setDate(current.getDate() + 1);
            }

            const nights = Math.round((end - start) / oneDay);
            let finalTotal = total;

            if (nights >= 28 && this.priceRules.discount_month) {
                finalTotal = total * (1 - this.priceRules.discount_month);
            } else if (nights >= 7 && this.priceRules.discount_week) {
                finalTotal = total * (1 - this.priceRules.discount_week);
            }

            selectionData.nights = nights;
            selectionData.fullPrice = total;
            selectionData.discountedPrice = Math.round(finalTotal);
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
        // Here we could implement "hover range" effect by re-rendering or toggling classes
        // For simplicity/performance, we'll skip aggressive re-renders on hover for now
    }


}

customElements.define('str-date-range-picker', StrDateRangePicker);
