(() => {
    'use strict';

    const photo = (src, caption, alt, fallback = null) => ({ src, caption, alt, fallback });

    const galleryData = {
        exterior: {
            title: 'Exterior & Entrance',
            intro: 'Exterior architecture and arrival views of Casa de Pedra.',
            subcategories: [
                {
                    id: 'house-exterior',
                    title: 'House Exterior',
                    facts: ['Historic house', 'Private residence', 'Copacabana'],
                    description: 'Casa de Pedra is a private residence in Copacabana. These exterior views help guests recognize the property and its distinctive architecture on arrival.',
                    images: [
                        photo('images/gallery/exterior/01.jpg', 'Exterior view of Casa de Pedra in Copacabana.', 'Exterior of Casa de Pedra', 'images/house.jpg')
                    ]
                },
                {
                    id: 'entrance',
                    title: 'Entrance',
                    facts: ['Private entrance'],
                    description: 'The entrance is part of the private house and provides direct access to the residence.',
                    images: [
                        photo('images/house.jpg', 'Entrance and exterior arrival view.', 'Entrance to Casa de Pedra')
                    ]
                }
            ]
        },

        'living-office': {
            title: 'Living Room & Office',
            intro: 'Shared living space plus a dedicated private work area.',
            subcategories: [
                {
                    id: 'living-room',
                    title: 'Living Room',
                    facts: ['Large shared living area', 'Group seating', 'Air conditioning'],
                    description: 'The living room is the main indoor gathering space for the group, with generous seating and room to relax together.',
                    images: [
                        photo('images/gallery/living/01.jpg', 'Main living room with space for the group to gather.', 'Living room at Casa de Pedra', 'images/living-room.png')
                    ]
                },
                {
                    id: 'private-office',
                    title: 'Private Office',
                    facts: ['Dedicated workspace', 'Wi-Fi', 'Private work area'],
                    description: 'The private office provides a dedicated workspace away from the bedrooms and main living area, useful for remote work during longer stays.',
                    images: [
                        photo('images/gallery/office/01.jpg', 'Dedicated private office and work area.', 'Private office at Casa de Pedra', 'images/office.jpg')
                    ]
                }
            ]
        },

        bedrooms: {
            title: 'Bedrooms',
            intro: 'Four bedrooms: two master suites and two queen bedrooms that share a corridor bathroom.',
            subcategories: [
                {
                    id: 'king-master',
                    title: 'King Master Suite',
                    facts: ['Second floor', 'King bed', 'Private balcony', 'Private shower ensuite'],
                    description: 'The King Master Suite is on the second floor. It has a king bed, private balcony and its own private bathroom with shower.',
                    linkedBathroom: {
                        title: 'Private King Master Ensuite',
                        text: 'Second-floor private bathroom with shower, reserved for the King Master Suite.',
                        target: 'king-master-ensuite',
                        preview: photo('images/gallery/bathrooms/king-master/01.jpg', '', 'King Master Ensuite bathroom')
                    },
                    images: [
                        photo('images/gallery/bedrooms/king-master/01.jpg', 'King Master Suite with king bed and balcony access.', 'King Master Suite with king bed'),
                        photo('images/gallery/bedrooms/king-master/02.jpg', 'Wide view of the King Master Suite.', 'Wide view of the King Master Suite')
                    ]
                },
                {
                    id: 'queen-master',
                    title: 'Queen Master Suite',
                    facts: ['First floor', 'Queen bed', 'Walk-in closet', 'Private shower + Jacuzzi bathroom'],
                    description: 'The Queen Master Suite is on the first floor. It has a queen bed, walk-in closet and a private bathroom with shower and Jacuzzi.',
                    linkedBathroom: {
                        title: 'Private Queen Master Bathroom & Jacuzzi',
                        text: 'First-floor private bathroom with shower and Jacuzzi, reserved for the Queen Master Suite.',
                        target: 'queen-master-bath',
                        preview: photo('images/gallery/bathrooms/queen-master/01.jpg', '', 'Queen Master bathroom with Jacuzzi', 'images/jacuzzi.png')
                    },
                    images: [
                        photo('images/gallery/bedrooms/queen-master/01.jpg', 'Queen Master Suite with queen bed.', 'Queen Master Suite'),
                        photo('images/gallery/bedrooms/queen-master/02.jpg', 'Additional Queen Master Suite view showing storage and access toward its private bathroom.', 'Queen Master Suite alternate view')
                    ]
                },
                {
                    id: 'queen-bedroom-3',
                    title: 'Queen Bedroom 3',
                    facts: ['Corner bedroom', 'Second floor', 'Queen bed', 'Shared corridor bathroom'],
                    description: 'Queen Bedroom 3 is the second-floor corner bedroom. It does not have a private bathroom; guests use the shared bathroom entered from the corridor.',
                    linkedBathroom: {
                        title: 'Shared Second-Floor Bathroom',
                        text: 'Corridor bathroom shared by Queen Bedroom 3 and Queen Bedroom 4.',
                        target: 'shared-second-floor',
                        preview: photo('images/gallery/bathrooms/shared-second-floor/01.jpg', '', 'Shared second-floor bathroom')
                    },
                    images: [
                        photo('images/gallery/bedrooms/queen-3/01.jpg', 'Corner bedroom, Queen Bedroom 3.', 'Queen Bedroom 3 corner bedroom'),
                        photo('images/gallery/bedrooms/queen-3/02.jpg', 'Additional view of Queen Bedroom 3.', 'Queen Bedroom 3 alternate view')
                    ]
                },
                {
                    id: 'queen-bedroom-4',
                    title: 'Queen Bedroom 4',
                    facts: ['Central bedroom', 'Second floor', 'Queen bed', 'Shared corridor bathroom'],
                    description: 'Queen Bedroom 4 is the second-floor central bedroom. It does not have a private bathroom; guests use the shared bathroom entered from the corridor.',
                    linkedBathroom: {
                        title: 'Shared Second-Floor Bathroom',
                        text: 'Corridor bathroom shared by Queen Bedroom 3 and Queen Bedroom 4.',
                        target: 'shared-second-floor',
                        preview: photo('images/gallery/bathrooms/shared-second-floor/01.jpg', '', 'Shared second-floor bathroom')
                    },
                    images: [
                        photo('images/gallery/bedrooms/queen-4/01.jpg', 'Central bedroom, Queen Bedroom 4.', 'Queen Bedroom 4 central bedroom'),
                        photo('images/gallery/bedrooms/queen-4/02.jpg', 'Additional view of Queen Bedroom 4.', 'Queen Bedroom 4 alternate view')
                    ]
                }
            ]
        },

        kitchen: {
            title: 'Kitchen',
            intro: 'A full kitchen for breakfast, meals and longer stays.',
            subcategories: [
                {
                    id: 'full-kitchen',
                    title: 'Full Kitchen',
                    facts: ['Full kitchen', 'Dining table', 'Cooking space'],
                    description: 'The kitchen provides space to prepare meals and includes a dining table, making it practical for families and groups staying together.',
                    images: [
                        photo('images/gallery/kitchen/01.jpg', 'Full kitchen and dining table at Casa de Pedra.', 'Kitchen at Casa de Pedra', 'images/kitchen.png')
                    ]
                }
            ]
        },

        outdoor: {
            title: 'Outdoor & BBQ',
            intro: 'Private outdoor areas, BBQ facilities and the King Master Suite balcony.',
            subcategories: [
                {
                    id: 'backyard',
                    title: 'Backyard',
                    facts: ['Private outdoor area'],
                    description: 'The backyard provides a private outdoor area for guests to relax at the house.',
                    images: [
                        photo('images/backyard.jpg', 'Private backyard at Casa de Pedra.', 'Backyard at Casa de Pedra')
                    ]
                },
                {
                    id: 'bbq-area',
                    title: 'BBQ Area',
                    facts: ['BBQ', 'Outdoor sink', 'Exterior-access toilet nearby'],
                    description: 'The BBQ area is an outdoor service and gathering space. A separate toilet with exterior entrance is located next to the sink.',
                    images: [
                        photo('images/washer-barbeque.jpg', 'BBQ and outdoor service area.', 'BBQ area at Casa de Pedra')
                    ]
                },
                {
                    id: 'king-balcony',
                    title: 'King Suite Balcony',
                    facts: ['Second floor', 'Private to King Master Suite'],
                    description: 'The King Master Suite has its own private second-floor balcony.',
                    images: [
                        photo('images/gallery/outdoor/king-balcony-01.jpg', 'Private balcony associated with the King Master Suite.', 'King Master Suite private balcony')
                    ]
                }
            ]
        },

        bathrooms: {
            title: 'Bathrooms & Jacuzzi',
            intro: 'Four full bathrooms plus the BBQ-area half bath, with the bedroom relationships shown explicitly.',
            subcategories: [
                {
                    id: 'king-master-ensuite',
                    title: 'King Master Ensuite',
                    facts: ['Second floor', 'Private to King Master Suite', 'Shower'],
                    description: 'This second-floor bathroom is private to the King Master Suite. It includes a shower and is not shared with the other upstairs bedrooms.',
                    relationship: 'Linked bedroom: King Master Suite',
                    images: [
                        photo('images/gallery/bathrooms/king-master/01.jpg', 'King Master Ensuite shower and vanity area.', 'King Master Ensuite shower and vanity'),
                        photo('images/gallery/bathrooms/king-master/02.jpg', 'Additional view of the King Master Ensuite.', 'King Master Ensuite additional view')
                    ]
                },
                {
                    id: 'queen-master-bath',
                    title: 'Queen Master Bathroom & Jacuzzi',
                    facts: ['First floor', 'Private to Queen Master Suite', 'Shower', 'Jacuzzi'],
                    description: 'This first-floor bathroom is private to the Queen Master Suite and includes both a shower and Jacuzzi.',
                    relationship: 'Linked bedroom: Queen Master Suite',
                    images: [
                        photo('images/gallery/bathrooms/queen-master/01.jpg', 'Queen Master private bathroom with Jacuzzi.', 'Queen Master bathroom with Jacuzzi', 'images/jacuzzi.png'),
                        photo('images/gallery/bathrooms/queen-master/02.jpg', 'Alternate view showing the Queen Master bathroom layout.', 'Queen Master bathroom alternate view')
                    ]
                },
                {
                    id: 'shared-second-floor',
                    title: 'Shared Second-Floor Bathroom',
                    facts: ['Second floor', 'Corridor entrance', 'Shared by Bedrooms 3 & 4'],
                    description: 'This bathroom is entered from the second-floor corridor and is shared by guests staying in Queen Bedroom 3 and Queen Bedroom 4.',
                    relationship: 'Linked bedrooms: Queen Bedroom 3 and Queen Bedroom 4',
                    images: [
                        photo('images/gallery/bathrooms/shared-second-floor/01.jpg', 'Shared second-floor corridor bathroom.', 'Shared second-floor bathroom')
                    ]
                },
                {
                    id: 'first-floor-full-bath',
                    title: 'First-Floor Full Bathroom',
                    facts: ['First floor', 'Between living room and kitchen', 'Shower', 'Toilet', 'Sink'],
                    description: 'A separate full bathroom is located on the first floor between the living room and kitchen. It has a shower, toilet and sink.',
                    images: [
                        photo('images/gallery/bathrooms/first-floor-full/01.jpg', 'First-floor full bathroom with shower, toilet and sink.', 'First-floor full bathroom')
                    ]
                },
                {
                    id: 'bbq-toilet',
                    title: 'BBQ Area Toilet',
                    facts: ['Exterior entrance', 'Next to BBQ sink', 'Half bath'],
                    description: 'This half bath has its own exterior entrance next to the sink in the BBQ area, making it convenient when guests are using the outdoor space.',
                    images: [
                        photo('images/gallery/bathrooms/bbq-toilet/01.jpg', 'Exterior-access toilet in the BBQ area.', 'BBQ area toilet')
                    ]
                }
            ]
        }
    };

    let activeCategoryId = null;
    let activeSubcategoryId = null;
    let activeImageIndex = 0;
    let lastFocusedElement = null;
    let touchStartX = null;

    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'property-gallery-modal';
        modal.className = 'property-gallery-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="property-gallery-dialog" role="dialog" aria-modal="true" aria-labelledby="property-gallery-title">
                <header class="property-gallery-header">
                    <div>
                        <h2 id="property-gallery-title"></h2>
                        <p id="property-gallery-intro"></p>
                    </div>
                    <button type="button" class="property-gallery-close" aria-label="Close gallery">&times;</button>
                </header>
                <div class="property-gallery-tabs" id="property-gallery-tabs" role="tablist"></div>
                <div class="property-gallery-body">
                    <section class="property-gallery-viewer">
                        <div class="property-gallery-stage">
                            <button type="button" class="property-gallery-arrow property-gallery-prev" aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>
                            <div class="property-gallery-image-shell">
                                <img id="property-gallery-main-image" alt="">
                                <div id="property-gallery-image-empty" class="property-gallery-image-empty" hidden>
                                    <i class="fas fa-camera"></i>
                                    <span>Photo not available locally yet.</span>
                                </div>
                            </div>
                            <button type="button" class="property-gallery-arrow property-gallery-next" aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>
                        </div>
                        <div class="property-gallery-photo-line">
                            <span id="property-gallery-counter"></span>
                            <span id="property-gallery-caption"></span>
                        </div>
                        <div class="property-gallery-thumbnails" id="property-gallery-thumbnails" aria-label="Photo thumbnails"></div>
                    </section>
                    <aside class="property-gallery-details">
                        <h3 id="property-gallery-subtitle"></h3>
                        <div id="property-gallery-facts" class="property-gallery-facts"></div>
                        <p id="property-gallery-description"></p>
                        <p id="property-gallery-relationship" class="property-gallery-relationship" hidden></p>
                        <button type="button" id="property-gallery-bathroom-link" class="property-gallery-bathroom-link" hidden>
                            <img id="property-gallery-bathroom-preview" alt="" hidden>
                            <span>
                                <strong id="property-gallery-bathroom-title"></strong>
                                <small id="property-gallery-bathroom-text"></small>
                                <em>View linked bathroom <i class="fas fa-arrow-right"></i></em>
                            </span>
                        </button>
                    </aside>
                </div>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    const modal = createModal();
    const titleEl = modal.querySelector('#property-gallery-title');
    const introEl = modal.querySelector('#property-gallery-intro');
    const tabsEl = modal.querySelector('#property-gallery-tabs');
    const mainImageEl = modal.querySelector('#property-gallery-main-image');
    const emptyImageEl = modal.querySelector('#property-gallery-image-empty');
    const counterEl = modal.querySelector('#property-gallery-counter');
    const captionEl = modal.querySelector('#property-gallery-caption');
    const thumbsEl = modal.querySelector('#property-gallery-thumbnails');
    const subtitleEl = modal.querySelector('#property-gallery-subtitle');
    const factsEl = modal.querySelector('#property-gallery-facts');
    const descriptionEl = modal.querySelector('#property-gallery-description');
    const relationshipEl = modal.querySelector('#property-gallery-relationship');
    const bathroomLinkEl = modal.querySelector('#property-gallery-bathroom-link');
    const bathroomPreviewEl = modal.querySelector('#property-gallery-bathroom-preview');
    const bathroomTitleEl = modal.querySelector('#property-gallery-bathroom-title');
    const bathroomTextEl = modal.querySelector('#property-gallery-bathroom-text');

    function currentCategory() {
        return galleryData[activeCategoryId];
    }

    function currentSubcategory() {
        const category = currentCategory();
        return category?.subcategories.find(item => item.id === activeSubcategoryId) || category?.subcategories[0];
    }

    function setImageSource(element, imageData, onUnavailable) {
        if (!imageData) {
            element.removeAttribute('src');
            onUnavailable?.();
            return;
        }

        let fallbackTried = false;
        element.onerror = () => {
            if (!fallbackTried && imageData.fallback) {
                fallbackTried = true;
                element.src = imageData.fallback;
                return;
            }
            element.onerror = null;
            element.removeAttribute('src');
            onUnavailable?.();
        };
        element.alt = imageData.alt || '';
        element.src = imageData.src || imageData.fallback || '';
        if (!element.getAttribute('src')) onUnavailable?.();
    }

    function renderTabs() {
        const category = currentCategory();
        tabsEl.innerHTML = '';

        category.subcategories.forEach(subcategory => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'property-gallery-tab';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(subcategory.id === activeSubcategoryId));
            button.textContent = subcategory.title;
            button.addEventListener('click', () => {
                activeSubcategoryId = subcategory.id;
                activeImageIndex = 0;
                renderTabs();
                renderSubcategory();
            });
            tabsEl.appendChild(button);
        });
    }

    function renderMainImage() {
        const images = currentSubcategory()?.images || [];
        const imageData = images[activeImageIndex];

        emptyImageEl.hidden = true;
        mainImageEl.hidden = false;

        if (!imageData) {
            mainImageEl.hidden = true;
            emptyImageEl.hidden = false;
            counterEl.textContent = 'No photo';
            captionEl.textContent = '';
            return;
        }

        setImageSource(mainImageEl, imageData, () => {
            mainImageEl.hidden = true;
            emptyImageEl.hidden = false;
        });

        counterEl.textContent = `${activeImageIndex + 1} / ${images.length}`;
        captionEl.textContent = imageData.caption || '';

        const showArrows = images.length > 1;
        modal.querySelector('.property-gallery-prev').hidden = !showArrows;
        modal.querySelector('.property-gallery-next').hidden = !showArrows;
    }

    function renderThumbnails() {
        const images = currentSubcategory()?.images || [];
        thumbsEl.innerHTML = '';
        if (images.length <= 1) return;

        images.forEach((imageData, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `property-gallery-thumb${index === activeImageIndex ? ' active' : ''}`;
            button.setAttribute('aria-label', `View photo ${index + 1}`);

            const img = document.createElement('img');
            img.alt = imageData.alt || '';
            setImageSource(img, imageData, () => button.remove());

            button.appendChild(img);
            button.addEventListener('click', () => {
                activeImageIndex = index;
                renderMainImage();
                renderThumbnails();
            });
            thumbsEl.appendChild(button);
        });
    }

    function renderLinkedBathroom(subcategory) {
        const linked = subcategory.linkedBathroom;
        if (!linked) {
            bathroomLinkEl.hidden = true;
            return;
        }

        bathroomLinkEl.hidden = false;
        bathroomTitleEl.textContent = linked.title;
        bathroomTextEl.textContent = linked.text;
        bathroomLinkEl.dataset.target = linked.target;

        bathroomPreviewEl.hidden = false;
        setImageSource(bathroomPreviewEl, linked.preview, () => {
            bathroomPreviewEl.hidden = true;
        });
    }

    function renderSubcategory() {
        const subcategory = currentSubcategory();
        if (!subcategory) return;

        activeSubcategoryId = subcategory.id;
        if (activeImageIndex >= (subcategory.images?.length || 0)) activeImageIndex = 0;

        subtitleEl.textContent = subcategory.title;
        descriptionEl.textContent = subcategory.description || '';

        factsEl.innerHTML = '';
        (subcategory.facts || []).forEach(fact => {
            const span = document.createElement('span');
            span.textContent = fact;
            factsEl.appendChild(span);
        });

        if (subcategory.relationship) {
            relationshipEl.hidden = false;
            relationshipEl.textContent = subcategory.relationship;
        } else {
            relationshipEl.hidden = true;
            relationshipEl.textContent = '';
        }

        renderLinkedBathroom(subcategory);
        renderMainImage();
        renderThumbnails();
    }

    function openCategory(categoryId, subcategoryId) {
        const category = galleryData[categoryId];
        if (!category) return;

        lastFocusedElement = document.activeElement;
        activeCategoryId = categoryId;
        activeSubcategoryId = subcategoryId || category.subcategories[0].id;
        activeImageIndex = 0;

        titleEl.textContent = category.title;
        introEl.textContent = category.intro;
        renderTabs();
        renderSubcategory();

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('property-gallery-open');
        modal.querySelector('.property-gallery-close').focus();
    }

    function closeGallery() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('property-gallery-open');
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    function movePhoto(direction) {
        const images = currentSubcategory()?.images || [];
        if (images.length <= 1) return;
        activeImageIndex = (activeImageIndex + direction + images.length) % images.length;
        renderMainImage();
        renderThumbnails();
    }

    document.querySelectorAll('[data-gallery-category]').forEach(tile => {
        tile.addEventListener('click', () => openCategory(tile.dataset.galleryCategory));
    });

    modal.querySelector('.property-gallery-close').addEventListener('click', closeGallery);
    modal.querySelector('.property-gallery-prev').addEventListener('click', () => movePhoto(-1));
    modal.querySelector('.property-gallery-next').addEventListener('click', () => movePhoto(1));

    bathroomLinkEl.addEventListener('click', () => {
        openCategory('bathrooms', bathroomLinkEl.dataset.target);
    });

    modal.addEventListener('click', event => {
        if (event.target === modal) closeGallery();
    });

    modal.querySelector('.property-gallery-stage').addEventListener('touchstart', event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    modal.querySelector('.property-gallery-stage').addEventListener('touchend', event => {
        if (touchStartX === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX;
        const delta = endX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) < 45) return;
        movePhoto(delta > 0 ? -1 : 1);
    }, { passive: true });

    document.addEventListener('keydown', event => {
        if (!modal.classList.contains('active')) return;
        if (event.key === 'Escape') closeGallery();
        if (event.key === 'ArrowLeft') movePhoto(-1);
        if (event.key === 'ArrowRight') movePhoto(1);
    });

    window.CasaDePedraGallery = {
        open: openCategory,
        close: closeGallery
    };
})();
