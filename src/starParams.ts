import type { CategoryId } from './categories';
import { getCategory } from './categories';
import { mulberry32, randomSeed } from './rng';

/** 1つの星を再現できる全パラメータ（仕様書 §18） */
export interface StarParams {
  category: CategoryId;
  coreColor: string;
  glowColor: string;
  particleColors: string[];
  particleCount: number;
  particleSize: number;
  orbitRadius: number;
  orbitSpeed: number;
  ringCount: number;
  pulseSpeed: number;
  pulseDepth: number;
  flicker: number;
  intensity: number;
  starSize: number;
  rotationSpeed: number;
  tailLength: number;
  ringTilt: number;
  backgroundSeed: number;
  seed: number;
}

/**
 * 願いごと本文とカテゴリから星のパラメータを生成する（仕様書 §19）。
 * 文字数が長いほど粒子が多く、輪が複雑になる（§10.4）。
 */
export function generateStarParams(
  wish: string,
  category: CategoryId,
  seed: number = randomSeed(),
): StarParams {
  const def = getCategory(category);
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const len = [...wish].length;
  const t = Math.min(len / 40, 1); // 0（短い）〜 1（長い）

  return {
    category,
    seed,
    coreColor: pick(def.coreColors),
    glowColor: pick(def.glowColors),
    particleColors: def.particleColors,
    particleCount: Math.round((70 + 150 * t) * def.particleBoost * (0.85 + rng() * 0.3)),
    particleSize: 0.3 * def.particleSize * (0.9 + rng() * 0.2),
    orbitRadius: (4.3 + rng() * 1.4) * (1 + t * 0.25),
    orbitSpeed: (0.22 + rng() * 0.2) * def.orbitSpeedFactor,
    ringCount: t > 0.45 || rng() < 0.3 ? 2 : 1,
    pulseSpeed: def.pulseSpeed[0] + (def.pulseSpeed[1] - def.pulseSpeed[0]) * rng(),
    pulseDepth: def.pulseDepth * (0.85 + rng() * 0.3),
    flicker: def.flicker,
    intensity: def.intensity,
    starSize: (1.55 + rng() * 0.6) * (1 + t * 0.15),
    rotationSpeed: (0.05 + rng() * 0.1) * (rng() < 0.5 ? -1 : 1),
    tailLength: 4.5 + t * 4 + rng() * 2,
    ringTilt: rng() * Math.PI,
    backgroundSeed: Math.floor(rng() * 0x7fffffff),
  };
}
