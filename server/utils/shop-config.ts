import type { Locale } from 'vue-i18n'

export default {
  'baur.de': {
    searchURL: (query: string) => `https://www.baur.de/s/${query}/`,
    category: 'e-commerce',
    group: 'satsback',
    paging: {
      loadMoreSelector: 'main > div:nth-child(6) > div:nth-child(6) > div:nth-child(2) > section > div:nth-child(1) > div:nth-child(3) > button',
      pageQueryParam: 'p',
    },
    productCssShema: {
      type: 'dict',
      value: {
        baseSelector: 'li.product-card',
        fields: [
          {
            name: 'name',
            selector: '.product-card-name',
            type: 'text',
          },
          {
            name: 'sourceUrl',
            selector: '.product-card-name',
            type: 'attribute',
            attribute: 'href',
          },
          {
            name: 'brand',
            selector: '.product-card-brand',
            type: 'text',
          },
          {
            name: 'price',
            selector: '.price-value',
            type: 'text',
          },
          {
            name: 'imageSrc',
            selector: '.product-card-image > img',
            type: 'attribute',
            attribute: 'src',
          },
          {
            name: 'imageAlt',
            selector: '.product-card-image > img',
            type: 'attribute',
            attribute: 'alt',
          },
          {
            name: 'imageSrcset',
            selector: '.product-card-image > img',
            type: 'attribute',
            attribute: 'srcset',
          },
          {
            name: 'color1',
            selector: '.product-card-color-switcher > button:nth-child(1)',
            type: 'attribute',
            attribute: 'aria-label',
          },
          {
            name: 'color2',
            selector: '.product-card-color-switcher > button:nth-child(2)',
            type: 'attribute',
            attribute: 'aria-label',
          },
          {
            name: 'color3',
            selector: '.product-card-color-switcher > button:nth-child(3)',
            type: 'attribute',
            attribute: 'aria-label',
          },
          {
            name: 'colorMore',
            selector: '.product-card-color-switcher > span',
            type: 'text',
          },
        ],
      },
    },
  },
  'shopinbit.com': {
    searchURL: (query: string, locale: Locale) => `https://shopinbit.com/${locale}/search?search=${query}`,
    category: 'e-commerce',
    group: 'payWithBitcoin',
    paging: {
      loadMoreSelector: '.page-item .page-next',
      pageQueryParam: 'p',
    },
    productCssShema: {
      type: 'dict',
      value: {
        baseSelector: '.product-box',
        fields: [
          {
            name: 'name',
            selector: '.product-name',
            type: 'text',
          },
          {
            name: 'sourceUrl',
            selector: 'a:nth-child(1)',
            type: 'attribute',
            attribute: 'href',
          },
          {
            name: 'brand',
            selector: '',
            type: 'text',
          },
          {
            name: 'price',
            selector: '.product-price',
            type: 'text',
          },
          {
            name: 'imageSrc',
            selector: '.product-image',
            type: 'attribute',
            attribute: 'src',
          },
          {
            name: 'imageAlt',
            selector: '.product-image',
            type: 'attribute',
            attribute: 'alt',
          },
        ],
      },
    },
  },
  'galaxus.de': {
    searchURL: (query: string, locale: Locale) => `https://www.galaxus.de/${locale}/search?q=${query}`,
    category: 'e-commerce',
    group: 'satsback',
    paging: {
      loadMoreSelector: '#pageContent > div > section:nth-child(2) > div:last-child button',
    },
    productCssShema: {
      type: 'dict',
      value: {
        baseSelector: '#pageContent article',
        fields: [
          {
            name: 'name',
            selector: 'div:nth-child(6) > p > span',
            type: 'text',
            default: 'Click the button below to see more',
          },
          {
            name: 'sourceUrl',
            selector: 'a',
            type: 'attribute',
            attribute: 'href',
          },
          {
            name: 'brand',
            selector: 'div:nth-child(6) > p strong',
            type: 'text',
          },
          {
            name: 'price',
            selector: 'div:nth-child(5) span',
            type: 'text',
          },
          {
            name: 'imageSrc',
            selector: 'picture img',
            type: 'attribute',
            attribute: 'src',
          },
          {
            name: 'imageAlt',
            selector: 'picture img',
            type: 'attribute',
            attribute: 'alt',
          },
          {
            name: 'imageSrcset',
            selector: 'picture source',
            type: 'attribute',
            attribute: 'srcset',
          },
          {
            name: 'description',
            selector: 'div:nth-child(6) p:nth-child(3)',
            type: 'text',
          },
        ],
      },
    },
  },
  // Blocked from outside europe. Proxy ?
  // Skip Paging cause is complicated there is no p query param the load more button is a link to a new page
  'netto-online.de': {
    searchURL: (query: string) => `https://www.netto-online.de/INTERSHOP/web/WFS/Plus-NettoDE-Site/de_DE/-/EUR/ViewMMPParametricSearch-SimpleOfferSearch?SearchTerm=${query}&Region=1&MeatMarketType=2&KW=43`,
    category: 'e-commerce',
    group: 'satsback',
    productCssShema: {
      type: 'dict',
      value: {
        baseSelector: '.product',
        fields: [
          {
            name: 'name',
            selector: '.product__title',
            type: 'text',
          },
          {
            name: 'sourceUrl',
            selector: '.product__link',
            type: 'attribute',
            attribute: 'href',
          },
          {
            name: 'brand',
            selector: '',
            type: 'text',
          },
          {
            name: 'price',
            selector: '.product__current-price strong',
            type: 'text',
          },
          // Hint: Image selector is correct but mostly returns a fall back image cause of lazy loading...
          {
            name: 'imageSrc',
            selector: '.product__image',
            type: 'attribute',
            attribute: 'src',
          },
          {
            name: 'imageAlt',
            selector: '.product__image',
            type: 'attribute',
            attribute: 'alt',
          },
        ],
      },
    },
  },
  // Skip Paging cause via paging click but no p query param
  'running-point.de': {
    searchURL: (query: string) => `https://www.running-point.de/search/?q=${query}&lang=de_DE`,
    category: 'e-commerce',
    group: 'satsback',

    productCssShema: {
      type: 'dict',
      value: {
        baseSelector: '.item-list-element',
        fields: [
          {
            name: 'name',
            selector: '.product-description',
            type: 'text',
          },
          {
            name: 'sourceUrl',
            selector: 'a:nth-child(1)',
            type: 'attribute',
            attribute: 'href',
          },
          {
            name: 'brand',
            selector: '.brand-name',
            type: 'text',
          },
          {
            name: 'price',
            selector: '.sales > .value',
            type: 'text',
          },
          {
            name: 'imageSrc',
            selector: '.product-main-image picture img',
            type: 'attribute',
            attribute: 'src',
          },
          {
            name: 'imageAlt',
            selector: '.product-main-image picture img',
            type: 'attribute',
            attribute: 'alt',
          },
        ],
      },
    },
  },
}
