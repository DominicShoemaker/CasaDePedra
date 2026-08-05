(function initializeCasaPricing(global) {
    const apiBaseUrl = String(global.PMC_CONFIG?.pricingApiBaseUrl || '').replace(/\/$/, '');

    function addDays(localDate, days) {
        const date = new Date(`${localDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function addYears(localDate, years) {
        const [year, month, day] = localDate.split('-').map(Number);
        const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
        return `${year + years}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    }

    function rioToday() {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    async function request(path, options = {}) {
        if (!apiBaseUrl) throw new Error('Pricing API is not configured.');
        const response = await fetch(`${apiBaseUrl}/api${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(body?.error?.message || `Pricing request failed (${response.status}).`);
            error.code = body?.error?.code || 'PRICING_REQUEST_FAILED';
            error.details = body?.error?.details;
            throw error;
        }
        return body;
    }

    async function configurePicker() {
        const picker = document.querySelector('str-date-range-picker');
        if (!picker) throw new Error('Booking calendar was not found.');

        const calendarResponse = await request('/v1/calendar-snapshot');
        const calendar = calendarResponse.calendarSnapshot;
        const from = [addDays(rioToday(), 1), calendar.coverage.from].sort().at(-1);
        const requestedThrough = addDays(addYears(from, 2), -1);
        const through = requestedThrough < calendar.coverage.through ? requestedThrough : calendar.coverage.through;
        const quote = await request('/v1/pricing/evaluate-calendar', {
            method: 'POST',
            body: JSON.stringify({ from, through, assumedStayNights: 3 })
        });
        const prices = new Map(quote.dates.map(day => [day.date, day]));

        picker.setPricingProvider({
            getPriceForDate(localDate) {
                return prices.get(localDate)?.final ?? null;
            },
            getMinimumStayForDate(localDate) {
                return prices.get(localDate)?.restrictions?.minimumStay ?? null;
            },
            formatPrice(value) {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency', currency: quote.currency, maximumFractionDigits: 0
                }).format(Number(value));
            }
        });
        picker.setSelectableBounds(from, through);
        return { currency: quote.currency, coverage: { from, through } };
    }

    const ready = new Promise((resolve, reject) => {
        document.addEventListener('DOMContentLoaded', () => configurePicker().then(resolve, reject), { once: true });
    });
    ready.catch(() => {});

    global.CasaPricing = Object.freeze({
        ready,
        async evaluateStay(checkIn, checkOut) {
            await ready;
            return request('/v1/pricing/evaluate-stay', {
                method: 'POST',
                body: JSON.stringify({ checkIn, checkOut })
            });
        }
    });
})(globalThis);
