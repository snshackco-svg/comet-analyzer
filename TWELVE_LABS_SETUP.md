# Twelve Labs API セットアップガイド

このガイドでは、Twelve Labs APIの設定方法を説明します。

---

## 📋 Twelve Labs APIとは

**Twelve Labs**は動画理解に特化したAI APIサービスです。

### 主な機能
- 動画の視覚分析（シーン検出、オブジェクト認識、色彩分析）
- テキスト抽出（動画内のテキストオーバーレイ読み取り）
- 音声認識と会話分析
- ロゴ・ブランド検出

### 料金
- **無料枠**: 月10時間の動画処理（約600本の1分動画）
- **有料**: $0.05/分（1分動画 = $0.05）

**例**:
- 1分動画 × 100本 = $5
- 1分動画 × 600本/月 = 無料枠内

---

## 🚀 セットアップ手順

### Step 1: アカウント作成

1. **公式サイトにアクセス**: https://www.twelvelabs.io/
2. **Sign Up**をクリック
3. メールアドレスで登録（Googleアカウントでも可）
4. 認証メールを確認してアカウント有効化

### Step 2: APIキーの取得

1. ダッシュボードにログイン
2. 左メニューから **"API Keys"** をクリック
3. **"Create API Key"** ボタンをクリック
4. キー名を入力（例: `comet-analyzer`）
5. **APIキーをコピー** → 安全な場所に保存

> ⚠️ APIキーは一度しか表示されません。必ずコピーして保存してください。

### Step 3: Cloudflare Pagesに環境変数を設定

#### 開発環境（ローカル）

`.dev.vars`ファイルを作成:
```bash
TWELVE_LABS_API_KEY="your_api_key_here"
```

#### 本番環境（Cloudflare Pages）

1. Cloudflare Dashboardにログイン
2. **Workers & Pages** → プロジェクト選択（例: `comet-analyzer`）
3. **Settings** タブ → **Environment variables**
4. **Production** セクションで **Add variable**:
   - Variable name: `TWELVE_LABS_API_KEY`
   - Value: （取得したAPIキー）
   - **Encrypt**にチェック
5. **Save**をクリック
6. **再デプロイ**（環境変数反映のため）

### Step 4: 動作確認

1. Comet Analyzerで動画を処理
2. ログに以下が表示されれば成功:
   ```
   [Hybrid] video_url → vision (Twelve Labs分析)
   ```
3. 分析結果に映像の詳細（カット割り、色彩、構成）が含まれることを確認

---

## 🧪 テスト方法

ローカル環境でテストスクリプトを実行:

```bash
# APIキーを設定
export TWELVE_LABS_API_KEY="your_api_key_here"

# テスト実行
cd /home/user/webapp
node test-twelvelabs.js
```

**テスト内容**:
1. Indexの作成
2. 動画のアップロード
3. 処理完了待機
4. 動画分析の実行

---

## 📊 使用状況の確認

1. Twelve Labs Dashboardにログイン
2. **Usage** ページで以下を確認:
   - 処理済み動画時間
   - 残り無料枠
   - 月間使用量

---

## 💡 ベストプラクティス

### 1. 無料枠を最大限活用

- **月600本（10時間）まで無料**
- 短い動画（15秒〜1分）なら1200本まで可能

### 2. ハイブリッド運用

```javascript
// ハイブリッド基準の設定例
{
  // 高エンゲージメント動画のみ動画分析
  minEngagementForVideo: 0.05, // 5%以上
  // 再生数が多い動画のみ
  minViewsForVideo: 100000
}
```

### 3. バッチ処理

- 一度に大量の動画を処理しない
- 1バッチ = 10〜20動画が推奨
- 処理時間: 1動画あたり10〜30秒

---

## ⚠️ トラブルシューティング

### エラー: "API key is invalid"

**原因**: APIキーが間違っている

**解決策**:
1. Twelve Labs Dashboardで新しいAPIキーを発行
2. Cloudflare環境変数を更新
3. 再デプロイ

### エラー: "Task timeout"

**原因**: 動画処理に時間がかかりすぎている

**解決策**:
1. 動画URLが有効か確認
2. 短い動画（1分以内）でテスト
3. `waitForTask`のタイムアウトを延長（コード修正）

### エラー: "Video processing failed"

**原因**: 動画フォーマットが非対応

**解決策**:
1. 動画がMP4形式か確認
2. 動画URLが直接アクセス可能か確認（Apifyから取得したURLを使用）
3. 他の動画で試す

### 無料枠を超えた場合

**症状**: "Quota exceeded" エラー

**解決策**:
1. Usage ページで使用状況を確認
2. 有料プランにアップグレード、または
3. GPT-4o Text分析にフォールバック（自動）

---

## 🔗 関連リンク

- **公式サイト**: https://www.twelvelabs.io/
- **ドキュメント**: https://docs.twelvelabs.io/
- **API リファレンス**: https://docs.twelvelabs.io/reference/api-reference
- **料金**: https://www.twelvelabs.io/pricing

---

## 🆘 サポート

問題が発生した場合:
1. このガイドのトラブルシューティングを確認
2. Twelve Labs公式ドキュメントを参照
3. Twelve Labs サポート（support@twelvelabs.io）に問い合わせ

---

**Twelve Labs APIで動画分析の品質を最大化しましょう！** 🚀
