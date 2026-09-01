import type { StarScene } from './starScene';

const FONT_FAMILY = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';

export interface ExportInfo {
  wish: string;
  categoryLabel: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/** 文字単位で折り返す（日本語は単語区切りがないため） */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    if (current && ctx.measureText(current + ch).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string): void {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = value;
}

/**
 * 星の描画＋願いごと・タイトル・日付を合成した 1080×1920 のPNGを作る（仕様書 §12）。
 */
export async function exportWishImage(scene: StarScene, info: ExportInfo): Promise<Blob> {
  const W = 1080;
  const H = 1920;

  try {
    await Promise.all([
      document.fonts.load(`500 56px ${FONT_FAMILY}`),
      document.fonts.load(`300 40px ${FONT_FAMILY}`),
    ]);
  } catch {
    // フォントが読めなくてもフォールバックで描画する
  }

  const starImage = await loadImage(scene.renderToDataURL(W, H));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(starImage, 0, 0, W, H);

  // 文字を載せる下部をわずかに暗くする
  const scrim = ctx.createLinearGradient(0, H * 0.62, 0, H);
  scrim.addColorStop(0, 'rgba(3,5,18,0)');
  scrim.addColorStop(1, 'rgba(3,5,18,0.7)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // タイトル
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `300 26px ${FONT_FAMILY}`;
  ctx.fillText('✦', W / 2, 104);
  setLetterSpacing(ctx, '12px');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `300 40px ${FONT_FAMILY}`;
  ctx.fillText('Wish Star', W / 2 + 6, 160); // 字間の分だけ中心を補正
  setLetterSpacing(ctx, '0px');

  // 願いごと本文：行数が最少になる中で最大のフォントサイズを選ぶ
  const maxWidth = W - 200;
  let fontSize = 56;
  let lines: string[] = [];
  for (const size of [56, 48, 42]) {
    ctx.font = `500 ${size}px ${FONT_FAMILY}`;
    const wrapped = wrapText(ctx, info.wish, maxWidth);
    if (lines.length === 0 || wrapped.length < lines.length) {
      fontSize = size;
      lines = wrapped;
    }
    if (lines.length === 1) break;
  }
  ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
  const lineHeight = fontSize * 1.55;
  const wishCenterY = 1580;
  ctx.fillStyle = '#f3f1ff';
  ctx.shadowColor = 'rgba(150,170,255,0.6)';
  ctx.shadowBlur = 24;
  lines.forEach((line, i) => {
    const y = wishCenterY + (i - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, W / 2, y);
  });
  ctx.shadowBlur = 0;

  // カテゴリ
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `300 28px ${FONT_FAMILY}`;
  const categoryY = wishCenterY - ((lines.length - 1) / 2) * lineHeight - fontSize * 1.7;
  ctx.fillText(`— ${info.categoryLabel} —`, W / 2, categoryY);

  // 日付
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `300 28px ${FONT_FAMILY}`;
  ctx.fillText(dateStr, W / 2, 1802);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
