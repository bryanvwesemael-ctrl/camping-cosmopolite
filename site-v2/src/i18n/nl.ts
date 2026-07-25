import { IMG } from '../data/images';
import type { Feature, Activity, RentalOption, PriceItem, Review, FaqItem, TimelineItem, MetaSet } from '../types';

// Alle Nederlandse teksten. Geen enkele string hoort hardcoded in componenten.
export const nl = {
  meta: {
    home: { title: 'Camping Cosmopolite — Kamperen aan de Ourthe in La Roche-en-Ardenne', description: 'Familiecamping aan de oevers van de Ourthe in La Roche-en-Ardenne. Tenten, caravans, campers en huuraccommodatie in de Ardennen. Reserveer online.' },
    activiteiten: { title: 'Activiteiten — Camping Cosmopolite', description: 'Zwemmen, wandelen, fietsen, kajakken en vissen in en rond Camping Cosmopolite in de Ardennen.' },
    huuropties: { title: 'Huuropties & staanplaatsen — Camping Cosmopolite', description: 'Ruime staanplaatsen voor tent, caravan en camper, plus safaritent en stacaravan te huur aan de Ourthe.' },
    scoutsweide: { title: 'Scoutsweide & groepen — Camping Cosmopolite', description: 'Een aparte weide voor scouts, chiro, jeugdverenigingen en scholen aan de oevers van de Ourthe.' },
    tarieven: { title: 'Tarieven — Camping Cosmopolite', description: 'Bekijk de tarieven van Camping Cosmopolite: staanplaatsen, personen, huuraccommodatie en extra\'s.' },
    contact: { title: 'Contact — Camping Cosmopolite', description: 'Contacteer Camping Cosmopolite in La Roche-en-Ardenne. Adres, telefoon, e-mail en ligging.' },
    overons: { title: 'Over ons — Camping Cosmopolite', description: 'Ontdek het verhaal achter Camping Cosmopolite, een familiecamping aan de Ourthe in de Ardennen.' },
  } as Record<string, MetaSet>,

  nav: { home: 'Home', activiteiten: 'Activiteiten', huuropties: 'Huuropties', scoutsweide: 'Scoutsweide', tarieven: 'Tarieven', contact: 'Contact', overons: 'Over ons', reserveer: 'Reserveer' },

  common: {
    reserveer: 'Reserveer', reserveerNu: 'Reserveer nu', meerInfo: 'Meer info', ontdek: 'Ontdek de camping',
    contacteerOns: 'Contacteer ons', perNacht: 'per nacht', gratis: 'Gratis', bekijkTarieven: 'Bekijk tarieven',
    alleActiviteiten: 'Alle activiteiten', alleHuuropties: 'Alle huuropties',
  },

  hero: {
    title: 'Camping Cosmopolite',
    subtitle: 'Kamperen aan de oevers van de Ourthe in La Roche-en-Ardenne',
    ctaPrimary: 'Reserveer je verblijf',
    ctaSecondary: 'Ontdek de camping',
    scroll: 'Scroll',
  },

  home: {
    introEyebrow: 'Welkom',
    introTitle: 'Rust, ruimte en natuur aan de rivier',
    introText: 'Welkom op Camping Cosmopolite. Bij ons vind je volop ruimte om te ontspannen met je gezin, pal aan de oevers van de Ourthe. We verwelkomen tenten, caravans en campers in een ontspannen sfeer met plaats voor iedereen.',

    whyEyebrow: 'Waarom Cosmopolite',
    whyTitle: 'Alles voor een zorgeloos verblijf',
    whySub: 'Kleinschalig, gemoedelijk en midden in de natuur — met de voorzieningen die je nodig hebt.',
    features: [
      { icon: 'Zap', title: 'Elektriciteit', text: 'Elektrische aansluitingen beschikbaar op de plaatsen.' },
      { icon: 'Flame', title: 'Kampvuur', text: 'Kampvuur toegelaten in een eigen vuurkorf.' },
      { icon: 'Dog', title: 'Huisdieren welkom', text: 'Je viervoeter is van harte welkom op de camping.' },
      { icon: 'Waves', title: 'Aan de rivier', text: 'Zwemmen en vissen in de Ourthe, vlak bij je plaats.' },
      { icon: 'Leaf', title: 'Rust', text: 'Een rustige, groene omgeving zonder massatoerisme.' },
      { icon: 'Users', title: 'Gezinsvriendelijk', text: 'Volop ruimte voor kinderen om veilig te spelen.' },
    ] as Feature[],

    domeinEyebrow: 'Het domein',
    domeinTitle: 'Een groene oase langs de Ourthe',
    domeinText: 'Het domein ligt op wandelafstand van het bruisende centrum van La Roche-en-Ardenne, en toch helemaal in het groen. Ruime, natuurlijke staanplaatsen, directe toegang tot de rivier en een gezellige bar maken van elk verblijf een echte ontsnapping aan de drukte.',
    domeinPoints: ['Op wandelafstand van La Roche-en-Ardenne', 'Directe toegang tot de Ourthe', 'Gezellige bar met drankjes', 'Ruime, natuurlijke staanplaatsen'],

    rentalsEyebrow: 'Verblijven',
    rentalsTitle: 'Jouw plek onder de sterren',
    rentalsSub: 'Van je eigen tent tot een volledig ingerichte safaritent — er is voor elk wat wils.',

    activitiesEyebrow: 'Te beleven',
    activitiesTitle: 'Avontuur voor de deur',
    activitiesSub: 'De Ardennen zijn een natuurlijk speelterrein. Ontdek wat je allemaal kan doen.',

    reviewsEyebrow: 'Wat gasten zeggen',
    reviewsTitle: 'Geliefd door families',
    reviewsSub: 'Ervaringen van gasten die hun vakantie bij ons doorbrachten.',
    reviews: [
      { name: 'Sofie D.', location: 'Gent', rating: 5, text: 'Heerlijk rustige camping vlak aan het water. De kinderen hebben zich elke dag geamuseerd in de rivier. Zeker terug!' },
      { name: 'Marc & Ann', location: 'Antwerpen', rating: 5, text: 'Ruime plaatsen, vriendelijke uitbaters en een prachtige omgeving. Precies wat we zochten om tot rust te komen.' },
      { name: 'Julie V.', location: 'Leuven', rating: 5, text: 'De safaritent was top ingericht. Kampvuur \'s avonds, wandelen overdag — een perfecte gezinsvakantie.' },
      { name: 'Thomas L.', location: 'Hasselt', rating: 5, text: 'Ideale uitvalsbasis voor kajak en mountainbike. Op wandelafstand van La Roche. Aanrader!' },
      { name: 'Familie Peeters', location: 'Mechelen', rating: 5, text: 'Al drie jaar op rij onze vaste stek. Gemoedelijk, proper en de honden mogen mee. Wat wil je nog meer?' },
      { name: 'Nathalie B.', location: 'Brugge', rating: 5, text: 'Een echte natuurcamping zonder poespas. Rustig, groen en met een prachtig zicht op de Ourthe.' },
    ] as Review[],

    faqEyebrow: 'Veelgestelde vragen',
    faqTitle: 'Alles wat je wil weten',
    faqSub: 'Vind je het antwoord niet? Neem gerust contact met ons op.',
    faq: [
      { q: 'Zijn huisdieren toegelaten?', a: 'Ja, je hond is van harte welkom op de camping. We vragen wel om je viervoeter aan de leiband te houden en op te ruimen.' },
      { q: 'Mag ik een kampvuur maken?', a: 'Een kampvuur is toegelaten in een eigen vuurkorf, zodat de weide niet beschadigd wordt. Open vuur rechtstreeks op de grond is niet toegestaan.' },
      { q: 'Is er elektriciteit op de plaatsen?', a: 'Ja, elektrische aansluitingen zijn beschikbaar. Je kan elektriciteit bijboeken bij je reservering.' },
      { q: 'Hoe ver is het centrum van La Roche-en-Ardenne?', a: 'Het centrum ligt op wandelafstand van de camping — ideaal voor een terrasje, boodschappen of een bezoek aan het kasteel.' },
      { q: 'Kan ik zwemmen in de Ourthe?', a: 'De camping ligt pal aan de Ourthe, waar je kan zwemmen en spelen. Hou steeds toezicht op kinderen aan het water.' },
      { q: 'Hebben jullie huuraccommodatie?', a: 'Ja, naast staanplaatsen verhuren we onder andere een safaritent en een stacaravan. Bekijk de huuropties voor alle details.' },
      { q: 'Zijn er sanitaire voorzieningen?', a: 'De camping beschikt over sanitair met toiletten en douches. Details ontvang je bij je reservering.' },
      { q: 'Kan ik met een grote groep of vereniging komen?', a: 'Zeker. We hebben een aparte scoutsweide voor scouts, chiro, jeugdverenigingen en scholen. Contacteer ons voor de mogelijkheden.' },
      { q: 'Moet ik op voorhand reserveren?', a: 'Reserveren wordt sterk aangeraden, zeker in het hoogseizoen en tijdens weekends en vakanties. Dat kan eenvoudig online.' },
      { q: 'Hoe betaal ik mijn verblijf?', a: 'Je ontvangt de betaalgegevens bij je reservering. Ter plaatse kan je terecht met de gangbare betaalmethodes.' },
      { q: 'Zijn er dagbezoekers toegelaten?', a: 'Dagbezoek is mogelijk, mits melding vooraf. Er geldt een bezoekersbijdrage per persoon.' },
    ] as FaqItem[],

    ctaTitle: 'Klaar voor je volgende avontuur?',
    ctaText: 'Reserveer vandaag nog jouw plaats aan de Ourthe en geniet van rust, ruimte en natuur.',
    ctaBtn: 'Reserveer nu',
  },

  activiteiten: {
    eyebrow: 'Activiteiten',
    title: 'Avontuur in en rond de camping',
    intro: 'In en rond de camping is er van alles te beleven. Van een frisse duik in de Ourthe tot uitgestrekte wandel- en fietsroutes door de Ardennen.',
    items: [
      { icon: 'Waves', title: 'Zwemmen', text: 'Verkoeling in de Ourthe, pal aan de camping. Ideaal voor kinderen op warme dagen.', image: IMG.activiteiten.zwemmen },
      { icon: 'Footprints', title: 'Wandelen', text: 'Talrijke wandelroutes vertrekken vlakbij, doorheen de bossen en heuvels van de Ardennen.', image: IMG.activiteiten.wandelen },
      { icon: 'Bike', title: 'Fietsen', text: 'Verken de streek met de fiets of mountainbike langs pittoreske paden en rivierwegen.', image: IMG.activiteiten.fietsen },
      { icon: 'Sailboat', title: 'Kajak', text: 'Peddel over de Ourthe tijdens een onvergetelijke kajaktocht door het Ardense landschap.', image: IMG.activiteiten.kajak },
      { icon: 'Fish', title: 'Vissen', text: 'Werp je lijn uit in de rivier en geniet van de rust (visverlof vereist).', image: IMG.activiteiten.vissen },
    ] as Activity[],
  },

  huuropties: {
    eyebrow: 'Huuropties',
    title: 'Staanplaatsen & verblijven',
    intro: 'Ruime staanplaatsen en huurmogelijkheden beschikbaar. Kom met je eigen tent, caravan of camper, of huur een volledig ingerichte accommodatie.',
    items: [
      { id: 'tent', name: 'Staanplaats tent', price: '€15', text: 'Een ruime, natuurlijke plaats voor je eigen tent, dicht bij de rivier.', features: ['Ruime staanplaats', 'Elektriciteit optioneel', 'Dicht bij het sanitair'], image: IMG.rentals.tent },
      { id: 'caravan', name: 'Staanplaats caravan', price: '€15', text: 'Comfortabele plaats voor je caravan met voldoende ruimte rondom.', features: ['Vlakke ondergrond', 'Elektriciteit optioneel', 'Auto naast de plaats'], image: IMG.rentals.caravan },
      { id: 'camper', name: 'Staanplaats camper', price: '€15', text: 'Een goed bereikbare plaats voor je mobilhome in het groen.', features: ['Vlot bereikbaar', 'Elektriciteit optioneel', 'Rustige ligging'], image: IMG.rentals.camper },
      { id: 'safaritent', name: 'Safaritent', price: '€102', text: 'Volledig ingerichte safaritent — glamping-comfort midden in de natuur.', features: ['Tot 6 personen', 'Volledig ingericht', 'Inclusief afvalbijdrage'], image: IMG.rentals.safaritent },
      { id: 'stacaravan', name: 'Stacaravan te huur', price: '€100', text: 'Gezellige stacaravan met alle comfort voor een zorgeloos verblijf.', features: ['Tot 4 personen', 'Eigen keukentje', 'Ideaal voor gezinnen'], image: IMG.rentals.stacaravan },
    ] as RentalOption[],
    ctaTitle: 'Niet zeker welke optie bij je past?',
    ctaText: 'We helpen je graag de perfecte plek te kiezen voor jouw verblijf.',
  },

  scoutsweide: {
    eyebrow: 'Groepen',
    title: 'Scoutsweide',
    intro: 'Een aparte weide, speciaal voor groepen. De ideale uitvalsbasis voor een onvergetelijk kamp in de Ardennen, met de rivier en de natuur binnen handbereik.',
    groupsTitle: 'Voor wie?',
    groups: ['Scouts', 'Chiro', 'Jeugdverenigingen', 'Scholen'],
    text: 'Ruimte om te ravotten, kampvuur te maken en de natuur te ontdekken — alles wat een geslaagd groepskamp nodig heeft. Contacteer ons voor de mogelijkheden, capaciteit en beschikbaarheid.',
    ctaTitle: 'Een kamp plannen?',
    ctaText: 'Neem contact op en we bekijken samen wat mogelijk is voor jouw groep.',
  },

  tarieven: {
    eyebrow: 'Tarieven',
    title: 'Eerlijke prijzen, alles inbegrepen in de rust',
    intro: 'Onze tarieven per nacht. Zo weet je op voorhand precies waar je aan toe bent.',
    sectieVerblijf: 'Staanplaatsen & verblijf',
    sectiePersonen: 'Personen',
    sectieExtra: 'Extra\'s & bijdragen',
    items: [
      { icon: 'Tent', label: 'Tent', price: '€15', highlight: true },
      { icon: 'Caravan', label: 'Camper / Caravan', price: '€15', highlight: true },
      { icon: 'Home', label: 'Safaritent', price: '€102', highlight: true },
      { icon: 'Home', label: 'Stacaravan', price: '€100', highlight: true },
      { icon: 'User', label: 'Volwassene', price: '€7' },
      { icon: 'Baby', label: 'Kind (3–11 jaar)', price: '€5' },
      { icon: 'Baby', label: 'Baby (<3 jaar)', price: 'Gratis' },
      { icon: 'Dog', label: 'Hond', price: '€3' },
      { icon: 'Car', label: 'Extra auto', price: '€2' },
      { icon: 'Zap', label: 'Elektriciteit', price: '€6' },
      { icon: 'Recycle', label: 'Afvalbijdrage', price: '€2' },
      { icon: 'Landmark', label: 'Toeristentaks', price: '€1' },
    ] as PriceItem[],
    note: 'Prijzen per nacht, onder voorbehoud van wijzigingen. Het definitieve bedrag zie je bij je reservering.',
    ctaTitle: 'Klaar om te boeken?',
    ctaText: 'Stel je verblijf samen en reserveer in een paar klikken.',
  },

  contact: {
    eyebrow: 'Contact',
    title: 'Kom langs of neem contact op',
    intro: 'Vragen over je verblijf, een groep of de beschikbaarheid? We helpen je graag verder.',
    adresLabel: 'Adres',
    adres: ['Rue Vecpré 66A', '6980 La Roche-en-Ardenne', 'België'],
    telLabel: 'Telefoon',
    tel: '+32 474 95 19 06',
    emailLabel: 'E-mail',
    email: 'karen.campingcosmopolite@gmail.com',
    instaLabel: 'Instagram',
    insta: 'domein_cosmopolite_',
    mapTitle: 'Onze ligging',
  },

  overons: {
    eyebrow: 'Over ons',
    title: 'Ons verhaal',
    intro: 'Camping Cosmopolite ligt op wandelafstand van het centrum van La Roche-en-Ardenne, aan de oevers van de Ourthe. Een plek waar rust, natuur en gastvrijheid samenkomen.',
    lead: 'Wat begon als een droom om mensen samen te brengen in de natuur, groeide uit tot een gemoedelijke familiecamping waar gezinnen, natuurliefhebbers en groepen jaar na jaar terugkeren.',
    missionTitle: 'Onze missie',
    missionText: 'Iedereen laten genieten van een zorgeloze vakantie in de natuur, in een gemoedelijke sfeer en met respect voor de omgeving.',
    visionTitle: 'Onze visie',
    visionText: 'Een kleinschalige camping blijven waar persoonlijk contact, rust en de natuur centraal staan — geen massatoerisme, wel echte beleving.',
    timelineTitle: 'In een notendop',
    timeline: [
      { year: 'Ligging', title: 'Aan de Ourthe', text: 'Direct aan de rivier, op wandelafstand van La Roche-en-Ardenne.' },
      { year: 'Sfeer', title: 'Gemoedelijk', text: 'Kleinschalig en persoonlijk, met plaats voor iedereen.' },
      { year: 'Natuur', title: 'Middenin het groen', text: 'Bossen, heuvels en water binnen handbereik.' },
    ] as TimelineItem[],
  },

  footer: {
    tagline: 'Familiecamping aan de oevers van de Ourthe in La Roche-en-Ardenne.',
    colCamping: 'Camping',
    colNav: 'Navigatie',
    colInfo: 'Praktisch',
    colSocial: 'Volg ons',
    praktisch: ['Reserveren', 'Tarieven', 'Huuropties', 'Contact'],
    rights: 'Alle rechten voorbehouden.',
    privacy: 'Privacybeleid',
  },
};

export type Dict = typeof nl;
