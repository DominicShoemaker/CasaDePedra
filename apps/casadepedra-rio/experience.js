(() => {
    'use strict';

    const metroDiagram = (() => {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="720" viewBox="0 0 1400 720">
          <rect width="1400" height="720" fill="#f7f8fa"/>
          <text x="70" y="82" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#073b5c">Cantagalo on MetrôRio Line 1</text>
          <text x="70" y="125" font-family="Arial, sans-serif" font-size="24" fill="#58636d">Simplified orientation — not to scale</text>
          <line x1="135" y1="330" x2="1260" y2="330" stroke="#0a6fa5" stroke-width="18" stroke-linecap="round"/>
          <g font-family="Arial, sans-serif" fill="#1b2730" text-anchor="middle">
            <g transform="translate(135,330)"><circle r="24" fill="#fff" stroke="#0a6fa5" stroke-width="12"/><text y="72" font-size="22">General Osório</text><text y="100" font-size="19" fill="#6d7780">Ipanema</text></g>
            <g transform="translate(285,330)"><circle r="35" fill="#e8a92d" stroke="#fff" stroke-width="8"/><text y="-58" font-size="27" font-weight="700" fill="#073b5c">Cantagalo</text><text y="-28" font-size="19" fill="#6d7780">Casa de Pedra area</text></g>
            <g transform="translate(440,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="72" font-size="21">Siqueira Campos</text></g>
            <g transform="translate(600,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="-55" font-size="21">Cardeal Arcoverde</text></g>
            <g transform="translate(760,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="72" font-size="22">Botafogo</text></g>
            <g transform="translate(920,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="-55" font-size="22">Flamengo</text></g>
            <g transform="translate(1080,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="72" font-size="22">Cinelândia</text><text y="100" font-size="19" fill="#6d7780">Centro</text></g>
            <g transform="translate(1260,330)"><circle r="22" fill="#fff" stroke="#0a6fa5" stroke-width="10"/><text y="-55" font-size="22">Carioca / Central</text><text y="-27" font-size="19" fill="#6d7780">Centro connections</text></g>
          </g>
          <g font-family="Arial, sans-serif" fill="#33424d">
            <rect x="95" y="510" width="1210" height="120" rx="18" fill="#fff" stroke="#d9dee2"/>
            <text x="130" y="557" font-size="25" font-weight="700" fill="#073b5c">Why it matters</text>
            <text x="130" y="598" font-size="23">One stop to General Osório / Ipanema; direct Line 1 service toward Botafogo and Rio's historic center.</text>
          </g>
        </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    })();

    const data = {
        location: {
            title: 'Prime Copacabana Location',
            intro: 'A residential base with the beach, Cantagalo Metro, the fort, Ipanema/Arpoador and everyday services close at hand.',
            tabs: [
                {
                    id: 'walkable',
                    title: 'Why This Location',
                    facts: ['~500 m to Cantagalo Metro', '~800 m to Copacabana Beach', '~2 km to Forte de Copacabana'],
                    description: 'Casa de Pedra sits in a quieter residential pocket of Copacabana near Rua Pompeu Loureiro and Rua Barão de Ipanema. Guests can combine a neighborhood stay with quick access to the beach, metro, markets, bakeries, pharmacies, cafés and restaurants instead of depending on a car for every outing.',
                    highlights: [
                        'Copacabana Beach and its waterfront are within walking distance.',
                        'Cantagalo gives the house a fast public-transport connection to Ipanema, Botafogo and Centro.',
                        'Forte de Copacabana and the Arpoador/Ipanema side of the South Zone are close enough for easy sightseeing days.'
                    ],
                    sources: [
                        ['Riotur — Copacabana & Leme', 'https://riotur.rio/en/que_fazer/copacabana-e-leme-2/'],
                        ['MetrôRio — Cantagalo / Copacabana', 'https://www.metrorio.com.br/Estacoes?p_ponto=26']
                    ],
                    images: [
                        {
                            src: 'images/Copacabana-map-with-the-house.png',
                            caption: 'Casa de Pedra neighborhood locator showing the house within Copacabana.',
                            credit: null
                        },
                        {
                            src: 'images/experience/copacabana-aerial.webp',
                            fallback: 'images/Map with house.png',
                            caption: 'Aerial view of Copacabana and its compact relationship between beach, neighborhood streets and surrounding hills.',
                            credit: ['Gustavo Facci / Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_Copacabana_beach.jpg']
                        }
                    ]
                },
                {
                    id: 'metro',
                    title: 'Cantagalo Metro',
                    facts: ['MetrôRio Line 1', '1 stop to General Osório / Ipanema', 'Direct toward Botafogo & Centro'],
                    description: 'Cantagalo / Copacabana is a Line 1 station. From Cantagalo, General Osório / Ipanema is the next stop in one direction; in the other direction Line 1 continues through Siqueira Campos, Cardeal Arcoverde, Botafogo, Flamengo and central-city stations such as Cinelândia and Carioca.',
                    highlights: [
                        'Useful for Ipanema without arranging a car.',
                        'Direct rail access toward Botafogo, Flamengo and the historic center.',
                        'Connections farther across Rio are available through the wider MetrôRio network.'
                    ],
                    sources: [
                        ['MetrôRio — Cantagalo / Copacabana', 'https://www.metrorio.com.br/Estacoes?p_ponto=26'],
                        ['MetrôRio — Interactive Map', 'https://www.metrorio.com.br/VadeMetro/MapaInterativo']
                    ],
                    images: [
                        {
                            src: 'images/experience/cantagalo-metro-entrance.webp',
                            caption: 'Cantagalo / Copacabana station, Access B on Rua Xavier da Silveira.',
                            credit: ['Vitor Crayon / Wikimedia Commons — CC0', 'https://commons.wikimedia.org/wiki/File:Acesso_B_da_esta%C3%A7%C3%A3o_Cantagalo_(Copacabana),_do_Metr%C3%B4Rio.jpg']
                        },
                        {
                            src: metroDiagram,
                            caption: 'Simplified Line 1 orientation from Cantagalo toward Ipanema, Botafogo and Centro.',
                            credit: null
                        }
                    ]
                },
                {
                    id: 'beach-fort',
                    title: 'Beach, Fort & Arpoador',
                    facts: ['Copacabana waterfront', 'Historic forts', 'Arpoador & Ipanema nearby'],
                    description: 'Copacabana is more than its famous sand. Riotur highlights the bike path, kiosks, hotels, bars and restaurants along the waterfront, plus military forts at both ends of the beach. Toward the south end, Forte de Copacabana and Arpoador create an easy sequence of history, ocean views and sunset scenery.',
                    highlights: [
                        'Walk the wave-pattern Portuguese-stone promenade.',
                        'Combine Forte de Copacabana with Arpoador and Ipanema in the same outing.',
                        'Beachfront kiosks make it easy to stop for coconut water, snacks or a casual meal.'
                    ],
                    sources: [
                        ['Riotur — Copacabana & Leme', 'https://riotur.rio/en/que_fazer/copacabana-e-leme-2/'],
                        ['Riotur — Rio Beaches', 'https://riotur.rio/en/que_fazer/rio-beaches/']
                    ],
                    images: [
                        {
                            src: 'images/experience/arpoador-rio.webp',
                            caption: 'Arpoador at the Ipanema end of the South Zone beach corridor.',
                            credit: ['VinnyWiki / Wikimedia Commons — CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Arpoador_-_Rio.jpg']
                        },
                        {
                            src: 'images/experience/copacabana-promenade.webp',
                            caption: 'Copacabana’s iconic Portuguese-stone promenade, with its black-and-white wave pattern.',
                            credit: null
                        },
                        {
                            src: 'images/experience/copacabana-waterfront.webp',
                            caption: 'Copacabana beach and waterfront scenery.',
                            credit: null
                        },
                        {
                            src: 'images/experience/arpoador-coastline.webp',
                            caption: 'Arpoador and the South Zone coastline.',
                            credit: null
                        },
                        {
                            src: 'images/experience/forte-de-copacabana.webp',
                            caption: 'Forte de Copacabana, the historic military fort at the southern end of Copacabana Beach.',
                            credit: null
                        }
                    ]
                }
            ]
        },

        architecture: {
            title: 'Rio Architecture & Natural Beauty',
            intro: 'Rio layers palaces and civic landmarks with Atlantic Forest, tropical parks, mountains, Guanabara Bay and islands.',
            tabs: [
                {
                    id: 'christ-redeemer',
                    title: 'Christ the Redeemer',
                    facts: ['Corcovado Mountain', '30 m statue • 38 m with pedestal', 'Dedicated in 1931', 'Reinforced concrete & soapstone'],
                    description: 'High above Rio on Corcovado, Christ the Redeemer (Cristo Redentor) brings sculpture, engineering, faith and landscape into one unforgettable silhouette. The 30-meter statue stands on an 8-meter pedestal and its outstretched arms span 28 meters. Designed under Brazilian engineer Heitor da Silva Costa, with sculptor Paul Landowski and engineer Albert Caquot, the monument was inaugurated on October 12, 1931.',
                    highlights: [
                        'The open-armed figure forms a cross above Guanabara Bay and has become one of Rio’s defining cultural and religious symbols.',
                        'Its reinforced-concrete structure is covered with a mosaic of soapstone pieces chosen for durability and their ability to follow the monument’s curves.',
                        'From Corcovado, the setting brings together Tijuca Forest, Rio’s mountains, Guanabara Bay and the urban coastline in a single panorama.'
                    ],
                    sources: [
                        ['Santuário Cristo Redentor — History', 'https://cristoredentoroficial.com.br/a-historia-em-um-clique'],
                        ['Santuário Cristo Redentor — Monument facts', 'https://cristoredentoroficial.com.br/curiosidades'],
                        ['Paul Landowski — Christ the Redeemer', 'https://www.paul-landowski.com/en/portfolio/christ-redempteur/']
                    ],
                    images: [
                        {
                            src: 'images/experience/christ-the-redeemer-raphael.webp',
                            caption: 'Christ the Redeemer above Rio de Janeiro.',
                            credit: null
                        },
                        {
                            src: 'images/experience/christ-the-redeemer-visitors.webp',
                            caption: 'Visitors at the base of Christ the Redeemer on Corcovado.',
                            credit: null
                        },
                        {
                            src: 'images/experience/christ-the-redeemer-moon.webp',
                            caption: 'Christ the Redeemer rising above Corcovado with the moon aligned behind the monument.',
                            credit: null
                        }
                    ]
                },
                {
                    id: 'architecture',
                    title: 'Palaces & Landmarks',
                    facts: ['Theatro Municipal', 'Praça Tiradentes', 'Ilha Fiscal', 'Historic churches', 'Museu do Amanhã', 'AquaRio'],
                    description: 'Rio rewards visitors who look beyond the beach. Riotur’s architecture guide highlights landmarks ranging from the Theatro Municipal and Real Gabinete Português de Leitura to Ilha Fiscal, Parque Eduardo Guinle and Copacabana Palace. Together they show how imperial, Belle Époque, modern and landscape architecture sit within the same city.',
                    highlights: [
                        'Theatro Municipal anchors the Cinelândia cultural district.',
                        'Ilha Fiscal adds a castle-like historic landmark inside Guanabara Bay.',
                        'Copacabana Palace brings landmark hotel architecture directly to the neighborhood waterfront.'
                    ],
                    sources: [
                        ['Riotur — Rio Architecture guide', 'https://riotur.rio/wp-content/uploads/2023/04/RIO-ARCHITECTURE.pdf']
                    ],
                    images: [
                        {
                            src: 'images/experience/theatro-municipal-raphael.webp',
                            caption: 'Theatro Municipal do Rio de Janeiro.',
                            credit: null
                        },
                        {
                            src: 'images/experience/praca-tiradentes.webp',
                            caption: 'Praça Tiradentes, a historic public square in central Rio de Janeiro.',
                            credit: ['Riotur', 'https://riotur.rio/']
                        },
                        {
                            src: 'images/experience/ilha-fiscal.webp',
                            caption: 'Ilha Fiscal, the distinctive historic palace set inside Guanabara Bay.',
                            credit: null
                        },
                        {
                            src: 'images/experience/historic-church-rio.webp',
                            caption: 'Historic church architecture in Rio de Janeiro.',
                            credit: null
                        },
                        {
                            src: 'images/experience/museu-do-amanha.webp',
                            caption: 'Museu do Amanhã at Praça Mauá, a striking contemporary landmark on Rio’s revitalized waterfront.',
                            credit: null
                        },
                        {
                            src: 'images/experience/aquario.webp',
                            caption: 'AquaRio, Rio’s marine aquarium in the Porto Maravilha waterfront district.',
                            credit: null
                        },
                        {
                            src: 'images/experience/parque-lage-palace.webp',
                            caption: 'Palácio do Parque Lage, where architecture opens directly into tropical landscape.',
                            credit: ['Wilfredor / Wikimedia Commons — CC0', 'https://commons.wikimedia.org/wiki/File:Pal%C3%A1cio_do_Parque_Lage,_Rio_de_Janeiro.jpg']
                        }
                    ]
                },
                {
                    id: 'parks',
                    title: 'Parks & Atlantic Forest',
                    facts: ['Tijuca Forest', 'Parque Lage', 'Vista Chinesa', 'Jardim Botânico', 'Atlantic Forest'],
                    description: 'Parque Lage is one of the clearest examples of Rio’s combination of architecture and nature. Riotur describes an 1840 Romantic-style garden designed by English landscaper John Tyndale, with native Atlantic Forest, imperial palms, lakes, artificial islands, caves and the historic mansion now used by the School of Visual Arts.',
                    highlights: [
                        'Architecture, gardens and forest share the same setting.',
                        'Nearby Jardim Botânico and the Tijuca/Corcovado landscape extend the green side of a Rio itinerary.',
                        'The South Zone makes it practical to combine beach mornings with parks and cultural stops later in the day.'
                    ],
                    sources: [
                        ['Riotur — Parque Lage', 'https://riotur.rio/en/que_fazer/parque-lage-2/']
                    ],
                    images: [
                        {
                            src: 'images/experience/cascatinha-taunay.webp',
                            caption: 'Cascatinha Taunay in Tijuca Forest, one of the best-known waterfall scenes inside Rio’s urban Atlantic Forest.',
                            credit: null
                        },
                        {
                            src: 'images/experience/parque-lage.webp',
                            caption: 'Parque Lage, where a historic palace, formal gardens and Atlantic Forest meet beneath Corcovado.',
                            credit: null
                        },
                        {
                            src: 'images/experience/vista-chinesa.webp',
                            caption: 'Vista Chinesa, a panoramic lookout in Tijuca National Park with wide views across Rio.',
                            credit: null
                        },
                        {
                            src: 'images/experience/jardim-botanico.webp',
                            caption: 'Jardim Botânico do Rio de Janeiro, known for its monumental palm avenues and tropical plant collections.',
                            credit: null
                        },
                        {
                            src: 'images/experience/parque-lage-palace.webp',
                            caption: 'The Parque Lage palace framed by tropical vegetation.',
                            credit: ['Wilfredor / Wikimedia Commons — CC0', 'https://commons.wikimedia.org/wiki/File:Pal%C3%A1cio_do_Parque_Lage,_Rio_de_Janeiro.jpg']
                        }
                    ]
                },
                {
                    id: 'bay',
                    title: 'Bay, Mountains & Islands',
                    facts: ['Sugarloaf', 'Angra dos Reis', 'Arraial do Cabo', 'Ilha da Gigóia', 'Praia Vermelha', 'Búzios'],
                    description: 'Rio’s cityscape is inseparable from its geography. Sugarloaf rises at the entrance to Guanabara Bay, while nearby beaches, islands and lagoons add another layer to the landscape. The gallery also highlights celebrated coastal excursions beyond the city, including Angra dos Reis, Arraial do Cabo and Búzios.',
                    highlights: [
                        'Sugarloaf remains one of the defining natural silhouettes of Rio.',
                        'Praia Vermelha and Ilha da Gigóia show how beaches, lagoons and islands are woven into the city itself.',
                        'Angra dos Reis, Arraial do Cabo and Búzios extend the experience to some of the best-known coastal landscapes in Rio de Janeiro state.'
                    ],
                    sources: [
                        ['Riotur — Fortress Complex / Guanabara Bay views', 'https://riotur.rio/en/que_fazer/complexo-dos-fortes-fortress-complex/'],
                        ['Riotur — Rio Architecture guide', 'https://riotur.rio/wp-content/uploads/2023/04/RIO-ARCHITECTURE.pdf']
                    ],
                    images: [
                        {
                            src: 'images/experience/sugarloaf-mountain.webp',
                            caption: 'Sugarloaf Mountain above the Rio waterfront and Guanabara Bay landscape.',
                            credit: ['Wilfredor / Wikimedia Commons — CC0', 'https://commons.wikimedia.org/wiki/File:Sugarloaf_Mountain,_Rio_de_Janeiro,_Brazil.jpg']
                        },
                        {
                            src: 'images/experience/angra-dos-reis.webp',
                            caption: 'Angra dos Reis, known for forested islands, sheltered coves and emerald-green water along the Costa Verde.',
                            credit: null
                        },
                        {
                            src: 'images/experience/arraial-do-cabo.webp',
                            caption: 'Arraial do Cabo, where pale-sand beaches and clear Atlantic water define the coastal scenery.',
                            credit: null
                        },
                        {
                            src: 'images/experience/ilha-da-gigoia.webp',
                            caption: 'Ilha da Gigóia, a small island community in Barra da Tijuca’s lagoon system.',
                            credit: null
                        },
                        {
                            src: 'images/experience/praia-vermelha.webp',
                            caption: 'Praia Vermelha beneath the granite slopes beside Sugarloaf Mountain.',
                            credit: null
                        },
                        {
                            src: 'images/experience/buzios.webp',
                            caption: 'Búzios, a peninsula of beaches, rocky coves and Atlantic viewpoints east of Rio.',
                            credit: null
                        }
                    ]
                }
            ]
        },

        lifestyle: {
            title: 'Carioca Lifestyle',
            intro: 'Beach sports, surf, Carnival, cafés, restaurants, kiosks, bars and nightlife are part of everyday Rio as much as sightseeing.',
            tabs: [
                {
                    id: 'sports',
                    title: 'Beach Sports',
                    facts: ['Beach volleyball', 'Beach football', 'Footvolley', 'Cycling & running'],
                    description: 'Copacabana’s sand and waterfront function as a giant outdoor recreation space. Riotur notes that the beach has hosted major beach-soccer and volleyball championships, while everyday visitors see informal games, training, running and cycling along the promenade.',
                    highlights: [
                        'Join or watch beach volleyball and football on the sand.',
                        'Use the waterfront for walking, jogging and cycling.',
                        'Beach kiosks make it easy to alternate activity with relaxed food and drinks.'
                    ],
                    sources: [
                        ['Riotur — Copacabana & Leme', 'https://riotur.rio/en/que_fazer/copacabana-e-leme-2/']
                    ],
                    images: [
                        {
                            src: 'images/experience/copacabana-beach-volleyball.webp',
                            caption: 'Beach volleyball on Copacabana — the waterfront has hosted international competition as well as everyday play.',
                            credit: ['U.S. Department of State / Wikimedia Commons — Public Domain', 'https://commons.wikimedia.org/wiki/File:The_Venue_for_Olympic_Beach_Volleyball_on_the_Copacabana_Beach_at_the_2016_Summer_Olympics_in_Rio_(28773460166).jpg']
                        },
                        {
                            src: 'images/experience/copacabana-footvolley.webp',
                            caption: 'Footvolley combines football technique with beach-volleyball rules and is a signature sport on Rio’s sand.',
                            credit: null
                        },
                        {
                            src: 'images/experience/rio-beach-football.webp',
                            caption: 'Beach football on Rio’s sand, part of the everyday sporting culture along the waterfront.',
                            credit: null
                        }
                    ]
                },
                {
                    id: 'surf',
                    title: 'Surf & Sunset',
                    facts: ['Arpoador', 'Surf culture', 'Sunset viewpoint', 'Ipanema'],
                    description: 'At the Ipanema end of the South Zone coastline, Arpoador is described by Riotur as a surfers’ corner and a favorite place to watch the sunset. It gives guests an easy contrast to Copacabana: rock viewpoint, surf, Ipanema beach and one of Rio’s classic evening rituals.',
                    highlights: [
                        'Watch surfers from the Arpoador rocks or take a lesson when conditions suit.',
                        'Stay for sunset — applause at the horizon is a familiar local tradition.',
                        'Continue into Ipanema for dinner, drinks or an evening walk.'
                    ],
                    sources: [
                        ['Riotur — Beaches to contemplate and live', 'https://riotur.rio/wp-content/uploads/2024/08/Riotur_LivretoPublico_Visit_2023_200x200mm_ING.pdf']
                    ],
                    images: [
                        {
                            src: 'images/experience/arpoador-rio.webp',
                            caption: 'Arpoador at the edge of Ipanema, known for surf and sunset views.',
                            credit: ['VinnyWiki / Wikimedia Commons — CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Arpoador_-_Rio.jpg']
                        }
                    ]
                },
                {
                    id: 'nightlife',
                    title: 'Carnival, Food & Nightlife',
                    facts: ['Carnival', 'Waterfront kiosks', 'Restaurants & cafés', 'Bars & nightlife'],
                    description: 'Copacabana stays active after the beach day ends. Riotur describes lively kiosks, restaurants and bars used both day and night, while the metro makes it straightforward to branch out toward Ipanema, Botafogo and central Rio. Carnival adds another dimension: Praça Onze station sits close to the Sambadrome, putting the parade district on the rail network from Cantagalo.',
                    highlights: [
                        'Start with a beachfront kiosk or neighborhood café.',
                        'Choose from casual Brazilian food, seafood, international restaurants and cocktail bars across the South Zone.',
                        'During Carnival, use the metro network to reach central festivities and the Sambadrome area.'
                    ],
                    sources: [
                        ['Riotur — Copacabana & Leme', 'https://riotur.rio/en/que_fazer/copacabana-e-leme-2/'],
                        ['Riotur — Restaurants', 'https://riotur.rio/en/onde-comer/restaurants/'],
                        ['MetrôRio — Praça Onze', 'https://www.metrorio.com.br/Estacoes?p_ponto=13']
                    ],
                    images: [
                        {
                            src: 'images/experience/copacabana-new-years-eve.webp',
                            caption: 'New Year’s Eve in Rio de Janeiro, when Copacabana becomes the stage for one of the city’s largest annual celebrations.',
                            credit: null
                        },
                        {
                            src: 'images/experience/rio-carnival.webp',
                            caption: 'Rio Carnival brings samba, elaborate costumes and large-scale celebrations to the city.',
                            credit: null
                        },
                        {
                            src: 'images/experience/rio-beachfront-food.webp',
                            caption: 'Beachfront food and drink are part of Rio’s day-to-night waterfront culture.',
                            credit: null
                        }
                    ]
                }
            ]
        }
    };

    let modal;
    let activeCategory;
    let activeTab;
    let activeImage = 0;
    let lastFocus;
    let touchStartX = null;

    function createModal() {
        const el = document.createElement('div');
        el.className = 'experience-modal';
        el.id = 'experience-detail-modal';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = `
          <div class="experience-dialog" role="dialog" aria-modal="true" aria-labelledby="experience-modal-title">
            <header class="experience-modal-header">
              <div><h2 id="experience-modal-title"></h2><p id="experience-modal-intro"></p></div>
              <button type="button" class="experience-modal-close" aria-label="Close experience popup">&times;</button>
            </header>
            <div class="experience-tabs" id="experience-tabs" role="tablist"></div>
            <div class="experience-modal-body">
              <section class="experience-viewer">
                <div class="experience-stage">
                  <button type="button" class="experience-arrow experience-prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
                  <div class="experience-image-shell">
                    <img id="experience-main-image" alt="">
                    <div id="experience-image-loading" class="experience-image-loading"><i class="fas fa-spinner fa-spin"></i><span>Loading image…</span></div>
                    <div id="experience-image-error" class="experience-image-error" hidden><i class="fas fa-image"></i><span>Image unavailable.</span></div>
                  </div>
                  <button type="button" class="experience-arrow experience-next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="experience-photo-line">
                  <strong id="experience-counter"></strong>
                  <div class="experience-photo-meta"><span id="experience-caption"></span><small id="experience-credit" class="experience-credit" hidden></small></div>
                </div>
                <div class="experience-thumbnails" id="experience-thumbnails"></div>
              </section>
              <aside class="experience-details">
                <h3 id="experience-subtitle"></h3>
                <div class="experience-facts" id="experience-facts"></div>
                <p id="experience-description"></p>
                <ul class="experience-highlights" id="experience-highlights"></ul>
                <div class="experience-sources" id="experience-sources"></div>
              </aside>
            </div>
          </div>`;
        document.body.appendChild(el);
        return el;
    }

    function tabData() {
        return data[activeCategory]?.tabs.find(item => item.id === activeTab) || data[activeCategory]?.tabs[0];
    }

    function setImage(img, slide, errorCallback) {
        let fallbackUsed = false;
        img.onload = () => {
            modal.querySelector('#experience-image-loading').hidden = true;
            modal.querySelector('#experience-image-error').hidden = true;
            img.hidden = false;
        };
        img.onerror = () => {
            if (!fallbackUsed && slide.fallback) {
                fallbackUsed = true;
                img.src = slide.fallback;
                return;
            }
            img.hidden = true;
            errorCallback?.();
        };
        img.referrerPolicy = 'no-referrer';
        img.alt = slide.caption || '';
        img.src = slide.src;
    }

    function renderTabs() {
        const tabs = modal.querySelector('#experience-tabs');
        tabs.innerHTML = '';
        data[activeCategory].tabs.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'experience-tab';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(item.id === activeTab));
            button.textContent = item.title;
            button.addEventListener('click', () => {
                activeTab = item.id;
                activeImage = 0;
                renderTabs();
                renderContent();
            });
            tabs.appendChild(button);
        });
    }

    function renderImage() {
        const item = tabData();
        const slides = item.images || [];
        const slide = slides[activeImage];
        const img = modal.querySelector('#experience-main-image');
        const loading = modal.querySelector('#experience-image-loading');
        const error = modal.querySelector('#experience-image-error');
        const credit = modal.querySelector('#experience-credit');

        loading.hidden = false;
        error.hidden = true;
        img.hidden = false;
        setImage(img, slide, () => {
            loading.hidden = true;
            error.hidden = false;
        });

        modal.querySelector('#experience-counter').textContent = `${activeImage + 1} / ${slides.length}`;
        modal.querySelector('#experience-caption').textContent = slide.caption || '';

        if (slide.credit) {
            credit.hidden = false;
            credit.innerHTML = `Photo: <a href="${slide.credit[1]}" target="_blank" rel="noopener">${slide.credit[0]}</a>`;
        } else {
            credit.hidden = true;
            credit.textContent = '';
        }

        const showArrows = slides.length > 1;
        modal.querySelector('.experience-prev').hidden = !showArrows;
        modal.querySelector('.experience-next').hidden = !showArrows;
    }

    function renderThumbnails() {
        const holder = modal.querySelector('#experience-thumbnails');
        const slides = tabData().images || [];
        holder.innerHTML = '';
        if (slides.length <= 1) return;
        slides.forEach((slide, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `experience-thumb${index === activeImage ? ' active' : ''}`;
            button.setAttribute('aria-label', `View image ${index + 1}`);
            const img = document.createElement('img');
            img.referrerPolicy = 'no-referrer';
            img.loading = 'lazy';
            img.alt = slide.caption || '';
            img.src = slide.src;
            img.onerror = () => {
                if (slide.fallback && img.src !== slide.fallback) img.src = slide.fallback;
                else button.remove();
            };
            button.appendChild(img);
            button.addEventListener('click', () => {
                activeImage = index;
                renderImage();
                renderThumbnails();
            });
            holder.appendChild(button);
        });
    }

    function renderContent() {
        const item = tabData();
        modal.querySelector('#experience-subtitle').textContent = item.title;
        modal.querySelector('#experience-description').textContent = item.description;

        const facts = modal.querySelector('#experience-facts');
        facts.innerHTML = '';
        item.facts.forEach(value => {
            const chip = document.createElement('span');
            chip.textContent = value;
            facts.appendChild(chip);
        });

        const highlights = modal.querySelector('#experience-highlights');
        highlights.innerHTML = '';
        item.highlights.forEach(value => {
            const li = document.createElement('li');
            li.textContent = value;
            highlights.appendChild(li);
        });

        const sources = modal.querySelector('#experience-sources');
        sources.innerHTML = '<strong>Research sources:</strong> ' + item.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`).join(' · ');

        renderImage();
        renderThumbnails();
    }

    function openExperience(categoryId) {
        if (!data[categoryId]) return;
        lastFocus = document.activeElement;
        activeCategory = categoryId;
        activeTab = data[categoryId].tabs[0].id;
        activeImage = 0;
        modal.querySelector('#experience-modal-title').textContent = data[categoryId].title;
        modal.querySelector('#experience-modal-intro').textContent = data[categoryId].intro;
        renderTabs();
        renderContent();
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('experience-modal-open');
        modal.querySelector('.experience-modal-close').focus();
    }

    function closeExperience() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('experience-modal-open');
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function moveImage(direction) {
        const slides = tabData()?.images || [];
        if (slides.length <= 1) return;
        activeImage = (activeImage + direction + slides.length) % slides.length;
        renderImage();
        renderThumbnails();
    }

    function enhanceTiles() {
        const cards = document.querySelectorAll('#experience .experience-grid .experience-card');
        const configs = [
            {
                id: 'location',
                title: 'Prime Copacabana Location',
                text: 'Beach, Cantagalo Metro, Forte de Copacabana, Ipanema/Arpoador and daily services are all within easy reach.',
                image: 'images/Map with house.png',
                alt: 'Map showing Casa de Pedra in Copacabana near Cantagalo Metro and Copacabana Beach'
            },
            {
                id: 'architecture',
                title: 'Rio Architecture & Natural Beauty',
                text: 'Palaces, historic landmarks, tropical parks, Atlantic Forest, mountains, Guanabara Bay and islands.',
                image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Sugarloaf_Mountain%2C_Rio_de_Janeiro%2C_Brazil.jpg/1280px-Sugarloaf_Mountain%2C_Rio_de_Janeiro%2C_Brazil.jpg',
                alt: 'Sugarloaf Mountain and Rio de Janeiro waterfront'
            },
            {
                id: 'lifestyle',
                title: 'Carioca Lifestyle',
                text: 'Surf, beach sports, Carnival, cafés, restaurants, kiosks, bars and nightlife — Rio is lived outdoors and after dark.',
                image: 'images/activities.png',
                alt: 'Rio de Janeiro beach, culture and lifestyle activities'
            }
        ];

        cards.forEach((card, index) => {
            const cfg = configs[index];
            if (!cfg) return;
            card.dataset.experienceCategory = cfg.id;
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Explore ${cfg.title}`);
            const img = card.querySelector('img');
            const title = card.querySelector('h3');
            const paragraph = card.querySelector('p');
            if (img) {
                img.src = cfg.image;
                img.alt = cfg.alt;
                img.referrerPolicy = 'no-referrer';
            }
            if (title) title.textContent = cfg.title;
            if (paragraph) paragraph.textContent = cfg.text;
            card.addEventListener('click', () => openExperience(cfg.id));
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openExperience(cfg.id);
                }
            });
        });
    }

    modal = createModal();
    modal.querySelector('.experience-modal-close').addEventListener('click', closeExperience);
    modal.querySelector('.experience-prev').addEventListener('click', () => moveImage(-1));
    modal.querySelector('.experience-next').addEventListener('click', () => moveImage(1));
    modal.addEventListener('click', event => {
        if (event.target === modal) closeExperience();
    });
    modal.querySelector('.experience-stage').addEventListener('touchstart', event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    modal.querySelector('.experience-stage').addEventListener('touchend', event => {
        if (touchStartX === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX;
        const delta = endX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) >= 45) moveImage(delta > 0 ? -1 : 1);
    }, { passive: true });
    document.addEventListener('keydown', event => {
        if (!modal.classList.contains('active')) return;
        if (event.key === 'Escape') closeExperience();
        if (event.key === 'ArrowLeft') moveImage(-1);
        if (event.key === 'ArrowRight') moveImage(1);
    });

    enhanceTiles();
    window.CasaDePedraExperience = { open: openExperience, close: closeExperience };
})();
