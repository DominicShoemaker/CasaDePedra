// -------------------- NAVIGATION --------------------
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        // Offset for the sticky header
        const offset = 60;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// -------------------- MODALS --------------------
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'block';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// -------------------- LIGHTBOX --------------------
function initLightbox() {
    // Create lightbox HTML structure dynamically if not present
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.innerHTML = `
            <span class="close-lightbox" onclick="document.getElementById('lightbox').classList.remove('active')">&times;</span>
            <img id="lightbox-img" src="" alt="Full Screen Image">
        `;
        document.body.appendChild(lightbox);
    }

    const galleryImages = document.querySelectorAll('.gallery img');
    galleryImages.forEach(img => {
        img.addEventListener('click', function() {
            document.getElementById('lightbox-img').src = this.src;
            lightbox.classList.add('active');
        });
    });

    // Close on click outside image
    lightbox.addEventListener('click', function(e) {
        if (e.target !== document.getElementById('lightbox-img')) {
            this.classList.remove('active');
        }
    });
}

// -------------------- BOOKING LOGIC --------------------
function checkBookingPending() {
    const pendingCookie = localStorage.getItem('booking_pending');
    if (pendingCookie) {
        // Check expiration - 1 hour
        try {
            const parsed = JSON.parse(pendingCookie);
            if (parsed.createdAt && (Date.now() - parsed.createdAt > 60 * 60 * 1000)) {
                localStorage.removeItem('booking_pending');
                return;
            }
        } catch (e) { /* proceed to existing logic */ }
        
        try {
            const pendingData = JSON.parse(pendingCookie);
            fetch(`https://shorttermreservation.azurewebsites.net/api/Reservation/${pendingData.reservationID}/${pendingData.from}/${pendingData.to}`)
                .then(response => {
                    if (!response.ok) {
                        localStorage.removeItem('booking_pending');
                    } else {
                        return response.json();
                    }
                })
                .then(record => {
                    if (record) {
                        if (record.Status === "Paid" || record.status === "Paid") {
                            localStorage.removeItem('booking_pending');
                        } else {
                            const params = new URLSearchParams({
                                reservationid: pendingData.reservationID,
                                from: pendingData.from,
                                to: pendingData.to
                            });
                            window.location.href = `cancellation.html?${params.toString()}`;
                        }
                    }
                })
                .catch(err => {
                    console.error('Error checking pending reservation:', err);
                    localStorage.removeItem('booking_pending');
                });
        } catch (e) {
            console.error('Error parsing booking cookie:', e);
            localStorage.removeItem('booking_pending');
        }
    }
}

// Browser back button from payment page
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        checkBookingPending();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    checkBookingPending();
    initLightbox();

    const picker = document.querySelector('str-date-range-picker');
    const priceInfo = document.getElementById('priceInfo');
    const statusText = document.getElementById('statusText');

    const nameInput = document.getElementById('guest-name');
    const emailInput = document.getElementById('guest-email');
    const phoneInput = document.getElementById('guest-phone');
    const agreeInput = document.getElementById('agree-rules');

    const submitBtn = document.getElementById('submit-booking');
    const errorDiv = document.getElementById('booking-error');

    let data = null;

    function formatDate(date) {
        if (!date) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;

    // Helper to toggle error messages
    function toggleError(inputElement, show, message) {
        inputElement.classList.toggle('input-error', show);
        let errorMsg = inputElement.nextElementSibling;
        if (!errorMsg || !errorMsg.classList.contains('error-message')) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            inputElement.parentNode.insertBefore(errorMsg, inputElement.nextSibling);
        }
        errorMsg.textContent = message;
        errorMsg.style.display = show ? 'block' : 'none';
    }

    function validateForm() {
        let isValid = true;
        errorDiv.style.display = 'none';

        if (!data || !data.isComplete) {
            isValid = false;
        }

        const nameVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();
        const phoneVal = phoneInput.value.trim();

        if (!nameVal) {
            isValid = false;
        }

        const emailOk = emailVal && emailRegex.test(emailVal);
        if (!emailOk) {
            isValid = false;
            if (emailVal.length > 0) toggleError(emailInput, true, "Please enter a valid email address.");
            else toggleError(emailInput, false, "");
        } else {
            toggleError(emailInput, false, "");
        }

        const phoneOk = phoneVal && phoneRegex.test(phoneVal);
        if (!phoneOk) {
            isValid = false;
            if (phoneVal.length > 0) toggleError(phoneInput, true, "Please enter a valid phone number.");
            else toggleError(phoneInput, false, "");
        } else {
            toggleError(phoneInput, false, "");
        }

        if (!agreeInput.checked) isValid = false;

        submitBtn.disabled = !isValid;
    }

    if (picker) {
        picker.addEventListener('selection-changed', (e) => {
            data = e.detail;
            if (data && data.isComplete) {
                if (data.fullPrice > data.discountedPrice) {
                    priceInfo.innerHTML = `${data.nights} nights: <span style="text-decoration: line-through; color: #717171;">$${data.fullPrice}</span> $${data.discountedPrice}`;
                } else {
                    priceInfo.textContent = `${data.nights} nights: $${data.fullPrice}`;
                }
                statusText.textContent = `${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`;
            } else {
                statusText.textContent = data && data.startDate ? 'Select end date' : 'Select from 3 to 28 nights';
                priceInfo.textContent = '';
            }
            validateForm();
        });
    }

    [nameInput, emailInput, phoneInput, agreeInput].forEach(el => {
        if (el) {
            el.addEventListener('input', validateForm);
            el.addEventListener('change', validateForm);
        }
    });

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="spinner" style="display:inline-block"></div><span>Processing...</span>';
            errorDiv.style.display = 'none';

            const payload = {
                fullName: nameInput.value.trim(),
                Email: emailInput.value.trim(),
                Phone: phoneInput.value.trim(),
                From: formatDate(data.startDate),
                To: formatDate(data.endDate)
            };

            try {
                // 1. Reservation API
                const resResponse = await fetch('https://shorttermreservation.azurewebsites.net/api/Reservation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!resResponse.ok) {
                    throw new Error('Reservation failed with status ' + resResponse.status);
                }

                let reservationID;
                const resContentType = resResponse.headers.get("content-type");
                if (resContentType && resContentType.indexOf("application/json") !== -1) {
                    const data = await resResponse.json();
                    reservationID = data.reservationID || data.id || data;
                } else {
                    reservationID = await resResponse.text();
                }
                if (typeof reservationID === 'string') {
                    reservationID = reservationID.replace(/^"|"$/g, '');
                }

                // 2. Payment API
                const payPayload = {
                    reservationID: reservationID,
                    amount: data.discountedPrice
                };

                const payResponse = await fetch('https://shorttermreservation.azurewebsites.net/api/Payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payPayload)
                });

                if (!payResponse.ok) {
                    throw new Error('Payment failed with status ' + payResponse.status);
                }

                let paymentUrl;
                const payContentType = payResponse.headers.get("content-type");
                if (payContentType && payContentType.indexOf("application/json") !== -1) {
                    const data = await payResponse.json();
                    paymentUrl = data.url || data;
                } else {
                    paymentUrl = await payResponse.text();
                }
                if (typeof paymentUrl === 'string') {
                    paymentUrl = paymentUrl.replace(/^"|"$/g, '');
                }

                const cookieData = JSON.stringify({
                    reservationID: reservationID,
                    from: formatDate(data.startDate),
                    to: formatDate(data.endDate),
                    fullName: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    phone: phoneInput.value.trim(),
                    price: data.discountedPrice,
                    paymentUrl: paymentUrl,
                    createdAt: Date.now()
                });
                localStorage.setItem('booking_pending', cookieData);

                window.location.href = paymentUrl;

            } catch (err) {
                console.error('Booking error:', err);
                errorDiv.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right:8px;"></i>There was an error processing your reservation. Please try again later or email us with your desired dates.';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
});
