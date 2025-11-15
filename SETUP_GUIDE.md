# Comet Analyzer セットアップガイド

## 📋 目次

1. [必要なAPI](#必要なapi)
2. [Google Sheets APIの設定](#google-sheets-apiの設定)
3. [Cloudflare環境変数の設定](#cloudflare環境変数の設定)
4. [ローカル開発環境の設定](#ローカル開発環境の設定)
5. [動作確認](#動作確認)

---

## 必要なAPI

このシステムを稼働させるには、以下のAPIが必要です：

### 1. Google Sheets API（必須）
- **用途**: スプレッドシートへのデータ書き込み・読み込み
- **料金**: 無料（1日あたり500リクエストまで）
- **必要な理由**: TikTok/Instagramのデータをスプレッドシートに保存するため

### 2. Cloudflare Workers AI（必須）
- **用途**: AI分析コメントの自動生成
- **料金**: 無料枠あり（月10,000リクエスト）
- **必要な理由**: 各動画の分析コメント（200-300文字）を自動生成するため
- **モデル**: `@cf/meta/llama-3.1-8b-instruct`

### 3. Cloudflare Pages（必須）
- **用途**: Webアプリケーションのホスティング
- **料金**: 無料
- **必要な理由**: アプリケーションを公開するため

---

## Google Sheets APIの設定

### ステップ1: Google Cloud Projectの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 右上の「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `comet-analyzer`）
4. 「作成」をクリック

### ステップ2: Google Sheets APIの有効化

1. 左メニュー → 「APIとサービス」 → 「ライブラリ」
2. 検索バーに「Google Sheets API」と入力
3. 「Google Sheets API」をクリック
4. 「有効にする」ボタンをクリック

### ステップ3: サービスアカウントの作成

1. 左メニュー → 「APIとサービス」 → 「認証情報」
2. 「認証情報を作成」 → 「サービスアカウント」をクリック
3. サービスアカウント名を入力（例: `comet-analyzer-sa`）
4. 「作成して続行」をクリック
5. 役割を選択:
   - **基本** → **編集者** を選択
6. 「続行」→「完了」をクリック

### ステップ4: JSONキーのダウンロード

1. 作成したサービスアカウントをクリック
2. 上部の「キー」タブをクリック
3. 「鍵を追加」 → 「新しい鍵を作成」
4. キーのタイプ: **JSON** を選択
5. 「作成」をクリック
6. **JSONファイルが自動的にダウンロードされます**（重要！このファイルを大切に保管）

ダウンロードされたJSONファイルの内容（例）:
```json
{
  "type": "service_account",
  "project_id": "comet-analyzer-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "comet-analyzer-sa@comet-analyzer-123456.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### ステップ5: スプレッドシートの作成と共有

1. [Google Sheets](https://sheets.google.com/) を開く
2. 「空白」をクリックして新しいスプレッドシートを作成
3. スプレッドシート名を変更（例: `Comet Analyzer データ`）
4. URLからスプレッドシートIDをコピー:
   ```
   https://docs.google.com/spreadsheets/d/【ここがスプレッドシートID】/edit
   ```
   例: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

5. 右上の「共有」ボタンをクリック
6. サービスアカウントのメールアドレスを入力:
   ```
   comet-analyzer-sa@comet-analyzer-123456.iam.gserviceaccount.com
   ```
   （JSONファイルの`client_email`の値）
7. 権限: **編集者** を選択
8. 「送信」をクリック

**重要:** シート名は自動的に「動画データ」として作成されます。手動で作成する必要はありません。

---

## Cloudflare環境変数の設定

### 本番環境（Cloudflare Pages）の設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左メニュー → **Workers & Pages** をクリック
3. `comet-analyzer` プロジェクトを選択
4. 上部タブ → **Settings** をクリック
5. 左メニュー → **Environment variables** をクリック

#### 環境変数1: SPREADSHEET_ID

1. 「Add variable」をクリック
2. 以下を入力:
   - **Variable name**: `SPREADSHEET_ID`
   - **Value**: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`（あなたのスプレッドシートID）
   - **Environment**: `Production` と `Preview` 両方にチェック
3. 「Save」をクリック

#### 環境変数2: GOOGLE_CREDENTIALS

1. 「Add variable」をクリック
2. 以下を入力:
   - **Variable name**: `GOOGLE_CREDENTIALS`
   - **Value**: ダウンロードしたJSONファイルの内容を**1行にして**貼り付け
   - **Environment**: `Production` と `Preview` 両方にチェック

**JSONを1行にする方法:**

元のJSON（改行あり）:
```json
{
  "type": "service_account",
  "project_id": "comet-analyzer-123456",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "comet-analyzer-sa@comet-analyzer-123456.iam.gserviceaccount.com"
}
```

1行にしたJSON（スペースや改行を削除）:
```json
{"type":"service_account","project_id":"comet-analyzer-123456","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n","client_email":"comet-analyzer-sa@comet-analyzer-123456.iam.gserviceaccount.com"}
```

**注意:** `private_key`内の`\n`は残しておいてください！

3. 「Save」をクリック

#### 環境変数設定後の再デプロイ

環境変数を設定したら、再デプロイが必要です：

```bash
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name comet-analyzer
```

---

## ローカル開発環境の設定

### .dev.vars ファイルの作成

ローカル開発環境で動作確認する場合は、`.dev.vars`ファイルを作成します：

1. プロジェクトルートに `.dev.vars` ファイルを作成:
```bash
cd /home/user/webapp
touch .dev.vars
```

2. `.dev.vars` ファイルに以下を記入:
```bash
# Google Sheets設定
SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"comet-analyzer-123456","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n","client_email":"comet-analyzer-sa@comet-analyzer-123456.iam.gserviceaccount.com"}
```

**注意:** `.dev.vars`ファイルは`.gitignore`に含まれているため、Gitにコミットされません（安全）。

### ローカルでの起動

```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
```

---

## 動作確認

### ステップ1: 環境変数の確認

Cloudflare Dashboardで環境変数が正しく設定されているか確認:
- ✅ `SPREADSHEET_ID` が設定されている
- ✅ `GOOGLE_CREDENTIALS` が設定されている（JSONが1行になっている）

### ステップ2: 本番環境でテスト

1. 本番URLにアクセス:
   ```
   https://08a025da.comet-analyzer.pages.dev
   ```

2. プラットフォームを選択（TikTok / Instagram）

3. サンプルCSVファイルをアップロード:
   - `/home/user/webapp/sample_data.csv` (TikTok用)
   - `/home/user/webapp/sample_data_instagram.csv` (Instagram用)

4. 「データ収集＆スプレッドシート反映」ボタンをクリック

5. ログを確認:
   ```
   ✅ 処理が完了しました。XX件のデータを追加しました。
   ```

### ステップ3: スプレッドシートを確認

1. Google Sheetsを開く
2. 「動画データ」シートが自動的に作成されている
3. データが追加されている:
   - A列: プラットフォーム（TikTok / Instagram）
   - B列: 取得日
   - C列: 動画リンク
   - D〜H列: 数値データ
   - I〜M列: 計算された率
   - N列: AI詳細分析結果（約1000文字）
   - O列: メモ/タグ

---

## よくあるエラーと解決方法

### エラー1: 「スプレッドシートIDが設定されていません」

**原因:** 環境変数`SPREADSHEET_ID`が設定されていない

**解決策:**
1. Cloudflare Dashboard → Settings → Environment variables
2. `SPREADSHEET_ID`を追加
3. 再デプロイ

### エラー2: 「Google認証情報が設定されていません」

**原因:** 環境変数`GOOGLE_CREDENTIALS`が設定されていない

**解決策:**
1. Cloudflare Dashboard → Settings → Environment variables
2. `GOOGLE_CREDENTIALS`を追加（JSONを1行に）
3. 再デプロイ

### エラー3: 「アクセス権限がありません（403）」

**原因:** サービスアカウントにスプレッドシートへの編集権限がない

**解決策:**
1. Google Sheetsを開く
2. 「共有」ボタンをクリック
3. サービスアカウントのメールアドレスを追加
4. 権限を「編集者」に設定

### エラー4: 「スプレッドシートが見つかりません（404）」

**原因:** スプレッドシートIDが間違っている

**解決策:**
1. Google SheetsのURLを確認
2. 正しいIDを環境変数に設定
3. 再デプロイ

### エラー5: 「AI分析の生成に失敗しました」

**原因:** Cloudflare Workers AIが有効になっていない

**解決策:**
- wrangler.jsonc の `ai.binding` が設定されているか確認
- Cloudflareアカウントで Workers AI が有効か確認

---

## チェックリスト

設定が完了したら、以下をチェックしてください：

- [ ] Google Cloud Projectを作成した
- [ ] Google Sheets APIを有効化した
- [ ] サービスアカウントを作成した
- [ ] JSONキーをダウンロードした
- [ ] スプレッドシートを作成した
- [ ] スプレッドシートをサービスアカウントと共有した（編集者権限）
- [ ] Cloudflareで`SPREADSHEET_ID`環境変数を設定した
- [ ] Cloudflareで`GOOGLE_CREDENTIALS`環境変数を設定した（1行JSON）
- [ ] 再デプロイした
- [ ] 本番環境でテストした
- [ ] スプレッドシートにデータが追加された

---

## サポート

問題が解決しない場合は、以下を確認してください：

1. **ブラウザのコンソール** (F12キー) でエラーメッセージを確認
2. **実行ログ** のデバッグ情報を展開して確認
3. **環境変数** が正しく設定されているか再確認

それでも解決しない場合は、エラーメッセージとデバッグ情報をコピーして質問してください。
