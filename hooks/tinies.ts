import type { AccessoryName, HatName } from '../types'
import type { Hat, IconName, Sprite } from './sprites'

/**
 * The medium and small desks' pictures, drawn with quarter blocks: every
 * character cell holds 2x2 pixels, each half a cell wide and half a cell
 * tall. A cell paints only two colors, so the pictures keep to two colors
 * in each 2x2 square where they can.
 *
 * Column 0 of a hat or an extra is the column left of the body, so the
 * medium ones are 12 wide around a body 10 wide, the small ones 8 wide
 * around a body 6 wide.
 */
export const MEDIUM_HATS: Record<Exclude<HatName, 'none'>, Hat> = {
  crown: { overlap: 0, frames: [['.G...GG...G.', '.GGGGGGGGGG.']] },
  tophat: { overlap: 0, frames: [['...KKKKKK...', '...KKKKKK...', '...RRRRRR...', 'KKKKKKKKKKKK']] },
  cap: { overlap: 0, frames: [['...BBBBB....', '..BBBBBBBbbb']] },
  beanie: { overlap: 1, frames: [['.....WW.....', '...RRRRRR...', '.rrrrrrrrrr.']] },
  wizard: { overlap: 0, frames: [['.....PP.....', '....PPPP....', '...PPYYPP...', '..pppppppp..']] },
  party: {
    overlap: 0,
    frames: [
      ['.....YY.....', '....MCCM....', '...MMMMMM...'],
      ['.....WW.....', '....MCCM....', '...MMMMMM...'],
    ],
  },
  hardhat: { overlap: 0, frames: [['....YYYY....', '...YYYYYY...', 'yyyyyyyyyyyy']] },
  chef: { overlap: 0, frames: [['..WWWWWWWW..', '..WWWWWWWW..', '...wwwwww...']] },
  cowboy: { overlap: 0, frames: [['....NNNN....', 'N...nnnn...N', '.NNNNNNNNNN.']] },
  explorer: { overlap: 0, frames: [['....TTTT....', '...tttttt...', 'TTTTTTTTTTTT']] },
  propeller: {
    overlap: 0,
    frames: [
      ['RRRRRkBBBBB.', '.....k......', '...RRYYBB...'],
      ['....RkB.....', '.....k......', '...RRYYBB...'],
    ],
  },
  headphones: { overlap: 2, frames: [['..kkkkkkkk..', '.k........k.', 'C..........C', 'C..........C']] },
  bow: { overlap: 0, frames: [['...MM..MM...', '....MmmM....', '...MM..MM...']] },
  halo: {
    overlap: 0,
    frames: [
      ['...GGGGGG...', '............'],
      ['............', '...GGGGGG...'],
    ],
  },
  antenna: {
    overlap: 0,
    frames: [
      ['..L......L..', '...k....k...'],
      ['..Y......Y..', '...k....k...'],
    ],
  },
  gradcap: { overlap: 1, frames: [['KKKKKKKKKKKK', '...kkkkkk.Y.', '..........Y.']] },
  viking: { overlap: 0, frames: [['W..........W', 'W...SSSS...W', '.WSSSSSSSSW.']] },
  sprout: { overlap: 0, frames: [['....LL.LL...', '......l.....']] },
}

export const MEDIUM_ACCESSORIES: Record<Exclude<AccessoryName, 'none'>, Sprite> = {
  glasses: ['............', '..SSSSSSSS..'],
  shades: ['............', '..KKKKKKKK..'],
  monocle: ['............', '.......GGG..', '.........G..'],
  tie: ['............', '............', '.....RR.....'],
  bowtie: ['............', '............', '....RrrR....'],
  mustache: ['............', '............', '....nnnn....'],
  scarf: ['............', '............', '.RWRWRWRWRW.'],
  blush: ['............', '............', '..F......F..'],
}

export const SMALL_HATS: Record<Exclude<HatName, 'none'>, Hat> = {
  crown: { overlap: 0, frames: [['.G.GG.G.', '.GGGGGG.']] },
  tophat: { overlap: 0, frames: [['..KKKK..', 'KKKKKKKK']] },
  cap: { overlap: 0, frames: [['..BBBB..', '.BBBBbbb']] },
  beanie: { overlap: 0, frames: [['...WW...', '.RRRRRR.']] },
  wizard: { overlap: 0, frames: [['...PY...', '.pppppp.']] },
  party: {
    overlap: 0,
    frames: [
      ['...YY...', '..MCCM..'],
      ['...WW...', '..MCCM..'],
    ],
  },
  hardhat: { overlap: 0, frames: [['..YYYY..', 'yyyyyyyy']] },
  chef: { overlap: 0, frames: [['.WWWWWW.', '..wwww..']] },
  cowboy: { overlap: 0, frames: [['..NNNN..', 'NNNNNNNN']] },
  explorer: { overlap: 0, frames: [['..TTTT..', 'TTTTTTTT']] },
  propeller: {
    overlap: 0,
    frames: [
      ['RRRkBBB.', '..RYYB..'],
      ['..RkB...', '..RYYB..'],
    ],
  },
  headphones: { overlap: 2, frames: [['.kkkkkk.', 'k......k', 'C......C']] },
  bow: { overlap: 0, frames: [['.MM..MM.', '..MmmM..']] },
  halo: {
    overlap: 0,
    frames: [
      ['..GGGG..', '........'],
      ['........', '..GGGG..'],
    ],
  },
  antenna: {
    overlap: 0,
    frames: [
      ['.L....L.', '..k..k..'],
      ['.Y....Y.', '..k..k..'],
    ],
  },
  gradcap: { overlap: 0, frames: [['KKKKKKKK', '...kk.Y.']] },
  viking: { overlap: 0, frames: [['W......W', 'W.SSSS.W']] },
  sprout: { overlap: 0, frames: [['..LL.LL.', '....l...']] },
}

export const SMALL_ACCESSORIES: Record<Exclude<AccessoryName, 'none'>, Sprite> = {
  glasses: ['........', '.SSSSSS.'],
  shades: ['........', '.KKKKKK.'],
  monocle: ['........', '....GGG.'],
  tie: ['........', '........', '...RR...'],
  bowtie: ['........', '........', '..RrrR..'],
  mustache: ['........', '........', '..nnnn..'],
  scarf: ['........', '........', '.RWRWRW.'],
  blush: ['........', '........', '.F....F.'],
}

/** Too small for a picture: the thought bubble shows the tool by its color. */
export const CHIPS: Record<IconName, string> = {
  search: 'Y',
  edit: 'M',
  shell: 'L',
  web: 'B',
  delegate: 'O',
  todo: 'l',
  ask: 'C',
  think: 'k',
  tool: 'S',
}
