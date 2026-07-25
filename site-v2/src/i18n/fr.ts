import { IMG } from '../data/images';
import type { Dict } from './nl';

// Franse vertalingen — exact dezelfde structuur als nl.ts (afgedwongen door het
// Dict-type). Eerste versie, klaar om na te lezen.
export const fr: Dict = {
  meta: {
    home: { title: 'Camping Cosmopolite — Camping au bord de l\'Ourthe à La Roche-en-Ardenne', description: 'Camping familial au bord de l\'Ourthe à La Roche-en-Ardenne. Tentes, caravanes, camping-cars et hébergements en Ardenne. Réservez en ligne.' },
    activiteiten: { title: 'Activités — Camping Cosmopolite', description: 'Baignade, randonnée, vélo, kayak et pêche au camping Cosmopolite en Ardenne.' },
    huuropties: { title: 'Locations & emplacements — Camping Cosmopolite', description: 'Emplacements spacieux pour tente, caravane et camping-car, plus tente safari et caravane résidentielle au bord de l\'Ourthe.' },
    scoutsweide: { title: 'Prairie scouts & groupes — Camping Cosmopolite', description: 'Une prairie séparée pour scouts, patros, mouvements de jeunesse et écoles au bord de l\'Ourthe.' },
    tarieven: { title: 'Tarifs — Camping Cosmopolite', description: 'Découvrez les tarifs du Camping Cosmopolite : emplacements, personnes, hébergements et suppléments.' },
    contact: { title: 'Contact — Camping Cosmopolite', description: 'Contactez le Camping Cosmopolite à La Roche-en-Ardenne. Adresse, téléphone, e-mail et situation.' },
    overons: { title: 'À propos — Camping Cosmopolite', description: 'Découvrez l\'histoire du Camping Cosmopolite, un camping familial au bord de l\'Ourthe en Ardenne.' },
  },

  nav: { home: 'Accueil', activiteiten: 'Activités', huuropties: 'Locations', scoutsweide: 'Prairie scouts', tarieven: 'Tarifs', contact: 'Contact', overons: 'À propos', reserveer: 'Réserver' },

  common: {
    reserveer: 'Réserver', reserveerNu: 'Réservez maintenant', meerInfo: 'En savoir plus', ontdek: 'Découvrir le camping',
    contacteerOns: 'Contactez-nous', perNacht: 'par nuit', gratis: 'Gratuit', bekijkTarieven: 'Voir les tarifs',
    alleActiviteiten: 'Toutes les activités', alleHuuropties: 'Toutes les locations',
  },

  hero: {
    title: 'Camping Cosmopolite',
    subtitle: 'Camping au bord de l\'Ourthe à La Roche-en-Ardenne',
    ctaPrimary: 'Réservez votre séjour',
    ctaSecondary: 'Découvrir le camping',
    scroll: 'Défiler',
  },

  home: {
    introEyebrow: 'Bienvenue',
    introTitle: 'Calme, espace et nature au bord de la rivière',
    introText: 'Bienvenue au Camping Cosmopolite. Chez nous, vous trouverez de l\'espace pour vous détendre en famille, au bord de l\'Ourthe. Nous accueillons tentes, caravanes et camping-cars dans une ambiance conviviale avec de la place pour tous.',

    whyEyebrow: 'Pourquoi Cosmopolite',
    whyTitle: 'Tout pour un séjour serein',
    whySub: 'Un camping à taille humaine, convivial et en pleine nature — avec les commodités essentielles.',
    features: [
      { icon: 'Zap', title: 'Électricité', text: 'Raccordements électriques disponibles sur les emplacements.' },
      { icon: 'Flame', title: 'Feu de camp', text: 'Feu de camp autorisé dans un brasero personnel.' },
      { icon: 'Dog', title: 'Animaux bienvenus', text: 'Votre compagnon à quatre pattes est le bienvenu.' },
      { icon: 'Waves', title: 'Au bord de la rivière', text: 'Baignade et pêche dans l\'Ourthe, tout près de votre emplacement.' },
      { icon: 'Leaf', title: 'Tranquillité', text: 'Un environnement calme et verdoyant, loin du tourisme de masse.' },
      { icon: 'Users', title: 'Convivial en famille', text: 'De l\'espace pour que les enfants jouent en toute sécurité.' },
    ],

    domeinEyebrow: 'Le domaine',
    domeinTitle: 'Une oasis verte le long de l\'Ourthe',
    domeinText: 'Le domaine se situe à distance de marche du centre animé de La Roche-en-Ardenne, tout en restant en pleine verdure. Des emplacements spacieux et naturels, un accès direct à la rivière et un bar convivial font de chaque séjour une véritable évasion.',
    domeinPoints: ['À distance de marche de La Roche-en-Ardenne', 'Accès direct à l\'Ourthe', 'Bar convivial avec boissons', 'Emplacements spacieux et naturels'],

    rentalsEyebrow: 'Séjours',
    rentalsTitle: 'Votre place sous les étoiles',
    rentalsSub: 'De votre propre tente à une tente safari entièrement équipée — il y en a pour tous les goûts.',

    activitiesEyebrow: 'À vivre',
    activitiesTitle: 'L\'aventure à votre porte',
    activitiesSub: 'L\'Ardenne est un terrain de jeu naturel. Découvrez tout ce que vous pouvez y faire.',

    reviewsEyebrow: 'Avis des visiteurs',
    reviewsTitle: 'Apprécié des familles',
    reviewsSub: 'Les expériences de visiteurs qui ont passé leurs vacances chez nous.',
    reviews: [
      { name: 'Sofie D.', location: 'Gand', rating: 5, text: 'Camping agréablement calme au bord de l\'eau. Les enfants se sont amusés chaque jour dans la rivière. On revient, c\'est sûr !' },
      { name: 'Marc & Ann', location: 'Anvers', rating: 5, text: 'Emplacements spacieux, gérants accueillants et un cadre magnifique. Exactement ce que nous cherchions pour nous ressourcer.' },
      { name: 'Julie V.', location: 'Louvain', rating: 5, text: 'La tente safari était superbement aménagée. Feu de camp le soir, randonnées la journée — des vacances en famille parfaites.' },
      { name: 'Thomas L.', location: 'Hasselt', rating: 5, text: 'Point de départ idéal pour le kayak et le VTT. À distance de marche de La Roche. À recommander !' },
      { name: 'Famille Peeters', location: 'Malines', rating: 5, text: 'Notre coin favori depuis trois ans. Convivial, propre et les chiens sont admis. Que demander de plus ?' },
      { name: 'Nathalie B.', location: 'Bruges', rating: 5, text: 'Un vrai camping nature sans chichis. Calme, verdoyant et avec une superbe vue sur l\'Ourthe.' },
    ],

    faqEyebrow: 'Questions fréquentes',
    faqTitle: 'Tout ce que vous voulez savoir',
    faqSub: 'Vous ne trouvez pas la réponse ? N\'hésitez pas à nous contacter.',
    faq: [
      { q: 'Les animaux sont-ils admis ?', a: 'Oui, votre chien est le bienvenu au camping. Nous demandons de le tenir en laisse et de ramasser ses déjections.' },
      { q: 'Puis-je faire un feu de camp ?', a: 'Un feu de camp est autorisé dans un brasero personnel, afin de préserver la prairie. Le feu à même le sol n\'est pas permis.' },
      { q: 'Y a-t-il de l\'électricité sur les emplacements ?', a: 'Oui, des raccordements électriques sont disponibles. Vous pouvez réserver l\'électricité lors de votre réservation.' },
      { q: 'À quelle distance se trouve le centre de La Roche-en-Ardenne ?', a: 'Le centre est à distance de marche du camping — idéal pour une terrasse, des courses ou une visite du château.' },
      { q: 'Peut-on se baigner dans l\'Ourthe ?', a: 'Le camping est situé au bord de l\'Ourthe, où l\'on peut se baigner et jouer. Surveillez toujours les enfants près de l\'eau.' },
      { q: 'Proposez-vous des hébergements en location ?', a: 'Oui, en plus des emplacements, nous louons notamment une tente safari et une caravane résidentielle. Voir les locations pour tous les détails.' },
      { q: 'Y a-t-il des sanitaires ?', a: 'Le camping dispose de sanitaires avec toilettes et douches. Vous recevrez les détails lors de votre réservation.' },
      { q: 'Puis-je venir en groupe ou en association ?', a: 'Bien sûr. Nous avons une prairie séparée pour scouts, patros, mouvements de jeunesse et écoles. Contactez-nous pour les possibilités.' },
      { q: 'Dois-je réserver à l\'avance ?', a: 'La réservation est fortement conseillée, surtout en haute saison, les week-ends et pendant les vacances. C\'est simple, en ligne.' },
      { q: 'Comment payer mon séjour ?', a: 'Vous recevez les informations de paiement lors de votre réservation. Sur place, les moyens de paiement habituels sont acceptés.' },
      { q: 'Les visiteurs à la journée sont-ils admis ?', a: 'Les visites à la journée sont possibles, sur annonce préalable. Une contribution par personne s\'applique.' },
    ],

    ctaTitle: 'Prêt pour votre prochaine aventure ?',
    ctaText: 'Réservez dès aujourd\'hui votre place au bord de l\'Ourthe et profitez du calme, de l\'espace et de la nature.',
    ctaBtn: 'Réservez maintenant',
  },

  activiteiten: {
    eyebrow: 'Activités',
    title: 'L\'aventure au camping et alentour',
    intro: 'Il y a beaucoup à faire au camping et dans les environs. D\'une baignade rafraîchissante dans l\'Ourthe aux vastes itinéraires de randonnée et de vélo à travers l\'Ardenne.',
    items: [
      { icon: 'Waves', title: 'Baignade', text: 'Rafraîchissez-vous dans l\'Ourthe, au bord du camping. Idéal pour les enfants les jours de chaleur.', image: IMG.activiteiten.zwemmen },
      { icon: 'Footprints', title: 'Randonnée', text: 'De nombreux sentiers partent tout près, à travers les forêts et collines de l\'Ardenne.', image: IMG.activiteiten.wandelen },
      { icon: 'Bike', title: 'Vélo', text: 'Explorez la région à vélo ou en VTT le long de chemins pittoresques et de routes longeant la rivière.', image: IMG.activiteiten.fietsen },
      { icon: 'Sailboat', title: 'Kayak', text: 'Pagayez sur l\'Ourthe lors d\'une descente inoubliable à travers le paysage ardennais.', image: IMG.activiteiten.kajak },
      { icon: 'Fish', title: 'Pêche', text: 'Lancez votre ligne dans la rivière et profitez du calme (permis de pêche requis).', image: IMG.activiteiten.vissen },
    ],
  },

  huuropties: {
    eyebrow: 'Locations',
    title: 'Emplacements & séjours',
    intro: 'Emplacements spacieux et options de location disponibles. Venez avec votre propre tente, caravane ou camping-car, ou louez un hébergement entièrement équipé.',
    items: [
      { id: 'tent', name: 'Emplacement tente', price: '€15', text: 'Un emplacement spacieux et naturel pour votre propre tente, près de la rivière.', features: ['Emplacement spacieux', 'Électricité en option', 'Proche des sanitaires'], image: IMG.rentals.tent },
      { id: 'caravan', name: 'Emplacement caravane', price: '€15', text: 'Emplacement confortable pour votre caravane avec de l\'espace tout autour.', features: ['Sol plat', 'Électricité en option', 'Voiture à côté de l\'emplacement'], image: IMG.rentals.caravan },
      { id: 'camper', name: 'Emplacement camping-car', price: '€15', text: 'Un emplacement facile d\'accès pour votre camping-car dans la verdure.', features: ['Accès aisé', 'Électricité en option', 'Situation calme'], image: IMG.rentals.camper },
      { id: 'safaritent', name: 'Tente safari', price: '€102', text: 'Tente safari entièrement équipée — le confort glamping en pleine nature.', features: ['Jusqu\'à 6 personnes', 'Entièrement équipée', 'Contribution déchets incluse'], image: IMG.rentals.safaritent },
      { id: 'stacaravan', name: 'Caravane résidentielle', price: '€100', text: 'Caravane résidentielle conviviale avec tout le confort pour un séjour serein.', features: ['Jusqu\'à 4 personnes', 'Petite cuisine', 'Idéale pour les familles'], image: IMG.rentals.stacaravan },
    ],
    ctaTitle: 'Vous hésitez sur l\'option idéale ?',
    ctaText: 'Nous vous aidons volontiers à choisir la formule parfaite pour votre séjour.',
  },

  scoutsweide: {
    eyebrow: 'Groupes',
    title: 'Prairie scouts',
    intro: 'Une prairie séparée, spécialement pour les groupes. Le point de départ idéal pour un camp inoubliable en Ardenne, avec la rivière et la nature à portée de main.',
    groupsTitle: 'Pour qui ?',
    groups: ['Scouts', 'Patros', 'Mouvements de jeunesse', 'Écoles'],
    text: 'De l\'espace pour se dépenser, faire un feu de camp et découvrir la nature — tout ce qu\'il faut pour un camp réussi. Contactez-nous pour les possibilités, la capacité et la disponibilité.',
    ctaTitle: 'Vous planifiez un camp ?',
    ctaText: 'Contactez-nous et voyons ensemble ce qui est possible pour votre groupe.',
  },

  tarieven: {
    eyebrow: 'Tarifs',
    title: 'Des prix justes, la tranquillité comprise',
    intro: 'Nos tarifs par nuit. Vous savez ainsi à l\'avance exactement à quoi vous en tenir.',
    sectieVerblijf: 'Emplacements & séjour',
    sectiePersonen: 'Personnes',
    sectieExtra: 'Suppléments & contributions',
    items: [
      { icon: 'Tent', label: 'Tente', price: '€15', highlight: true },
      { icon: 'Caravan', label: 'Camping-car / Caravane', price: '€15', highlight: true },
      { icon: 'Home', label: 'Tente safari', price: '€102', highlight: true },
      { icon: 'Home', label: 'Caravane résidentielle', price: '€100', highlight: true },
      { icon: 'User', label: 'Adulte', price: '€7' },
      { icon: 'Baby', label: 'Enfant (3–11 ans)', price: '€5' },
      { icon: 'Baby', label: 'Bébé (<3 ans)', price: 'Gratuit' },
      { icon: 'Dog', label: 'Chien', price: '€3' },
      { icon: 'Car', label: 'Voiture supplémentaire', price: '€2' },
      { icon: 'Zap', label: 'Électricité', price: '€6' },
      { icon: 'Recycle', label: 'Contribution déchets', price: '€2' },
      { icon: 'Landmark', label: 'Taxe de séjour', price: '€1' },
    ],
    note: 'Prix par nuit, sous réserve de modifications. Le montant définitif s\'affiche lors de votre réservation.',
    ctaTitle: 'Prêt à réserver ?',
    ctaText: 'Composez votre séjour et réservez en quelques clics.',
  },

  contact: {
    eyebrow: 'Contact',
    title: 'Passez nous voir ou contactez-nous',
    intro: 'Des questions sur votre séjour, un groupe ou la disponibilité ? Nous vous aidons avec plaisir.',
    adresLabel: 'Adresse',
    adres: ['Rue Vecpré 66A', '6980 La Roche-en-Ardenne', 'Belgique'],
    telLabel: 'Téléphone',
    tel: '+32 474 95 19 06',
    emailLabel: 'E-mail',
    email: 'karen.campingcosmopolite@gmail.com',
    instaLabel: 'Instagram',
    insta: 'domein_cosmopolite_',
    mapTitle: 'Notre situation',
  },

  overons: {
    eyebrow: 'À propos',
    title: 'Notre histoire',
    intro: 'Le Camping Cosmopolite se situe à distance de marche du centre de La Roche-en-Ardenne, au bord de l\'Ourthe. Un lieu où calme, nature et hospitalité se rejoignent.',
    lead: 'Ce qui a commencé comme un rêve de rassembler les gens dans la nature est devenu un camping familial convivial où familles, amoureux de la nature et groupes reviennent année après année.',
    missionTitle: 'Notre mission',
    missionText: 'Permettre à chacun de profiter de vacances sereines dans la nature, dans une ambiance conviviale et dans le respect de l\'environnement.',
    visionTitle: 'Notre vision',
    visionText: 'Rester un camping à taille humaine où le contact personnel, le calme et la nature priment — pas de tourisme de masse, mais de vraies expériences.',
    timelineTitle: 'En bref',
    timeline: [
      { year: 'Situation', title: 'Au bord de l\'Ourthe', text: 'Directement au bord de la rivière, à distance de marche de La Roche-en-Ardenne.' },
      { year: 'Ambiance', title: 'Conviviale', text: 'À taille humaine et personnelle, avec de la place pour tous.' },
      { year: 'Nature', title: 'En pleine verdure', text: 'Forêts, collines et eau à portée de main.' },
    ],
  },

  footer: {
    tagline: 'Camping familial au bord de l\'Ourthe à La Roche-en-Ardenne.',
    colCamping: 'Camping',
    colNav: 'Navigation',
    colInfo: 'Pratique',
    colSocial: 'Suivez-nous',
    praktisch: ['Réserver', 'Tarifs', 'Locations', 'Contact'],
    rights: 'Tous droits réservés.',
    privacy: 'Politique de confidentialité',
  },
};
