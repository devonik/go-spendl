/**
 * 1. CATEGORY RULES (ENGLISH ONLY)
 * Order = priority
 */
/**
 * 1. CATEGORY RULES — ALL POSSIBLE CATEGORIES
 * Order = priority (top wins)
 * Keywords are ENGLISH ONLY
 */
export const CATEGORY_RULES = [
  // Travel & Transport
  {
    category: 'categories.airline',
    keywords: ['airline', 'airways', 'flight', 'flug', 'fluggesellschaft'],
  },
  {
    category: 'categories.hotels',
    keywords: ['hotel', 'resort', 'übernachtung'],
  },
  {
    category: 'categories.accommodation',
    keywords: ['accommodation', 'lodging', 'unterkunft'],
  },
  {
    category: 'categories.travel',
    keywords: ['travel', 'vacation', 'holiday', 'reise', 'urlaub'],
  },
  {
    category: 'categories.activities',
    keywords: ['activities', 'experiences', 'tours', 'erlebnisse', 'tickets', 'sport'],
  },
  {
    category: 'categories.parking',
    keywords: ['parking', 'parkplatz', 'flughafenparkplatz'],
  },

  // Digital & Software
  {
    category: 'categories.security',
    keywords: ['vpn', 'password', 'antivirus', 'security', 'sicherheit'],
  },
  {
    category: 'categories.software',
    keywords: ['software', 'tool', 'backup', 'download'],
  },
  {
    category: 'categories.esim',
    keywords: ['esim', 'mobile data', 'datenpaket'],
  },

  // Telecom & Energy
  {
    category: 'categories.telecom',
    keywords: ['telecom', 'dsl', 'mobile', 'mobilfunk', 'internet'],
  },
  {
    category: 'categories.energy',
    keywords: ['energy', 'electricity', 'strom', 'energie'],
  },

  // Retail & Commerce
  {
    category: 'categories.marketplace',
    keywords: ['marketplace', 'plattform', 'seller', 'marktplatz'],
  },
  {
    category: 'categories.b2b',
    keywords: ['b2b', 'wholesale', 'großhandel', 'business customers'],
  },
  {
    category: 'categories.retail',
    keywords: ['retail', 'store', 'supermarket', 'einzelhandel'],
  },
  {
    category: 'categories.departmentstore',
    keywords: ['department store', 'kaufhaus', 'warenhaus'],
  },

  // Fashion & Lifestyle
  {
    category: 'categories.fashion',
    keywords: ['fashion', 'clothing', 'apparel', 'mode', 'bekleidung'],
  },
  {
    category: 'categories.sportswear',
    keywords: ['sportswear', 'sportbekleidung', 'athletic'],
  },
  {
    category: 'categories.sneakers',
    keywords: ['sneakers', 'shoes', 'turnschuhe'],
  },
  {
    category: 'categories.lingerie',
    keywords: ['lingerie', 'underwear', 'dessous'],
  },
  {
    category: 'categories.lifestyle',
    keywords: ['lifestyle', 'wellbeing', 'lebensstil'],
  },

  // Food & Consumables
  {
    category: 'categories.food',
    keywords: ['food', 'grocery', 'lebensmittel', 'essen'],
  },
  {
    category: 'categories.spices',
    keywords: ['spices', 'seasoning', 'gewürze'],
  },
  {
    category: 'categories.wine',
    keywords: ['wine', 'winery', 'wein'],
  },

  // Home & Living
  {
    category: 'categories.household',
    keywords: ['household', 'home products', 'haushalt'],
  },
  {
    category: 'categories.appliances',
    keywords: ['appliances', 'home appliances', 'haushaltsgeräte'],
  },
  {
    category: 'categories.furniture',
    keywords: ['furniture', 'chair', 'desk', 'möbel'],
  },
  {
    category: 'categories.materials',
    keywords: ['materials', 'aluminium', 'metal', 'material'],
  },

  // Automotive & Sports
  {
    category: 'categories.automotive',
    keywords: ['automotive', 'car parts', 'vehicle', 'auto', 'fahrzeug'],
  },
  {
    category: 'categories.motorsports',
    keywords: ['motorsports', 'motocross', 'racing', 'motorsport'],
  },

  // Electronics & Tech
  {
    category: 'categories.electronics',
    keywords: ['electronics', 'hardware', 'computer', 'laptop', 'elektronik', 'smartphone'],
  },
  {
    category: 'categories.3dprinting',
    keywords: ['3d printing', '3d printer', '3d-druck'],
  },

  // Health & Personal Care
  {
    category: 'categories.pharmacy',
    keywords: ['pharmacy', 'medicine', 'apotheke', 'zahngesundheit'],
  },
  {
    category: 'categories.cosmetics',
    keywords: ['cosmetics', 'skincare', 'beauty', 'kosmetik'],
  },
  {
    category: 'categories.fitness',
    keywords: ['fitness', 'workout', 'training equipment', 'fitnessgeräte'],
  },

  // Pets & Charity
  {
    category: 'categories.pets',
    keywords: ['pets', 'pet food', 'animals', 'haustiere'],
  },
  {
    category: 'categories.charity',
    keywords: ['charity', 'donation', 'non-profit', 'spende'],
  },

  // Education & Media
  {
    category: 'categories.education',
    keywords: ['education', 'academy', 'course', 'bildung'],
  },
  {
    category: 'categories.books',
    keywords: ['books', 'literature', 'bücher'],
  },
  {
    category: 'categories.photography',
    keywords: ['photography', 'photo', 'printing', 'foto'],
  },

  // Fallback
  {
    category: 'categories.other',
    keywords: [],
  },
]

/**
 * 2. CATEGORY DETECTION WITH CONFIDENCE
 */
function detectCategory(description = '') {
  const text = description.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    const matches = rule.keywords.filter(keyword =>
      text.includes(keyword),
    )

    if (matches.length > 0) {
      const confidence = Math.min(
        1,
        0.3 + matches.length / rule.keywords.length,
      )

      return {
        category: rule.category,
        confidence: Number(confidence.toFixed(2)),
        matches,
      }
    }
  }

  return {
    category: 'categories.other',
    confidence: 0.0,
    matches: [],
  }
}

export { detectCategory }
