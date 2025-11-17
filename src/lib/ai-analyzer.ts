import { VideoData, CalculatedMetrics, Platform } from '../types';
import { formatRate } from './metrics';
import { getPlatformDisplayName } from './platform-config';

/**
 * プラットフォームに応じた分析用のプロンプトを生成
 */
function generateAnalysisPrompt(
  platform: Platform,
  data: VideoData,
  metrics: CalculatedMetrics
): string {
  const platformName = getPlatformDisplayName(platform);
  const contentType = platform === 'tiktok' ? '動画' : 'リール';

  return `あなたは${platformName}${contentType}の伸びる動画を分析するプロ編集者です。
以下の動画データから、「なぜこの動画がこの数値になったのか」「今後同じジャンルで再現するには何を意識すればいいか」を簡潔に分析してください。

【動画データ】
・再生数: ${data.views.toLocaleString('ja-JP')}
・いいね: ${data.likes.toLocaleString('ja-JP')}（いいね率: ${formatRate(metrics.like_rate)}）
・保存: ${data.saves.toLocaleString('ja-JP')}（保存率: ${formatRate(metrics.save_rate)}）
・コメント: ${data.comments.toLocaleString('ja-JP')}（コメント率: ${formatRate(metrics.comment_rate)}）
・シェア: ${data.shares.toLocaleString('ja-JP')}（シェア率: ${formatRate(metrics.share_rate)}）
・エンゲージメント率: ${formatRate(metrics.engagement_rate)}

【出力条件】
以下の内容を含む、詳細で実践的な分析を1000文字程度で日本語で書いてください。

1. ターゲット分析（150-200文字）
   - どのような視聴者層に刺さっているか
   - 年齢層、興味関心、視聴動機

2. 数値の評価と要因分析（300-400文字）
   - 各指標（いいね率、保存率、コメント率、シェア率）の評価
   - なぜその数値になったのか（構成、テーマ、訴求、タイミングなど）
   - 特に優れている点、改善が必要な点

3. 成功要因または改善ポイント（250-300文字）
   - 伸びた要因、または伸び悩んだ理由
   - コンテンツの強み・弱み
   - アルゴリズム的な観点

4. 再現するための具体的アクション（250-300文字）
   - 次回以降に活かせる3-5個の具体的なポイント
   - 改善すべき要素
   - テストすべき施策`;
}

/**
 * OpenAI GPT-4oを使用して高度な分析を生成
 */
export async function generateAnalysisWithGPT4o(
  platform: Platform,
  data: VideoData,
  metrics: CalculatedMetrics,
  openaiApiKey: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  const platformName = getPlatformDisplayName(platform);
  const contentType = platform === 'tiktok' ? '動画' : 'リール';

  // GPT-4o用の改善されたプロンプト
  const systemPrompt = `あなたは${platformName}のトップクリエイターを指導する経験豊富なSNSマーケティングコンサルタントです。データドリブンな分析と、すぐに実践できる具体的なアドバイスを提供します。`;

  const userPrompt = `以下の${platformName}${contentType}のデータを分析し、実践的で具体的なインサイトを提供してください。

【動画データ】
再生数: ${data.views.toLocaleString('ja-JP')}
いいね: ${data.likes.toLocaleString('ja-JP')} (${formatRate(metrics.like_rate)})
保存: ${data.saves.toLocaleString('ja-JP')} (${formatRate(metrics.save_rate)})
コメント: ${data.comments.toLocaleString('ja-JP')} (${formatRate(metrics.comment_rate)})
シェア: ${data.shares.toLocaleString('ja-JP')} (${formatRate(metrics.share_rate)})
総合エンゲージメント率: ${formatRate(metrics.engagement_rate)}

【分析要件】
以下の4つのセクションで、合計1200-1500文字で分析してください：

## 1. パフォーマンス評価（300-400文字）
- 各指標の業界ベンチマークとの比較
- この再生数帯での標準値との差異
- 特に優れている指標と改善が必要な指標
- 具体的な数値での評価（例：「保存率0.84%は平均0.5%の1.7倍」）

## 2. 成功要因の分析（300-400文字）
- なぜこの数値になったのか（構成、テーマ、訴求力の観点）
- 視聴者の行動パターンから見える動画の特性
- アルゴリズムへの最適化度合い
- コンテンツの強みと独自性

## 3. ターゲット層の推定（200-300文字）
- どのような視聴者層に刺さっているか
- 年齢層、興味関心、視聴動機
- エンゲージメントパターンから見える視聴者の特徴

## 4. 次のアクションプラン（400-500文字）
- 今すぐ実践すべき3-5つの具体的施策
- 数値を改善するための優先順位付き推奨事項
- テストすべき新しい要素
- 避けるべきポイント
- 次回投稿のタイミングと内容の提案

【注意事項】
- 抽象的な表現を避け、具体的な数値や事例を使う
- すぐに実践できるアクションを重視
- 業界標準値との比較を必ず含める
- 「〜かもしれない」ではなく「〜です」と断定的に`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI API Error]', {
      status: response.status,
      statusText: response.statusText,
      error: errorText.substring(0, 500)
    });
    throw new Error(`OpenAI API エラー: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  let result;
  try {
    result = await response.json();
  } catch (parseError) {
    const text = await response.text();
    console.error('[OpenAI JSON Parse Error]', { text: text.substring(0, 500) });
    throw new Error(`OpenAI APIレスポンスのパースに失敗: ${text.substring(0, 100)}`);
  }
  const analysis = result.choices?.[0]?.message?.content;

  if (!analysis || analysis.trim() === '') {
    throw new Error('AI分析の生成に失敗しました。レスポンスが空です。');
  }

  return analysis.trim();
}

/**
 * OpenAI GPT-4o Vision APIを使用して動画の映像を含む高度な分析を生成
 * 説明文 + 映像解析による最も詳細な分析
 */
export async function generateAnalysisWithVision(
  platform: Platform,
  data: VideoData,
  metrics: CalculatedMetrics,
  openaiApiKey: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  const platformName = getPlatformDisplayName(platform);
  const contentType = platform === 'tiktok' ? '動画' : 'リール';

  // システムプロンプト
  const systemPrompt = `あなたは${platformName}のトップクリエイターを指導する経験豊富なSNSマーケティングコンサルタント兼映像ディレクターです。数値分析、テキスト分析、そして映像分析を統合し、すぐに実践できる具体的なアドバイスを提供します。`;

  // 説明文情報（利用可能な場合）
  const captionInfo = data.caption 
    ? `\n説明文: "${data.caption}"\n投稿者: ${data.author_name || data.author_username || '不明'}`
    : '';

  // ユーザープロンプト
  const userPrompt = `以下の${platformName}${contentType}を、映像の具体的な観察事実と数値データを緊密に結びつけて分析してください。

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
✅ 良い例: "15秒の動画内に18カット（平均0.83秒/カット）の高速編集。各カットで視覚的変化があり視聴維持率を高め、エンゲージメント率${formatRate(metrics.engagement_rate)}に貢献"

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
- カット数（例: "15秒で18カット、平均0.83秒/カット"）と数値への影響
- テキストオーバーレイの出現頻度・位置・サイズ（例: "画面上部1/3に2秒ごとに文字出現"）
- 色彩パターン（例: "暖色系60%、寒色系40%の配分"）と感情誘導
- トランジション/エフェクトの種類と使用タイミング（例: "3秒目にズーム、7秒目にフラッシュ"）
- これらの編集選択が具体的にどの指標（いいね率/保存率など）に貢献しているか

## 3. ストーリー構造の時系列分析（350-400文字）
【映像を時系列で分解して記述】
- 0-3秒: フックの内容（文字・映像・音）と視覚的インパクトの強度
- 4-10秒: 情報提示の順序と各要素の表示時間
- 11秒以降: クライマックス/CTA/締めの構造
- 各時間帯での視聴者の予想される反応と、それが特定の指標にどう現れているか
- 展開速度（例: "3秒ごとに新情報"）とエンゲージメント率${formatRate(metrics.engagement_rate)}の関係

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
- アルゴリズムとの相性（例: "初速3秒の高いいいね率がおすすめ欄配信を加速"）
- 競合との具体的差別化ポイント（映像要素で記述）

## 7. 改善提案（観察に基づく具体策）（350-400文字）
【現状の具体的観察→改善案→予想される数値変化】
- カット編集: 現状（例: "平均0.83秒/カット"）→ 提案（例: "1.2秒に調整"）→ 予想効果
- テキスト配置: 現状→ 提案（例: "画面下部1/4に移動"）→ 予想効果
- 色彩調整: 現状→ 提案（具体的な色指定）→ 予想効果
- フック強化: 現状の3秒→ 提案（具体的な映像・文字案）→ 予想効果
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: data.video_url,
                  detail: 'high'  // 高解像度で解析
                }
              }
            ]
          }
        ],
        max_tokens: 3000,  // 長文分析用
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vision API Error]', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500),
        videoUrl: data.video_url
      });
      // Vision APIエラーの場合はテキストのみ分析にフォールバック
      console.warn(`Vision API failed (${response.status}), falling back to text-only analysis`);
      return await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error('[Vision JSON Parse Error]', { text: text.substring(0, 500) });
      // パースエラーの場合もテキスト分析にフォールバック
      console.warn('Vision API response parse failed, falling back to text-only analysis');
      return await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey);
    }
    const analysis = result.choices?.[0]?.message?.content;

    if (!analysis || analysis.trim() === '') {
      throw new Error('AI分析の生成に失敗しました。レスポンスが空です。');
    }

    return analysis.trim();
  } catch (error: any) {
    // エラー時はテキストのみ分析にフォールバック
    console.warn('Vision API error, falling back to text-only analysis:', error.message);
    return await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey);
  }
}

/**
 * Cloudflare AIを使用して分析コメントを生成（フォールバック用）
 * 
 * NOTE: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) を使用
 * 他の選択肢: @cf/meta/llama-3.3-70b-instruct, @cf/qwen/qwen2.5-14b-instruct
 */
export async function generateAnalysis(
  platform: Platform,
  data: VideoData,
  metrics: CalculatedMetrics,
  ai: any // Cloudflare AI binding
): Promise<string> {
  if (!ai) {
    throw new Error('AI機能が利用できません。Cloudflare Workers AIが設定されていることを確認してください。');
  }

  const prompt = generateAnalysisPrompt(platform, data, metrics);
  const platformName = getPlatformDisplayName(platform);
  const contentType = platform === 'tiktok' ? '動画' : 'リール';

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: `あなたは${platformName}${contentType}の伸びる動画を分析するプロ編集者です。データに基づいて簡潔で具体的な分析を提供します。`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 2048,
    temperature: 0.7,
  });

  // レスポンスから分析テキストを抽出
  const analysis = response?.response;
  
  if (!analysis || analysis.trim() === '') {
    throw new Error('AI分析の生成に失敗しました。レスポンスが空です。');
  }

  // 長すぎる場合は1200文字程度にトリミング（1000文字目標+余裕）
  if (analysis.length > 1500) {
    return analysis.substring(0, 1200) + '...';
  }

  return analysis;
}


