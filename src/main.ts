import './style.css';
import { CATEGORIES, getCategory } from './categories';
import type { CategoryId } from './categories';
import { generateStarParams } from './starParams';
import type { StarParams } from './starParams';
import { StarScene } from './starScene';
import { exportWishImage, downloadBlob } from './exportImage';
import { randomSeed } from './rng';

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`element not found: ${selector}`);
  return el;
};

const container = $('#canvas-container');
const inputScreen = $('#screen-input');
const resultScreen = $('#screen-result');
const wishInput = $<HTMLInputElement>('#wish-input');
const charCount = $('#char-count');
const categoryList = $('#category-list');
const generateBtn = $<HTMLButtonElement>('#generate-btn');
const dissolveEl = $('#dissolve');
const resultCategory = $('#result-category');
const resultWish = $('#result-wish');
const saveBtn = $<HTMLButtonElement>('#save-btn');
const againBtn = $<HTMLButtonElement>('#again-btn');

// ---------- 3Dシーン初期化 ----------

let starScene: StarScene;
try {
  starScene = new StarScene(container, randomSeed());
} catch (e) {
  console.error(e);
  const msg = document.createElement('div');
  msg.className = 'webgl-error';
  msg.textContent =
    'この端末ではWebGLが利用できないため、星空を表示できません。別のブラウザでお試しください。';
  document.body.appendChild(msg);
  throw e;
}

// ---------- 状態 ----------

let selectedCategory: CategoryId = CATEGORIES[0].id;
let current: { wish: string; params: StarParams } | null = null;
let busy = false;

// ---------- カテゴリ選択 ----------

const chips = CATEGORIES.map((def) => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'category-chip';
  chip.textContent = `${def.emoji} ${def.label}`;
  chip.style.setProperty('--c', def.glowColors[0]);
  chip.setAttribute('role', 'radio');
  chip.addEventListener('click', () => selectCategory(def.id));
  categoryList.appendChild(chip);
  return { id: def.id, chip };
});

function selectCategory(id: CategoryId): void {
  selectedCategory = id;
  for (const { id: chipId, chip } of chips) {
    const selected = chipId === id;
    chip.classList.toggle('selected', selected);
    chip.setAttribute('aria-checked', String(selected));
  }
}
selectCategory(selectedCategory);

// ---------- 入力バリデーション ----------

function validate(): void {
  const value = wishInput.value;
  charCount.textContent = `${[...value].length} / 40`;
  generateBtn.disabled = value.trim().length === 0;
}
wishInput.addEventListener('input', validate);
wishInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    void generate();
  }
});
validate();

// ---------- 生成 ----------

function playDissolve(wish: string): void {
  dissolveEl.innerHTML = '';
  [...wish].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    span.style.animationDelay = `${120 + i * 35}ms`;
    dissolveEl.appendChild(span);
  });
  window.setTimeout(() => {
    dissolveEl.innerHTML = '';
  }, 2400);
}

async function generate(): Promise<void> {
  if (busy) return;
  const wish = wishInput.value.trim();
  if (!wish) return;
  busy = true;

  const params = generateStarParams(wish, selectedCategory);
  current = { wish, params };

  inputScreen.classList.add('hidden-screen');
  playDissolve(wish);
  await starScene.playBirth(params);

  resultCategory.textContent = getCategory(params.category).label;
  resultWish.textContent = wish;
  resultScreen.classList.remove('hidden-screen');
  busy = false;
}
generateBtn.addEventListener('click', () => void generate());

// ---------- 保存 ----------

saveBtn.addEventListener('click', async () => {
  if (!current || busy) return;
  busy = true;
  saveBtn.disabled = true;
  saveBtn.textContent = '書き出し中…';
  try {
    const blob = await exportWishImage(starScene, {
      wish: current.wish,
      categoryLabel: getCategory(current.params.category).label,
    });
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    downloadBlob(blob, `wish-star-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.png`);
  } catch (e) {
    console.error(e);
    alert('画像の保存に失敗しました。もう一度お試しください。');
  } finally {
    busy = false;
    saveBtn.disabled = false;
    saveBtn.textContent = '画像を保存';
  }
});

// ---------- もう一度作る ----------

againBtn.addEventListener('click', () => {
  if (busy) return;
  resultScreen.classList.add('hidden-screen');
  starScene.clearStar();
  current = null;
  wishInput.value = '';
  validate();
  inputScreen.classList.remove('hidden-screen');
  wishInput.focus();
});
