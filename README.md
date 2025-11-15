# Comet Analyzer

**マルチプラットフォーム対応**のSNSデータ収集＆分析ツール - TikTokとInstagramの動画データを自動分析し、Googleスプレッドシートに整理して保存するWebアプリケーション

## 🎯 プロジェクト概要

**Comet Analyzer**は、SNSデータ収集ツール「Comet（コメット）」でエクスポートしたCSVデータを読み込み、動画の各種エンゲージメント指標を自動計算し、AI分析コメントを付与してGoogleスプレッドシートに保存するツールです。

### 🆕 ハイブリッド運用対応！

**2つのデータ収集方法から選択可能:**

1. **Comet手動CSV** - 高精度（おすすめフィード）  
   - Cometブラウザで手動収集したCSVをアップロード
   - パーソナライズされた「おすすめ」動画を取得

2. **Apify自動収集** - 完全自動（ハッシュタグ検索） 🚀 **NEW!**
   - ボタン1つでトレンド動画を自動取得
   - ハッシュタグ検索ベースの大量データ収集
   - Comet不要、API経由で自動実行

### 対応プラットフォーム

✅ **TikTok** - TikTok動画の分析  
✅ **Instagram** - Instagramリールの分析

### 主な機能

✅ **マルチプラットフォーム対応**
- TikTokとInstagramを切り替えて使用可能
- 全データを1つの「動画データ」シートに統合管理
- A列でプラットフォームを識別

✅ **設定不要**
- 環境変数で認証情報を管理
- CSVアップロードだけで使える

✅ **自動指標計算**
- いいね率、保存率、コメント率、シェア率、エンゲージメント率を自動計算

✅ **AI分析コメント生成**
- Cloudflare Workers AIで各動画を自動分析
- プラットフォームごとに最適化された分析プロンプト

✅ **重複チェック**
- 同じ動画URLは自動的にスキップ（重複登録を防止）

✅ **CSVダウンロード**
- スプレッドシートのデータをCSVでエクスポート
- プラットフォームでフィルタリング可能

✅ **詳細なデバッグ情報**
- エラー発生時に原因と解決策を表示
- 展開可能なデバッグパネル

✅ **Apify自動データ収集** 🆕
- ハッシュタグ検索でトレンド動画を自動取得
- 複数ハッシュタグ一括検索
- 取得件数を自由に設定（20〜200件）
- 完全自動でAI分析＆スプレッドシート保存

### 必要なAPI

このシステムを稼働させるには以下のAPIが必要です：

| API | 用途 | 料金 | 必須度 |
|-----|-----|------|--------|
| **Google Sheets API** | データの保存・読み込み | 無料（1日500リクエスト） | ✅ 必須 |
| **Cloudflare Workers AI** | AI分析コメント生成 | 無料枠あり（月10,000リクエスト） | ✅ 必須 |
| **Cloudflare Pages** | アプリホスティング | 無料 | ✅ 必須 |
| **Apify API** 🆕 | 自動データ収集（TikTok/Instagram） | 無料枠$5/月（約2,100件）、有料$49/月〜 | ⭕ オプション |

**📖 [APIの設定方法はSETUP_GUIDE.mdを参照](./SETUP_GUIDE.md)**

## 🚀 現在のURL

### 本番環境（Apify自動収集対応 🆕）
- **Production URL**: https://c93a940b.comet-analyzer.pages.dev
- **プロジェクト**: comet-analyzer
- **プラットフォーム**: Cloudflare Pages
- **最終デプロイ**: 2025-01-23 (Apify完全版 - バグ修正 & 検証強化)

### 開発環境
- **Sandbox URL**: https://3000-ik4b2rxylqqe2sbqg2wuz-82b888ba.sandbox.novita.ai
- **ローカル**: http://localhost:3000

## ⚙️ セットアップ方法

**📖 [詳細なセットアップガイドはこちら](./SETUP_GUIDE.md)**

### クイックスタート

1. **Google Sheets APIを有効化**
   - Google Cloud Consoleでプロジェクト作成
   - Google Sheets APIを有効化
   - サービスアカウントを作成してJSONキーをダウンロード

2. **スプレッドシートを共有**
   - Google Sheetsでスプレッドシート作成
   - サービスアカウントのメールアドレスと共有（編集者権限）

3. **Cloudflareで環境変数を設定**
   - `SPREADSHEET_ID`: スプレッドシートのID
   - `GOOGLE_CREDENTIALS`: サービスアカウントのJSON（1行）
   - `APIFY_TOKEN`: Apify APIトークン（自動収集を使う場合のみ） 🆕

4. **再デプロイ**
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name comet-analyzer
   ```

5. **動作確認**
   - 方法1: CSVファイルをアップロード（手動収集）
   - 方法2: Apify自動収集ボタンをクリック（自動収集） 🆕
   - スプレッドシートにデータが追加されることを確認

## 📊 出力データ仕様

### 統一シート: `動画データ`

TikTokとInstagramのデータを1つのシートに統合管理します。A列でプラットフォームを識別：

| 列 | 項目 | 説明 |
|---|---|---|
| A | プラットフォーム | TikTok / Instagram |
| B | 取得日 | データ処理日時（YYYY-MM-DD HH:MM） |
| C | 動画リンク | 動画/リールのURL |
| D | 再生数 | views |
| E | いいね数 | likes |
| F | 保存数 | saves |
| G | コメント数 | comments |
| H | シェア数 | shares |
| I | いいね率 | likes ÷ views |
| J | 保存率 | saves ÷ views |
| K | コメント率 | comments ÷ views |
| L | シェア率 | shares ÷ views |
| M | エンゲージメント率 | (likes + saves + comments + shares) ÷ views |
| N | 分析結果 | AI生成の詳細分析コメント（約1000文字：ターゲット分析、数値評価、成功要因、改善アクション） |
| O | メモ/タグ | ユーザー用の自由記入欄 |

## 🛠 使い方

### データ収集の2つの方法

#### 方法1: Comet手動CSV（高精度）
1. Cometブラウザで「おすすめ」動画を閲覧
2. データをCSVエクスポート
3. Comet Analyzerにアップロード
4. **メリット**: パーソナライズされた精度の高いデータ

#### 方法2: Apify自動収集（完全自動）🆕
1. ハッシュタグを入力（例: fyp, viral, trending）
2. 取得件数を選択（20〜200件）
3. 「Apifyで自動収集」ボタンをクリック
4. **メリット**: ボタン1つで完全自動、Comet不要

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
   - **Google認証情報**: ダウンロードしたJSONファイルの内容をそのまま貼り付け

設定は自動的にブラウザに保存されます（次回から入力不要）。

### 3. データの処理

#### オプションA: Comet手動CSV
1. **プラットフォームを選択**
   - 「対象プラットフォーム」で **TikTok** または **Instagram** を選択

2. **Cometツールで動画データをCSVエクスポート**
   - TikTok: Cometから TikTok動画データをCSVとして保存
   - Instagram: Cometから InstagramリールデータをCSVとして保存

3. **CSVファイルをアップロード**
   - ファイル選択エリアにドラッグ＆ドロップ、または「選択」ボタンでファイルを選択

4. **処理を実行**
   - 「データ収集＆スプレッドシート反映」ボタンをクリック

#### オプションB: Apify自動収集 🆕
1. **プラットフォームを選択**
   - TikTok または Instagram を選択

2. **ハッシュタグを入力**
   - カンマ区切りで複数指定可能（例: fyp, viral, trending, おすすめ）

3. **取得件数を選択**
   - 20件（テスト用）〜 200件

4. **自動収集を実行**
   - 「Apifyで自動収集＆AI分析」ボタンをクリック
   - 通常1〜3分で完了

5. **実行ログを確認**
   - 処理状況がリアルタイムでログに表示されます
   - 処理完了後、統計情報が表示されます

## 📝 重要な仕様

### シート名の自動管理
- **統一シート**: 「動画データ」シートに全プラットフォームのデータを保存
- **A列でプラットフォーム識別**: TikTok / Instagram

### 重複チェック
- 同じURLの動画/リールは自動的にスキップ
- プラットフォーム関係なく、URL単位で重複判定

### データソース
- **Comet CSV**: 手動収集した高精度データ
- **Apify**: ハッシュタグ検索による自動収集データ 🆕
- 両方のデータを同じシートで管理可能

### Apify自動収集の特徴 🆕
- **TikTok**: ハッシュタグ検索ベース（For Youページは非対応）
- **Instagram**: ハッシュタグ検索ベース（Exploreページは非対応）
- **料金**: 50件 ≈ $0.50、100件 ≈ $1.00
- **処理時間**: 通常1〜3分

## 📁 プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx                  # メインアプリケーション
│   ├── routes/
│   │   └── api.ts                 # API エンドポイント
│   ├── lib/
│   │   ├── platform-config.ts     # プラットフォーム設定
│   │   ├── apify-client.ts        # Apify API クライアント 🆕
│   │   ├── csv-parser.ts          # CSVパース・カラムマッピング
│   │   ├── metrics.ts             # 指標計算ロジック
│   │   ├── ai-analyzer.ts         # AI分析コメント生成
│   │   ├── sheets-manager.ts      # Google Sheets API連携
│   │   ├── processor.ts           # メイン処理ロジック
│   │   └── debug.ts               # デバッグユーティリティ
│   └── types/
│       └── index.ts               # TypeScript型定義
├── public/
│   └── static/
│       ├── app.js                 # フロントエンドJavaScript
│       └── styles.css             # カスタムスタイル
├── sample_data.csv                # TikTok用サンプルデータ
├── sample_data_instagram.csv      # Instagram用サンプルデータ (NEW!)
├── ecosystem.config.cjs           # PM2設定
├── wrangler.jsonc                 # Cloudflare Workers設定
├── package.json                   # 依存関係
└── README.md                      # このファイル
```

## 💻 開発環境

### 技術スタック

- **バックエンド**: Hono (Cloudflare Workers)
- **フロントエンド**: Vanilla JS + TailwindCSS (モバイル対応)
- **AI分析**: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct)
- **CSVパーサー**: PapaParse
- **デプロイ**: Cloudflare Pages (本番稼働中 ✅)
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
- 同じ動画URL: 自動的にスキップしてログに記録（各プラットフォームのシート内で）

## 🎯 完了している機能

✅ マルチプラットフォーム対応（TikTok + Instagram）  
✅ 統一シート管理（A列でプラットフォーム識別）  
✅ CSVファイルアップロード・パース機能  
✅ 自動カラムマッピング（viewCount → views など）  
✅ 指標自動計算（各種率の算出）  
✅ プラットフォーム別AI分析コメント生成（1000文字）  
✅ Google Sheets API連携  
✅ 重複チェック機能  
✅ CSVダウンロード機能（プラットフォームフィルタ付き）  
✅ エラーハンドリング・詳細デバッグ情報  
✅ **モバイル対応レスポンシブUI**  
  - スマートフォン・タブレットに最適化
  - タッチフレンドリーなボタンサイズ（44px以上）
  - 画面サイズに応じた自動レイアウト調整
  - モバイルブラウザでの快適な操作性  
✅ **Apify自動データ収集** 🆕  
  - ハッシュタグ検索によるトレンド動画の自動取得
  - TikTok/Instagram対応
  - 取得件数のカスタマイズ（20〜200件）
  - 完全自動でAI分析＆スプレッドシート保存
  - ハイブリッド運用（Comet + Apify）  

## 🔜 今後の拡張予定

⏳ **YouTube Shorts対応**
- 3つ目のプラットフォームとして追加可能

⏳ **Cloudflare AI統合**
- Cloudflare Workers AIを使用した高度なAI分析

⏳ **Google Drive連携**
- Driveフォルダから最新CSVを自動取得

⏳ **アカウント別・ハッシュタグ別分析**
- 列の追加とフィルタリング機能

⏳ **ダッシュボード機能**
- プラットフォーム比較、期間フィルター、グラフ表示

⏳ **週次・月次レポート自動生成**
- 定期的な分析レポートの自動作成

## 📝 サンプルデータ

### TikTok用サンプル
`sample_data.csv` - TikTok動画データのサンプル

### Instagram用サンプル
`sample_data_instagram.csv` - Instagramリールデータのサンプル

**CSVフォーマット例（両プラットフォーム共通）:**
```csv
video_url,views,likes,saves,comments,shares
https://www.tiktok.com/@user1/video/123456789,125000,8500,1200,450,320
https://www.instagram.com/reel/ABC123xyz,145000,9800,1800,520,380
```

## 📌 注意事項

### Google Sheets API
- **無料枠**: 1日あたり500リクエスト（通常使用では十分）
- **レート制限**: 1分あたり100リクエスト
- **サービスアカウント**: スプレッドシートに必ず共有設定すること

### CSVフォーマット
- **必須カラム**: `video_url` (または類似名)
- **推奨カラム**: `views`, `likes`, `saves`, `comments`, `shares`
- **エンコーディング**: UTF-8推奨

### プラットフォーム別運用
- **TikTok**: 「TikTok動画データ」シートに保存
- **Instagram**: 「Instagram動画データ」シートに保存
- **重複チェック**: 各シート内で独立して動作

### セキュリティ
- **認証情報**: ブラウザのローカルストレージに保存（暗号化なし）
- **本番利用**: サーバーサイドでの認証情報管理を推奨
- **サービスアカウント**: 必要最小限の権限のみ付与すること

## 🤝 サポート

問題が発生した場合は、以下を確認してください：

1. **Google Sheets APIの設定**: サービスアカウントの共有設定
2. **プラットフォーム選択**: 正しいプラットフォームが選択されているか
3. **CSVフォーマット**: 必須カラムの存在確認
4. **ブラウザコンソール**: エラーメッセージの確認
5. **実行ログ**: 詳細なエラー情報（プラットフォーム名付き）を確認

## 🎉 新機能: Instagram対応

### 追加された機能
- ✅ Instagramリールの分析に対応
- ✅ プラットフォーム選択UI（TikTok / Instagram）
- ✅ プラットフォーム別シート自動管理
- ✅ プラットフォーム別AI分析プロンプト
- ✅ ログにプラットフォーム名を表示

### 後方互換性
- ✅ 既存のTikTok処理は完全に維持
- ✅ デフォルトはTikTok（既存ユーザーの挙動は変わらない）
- ✅ 既存のTikTokシートは影響を受けない

### 拡張性
- 🔧 プラットフォーム追加が容易な設計
- 🔧 YouTube Shortsなど、今後の拡張にも対応可能

## 📄 ライセンス

このプロジェクトは個人利用・商用利用ともに自由にご利用いただけます。

---

**Powered by Cloudflare Pages & Hono**  
Built with ❤️ for TikTok & Instagram creators
