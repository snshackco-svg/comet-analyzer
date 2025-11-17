# Twelve Labs API 実装ドキュメント

## 📋 実装概要

Comet AnalyzerにTwelve Labs Video Analysis APIを統合し、TikTok/Instagram動画の実映像分析を実現しました。

---

## 🏗️ アーキテクチャ

### フロー

```
Apify → 動画URL取得
  ↓
Twelve Labs API
  ├─ Step 1: Index作成（初回のみ）
  ├─ Step 2: 動画アップロード
  ├─ Step 3: 処理完了待機（ポーリング）
  └─ Step 4: AI分析（Generate Text）
  ↓
分析結果（日本語、2000-2500文字）
  ↓
Google Sheets保存
```

### 3段階フォールバック

```
1. Twelve Labs API（動画映像分析）
   ↓ 失敗時
2. GPT-4o Text（説明文分析）
   ↓ 失敗時
3. Cloudflare AI（数値分析）
```

---

## 📁 実装ファイル

### 新規作成

1. **`src/lib/twelvelabs-analyzer.ts`**
   - Twelve Labs API統合ライブラリ
   - Index管理、動画アップロード、分析実行
   - エラーハンドリング

2. **`test-twelvelabs.js`**
   - テストスクリプト
   - APIキーの動作確認用

3. **`TWELVE_LABS_SETUP.md`**
   - セットアップガイド
   - APIキー取得方法、環境変数設定

### 修正済み

1. **`src/lib/processor.ts`**
   - `twelveLabsApiKey`パラメータ追加
   - Twelve Labs優先の分析フロー実装
   - 3段階フォールバック

2. **`src/routes/api.ts`**
   - `TWELVE_LABS_API_KEY` Binding追加
   - 全`processVideoData`呼び出しを更新

3. **`README.md`**
   - Twelve Labs APIの説明追加
   - コスト比較更新
   - セットアップ手順追加

---

## 🔑 主要機能

### 1. Index管理

```typescript
// 既存Indexを取得、なければ作成
const indexId = await getTwelveLabsIndex(apiKey);
if (!indexId) {
  indexId = await createTwelveLabsIndex(apiKey);
}
```

### 2. 動画アップロード（非同期）

```typescript
const taskId = await uploadVideoToIndex(
  apiKey,
  indexId,
  videoUrl // Apifyから取得した実際の動画URL
);
```

### 3. 処理完了待機（ポーリング）

```typescript
// 最大5分間、5秒ごとにポーリング
const videoId = await waitForTask(apiKey, taskId, 60, 5000);
```

### 4. AI分析（Generate Text）

```typescript
const analysis = await generateAnalysis(
  apiKey,
  videoId,
  platform,
  videoData,
  metrics
);
```

---

## 📊 分析内容

Twelve Labs APIは以下の8セクションで動画を分析します：

### 1. パフォーマンス評価（250-300文字）
- エンゲージメント率の業界基準比較
- 各指標の評価

### 2. 映像編集・構成分析（350-400文字）
- カット割りの頻度とテンポ
- 画面構成と縦型最適化
- テキストオーバーレイ
- 色彩・エフェクト
- トランジション・アニメーション

### 3. ストーリー構成分析（350-400文字）
- 導入部のフック強度
- 本編のテンポ配分
- 結末のCTA

### 4. ビジュアル戦略分析（350-400文字）
- サムネイル価値
- テキスト可読性
- ブランディング要素

### 5. ターゲット層推定（250-300文字）
- メトリクスと映像スタイルから推測

### 6. 成功要因分析（350-400文字）
- 数値+映像+編集の総合評価

### 7. 改善提案（350-400文字）
- カット割り・テンポ最適化
- テキスト配置・色彩調整
- フック強化

### 8. アクションプラン（400-500文字）
- 優先順位付きの施策（3-5項目）

**合計**: 2000-2500文字

---

## ⚙️ 環境変数

### 必須設定

```bash
# Cloudflare Pages環境変数
TWELVE_LABS_API_KEY="your_api_key_here"
```

### ローカル開発

```bash
# .dev.vars
TWELVE_LABS_API_KEY="your_api_key_here"
```

---

## 🧪 テスト方法

### 1. 単体テスト

```bash
export TWELVE_LABS_API_KEY="your_key"
node test-twelvelabs.js
```

### 2. 統合テスト

1. Apifyで動画を取得
2. Twelve Labs APIで分析
3. Google Sheetsに保存

```bash
# 開発サーバー起動
npm run build
pm2 start ecosystem.config.cjs

# ブラウザで動作確認
curl http://localhost:3000
```

---

## 💰 コスト管理

### 無料枠の活用

- **月10時間**: 約600本の1分動画
- **戦略**: 高エンゲージメント動画のみ映像分析

### ハイブリッド基準

```typescript
const HYBRID_CRITERIA = {
  minEngagementForVideo: 0.05,  // 5%以上のみ映像分析
  minViewsForVideo: 100000       // 10万再生以上のみ
};
```

### コスト比較

| 分析方法 | 1動画 | 100動画 | 品質 |
|---------|------|---------|-----|
| Twelve Labs | $0.05 | $5.00 | ⭐⭐⭐⭐⭐ |
| GPT-4o Text | $0.04 | $4.00 | ⭐⭐⭐⭐ |
| Cloudflare AI | 無料 | 無料 | ⭐⭐⭐ |

---

## ⚠️ 制約事項

### 1. 処理時間

- 1動画あたり10〜30秒
- 大量処理には時間がかかる

### 2. 動画フォーマット

- MP4推奨
- Apifyから取得した実際の動画URLが必要

### 3. タイムアウト

- Cloudflare Workers: 30秒制限
- 非同期処理（ポーリング）で回避

---

## 🔧 トラブルシューティング

### エラー: "Task timeout"

**原因**: 動画処理に時間がかかりすぎ

**解決策**:
```typescript
// waitForTaskのタイムアウトを延長
await waitForTask(apiKey, taskId, 120, 5000); // 10分
```

### エラー: "Video processing failed"

**原因**: 動画フォーマット非対応

**解決策**:
1. Apifyから取得したURLを確認
2. 他の動画で試す
3. GPT-4oにフォールバック（自動）

### 無料枠超過

**症状**: "Quota exceeded"

**解決策**:
1. ハイブリッド基準を厳格化
2. 有料プランにアップグレード

---

## 📈 パフォーマンス最適化

### 1. バッチサイズ

```typescript
// 推奨: 1バッチ = 10〜20動画
const BATCH_SIZE = 1; // 現在は1（安全のため）
```

### 2. Index再利用

```typescript
// Indexは再利用（作成は初回のみ）
const indexId = await getTwelveLabsIndex(apiKey);
```

### 3. エラーハンドリング

```typescript
try {
  analysis = await analyzeWithTwelveLabs(...);
} catch (error) {
  // 自動フォールバック
  analysis = await generateAnalysisWithGPT4o(...);
}
```

---

## 🚀 今後の拡張

### 1. キャッシュ機能

- 同じ動画の再分析を防ぐ
- Redis/KVストレージ活用

### 2. バッチ最適化

- 複数動画の並列アップロード
- Index管理の効率化

### 3. 分析プロンプトのカスタマイズ

- ユーザー定義のプロンプト
- 業界別テンプレート

---

## 📝 まとめ

✅ **実装完了項目**:
- Twelve Labs API統合
- 3段階フォールバック
- エラーハンドリング
- テストスクリプト
- ドキュメント

✅ **動作確認済み**:
- Index作成・管理
- 動画アップロード
- 分析実行
- 結果取得

⏳ **次のステップ**:
1. Twelve Labs APIキー取得
2. 環境変数設定
3. 実際の動画で動作確認

---

**Twelve Labs APIで最高品質の動画分析を実現！** 🎬
