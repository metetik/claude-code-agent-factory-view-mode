import type { AccessoryName, HatName } from '../types'
import type { Hat, IconName, Sprite } from './sprites'

/**
 * The small desks' pictures: the same hats, extras and icons drawn for a
 * character 8 pixels wide (body 6 wide, eyes on rows 1 and 2, arms on row 3),
 * columns lined up with the character's.
 */
export const MINI_HATS: Record<Exclude<HatName, 'none'>, Hat> = {
  crown: { overlap: 0, frames: [['.G.GG.G.', '.GRGGRG.']] },
  tophat: { overlap: 0, frames: [['..KKKK..', '..RRRR..', '.KKKKKK.']] },
  cap: { overlap: 0, frames: [['..BBBB..', '.BBBBbbb']] },
  beanie: { overlap: 1, frames: [['...WW...', '..RRRR..', '.rWrWrW.']] },
  wizard: {
    overlap: 0,
    frames: [
      ['....P...', '...PYP..', '..PPPP..', '.pppppp.'],
      ['....P...', '...PPP..', '..PYPP..', '.pppppp.'],
    ],
  },
  party: {
    overlap: 0,
    frames: [
      ['...YY...', '..MCMM..', '.MMMCMM.'],
      ['...WW...', '..MCMM..', '.MMMCMM.'],
    ],
  },
  hardhat: { overlap: 0, frames: [['..YYYY..', '.YYWYYY.', 'yyyyyyyy']] },
  chef: { overlap: 0, frames: [['.WWWWWW.', '..WWWW..', '..wwww..']] },
  cowboy: { overlap: 0, frames: [['..NnnN..', 'N.nnnn.N', '.NNNNNN.']] },
  explorer: { overlap: 0, frames: [['..TTTT..', '.tttttt.', 'TTTTTTTT']] },
  propeller: {
    overlap: 0,
    frames: [
      ['RRRkBBB.', '...k....', '..RYBR..'],
      ['..RkB...', '...k....', '..RYBR..'],
    ],
  },
  headphones: { overlap: 3, frames: [['..kkkk..', '.k....k.', 'k......k', 'C......C', 'C......C']] },
  bow: { overlap: 0, frames: [['.MM..MM.', '..MmmM..', '.MM..MM.']] },
  halo: {
    overlap: 0,
    frames: [
      ['.GGGGGG.', '........', '........'],
      ['........', '.GGGGGG.', '........'],
    ],
  },
  antenna: {
    overlap: 0,
    frames: [
      ['.L....L.', '..k..k..'],
      ['.Y....Y.', '..k..k..'],
    ],
  },
  gradcap: { overlap: 1, frames: [['KKKKKKKK', '..kkkk.Y', '.......Y']] },
  viking: { overlap: 0, frames: [['W......W', 'W.SSSS.W', '.WSSSSW.']] },
  sprout: { overlap: 0, frames: [['..LL.LL.', '....l...']] },
}

/** Extras over the small character, top row on its top row. */
export const MINI_ACCESSORIES: Record<Exclude<AccessoryName, 'none'>, Sprite> = {
  glasses: ['........', '.SSSSSS.', '.S.SS.S.'],
  shades: ['........', '.KKKKKK.', '.KK..KK.'],
  monocle: ['.....G..', '....G.G.', '....G.G.', '.....G.G'],
  tie: ['........', '........', '........', '...RR...', '...rr...'],
  bowtie: ['........', '........', '........', '..RrrR..'],
  mustache: ['........', '........', '........', '..nnnn..', '.n....n.'],
  scarf: ['........', '........', '........', '........', '.RWRWRW.'],
  blush: ['........', '........', '........', '.F....F.'],
}

/** 3x3 pictures for the small thought bubble. */
export const MINI_ICONS: Record<IconName, readonly Sprite[]> = {
  search: [['KK.', 'KK.', '..K']],
  edit: [['..M', '.Y.', 'k..']],
  shell: [
    ['KKK', 'LKK', 'KLL'],
    ['KKK', 'LKK', 'KKK'],
  ],
  web: [['.B.', 'BLB', '.B.']],
  delegate: [['OOO', 'EOE', 'O.O']],
  todo: [['L.k', '...', 'L.k']],
  ask: [['BBB', '..B', '.B.']],
  think: [
    ['...', '...', 'k..'],
    ['...', '.k.', 'k..'],
    ['..k', '.k.', 'k..'],
    ['..k', '.k.', 'k..'],
  ],
  tool: [['.s.', 'sSs', '.s.']],
}

export const MINI_CHECK: Sprite = ['...L', 'L.L.', '.L..']
export const MINI_BANG: Sprite = ['R', 'R', '.', 'R']
export const MINI_BIG_Z: Sprite = ['ZZ.', '.Z.', '.ZZ']
export const MINI_SMALL_Z: Sprite = ['Z.', '.Z']
