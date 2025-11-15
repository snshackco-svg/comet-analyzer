# Comet Analyzer

TikTokデータ収集＆分析ツール - Cometから取得したTikTok動画データを自動分析し、Googleスプレッドシートに整理して保存するWebアプリケーション

## 🎯 プロジェクト概要

**Comet Analyzer**は、TikTokデータ収集ツール「Comet（コメット）」でエクスポートしたCSVデータを読み込み、動画の各種エンゲージメント指標を自動計算し、AI分析コメントを付与してGoogleスプレッドシートに保存するツールです。

### 主な機能

✅ **ワンボタン処理**
- CSVファイルをアップロードして、ボタン1回押すだけで完結

✅ **自動指標計算**
- いいね率、保存率、コメント率、シェア率、エンゲージメント率を自動計算

✅ **AI分析コメント生成**
- 各動画データから「なぜこの動画がこの数値になったのか」を自動分析

✅ **重複チェック**
- 同じ動画URLは自動的にスキップ（重複登録を防止）

✅ **カラムマッピング**
- CSVのカラム名が異なっても自動検出（例: `viewCount` → `views`）

✅ **Google Sheets連携**
- 指定したスプレッドシートに自動追記

## 🚀 現在のURL

### 開発環境
- **Sandbox URL**: https://3000-ik4b2rxylqqe2sbqg2wuz-82b888ba.sandbox.novita.ai
- **ローカル**: http://localhost:3000

### 本番環境
- 準備中（Cloudflare Pagesへデプロイ予定）

## 📊 出力データ仕様

Googleスプレッドシートには以下の列が自動的に作成されます：

| 列 | 項目 | 説明 |
|---|---|---|
| A | 取得日 | データ処理日時（YYYY-MM-DD HH:MM） |
| B | 動画リンク | TikTok動画URL |
| C | 再生数 | views |
| D | いいね数 | likes |
| E | 保存数 | saves |
| F | コメント数 | comments |
| G | シェア数 | shares |
| H | いいね率 | likes ÷ views |
| I | 保存率 | saves ÷ views |
| J | コメント率 | comments ÷ views |
| K | シェア率 | shares ÷ views |
| L | エンゲージメント率 | (likes + saves + comments + shares) ÷ views |
| M | 分析結果 | AI生成の分析コメント（200〜300文字） |
| N | メモ/タグ | ユーザー用の自由記入欄 |

## 🛠 使い方

### 1. Google Sheets APIの設定（初回のみ）

#### ステップ1: Google Cloud Projectの作成
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（例: `comet-analyzer`）

#### ステップ2: Google Sheets APIの有効化
1. 左メニュー → 「APIとサービス」 → 「ライブラリ」
2. 「Google Sheets API」を検索して有効化

#### ステップ3: サービスアカウントの作成
1. 左メニュー → 「APIとサービス」 → 「認証情報」
2. 「認証情報を作成」 → 「サービスアカウント」
3. サービスアカウント名を入力（例: `comet-analyzer-sa`）
4. 役割: 「編集者」を選択
5. 「完了」をクリック

#### ステップ4: JSONキーのダウンロード
1. 作成したサービスアカウントをクリック
2. 「キー」タブ → 「鍵を追加」 → 「新しい鍵を作成」
3. 形式: **JSON** を選択
4. ダウンロードされたJSONファイルを保存

#### ステップ5: スプレッドシートの共有
1. 分析結果を保存したいGoogleスプレッドシートを開く
2. 右上の「共有」ボタンをクリック
3. サービスアカウントのメールアドレス（`xxx@xxx.iam.gserviceaccount.com`）を追加
4. 権限: **編集者**を選択

### 2. アプリケーションの設定

1. **Comet Analyzer**のWebページにアクセス
2. 「設定」セクションを展開（▼ボタンをクリック）
3. 以下の情報を入力：
   - **スプレッドシートID**: スプレッドシートのURLから抽出
     - 例: `https://docs.google.com/spreadsheets/d/【ここがID】/edit`
   - **シート名**: `TikTok動画データ`（デフォルトのまま推奨）
   - **Google認証情報**: ダウンロードしたJSONファイルの内容をそのまま貼り付け

設定は自動的にブラウザに保存されます（次回から入力不要）。

### 3. データの処理

1. **Cometツールで動画データをCSVエクスポート**
   - Cometから動画データをCSVファイルとして保存

2. **CSVファイルをアップロード**
   - ファイル選択エリアにドラッグ＆ドロップ、または「選択」ボタンでファイルを選択

3. **処理を実行**
   - 「データ収集＆スプレッドシート反映」ボタンをクリック

4. **実行ログを確認**
   - 処理状況がリアルタイムでログに表示されます
   - 処理完了後、統計情報が表示されます

## 📁 プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx                  # メインアプリケーション
│   ├── routes/
│   │   └── api.ts                 # API エンドポイント
│   ├── lib/
│   │   ├── csv-parser.ts          # CSVパース・カラムマッピング
│   │   ├── metrics.ts             # 指標計算ロジック
│   │   ├── ai-analyzer.ts         # AI分析コメント生成
│   │   ├── sheets-manager.ts      # Google Sheets API連携
│   │   └── processor.ts           # メイン処理ロジック
│   └── types/
│       └── index.ts               # TypeScript型定義
├── public/
│   └── static/
│       ├── app.js                 # フロントエンドJavaScript
│       └── styles.css             # カスタムスタイル
├── ecosystem.config.cjs           # PM2設定
├── wrangler.jsonc                 # Cloudflare Workers設定
├── package.json                   # 依存関係
└── README.md                      # このファイル
```

## 💻 開発環境

### 技術スタック

- **バックエンド**: Hono (Cloudflare Workers)
- **フロントエンド**: Vanilla JS + TailwindCSS
- **CSVパーサー**: PapaParse
- **デプロイ**: Cloudflare Pages
- **開発ツール**: Vite, Wrangler, PM2

### ローカル開発

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 開発サーバー起動（PM2）
pm2 start ecosystem.config.cjs

# サービス確認
curl http://localhost:3000

# PM2ログ確認
pm2 logs comet-analyzer --nostream

# PM2停止
pm2 stop comet-analyzer
```

## 🚨 エラーハンドリング

### CSV形式エラー
- 必須カラムが無い場合: エラーメッセージを表示してスキップ
- 数値データが不正な場合: 0として処理

### Google Sheets APIエラー
- スプレッドシートが見つからない: エラーメッセージを表示
- 権限不足: サービスアカウントの共有設定を確認するよう案内

### 重複データ
- 同じ動画URL: 自動的にスキップしてログに記録

## 🎯 現在完了している機能

✅ CSVファイルアップロード・パース機能  
✅ 自動カラムマッピング（viewCount → views など）  
✅ 指標自動計算（各種率の算出）  
✅ AI分析コメント生成（簡易版）  
✅ Google Sheets API連携  
✅ 重複チェック機能  
✅ エラーハンドリング・ログ表示  
✅ レスポンシブUI  

## 🔜 今後の拡張予定

⏳ **Cloudflare AI統合**
- Cloudflare Workers AIを使用した高度なAI分析

⏳ **Google Drive連携**
- Driveフォルダから最新CSVを自動取得

⏳ **アカウント別・ハッシュタグ別分析**
- 列の追加とフィルタリング機能

⏳ **ダッシュボード機能**
- 期間フィルター、並び替え、グラフ表示

⏳ **週次・月次レポート自動生成**
- 定期的な分析レポートの自動作成

⏳ **他SNS対応**
- Instagram Reels、YouTube Shortsへの拡張

## 📝 注意事項

### Google Sheets API
- **無料枠**: 1日あたり500リクエスト（通常使用では十分）
- **レート制限**: 1分あたり100リクエスト
- **サービスアカウント**: スプレッドシートに必ず共有設定すること

### CSVフォーマット
- **必須カラム**: `video_url` (または類似名)
- **推奨カラム**: `views`, `likes`, `saves`, `comments`, `shares`
- **エンコーディング**: UTF-8推奨

### セキュリティ
- **認証情報**: ブラウザのローカルストレージに保存（暗号化なし）
- **本番利用**: サーバーサイドでの認証情報管理を推奨
- **サービスアカウント**: 必要最小限の権限のみ付与すること

## 🤝 サポート

問題が発生した場合は、以下を確認してください：

1. **Google Sheets APIの設定**: サービスアカウントの共有設定
2. **CSVフォーマット**: 必須カラムの存在確認
3. **ブラウザコンソール**: エラーメッセージの確認
4. **実行ログ**: 詳細なエラー情報を確認

## 📄 ライセンス

このプロジェクトは個人利用・商用利用ともに自由にご利用いただけます。

---

**Powered by Cloudflare Pages & Hono**  
Built with ❤️ for TikTok creators
