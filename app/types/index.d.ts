import '@nuxtjs/algolia'
export { };


declare global {  
  interface Product {
    id: string
    name: string
    sourceUrl: string
    brand: string
    price: string
    shopDomain: string
    imageUrl: string
    description: string
  }
  declare module '@nuxtjs/algolia' {
  interface AlgoliaIndices {
    someIndex: {
      name: string;
      bar: number;
    }
  }
}
}



