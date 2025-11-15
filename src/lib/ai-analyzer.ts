import { TikTokVideoData, CalculatedMetrics } from '../types';
import { formatRate } from './metrics';

/**
 * 動画データからAI分析用のプロンプトを生成
 */
function generateAnalysisPrompt(data: TikTokVideoData, metrics: CalculatedMetrics): string {
  return `あなたはTikTokの伸びる動画を分析するプロ編集者です。
以下の動画データから、「なぜこの動画がこの数値になったのか」「今後同じジャンルで再現するには何を意識すればいいか」を簡潔に分析してください。

【動画データ】
・再生数: ${data.views.toLocaleString('ja-JP')}
・いいね: ${data.likes.toLocaleString('ja-JP')}（いいね率: ${formatRate(metrics.like_rate)}）
・保存: ${data.saves.toLocaleString('ja-JP')}（保存率: ${formatRate(metrics.save_rate)}）
・コメント: ${data.comments.toLocaleString('ja-JP')}（コメント率: ${formatRate(metrics.comment_rate)}）
・シェア: ${data.shares.toLocaleString('ja-JP')}（シェア率: ${formatRate(metrics.share_rate)}）
・エンゲージメント率: ${formatRate(metrics.engagement_rate)}

【出力条件】
・ターゲット（誰に刺さっているか）
・伸びた／伸びなかった主な要因（構成・テーマ・訴求など）
・再現するためのポイントを2〜3個
を1つの文章として200〜300文字で日本語で書いてください。`;
}

/**
 * Cloudflare AIを使用して分析コメントを生成
 * 
 * NOTE: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) を使用
 * 他の選択肢: @cf/meta/llama-3.3-70b-instruct, @cf/qwen/qwen2.5-14b-instruct
 */
export async function generateAnalysis(
  data: TikTokVideoData,
  metrics: CalculatedMetrics,
  ai: any // Cloudflare AI binding
): Promise<string> {
  try {
    const prompt = generateAnalysisPrompt(data, metrics);

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'あなたはTikTokの伸びる動画を分析するプロ編集者です。データに基づいて簡潔で具体的な分析を提供します。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 512,
      temperature: 0.7,
    });

    // レスポンスから分析テキストを抽出
    const analysis = response?.response || '分析を生成できませんでした';

    // 長すぎる場合は300文字程度にトリミング
    if (analysis.length > 350) {
      return analysis.substring(0, 300) + '...';
    }

    return analysis;
  } catch (error) {
    console.error('AI分析生成エラー:', error);
    return '分析の生成中にエラーが発生しました';
  }
}

/**
 * フォールバック：AIが使えない場合のシンプルな分析生成
 */
export function generateSimpleAnalysis(
  data: TikTokVideoData,
  metrics: CalculatedMetrics
): string {
  const { views, likes, saves, comments, shares } = data;
  const { like_rate, save_rate, engagement_rate } = metrics;

  // エンゲージメントレベルを判定
  let engagementLevel = '低い';
  if (engagement_rate > 0.15) engagementLevel = '非常に高い';
  else if (engagement_rate > 0.10) engagementLevel = '高い';
  else if (engagement_rate > 0.05) engagementLevel = '平均的';

  // 最も高い指標を特定
  let strongPoint = '';
  if (save_rate > 0.02) strongPoint = '保存率が高く、視聴者にとって価値ある情報として認識されています。';
  else if (like_rate > 0.08) strongPoint = 'いいね率が高く、視聴者の共感を得ています。';
  else if (comments > views * 0.01) strongPoint = 'コメント数が多く、視聴者の関心を引いています。';

  return `エンゲージメント率${formatRate(engagement_rate)}（${engagementLevel}）。再生数${views.toLocaleString('ja-JP')}に対し、いいね${likes.toLocaleString('ja-JP')}、保存${saves.toLocaleString('ja-JP')}。${strongPoint} 今後は冒頭3秒でフックを強化し、視聴維持率を向上させることで、さらなる拡散が期待できます。`;
}
