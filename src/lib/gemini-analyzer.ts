import { VideoData, CalculatedMetrics, Platform } from '../types';
import { formatRate } from './metrics';
import { getPlatformDisplayName } from './platform-config';
import { downloadAndEncodeVideo, guessVideoMimeType } from './video-utils';

/**
 * Google Gemini 2.0 Flash APIを使用して動画の映像を含む高度な分析を生成
 * 動画を実際にダウンロードして分析する
 */
export async function generateAnalysisWithGeminiVideo(
  platform: Platform,
  data: VideoData,
  metrics: CalculatedMetrics,
  geminiApiKey: string
): Promise<string> {
  if (!geminiApiKey) {
    throw new Error('Gemini APIキーが設定されていません');
  }

  const platformName = getPlatformDisplayName(platform);
  const contentType = platform === 'tiktok' ? '動画' : 'リール';

  console.log(`[Gemini Video] Starting analysis for ${data.video_url}`);

  // 1. 動画をダウンロードしてBase64エンコード
  let base64Video: string;
  try {
    base64Video = await downloadAndEncodeVideo(data.video_url);
  } catch (error: any) {
    console.error('[Gemini Video] Video download failed:', error);
    throw new Error(`動画のダウンロードに失敗: ${error.message}`);
  }

  // 2. MIMEタイプを推測
  const mimeType = guessVideoMimeType(data.video_url);
  console.log(`[Gemini Video] MIME Type: ${mimeType}`);

  // 説明文情報（利用可能な場合）
  const captionInfo = data.caption 
    ? `\n説明文: "${data.caption}"\n投稿者: ${data.author_name || data.author_username || '不明'}`
    : '';

  // プロンプト（改善されたVision APIプロンプトを流用）
  const analysisPrompt = `以下の${platformName}${contentType}を、映像の具体的な観察事実と数値データを緊密に結びつけて分析してください。

【基本データ】
動画URL: ${data.video_url}
再生数: ${data.views.toLocaleString('ja-JP')}
いいね: ${data.likes.toLocaleString('ja-JP')} (${formatRate(metrics.like_rate)})
保存: ${data.saves.toLocaleString('ja-JP')} (${formatRate(metrics.save_rate)})
コメント: ${data.comments.toLocaleString('ja-JP')} (${formatRate(metrics.comment_rate)})
シェア: ${data.shares.toLocaleString('ja-JP')} (${formatRate(metrics.share_rate)})
総合エンゲージメント率: ${formatRate(metrics.engagement_rate)}${captionInfo}

【重要な分析原則】
❌ 悪い例（抽象的）: "訴求力の高いサムネイル"
✅ 良い例（具体的）: "サムネイルは赤と黄色の対比色を使用し、「〇〇円節約」の大きな数字で金銭的メリットを視覚化。この明確な価値提示が保存率${formatRate(metrics.save_rate)}につながっている"

❌ 悪い例: "キャッチーなオープニング"
✅ 良い例: "オープニング3秒で「えっ、知らなかった」という疑問形フックを使用。画面いっぱいの白抜き文字とズームエフェクトで視線を集中させ、いいね率${formatRate(metrics.like_rate)}の高い反応を引き出している"

❌ 悪い例: "テンポの良い編集"
✅ 良い例: "60秒の動画内に45カット（平均1.3秒/カット）の高速編集。各カットで視覚的変化があり視聴維持率を高め、エンゲージメント率${formatRate(metrics.engagement_rate)}に貢献"

【必須の分析手法】
各セクションで以下を必ず実施:
1. 映像から**観察できる具体的事実**を記述（色、文字、カット数、タイミング、配置など）
2. その事実を**特定の数値指標と結びつける**（いいね率、保存率、コメント率など）
3. **因果関係を明示**する（〇〇が△△を引き起こし、その結果□□%になった）

【分析要件】
以下の8つのセクションで、合計2000-2500文字で分析してください：

## 1. パフォーマンス評価（250-300文字）
- 各指標と業界標準値の具体的比較（例: "いいね率${formatRate(metrics.like_rate)}は業界平均7.5%の1.5倍"）
- 再生数${data.views.toLocaleString('ja-JP')}帯での位置づけ
- 最も優れている指標とその要因の仮説
- 改善が必要な指標とボトルネック

## 2. 編集テクニックの定量分析（350-400文字）
【映像から具体的に計測して記述】
- カット数（例: "60秒で45カット、平均1.3秒/カット"）と数値への影響
- テキストオーバーレイの出現頻度・位置・サイズ（例: "画面上部1/3に3秒ごとに文字出現"）
- 色彩パターン（例: "暖色系60%、寒色系40%の配分"）と感情誘導
- トランジション/エフェクトの種類と使用タイミング（例: "5秒目にズーム、15秒目にフラッシュ"）
- これらの編集選択が具体的にどの指標（いいね率/保存率など）に貢献しているか

## 3. ストーリー構造の時系列分析（350-400文字）
【映像を時系列で分解して記述】
- 0-5秒: フックの内容（文字・映像・音）と視覚的インパクトの強度
- 6-30秒: 情報提示の順序と各要素の表示時間
- 31秒以降: クライマックス/CTA/締めの構造
- 各時間帯での視聴者の予想される反応と、それが特定の指標にどう現れているか
- 展開速度（例: "5秒ごとに新情報"）とエンゲージメント率${formatRate(metrics.engagement_rate)}の関係

## 4. テキスト戦略の詳細分析（350-400文字）
【説明文と画面内テキストの両方を具体的に分析】
- 説明文の構造: 最初の5文字、疑問形/命令形/数字の使用有無
- 画面内テキスト: フォントサイズ（画面比）、色、アニメーション有無
- ハッシュタグの種類と数（例: "#トレンドタグ3個 #ニッチタグ2個"）
- テキストと数値の相関（例: "疑問形フックが高いコメント率${formatRate(metrics.comment_rate)}を生成"）
- 人物登場の有無と表情/動作の具体描写

## 5. ターゲット層の根拠ベース推定（250-300文字）
【数値パターンと映像要素から論理的に推測】
- エンゲージメント率${formatRate(metrics.engagement_rate)}から見る視聴者の熱量
- 保存率${formatRate(metrics.save_rate)}から見る実用性ニーズ
- コメント率${formatRate(metrics.comment_rate)}から見る共感度/議論性
- 映像スタイル（色調・テンポ・文字サイズ）から推測される年齢層
- これらの複合要素から導かれる具体的なペルソナ像

## 6. 成功要因の因果関係分析（350-400文字）
【観察事実→行動→数値の因果チェーン】
- 映像要素A（具体的記述）→ 視聴者行動B → 数値結果C（％で明記）
- 複数の因果チェーンを列挙（最低3つ）
- アルゴリズムとの相性（例: "初速5秒の高いいいね率がおすすめ欄配信を加速"）
- 競合との具体的差別化ポイント（映像要素で記述）

## 7. 改善提案（観察に基づく具体策）（350-400文字）
【現状の具体的観察→改善案→予想される数値変化】
- カット編集: 現状（例: "平均1.3秒/カット"）→ 提案（例: "1.5秒に調整"）→ 予想効果
- テキスト配置: 現状→ 提案（例: "画面下部1/4に移動"）→ 予想効果
- 色彩調整: 現状→ 提案（具体的な色指定）→ 予想効果
- フック強化: 現状の5秒→ 提案（具体的な映像・文字案）→ 予想効果
- 各提案でどの指標が何%改善するか予測

## 8. 次のアクションプラン（優先順位付き）（400-500文字）
【即実行可能な具体的施策】
優先度★★★（最重要）:
- 施策内容（具体的な編集・撮影指示）
- 対象指標と予想改善幅（例: "保存率を${formatRate(metrics.save_rate)}→1.2%に"）

優先度★★（重要）:
- 施策内容
- 対象指標と予想改善幅

優先度★（テスト推奨）:
- A/Bテストすべき要素（具体的に2択で提示）
- 避けるべき具体的な編集パターン

次回投稿の提案:
- 最適投稿時間帯（データに基づく）
- 改善版の具体的な構成案（秒数ごとの展開）

【厳守事項】
✅ 必須: すべての記述で具体的な観察事実（色・数・位置・時間）を明記
✅ 必須: 観察事実を必ず特定の数値指標（${formatRate(metrics.like_rate)}など）と結びつける
✅ 必須: 因果関係を明示（AがBを引き起こし、結果Cになった）
❌ 禁止: "魅力的"、"印象的"、"効果的"などの抽象形容詞のみの記述
❌ 禁止: 数値や観察事実の裏付けがない主張
❌ 禁止: "〜かもしれない"などの曖昧表現（断定的に）`;

  try {
    // 3. Gemini APIリクエスト
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    
    console.log('[Gemini Video] Sending request to Gemini API...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Video
              }
            },
            {
              text: analysisPrompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini Video] API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      });
      throw new Error(`Gemini API エラー: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error('[Gemini Video] JSON Parse Error:', { text: text.substring(0, 500) });
      throw new Error(`Gemini APIレスポンスのパースに失敗: ${text.substring(0, 100)}`);
    }

    // レスポンスからテキストを抽出
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysis || analysis.trim() === '') {
      throw new Error('AI分析の生成に失敗しました。レスポンスが空です。');
    }

    console.log('[Gemini Video] Analysis completed successfully');
    return analysis.trim();

  } catch (error: any) {
    console.error('[Gemini Video] Error:', error);
    throw error;
  }
}
