import type { Locale } from 'vue-i18n'

export default [
  {
    domain: 'baur.de',
    name: 'Baur',
    logoUrl: 'https://www.baur.de/favicon.ico',
    country: 'DE',
    currency: 'EUR',
    discountValue: '2%',
    getSearchUrl: (searchTerm: string) => `https://www.baur.de/s/${encodeURIComponent(searchTerm)}`,
  },
  {
    domain: 'galaxus.de',
    name: 'Galaxus',
    logoUrl: 'https://www.galaxus.de/favicon.ico',
    country: 'DE',
    currency: 'EUR',
    discountValue: '1,5%',
    getSearchUrl: (searchTerm: string, locale: Locale) => `https://www.galaxus.de/${locale}/search?q=${encodeURIComponent(searchTerm)}`,
  },
  {
    domain: 'netto-online.de',
    name: 'Netto',
    logoUrl: 'https://www.netto-online.de/INTERSHOP/static/WFS/Plus-NettoDE-Site/-/-/de_DE/images/favicon.ico',
    country: 'DE',
    currency: 'EUR',
    discountValue: '2%',
    getSearchUrl: (searchTerm: string) => `https://www.netto-online.de/INTERSHOP/web/WFS/Plus-NettoDE-Site/de_DE/-/EUR/ViewMMPParametricSearch-Browse?SearchScope=product&SearchTerm=${encodeURIComponent(searchTerm)}`,

  },
  {
    domain: 'running-point.de',
    name: 'Running Point',
    logoUrl: 'https://www.running-point.de/favicon.ico',
    country: 'DE',
    currency: 'EUR',
    discountValue: '3,2%',
    getSearchUrl: (searchTerm: string) => `https://www.running-point.de/search/?q=${encodeURIComponent(searchTerm)}&lang=de_DE`,
  },
  {
    domain: 'shopinbit.de',
    name: 'Shopinbit',
    logoUrl: 'https://shopinbit.com/media/54/27/a8/1684356931/iconapple.png',
    country: 'DE',
    currency: 'EUR',
    group: 'payWithBitcoin',
    discountValue: '3%',
    getSearchUrl: (searchTerm: string, locale: Locale) => `https://shopinbit.com/${locale}/search?search=${encodeURIComponent(searchTerm)}`,
  },
]
