import { title } from 'node:process'

export default {
  welcome: {
    title: 'Hola a GoSpendl!',
    description: 'La aplicación de comparación de precios para productos con descuento en Bitcoin, cashback con bitcoin y mucho más',
    feature1: {
      title: 'Payable with Bitcoin',
      description: 'You can search for products and compare prices on various online stores where you can pay with Bitcoin.',
    },
    feature2: {
      title: 'Cashback with Satsback',
      description: 'You can search for products and compare prices on various online stores where you can get cashback in Bitcoin (Satsback).',
    },
    feature3: {
      title: 'New to Bitcoin?',
      description: 'Do you not own any Bitcoin yet? Then order something and get cashback in Bitcoin (Satsback) on your daily purchases.',
    },
  },
  search: {
    title: 'Search Products',
    productGroups: {
      SATSBACK: 'Satsback',
      PAY_WITH_BITCOIN: 'Pay with Bitcoin',
    },
    searchPlaceholder: 'Search for products...',
    noResults: 'No results found',
    resultsFound: '{count} results found',
    showMoreResults: 'Show more results',
    noMoreResults: 'No more results',
    loading: 'Loading...',
    poweredBy: 'Search powered by Algolia',
  },
}
