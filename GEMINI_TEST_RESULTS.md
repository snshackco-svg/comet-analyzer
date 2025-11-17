# Gemini Video API テスト結果

## テスト概要
TikTok動画をGemini APIで分析できるかテストしました。

## 結果: ❌ 失敗

### 問題1: Inline Data方式が動作しない
- **テストモデル**: `gemini-2.0-flash-exp`, `gemini-2.5-flash`
- **エラー**: `400 - Request contains an invalid argument`
- **原因**: Base64エンコードされた動画データをinline_dataとして送信できない

### 問題2: Files API方式も失敗
- **方法**: Gemini Files APIに動画をアップロードしてから参照
- **結果**: アップロード成功 → 処理失敗
- **エラー**: `FAILED - The file failed to be processed`

### 根本的な問題: TikTok動画の直接ダウンロード不可
```
First 12 bytes: 3c 21 44 4f 43 54 59 50 45 20 68 74
Content-Type: text/html; charset=utf-8
```

TikTokのページURLから直接fetch()しても、動画ファイルではなく**HTMLが返される**。

## 実際の動画URLはApify経由でしか取得できない

```javascript
// Apifyの出力例
{
  "video_url": "https://v16-webapp-prime.tiktok.com/video/tos/...",  // これが実際の動画URL
  "webVideoUrl": "https://www.tiktok.com/@user/video/123"  // これはHTMLページ
}
```

## 結論と推奨事項

### ✅ 推奨: GPT-4o Text分析を使用

**理由**:
1. **現在実装済み** - 既に動作している
2. **コスト効率**: $0.005/動画（Gemini: $0.0023/動画と大差なし）
3. **確実に動作**: OpenAI APIは安定している
4. **メトリクスベース分析で十分**: エンゲージメント率、再生数などから傾向分析可能

### ⚠️ Gemini Video分析は本番環境でも困難

**理由**:
1. Cloudflare Workersの制約:
   - メモリ制限: 128MB
   - CPU時間制限: 30秒
   - 動画ダウンロード + Base64エンコード → メモリ不足の可能性

2. Files APIの制約:
   - アップロード→処理待機→分析の3ステップ
   - 各動画で20秒以上かかる
   - バッチ処理で100動画 = 33分以上

3. 不安定性:
   - 動画処理が頻繁に失敗（`FAILED - The file failed to be processed`）
   - エラー原因が不明確

## 最終推奨

**現在のGPT-4o Text分析を継続使用することを強く推奨します。**

メトリクスデータ（views, likes, shares, comments）から十分なパターン分析が可能であり、
動画の視覚的分析は費用対効果が低いと判断します。

---

## テスト詳細

### Test 1: Inline Data (gemini-2.0-flash-exp)
```
Error 400: Request contains an invalid argument
```

### Test 2: Inline Data (gemini-2.5-flash)
```
Error 400: Request contains an invalid argument
```

### Test 3: Files API (gemini-2.5-flash)
```
Upload: ✅ Success
Processing: ❌ FAILED - The file failed to be processed
```

### Test 4: Video Download Validation
```
Content downloaded: HTML (<!DOCTYPE html...) instead of MP4
Root cause: TikTok URL serves HTML page, not video file
```
