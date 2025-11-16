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
    throw new Error(`OpenAI API エラー: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
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
  const userPrompt = `以下の${platformName}${contentType}を、数値・説明文・映像の3つの観点から総合的に分析してください。

【基本データ】
動画URL: ${data.video_url}
再生数: ${data.views.toLocaleString('ja-JP')}
いいね: ${data.likes.toLocaleString('ja-JP')} (${formatRate(metrics.like_rate)})
保存: ${data.saves.toLocaleString('ja-JP')} (${formatRate(metrics.save_rate)})
コメント: ${data.comments.toLocaleString('ja-JP')} (${formatRate(metrics.comment_rate)})
シェア: ${data.shares.toLocaleString('ja-JP')} (${formatRate(metrics.share_rate)})
総合エンゲージメント率: ${formatRate(metrics.engagement_rate)}${captionInfo}

【分析要件】
以下の8つのセクションで、合計2000-2500文字で詳細に分析してください：

## 1. パフォーマンス評価（250-300文字）
- 各指標の業界ベンチマークとの比較
- この再生数帯での標準値との差異
- 特に優れている指標と改善が必要な指標
- 具体的な数値での評価

## 2. 編集・構成の分析（350-400文字）
【映像から分析】
- カット割りの頻度とテンポ感（高速/標準/ゆっくり）
- 画面構成と縦型最適化度
- テキストオーバーレイの配置・サイズ・読みやすさ
- 色彩・ビジュアルエフェクトの使用
- トランジション・ズームなどの演出効果

## 3. ストーリー構成の分析（350-400文字）
【映像から分析】
- 導入部（0-3秒）のフックの強度と視覚的インパクト
- 本編の情報提示順序とテンポ配分
- 結末のCTA（行動喚起）の有無と効果
- 視聴維持のための工夫（視覚的変化、情報密度）

## 4. 台本・演出の分析（350-400文字）
【説明文 + 映像から分析】
- 説明文のフック戦略（数字・疑問形・感情訴求）
- 画面内テキストと説明文の整合性
- ハッシュタグ戦略（トレンド vs ニッチ）
- 視覚的ストーリーテリング手法
- 人物の有無・表情・ボディランゲージ

## 5. ターゲット層の推定（250-300文字）
【数値パターン + 映像スタイルから推測】
- 想定される視聴者層（年齢・性別・興味関心）
- エンゲージメントパターンから見える視聴動機
- ビジュアルスタイルが訴求する層

## 6. 成功要因の統合分析（350-400文字）
【数値 + 説明文 + 映像の総合評価】
- なぜこの数値になったのか（編集・構成・訴求力の観点）
- 視聴者行動パターンから見える動画の特性
- アルゴリズム最適化度合い
- 競合との差別化ポイント

## 7. 改善提案（350-400文字）
【編集・構成・台本の具体的改善策】
- カット割り・テンポの最適化案
- テキスト配置・サイズの調整提案
- 色彩・エフェクトの改善
- フック強化の具体案
- 説明文・ハッシュタグの最適化

## 8. 次のアクションプラン（400-500文字）
【優先順位付きの実行可能施策】
- 今すぐ実践すべき3-5つの具体的施策
- 数値を改善するための推奨事項
- テストすべき新しい編集手法
- 避けるべきポイント
- 次回投稿のタイミングと内容の提案

【注意事項】
- 映像を実際に見て、具体的な要素を指摘する
- 抽象的な表現を避け、観察した事実を基に分析
- すぐに実践できるアクションを重視
- 業界標準値との比較を必ず含める
- 「〜かもしれない」ではなく「〜です」と断定的に`;

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
      // Vision APIエラーの場合はテキストのみ分析にフォールバック
      console.warn(`Vision API failed (${response.status}), falling back to text-only analysis`);
      return await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey);
    }

    const result = await response.json();
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


