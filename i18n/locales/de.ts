import categories from './categories.de.json'

export default {
  welcome: {
    title: 'Willkommen bei GoSpendl!',
    description: 'Die Preisvergleichs-App rund um Bitcoin',
    feature1: {
      title: 'Bezahle mit Bitcoin',
      description: 'Du kannst nach Produkten suchen und Preise bei verschiedenen Onlineshops vergleichen, bei denen du direkt mit Bitcoin bezahlen kannst',
    },
    feature2: {
      title: 'Cashback mit Satsback',
      description: 'Du kannst nach Produkten suchen und Preise bei verschiedenen Onlineshops vergleichen, bei denen du Cashback in Bitcoin erhälst.',
    },
    feature3: {
      title: 'Neu im Bitcoin?',
      description: 'Shoppe online mit Satsback und erhalte deine ersten Satoshis als Cashback.',
    },
    link1: {
      title: 'Entdecke Shops',
    },
  },
  stores: {
    title: 'Shops',
  },
  about: {
    aboutUs: {
      title: 'Über uns',
      text: 'Willkommen bei GoSpendl, der unabhängigen Such- und Vergleichsplattform für Bitcoiner und jene die es werden wollen.',
    },
    ourMission: {
      title: 'Unsere Mission',
      text: 'Bitcoin ist das härteste Geld und somit das beste Sparmittel das es  gibt. Unser Ziel ist es dir beim Sparen zu helfen und hier sparst du Zeit und Geld!',
    },
    howWeWork: {
      title: 'Wie wir arbeiten',
      text: 'Wir durchsuchen Hunderte Onlineshops um für dich das Beste Angebot zu finden deine Bitcoin direkt aus zu geben oder Bitcoin als Cashback ein zu nehemen. Unsere Vergleiche sind neutral und unabhängig –  wir nehmen keinen Einfluss auf die Preisgestaltung der Anbieter.',
    },
    security: {
      title: 'Sicherheit & Vertrauen',
      text: 'Transparenz, Datenschutz und Aktualität sind uns ein wichtiges Anliegen. Alle Preisangaben werden regelmäßig aktualisiert, und wir speichern keine sensiblen Nutzerdaten. Wir wollen dir eine verlässliche Informationsquelle im Preisvergleich sein.',
    },
    contact: {
      title: 'Kontakt',
      text: 'Hast du Fragen, Feedback oder möchtest mit uns zusammenarbeiten. Schreib uns gerne an {email} oder besuche unsere Social Media Kanäle.',
    },
  },
  product: {
    btcDiscount: '{value} BTC Rabatt',
    order: 'Zum Shop',
    noCashback: {
      title: 'Ohne Cashback weiter zum Shop?',
      mobileReason: 'Satsback Cashback braucht eine Browser-Erweiterung (nos2x oder Alby), die auf mobilen Browsern (noch) nicht verfügbar ist.',
      noExtensionReason: 'Ohne installierte Nostr-Erweiterung können wir dir kein Satsback Cashback gewähren.',
      continue: 'Ohne Cashback weiter zum Shop',
    },
    cashbackUnavailable: {
      title: 'Cashback-Link nicht verfügbar',
      description: 'Wir konnten gerade keinen Satsback-Link für diesen Shop erzeugen. Der Shop öffnet sich ohne Cashback.',
    },
  },
  search: {
    title: 'Suchergebnisse',
    sortBy: {
      price: {
        placeholder: 'Sortiere nach Preis',
        asc: 'Preis aufsteigend',
        desc: 'Preis absteigend',
      },
    },
    filter: {
      label: 'Filter',
      clearAllFilters: 'Zurücksetzen',
      categories: 'Kategorien',
      allCategories: 'Alle Kategorien',
      brands: 'Marken',
      colors: 'Farben',
      priceRange: 'Preisbereich',
    },
    productGroups: {
      satsback: 'Satsback',
      payWithBitcoin: 'Bezahlbar mit Bitcoin',
    },
    info: '{hits} treffer in {time}ms für {query}',
    placeholder: 'Suche nach Produkt...',
    noResults: 'Keine Ergebnisse gefunden',
    resultsFound: '{count} Ergebnisse gefunden',
    showMoreResults: 'Zeige mehr Ergebnisse',
    noMoreResults: 'Keine weiteren Ergebnisse',
    loading: 'Lade...',
  },
  seo: {
    site: {
      description: 'Die Preisvergleichs-App rund um Bitcoin. Finde Onlineshops, in denen du direkt mit Bitcoin bezahlst oder Satsback-Cashback in Bitcoin erhältst.',
    },
    home: {
      title: 'Preisvergleich für Bitcoiner',
      description: 'Vergleiche Produkte in über 100 Onlineshops – bezahle direkt mit Bitcoin oder sichere dir Satsback-Cashback in Bitcoin bei jedem Einkauf.',
    },
    stores: {
      title: 'Bitcoin- & Satsback-Shops',
      description: 'Alle Onlineshops, die Bitcoin akzeptieren oder Cashback in Bitcoin über Satsback ausschütten – kuratiert und nach Kategorie filterbar.',
    },
    about: {
      title: 'Über GoSpendl',
      description: 'Die unabhängige Such- und Vergleichsplattform für Bitcoiner. Erfahre, wie wir Preise neutral vergleichen und dir beim Sparen in Bitcoin helfen.',
    },
    search: {
      title: 'Produktsuche',
      description: 'Durchsuche Produkte aus Bitcoin- und Satsback-fähigen Onlineshops und vergleiche Preise.',
    },
  },
  categories,
}
