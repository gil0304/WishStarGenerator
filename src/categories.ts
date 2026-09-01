export type CategoryId =
  | 'dream'
  | 'love'
  | 'study'
  | 'health'
  | 'money'
  | 'fun'
  | 'secret';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  emoji: string;
  /** 中心星の色候補 */
  coreColors: string[];
  /** 発光・輪の色候補 */
  glowColors: string[];
  /** 周回粒子のパレット */
  particleColors: string[];
  /** 明滅速度の範囲 [min, max]（Hz） */
  pulseSpeed: [number, number];
  /** 明滅の深さ（脈動の強さ） */
  pulseDepth: number;
  /** 不規則な点滅の強さ（ネタ用） */
  flicker: number;
  /** 全体の明るさ係数（秘密は控えめ） */
  intensity: number;
  /** 粒子サイズ係数（お金は小粒） */
  particleSize: number;
  /** 粒子の周回速度係数 */
  orbitSpeedFactor: number;
  /** 粒子数の係数 */
  particleBoost: number;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'dream',
    label: '夢・目標',
    emoji: '🌠',
    coreColors: ['#ffe9a8', '#ffdf80'],
    glowColors: ['#ffb845', '#ffd35e'],
    particleColors: ['#ffd76a', '#fff3c2', '#ffbe55'],
    pulseSpeed: [0.3, 0.5],
    pulseDepth: 0.3,
    flicker: 0,
    intensity: 1.1,
    particleSize: 1,
    orbitSpeedFactor: 0.8,
    particleBoost: 1,
  },
  {
    id: 'love',
    label: '恋愛',
    emoji: '💗',
    coreColors: ['#ffc9e2', '#ffb3d9'],
    glowColors: ['#ff8fc8', '#c98af5'],
    particleColors: ['#ffa8d4', '#e3b0ff', '#c084f0'],
    pulseSpeed: [0.8, 1.1],
    pulseDepth: 0.16,
    flicker: 0.12,
    intensity: 1,
    particleSize: 1.05,
    orbitSpeedFactor: 0.6,
    particleBoost: 1,
  },
  {
    id: 'study',
    label: '勉強・仕事',
    emoji: '📘',
    coreColors: ['#e8f4ff', '#d6ecff'],
    glowColors: ['#86bfff', '#a9d4ff'],
    particleColors: ['#bfe0ff', '#8fc6ff', '#eef8ff'],
    pulseSpeed: [1.3, 1.7],
    pulseDepth: 0.1,
    flicker: 0.04,
    intensity: 1.05,
    particleSize: 0.85,
    orbitSpeedFactor: 1.0,
    particleBoost: 0.9,
  },
  {
    id: 'health',
    label: '健康',
    emoji: '🍀',
    coreColors: ['#eafff0', '#dcf8e4'],
    glowColors: ['#93e2a9', '#c2f0cd'],
    particleColors: ['#a8ecba', '#e6fdec', '#ffffff'],
    pulseSpeed: [0.3, 0.45],
    pulseDepth: 0.1,
    flicker: 0,
    intensity: 0.95,
    particleSize: 1,
    orbitSpeedFactor: 0.5,
    particleBoost: 0.9,
  },
  {
    id: 'money',
    label: 'お金',
    emoji: '🪙',
    coreColors: ['#fff3bd', '#ffefa0'],
    glowColors: ['#ffdf6b', '#ffe98f'],
    particleColors: ['#ffe066', '#fff7cc', '#ffd23e'],
    pulseSpeed: [0.6, 0.9],
    pulseDepth: 0.14,
    flicker: 0.05,
    intensity: 1,
    particleSize: 0.6,
    orbitSpeedFactor: 1.6,
    particleBoost: 1.5,
  },
  {
    id: 'fun',
    label: 'ネタ',
    emoji: '🎈',
    coreColors: ['#ffffff', '#fff0f5'],
    glowColors: ['#ff9ff3', '#7efff5', '#fff37e'],
    particleColors: ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#54a0ff'],
    pulseSpeed: [1.6, 2.4],
    pulseDepth: 0.22,
    flicker: 0.45,
    intensity: 1.05,
    particleSize: 1.1,
    orbitSpeedFactor: 1.2,
    particleBoost: 1.1,
  },
  {
    id: 'secret',
    label: '秘密',
    emoji: '🌙',
    coreColors: ['#ccd2ff', '#bcc4f6'],
    glowColors: ['#5d63d8', '#7b5ccc'],
    particleColors: ['#7076e0', '#8d7bd8', '#5555a8'],
    pulseSpeed: [0.4, 0.6],
    pulseDepth: 0.07,
    flicker: 0,
    intensity: 0.7,
    particleSize: 0.9,
    orbitSpeedFactor: 0.5,
    particleBoost: 0.8,
  },
];

export function getCategory(id: CategoryId): CategoryDef {
  const def = CATEGORIES.find((c) => c.id === id);
  if (!def) throw new Error(`unknown category: ${id}`);
  return def;
}
