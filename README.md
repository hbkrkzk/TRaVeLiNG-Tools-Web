# TRaVeLiNG Tools (Web)

旅行向けの小ツールをまとめたWebアプリです。

## 公開ページ

https://hbkrkzk.github.io/TRaVeLiNG-Tools-Web/

## 主な機能

1. Skyscanner Link
- Skyscannerの検索URLをアフィリエイトURLに変換
- 短縮URL（`skyscanner.app.link`）の展開に対応
- 短縮URL生成とシェア文面の自動生成

2. Boarding Barcode
- 搭乗券情報から IATA 文字列を生成
- Aztec / PDF417 バーコードを生成

3. FIRE Simulator
- 資産推移のシミュレーション
- リタイア時資産と資産寿命の可視化


## 注意

このツールは自己責任で利用してください。機能の一部は外部APIの可用性に依存します。

## セットアップ

### ローカル開発

1. リポジトリをクローン
```bash
git clone https://github.com/hbkrkzk/TRaVeLiNG-Tools-Web.git
cd TRaVeLiNG-Tools-Web
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
`.env.local` ファイルを作成し、`.env.example` を参考に必要な情報を入力
```bash
cp .env.example .env.local
# .env.local を編集してImpact.com APIの認証情報を入力
```

4. 開発サーバーを起動
```bash
npm run dev
```

### 本番デプロイ

このプロジェクトはVercelでのホスティングを想定しています。

**GitHub Pagesのみの場合:**
- フロントエンド（`dist/`）のみがホストされます
- バックエンド APIは利用できません

**Vercelにデプロイ:**
1. Vercelに登録し、このリポジトリをインポート
2. Project Settings → Environment Variables で以下を設定
   - `IMPACT_PARTNER_ID`
   - `IMPACT_API_KEY`
   - `IMPACT_PROGRAM_ID`
3. デプロイ完了後、GitHub Pagesホストのフロントエンドで以下を環境変数として設定
   - `VITE_API_BASE_URL=https://your-project.vercel.app`

### ビルド

```bash
npm run build
```
