import type { AccessoryName, ColorName, HatName } from '../types'

/** A small picture: one string per row, one character per pixel, `.` see-through. */
export type Sprite = readonly string[]

export const COLORS: Record<ColorName, number> = {
  clay: 0xd97757,
  tangerine: 0xf0a04b,
  sun: 0xe8c547,
  lime: 0x9bcb4b,
  mint: 0x5fc9a0,
  teal: 0x3aafa9,
  sky: 0x63a9e8,
  ocean: 0x4a72d9,
  grape: 0x8e6ad8,
  berry: 0xc45ab3,
  rose: 0xee7e9b,
  snow: 0xe8e6e3,
  slate: 0x7c8794,
  cocoa: 0x8b5e3c,
}

export const COLOR_NAMES = Object.keys(COLORS) as ColorName[]

/** The fixed colors sprites name by letter. */
export const INK: Record<string, number> = {
  K: 0x22252b, // black
  k: 0x4a4f5a, // charcoal
  E: 0x1d1a17, // eyes
  W: 0xf6f4f0, // white
  w: 0xc9ccd2, // light gray
  S: 0xb8c0c8, // silver
  s: 0x7d8691, // dark silver
  G: 0xf2c037, // gold
  g: 0xc28f1c, // dark gold
  R: 0xe0484d, // red
  r: 0x9e2f35, // dark red
  Y: 0xf7d84a, // yellow
  y: 0xd6a51c, // dark yellow
  B: 0x3f6fd8, // blue
  b: 0x2b4b9c, // dark blue
  C: 0x4fc3d9, // cyan
  P: 0x7a4fc9, // purple
  p: 0x543196, // dark purple
  M: 0xec6aa8, // pink
  m: 0xb8407c, // dark pink
  N: 0x8b5a2b, // brown
  n: 0x5e3b1c, // dark brown
  T: 0xd8bb8a, // tan
  t: 0xa98a5a, // dark tan
  L: 0x6cc24a, // green
  l: 0x3f8a2e, // dark green
  O: 0xf08a24, // orange
  Z: 0xd7e6ff, // sleepy blue-white
  F: 0xff9fb6, // blush
}

/** A color `f` of the way toward black (f < 1) or white (f > 1). */
export function shade(color: number, f: number): number {
  const channel = (shift: number) => {
    const c = (color >> shift) & 0xff
    const v = f < 1 ? c * f : c + (255 - c) * (f - 1)
    return Math.max(0, Math.min(255, Math.round(v)))
  }

  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** Relative brightness, 0 to 255, for picking a readable eye color. */
export function luma(color: number): number {
  return 0.299 * ((color >> 16) & 0xff) + 0.587 * ((color >> 8) & 0xff) + 0.114 * (color & 0xff)
}

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/**
 * Hats sit on a 12-pixel-wide character: the column of each string is the
 * character's column. `overlap` rows of the hat are drawn over the body's top
 * rows; the rest stand above it. A hat with frames swaps them as time goes on.
 */
export type Hat = { frames: readonly Sprite[]; overlap: number }

export const HATS: Record<Exclude<HatName, 'none'>, Hat> = {
  crown: {
    overlap: 0,
    frames: [['..G..GG..G..', '..GGGGGGGG..', '..gGRGGRGg..']],
  },
  tophat: {
    overlap: 0,
    frames: [['...KKKKKK...', '...KKKKKK...', '...RRRRRR...', '.KKKKKKKKKK.']],
  },
  cap: {
    overlap: 0,
    frames: [['....BBBB....', '..BBBWBBBB..', '..bbbbbbbbbb']],
  },
  beanie: {
    overlap: 1,
    frames: [['.....WW.....', '...RRRRRR...', '..RRRRRRRR..', '.rWrWrWrWrW.']],
  },
  wizard: {
    overlap: 0,
    frames: [
      ['.......P....', '......PP....', '.....PPY....', '....PYPPP...', '...PPPPPP...', '.pppppppppp.'],
      ['.......P....', '......PP....', '.....PPP....', '....PPPYP...', '...PPPPPP...', '.pppppppppp.'],
    ],
  },
  party: {
    overlap: 0,
    frames: [
      ['.....YY.....', '.....MM.....', '....MCMM....', '...MMMCMM...', '..MCMMMMCM..'],
      ['.....WW.....', '.....MM.....', '....MCMM....', '...MMMCMM...', '..MCMMMMCM..'],
    ],
  },
  hardhat: {
    overlap: 0,
    frames: [['....YYYY....', '..YYYWYYYY..', '..YYYYYYYY..', 'yyyyyyyyyyyy']],
  },
  chef: {
    overlap: 0,
    frames: [['...WW.WW....', '..WWWWWWWW..', '..WWWWWWWW..', '...WWWWWW...', '...wwwwww...']],
  },
  cowboy: {
    overlap: 0,
    frames: [['....NNNN....', '...NNnNNN...', 'N..nnnnnn..N', '.NNNNNNNNNN.']],
  },
  explorer: {
    overlap: 0,
    frames: [['....TTTT....', '...TTTTTT...', '..tttttttt..', 'TTTTTTTTTTTT']],
  },
  propeller: {
    overlap: 0,
    frames: [
      ['..RRRRkBBBB.', '......k.....', '...RYYBBR...', '..RRYYBBRR..'],
      ['.....RkB....', '......k.....', '...RYYBBR...', '..RRYYBBRR..'],
    ],
  },
  headphones: {
    overlap: 4,
    frames: [['...kkkkkk...', '..k......k..', '.k........k.', '.k........k.', 'CC........CC', 'CC........CC']],
  },
  bow: {
    overlap: 0,
    frames: [['..MMM..MMM..', '..MMMmmMMM..', '..MMM..MMM..']],
  },
  halo: {
    overlap: 0,
    frames: [
      ['...GGGGGG...', '..G......G..', '...GGGGGG...', '............'],
      ['............', '...GGGGGG...', '..G......G..', '...GGGGGG...'],
    ],
  },
  antenna: {
    overlap: 0,
    frames: [
      ['..L......L..', '...k....k...', '....k..k....'],
      ['..Y......Y..', '...k....k...', '....k..k....'],
    ],
  },
  gradcap: {
    overlap: 1,
    frames: [['.KKKKKKKKKK.', 'KKKKKKKKKKKK', '...kkkkkk.Y.', '..........Y.']],
  },
  viking: {
    overlap: 0,
    frames: [['W..........W', 'W...SSSS...W', 'WW.SSSSSS.WW', '.WSSSSSSSSW.']],
  },
  sprout: {
    overlap: 0,
    frames: [['...LL..LL...', '....LllL....', '.....ll.....']],
  },
}

export const HAT_NAMES: HatName[] = ['none', ...(Object.keys(HATS) as Exclude<HatName, 'none'>[])]

/** Accessories drawn over the 12-wide character, top row on the body's top row. */
export const ACCESSORIES: Record<Exclude<AccessoryName, 'none'>, Sprite> = {
  glasses: ['............', '..KKK..KKK..', '..K.KKKK.K..', '..KKK..KKK..'],
  shades: ['............', '............', '..KWKKKWKK..', '..KKK..KKK..'],
  monocle: ['............', '........G...', '.......G.G..', '.......G.G..', '........G.G.', '..........G.'],
  tie: ['............', '............', '............', '............', '.....RR.....', '.....rr.....', '.....RR.....'],
  bowtie: ['............', '............', '............', '............', '...RRrrRR...', '...R....R...'],
  mustache: ['............', '............', '............', '............', '...nnnnnn...', '..n......n..'],
  scarf: ['............', '............', '............', '............', '............', '.RWRWRWRWRW.', '.R.......W..'],
  blush: ['............', '............', '............', '............', '..F......F..'],
}

export const ACCESSORY_NAMES: AccessoryName[] = [
  'none',
  ...(Object.keys(ACCESSORIES) as Exclude<AccessoryName, 'none'>[]),
]

/** What a working agent's thought bubble shows: the kind of tool it runs. */
export type IconName = 'search' | 'edit' | 'shell' | 'web' | 'delegate' | 'todo' | 'ask' | 'think' | 'tool'

/** 5x5 pictures drawn inside the bubble. */
export const ICONS: Record<IconName, readonly Sprite[]> = {
  search: [['KKK..', 'KCK..', 'KKK..', '...K.', '....K']],
  edit: [['...MM', '..YYM', '.YYY.', 'kYY..', 'k....']],
  shell: [
    ['KKKKK', 'KLKKK', 'KKLKK', 'KLKLL', 'KKKKK'],
    ['KKKKK', 'KLKKK', 'KKLKK', 'KLKKK', 'KKKKK'],
  ],
  web: [['.BBB.', 'BLLBB', 'BBLLB', 'BLBBB', '.BBB.']],
  delegate: [['.....', 'OOOOO', 'OEOEO', 'OOOOO', 'O.O.O']],
  todo: [['L.kkk', '.....', 'L.kkk', '.....', 'w.kkk']],
  ask: [['.BBB.', '....B', '..BB.', '.....', '..B..']],
  think: [
    ['.....', '.....', 'k....', '.....', '.....'],
    ['.....', '.....', 'k.k..', '.....', '.....'],
    ['.....', '.....', 'k.k.k', '.....', '.....'],
    ['.....', '.....', '.....', '.....', '.....'],
  ],
  tool: [['..s..', '.sSs.', 'sS.Ss', '.sSs.', '..s..']],
}

export const CHECK: Sprite = ['....L', '...L.', 'L.L..', '.L...']
export const BANG: Sprite = ['R', 'R', 'R', '.', 'R']
export const BIG_Z: Sprite = ['ZZZZ', '..Z.', '.Z..', 'ZZZZ']
export const SMALL_Z: Sprite = ['ZZZ', '.Z.', 'ZZZ']
