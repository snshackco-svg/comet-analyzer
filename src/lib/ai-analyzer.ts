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
 * Cloudflare AIを使用して分析コメントを生成
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


