import { title } from 'node:process'

export default {
  welcome: {
    title: 'Willkommen bei GoSpendl!',
    description: 'Die Preisvergleichs-App für Bitcoin reduzierte Produkte, Cashback mit Bitcoin und vieles mehr',
    feature1: {
      title: 'Bezahlbar mit Bitcoin',
      description: 'Du kannst nach Produkten suchen und Preise bei verschiedenen Onlineshops vergleichen, bei denen du mit Bitcoin bezahlen kannst.',
    },
    feature2: {
      title: 'Cashback mit Satsback',
      description: 'Du kannst nach Produkten suchen und Preise bei verschiedenen Onlineshops vergleichen, bei denen du Cashback in Bitcoin (Satsback) erhalten kannst.',
    },
    feature3: {
      title: 'Neu im Bitcoin?',
      description: 'Besitzt du noch kein Bitcoin? Dann bestelle etwas und erhalte Cashback in Bitcoin (Satsback) auf deine täglichen Einkäufe.',
    },
  },
  product: {
    btcDiscount: '{percent}% BTC Rabatt',
    order: 'Bestelle auf der Partnerseite',
  },
  search: {
    title: 'Produkte suchen',
    filter: {
      label: 'Filter',
      clearAllFilters: 'Bereinige alle Filter',
      categories: 'Kategorien',
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
}
