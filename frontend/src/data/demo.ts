import type { Sermon, Testimonial } from '../types';

export const pastorPhoto = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3Cb-N2OcNWXqkXCFwkdo7M2R2CRD4jvcvLjYXP7c3XeEwTs8TkHLGdQQP7u8QuIGYahWutQ2z0hdjNQZGU7sjC2xg5wSywx5U3qaL8HK-P7-X6T1ojSrX1XX8UHnEEN8rOvqPFl6kSoCIpUzftd68JTKF2wE8UY0sbaMd_hu8rj69pEZq12i_9h721EjPmGNKrbHCssUbKVfHDXvHv0iro7HKSrtAKxTVWXTpTYo';

const covers = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAYEciYySGerZHjF9UW92ypNPCR0DEyd8gCl5bz6lT2cUVOOkzgm0VCx4ctLKvaAOCNh_CcZdBoRy5LpesV1U-d2iyCzpEJpF8QwqY7GYCOVHWWs9p3M2vOT_OR9BuVd6KtE6gYC3QrJiD8F7GopKcIwRhbK7J2fvTfKcOL9V7voMmb63_G-_LBj74HmS_YMip_iFtk9z31H5dCoze-MDhX0_f6bKdd6tuu_lYYtOg',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBbPNfNje5gPS1gQ-3jF8vZm1sY_l01f_Np3bBxgOrh82r85e9OTfY1Rg-t0uiA6ULemtAmPubCnvGd61izkq37DAsdEDdXxUsa9BwEZPRmXnPZ6HxUrWzSxL4yYULQwTCelGXEipslQVeMYIx0yyFgDvuKHbPFlkO7yH9BniCUpoyvlTT2sa4TyOwMuibpLpyxQXYHTDTwcyFg7o9OaWO34FhEolp0og2NOyCadSc',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBXIkThGS8cbezFUc0TWCwYpEImqrxYllo3t21Tv9SIXKLxwdEyrxkDx7yajsfl0TeFKnzTJXnF9VE9KTJQytOlRYWBDBudTWJJQ5yCgNlvVhAQwGEYt1tKe0YrPjeQehFK1Pb7GYWBBfFWLmz-HzUjCCbcMkhPmM3CjuvHhgXu_0ThGF1fZi_X_vG_gLGOf3yND1RuNNI1sduBx8qeBHrj5KzEz93ZoywfxYTQRJY',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC4SAy9DnU6kYx083-kHTMhUb7YRwwZoZRDP4ihLqag-oXW81FoHY-v36kaSiOei96IUznTTDnqRUG191HmwmuNm29AHM6smHo_ejTmlpjzImM3kJ4CBaQaepRKdRsqXJSgKt7TDl82HOYi2ptUZ3X87YuzeXWahwgeQOPuyiCFRNfygfPjC6pUFsP8RyO6wBRaW8Ed7yumVTvbXh98fV-v37ddfc2RagxkyTJmsiQ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCsT6-23ofFeFoSy7F_e4DfYOTw9uAMzwiFma133nLx143sSUzawRPk2rah0PWQ5yd1fBi3YmhsVrx8AtstWMYVcsXXjpq3JUpNOb8pYoEElx-QbwCyKfsT3QYtMJ_Apfu6pjL1gmeUJLrJJKsvHw9lqP8FHlncaMjGy4T--rzdIIQShb9ERUW9GrF38w7bjK3oE9uj8PNFf76ZwMka2yEvvfozdQSz--xsaHiSNr4',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDIlVYpSFzyrERdkC2XcWjNCDSR0O1Ks_Neb9d2PrBnTXWgBfkZQGm_x7g_9jpHfosGX48vyemSjg0_KjNhivWcfJzkgWsU7nvvOwGdstHY2elGW2v8fo0w2iVkznaPOixig72CxvFXfxMzQBqEGw6Edc0DB4cM3z16K64DX62lzJmtp3Ay0BMEbN3ZOICyDZ7NEoVCJZSAsSUSAADw982RztINziOrHIf_IoCRCzo'
];

export const demoSermons: Sermon[] = [
  {
    id: 'demo-1',
    title: 'Une espérance qui ne déçoit point',
    slug: 'une-esperance-qui-ne-decoit-point',
    excerpt: 'Quand les circonstances changent, la promesse de Dieu demeure un ancrage solide pour nos vies.',
    description: 'Une invitation à garder les yeux fixés sur Jésus et à faire de sa parole notre appui quotidien.',
    scriptureReference: 'Romains 5:1–5',
    preachedOn: '2026-09-27',
    durationSeconds: 2684,
    coverUrl: covers[0],
    preacherName: 'Pasteur Leki',
    categoryName: 'Espérance',
    playCount: 1248,
    likeCount: 184,
    isFeatured: true
  },
  {
    id: 'demo-2',
    title: 'Marcher par la foi, un jour à la fois',
    slug: 'marcher-par-la-foi',
    excerpt: 'La foi ne supprime pas toujours l’incertitude, mais elle nous apprend à avancer avec Dieu.',
    scriptureReference: '2 Corinthiens 5:7',
    preachedOn: '2026-09-20',
    durationSeconds: 2315,
    coverUrl: covers[1],
    preacherName: 'Pasteur Leki',
    categoryName: 'Foi',
    playCount: 968,
    likeCount: 132
  },
  {
    id: 'demo-3',
    title: 'Le pardon qui restaure les familles',
    slug: 'le-pardon-qui-restaure',
    excerpt: 'Recevoir la grâce de Dieu nous rend capables d’ouvrir un chemin de réconciliation.',
    scriptureReference: 'Colossiens 3:12–14',
    preachedOn: '2026-09-13',
    durationSeconds: 2522,
    coverUrl: covers[2],
    preacherName: 'Pasteur Leki',
    categoryName: 'Famille',
    playCount: 817,
    likeCount: 96
  },
  {
    id: 'demo-4',
    title: 'Servir avec un cœur humble',
    slug: 'servir-avec-un-coeur-humble',
    excerpt: 'Dans le Royaume, la grandeur se mesure à notre disponibilité pour les autres.',
    scriptureReference: 'Marc 10:43–45',
    preachedOn: '2026-09-06',
    durationSeconds: 2148,
    coverUrl: covers[3],
    preacherName: 'Pasteur Leki',
    categoryName: 'Service',
    playCount: 756,
    likeCount: 73
  },
  {
    id: 'demo-5',
    title: 'La paix au milieu de la tempête',
    slug: 'la-paix-au-milieu-de-la-tempete',
    excerpt: 'Même lorsque la barque est secouée, la présence du Seigneur change notre manière de traverser.',
    scriptureReference: 'Marc 4:35–41',
    preachedOn: '2026-08-30',
    durationSeconds: 2890,
    coverUrl: covers[4],
    preacherName: 'Pasteur Leki',
    categoryName: 'Paix',
    playCount: 1104,
    likeCount: 145
  },
  {
    id: 'demo-6',
    title: 'Cultiver une vie de prière',
    slug: 'cultiver-une-vie-de-priere',
    excerpt: 'La prière n’est pas une fuite du monde, mais le lieu où Dieu renouvelle notre regard sur lui.',
    scriptureReference: 'Luc 11:1–4',
    preachedOn: '2026-08-23',
    durationSeconds: 2460,
    coverUrl: covers[5],
    preacherName: 'Pasteur Leki',
    categoryName: 'Prière',
    playCount: 1390,
    likeCount: 207
  }
];

export const demoTestimonials: Testimonial[] = [
  {
    id: 'testimony-1',
    authorName: 'Maman Esther',
    authorLocation: 'Bukavu',
    content: 'Ces messages m’accompagnent pendant mes journées. La prédication sur le pardon nous a aidés à retrouver le dialogue dans notre famille.'
  },
  {
    id: 'testimony-2',
    authorName: 'Frère David',
    authorLocation: 'Goma',
    content: 'Pouvoir réécouter la Parole depuis mon téléphone est une vraie bénédiction. J’y trouve une direction simple, biblique et proche de la vie.'
  },
  {
    id: 'testimony-3',
    authorName: 'Sœur Grâce',
    authorLocation: 'Uvira',
    content: 'Une phrase entendue ici m’a rappelé que Dieu n’abandonne jamais ses enfants. Depuis, je prie avec une espérance renouvelée.'
  }
];
