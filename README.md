# Comet Analyzer

**マルチプラットフォーム対応**のSNSデータ収集＆分析ツール - TikTokとInstagramの動画データを自動分析し、Googleスプレッドシートに整理して保存するWebアプリケーション

## 🎯 プロジェクト概要

**Comet Analyzer**は、SNSデータ収集ツール「Comet（コメット）」でエクスポートしたCSVデータを読み込み、動画の各種エンゲージメント指標を自動計算し、AI分析コメントを付与してGoogleスプレッドシートに保存するツールです。

### 対応プラットフォーム

✅ **TikTok** - TikTok動画の分析  
✅ **Instagram** - Instagramリールの分析（**NEW!**）

### 主な機能

✅ **マルチプラットフォーム対応**
- TikTokとInstagramを切り替えて使用可能
- 各プラットフォームのデータは別シートに自動保存

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

### TikTok用シート: `TikTok動画データ`
### Instagram用シート: `Instagram動画データ`

両プラットフォームとも同じ列構成です：

| 列 | 項目 | 説明 |
|---|---|---|
| A | 取得日 | データ処理日時（YYYY-MM-DD HH:MM） |
| B | 動画リンク | 動画/リールのURL |
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
   - **Google認証情報**: ダウンロードしたJSONファイルの内容をそのまま貼り付け

設定は自動的にブラウザに保存されます（次回から入力不要）。

### 3. データの処理

1. **プラットフォームを選択**
   - 「対象プラットフォーム」で **TikTok** または **Instagram** を選択

2. **Cometツールで動画データをCSVエクスポート**
   - TikTok: Cometから TikTok動画データをCSVとして保存
   - Instagram: Cometから InstagramリールデータをCSVとして保存

3. **CSVファイルをアップロード**
   - ファイル選択エリアにドラッグ＆ドロップ、または「選択」ボタンでファイルを選択

4. **処理を実行**
   - 「データ収集＆スプレッドシート反映」ボタンをクリック

5. **実行ログを確認**
   - 処理状況がリアルタイムでログに表示されます
   - 処理完了後、統計情報が表示されます

## 📝 重要な仕様

### シート名の自動管理
- **TikTok**: 「TikTok動画データ」シートに自動保存
- **Instagram**: 「Instagram動画データ」シートに自動保存
- 同じスプレッドシート内で両プラットフォームのデータを管理可能

### 重複チェック
- TikTokとInstagramは別シートなので、URLが重複しても問題なし
- 各シート内では、同じURLの動画/リールは自動的にスキップ

### ログ表示
- 全てのログにプラットフォーム名が表示されます
- 例: `【TikTok】処理を開始します...`
- 例: `【Instagram】15件のデータを追加しました`

## 📁 プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx                  # メインアプリケーション
│   ├── routes/
│   │   └── api.ts                 # API エンドポイント
│   ├── lib/
│   │   ├── platform-config.ts     # プラットフォーム設定 (NEW!)
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
- 同じ動画URL: 自動的にスキップしてログに記録（各プラットフォームのシート内で）

## 🎯 完了している機能

✅ マルチプラットフォーム対応（TikTok + Instagram）  
✅ プラットフォーム別シート自動管理  
✅ CSVファイルアップロード・パース機能  
✅ 自動カラムマッピング（viewCount → views など）  
✅ 指標自動計算（各種率の算出）  
✅ プラットフォーム別AI分析コメント生成（簡易版）  
✅ Google Sheets API連携  
✅ プラットフォーム別重複チェック機能  
✅ プラットフォーム名付きログ表示  
✅ エラーハンドリング・ログ表示  
✅ レスポンシブUI  

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
