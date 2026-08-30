(() => {
    function initReviewCarousel(carousel) {
        const track = carousel.querySelector('[data-review-track]');
        const cards = Array.from(carousel.querySelectorAll('[data-review-card]'));
        const prev = carousel.querySelector('[data-review-prev]');
        const next = carousel.querySelector('[data-review-next]');
        const dotsHost = carousel.querySelector('[data-review-dots]');

        if (!track || cards.length === 0 || !prev || !next || !dotsHost) return;

        let activeIndex = 0;
        let raf = null;

        const dots = cards.map((_, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'review-dot';
            dot.setAttribute('aria-label', `Show review ${index + 1} of ${cards.length}`);
            dot.addEventListener('click', () => goTo(index));
            dotsHost.appendChild(dot);
            return dot;
        });

        function updateUi(index) {
            activeIndex = Math.max(0, Math.min(cards.length - 1, index));
            dots.forEach((dot, dotIndex) => {
                const active = dotIndex === activeIndex;
                dot.classList.toggle('is-active', active);
                dot.setAttribute('aria-current', active ? 'true' : 'false');
            });
        }

        function goTo(index) {
            const normalized = (index + cards.length) % cards.length;
            cards[normalized].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'start'
            });
            updateUi(normalized);
        }

        prev.addEventListener('click', () => goTo(activeIndex - 1));
        next.addEventListener('click', () => goTo(activeIndex + 1));

        track.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goTo(activeIndex - 1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                goTo(activeIndex + 1);
            }
        });

        track.addEventListener('scroll', () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const trackRect = track.getBoundingClientRect();
                const trackCenter = trackRect.left + trackRect.width / 2;
                let closestIndex = 0;
                let closestDistance = Infinity;

                cards.forEach((card, index) => {
                    const rect = card.getBoundingClientRect();
                    const cardCenter = rect.left + rect.width / 2;
                    const distance = Math.abs(cardCenter - trackCenter);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = index;
                    }
                });

                updateUi(closestIndex);
            });
        }, { passive: true });

        updateUi(0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-review-carousel]').forEach(initReviewCarousel);
    });
})();
