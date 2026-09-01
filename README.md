# Wish Star Generator

願いごとを、自分だけの星に変える七夕Web作品。

入力した願いごとが、カテゴリ・文字数・ランダムシードに応じて色や粒子、光の輪が変わる星として夜空に生成される。生成した星は 1080×1920 のPNG画像として保存できる。

## 使い方

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド（dist/）
npm run preview  # ビルド結果の確認
```

## 構成

- Vite + TypeScript + Three.js
- `src/categories.ts` — 7カテゴリ（夢・目標／恋愛／勉強・仕事／健康／お金／ネタ／秘密）の色・明滅などの定義
- `src/starParams.ts` — 願いごと本文＋カテゴリ＋シードから星のパラメータを生成
- `src/starScene.ts` — Three.jsによる星・粒子・光の輪・尾・天の川・生成演出の描画
- `src/exportImage.ts` — 星の描画に願いごと・タイトル・日付を合成してPNG化
- `src/main.ts` — 画面遷移とUIの配線
