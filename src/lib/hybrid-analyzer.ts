/**
 * ハイブリッド分析モード判定ロジック
 * 重要動画のみVision API、その他はGPT-4o Textを使用してコスト最適化
 */

import type { VideoData, CalculatedMetrics, HybridCriteria } from '../types';

/**
 * プリセット定義
 */
export const HYBRID_PRESETS: Record<string, HybridCriteria> = {
  // 厳格基準: Vision使用率 10-15%
  hybrid_strict: {
    mode: 'hybrid_strict',
    tier1: {
      views: 100000,        // 再生数10万以上
      saveRate: 2.0,        // 保存率2%以上
      engagementRate: 15.0, // エンゲージメント15%以上
      likes: 10000,         // いいね1万以上
    },
    tier2: {
      minConditions: 3,     // 3個以上満たす（厳格）
      views: 50000,         // 再生数5万以上
      saveRate: 1.0,        // 保存率1%以上
      likeRate: 8.0,        // いいね率8%以上
      commentRate: 0.5,     // コメント率0.5%以上
      engagementRate: 10.0, // エンゲージメント10%以上
    }
  },
  
  // バランス基準: Vision使用率 20-25% (デフォルト推奨)
  hybrid_balanced: {
    mode: 'hybrid_balanced',
    tier1: {
      views: 80000,         // 再生数8万以上
      saveRate: 1.5,        // 保存率1.5%以上
      engagementRate: 12.0, // エンゲージメント12%以上
      likes: 8000,          // いいね8千以上
    },
    tier2: {
      minConditions: 2,     // 2個以上満たす（バランス）
      views: 40000,         // 再生数4万以上
      saveRate: 0.8,        // 保存率0.8%以上
      likeRate: 7.0,        // いいね率7%以上
      commentRate: 0.4,     // コメント率0.4%以上
      engagementRate: 9.0,  // エンゲージメント9%以上
    }
  },
  
  // 寛容基準: Vision使用率 30-35%
  hybrid_generous: {
    mode: 'hybrid_generous',
    tier1: {
      views: 50000,         // 再生数5万以上
      saveRate: 1.0,        // 保存率1%以上
      engagementRate: 10.0, // エンゲージメント10%以上
      likes: 5000,          // いいね5千以上
    },
    tier2: {
      minConditions: 1,     // 1個以上満たす（寛容）
      views: 30000,         // 再生数3万以上
      saveRate: 0.5,        // 保存率0.5%以上
      likeRate: 6.0,        // いいね率6%以上
      commentRate: 0.3,     // コメント率0.3%以上
      engagementRate: 8.0,  // エンゲージメント8%以上
    }
  }
};

/**
 * デフォルトのハイブリッド基準（バランス）
 */
export const DEFAULT_HYBRID_CRITERIA: HybridCriteria = HYBRID_PRESETS.hybrid_balanced;

/**
 * 動画データに基づいて分析方法を判定
 * @returns 'vision' | 'text' | 'cloudflare'
 */
export function determineAnalysisMethod(
  data: VideoData,
  metrics: CalculatedMetrics,
  criteria: HybridCriteria,
  hasOpenAIKey: boolean
): 'vision' | 'text' | 'cloudflare' {
  
  // OpenAI APIキーがない場合はCloudflare AIにフォールバック
  if (!hasOpenAIKey) {
    return 'cloudflare';
  }
  
  // 全動画Visionモード
  if (criteria.mode === 'vision_all') {
    return 'vision';
  }
  
  // 全動画Textモード
  if (criteria.mode === 'text_all') {
    return 'text';
  }
  
  // ハイブリッドモード判定
  
  // Tier 1チェック: 超重要動画（いずれか1つ満たす）
  const tier1Match = 
    (criteria.tier1.views !== undefined && data.views >= criteria.tier1.views) ||
    (criteria.tier1.saveRate !== undefined && metrics.save_rate * 100 >= criteria.tier1.saveRate) ||
    (criteria.tier1.engagementRate !== undefined && metrics.engagement_rate * 100 >= criteria.tier1.engagementRate) ||
    (criteria.tier1.likes !== undefined && data.likes >= criteria.tier1.likes) ||
    (criteria.tier1.commentRate !== undefined && metrics.comment_rate * 100 >= criteria.tier1.commentRate);
  
  if (tier1Match) {
    return 'vision';
  }
  
  // Tier 2チェック: 重要動画（minConditions個以上満たす）
  const tier2Conditions = [
    criteria.tier2.views !== undefined && data.views >= criteria.tier2.views,
    criteria.tier2.saveRate !== undefined && metrics.save_rate * 100 >= criteria.tier2.saveRate,
    criteria.tier2.likeRate !== undefined && metrics.like_rate * 100 >= criteria.tier2.likeRate,
    criteria.tier2.commentRate !== undefined && metrics.comment_rate * 100 >= criteria.tier2.commentRate,
    criteria.tier2.engagementRate !== undefined && metrics.engagement_rate * 100 >= criteria.tier2.engagementRate,
  ];
  
  const tier2Score = tier2Conditions.filter(c => c).length;
  
  if (tier2Score >= criteria.tier2.minConditions) {
    return 'vision';
  }
  
  // それ以外はText
  return 'text';
}

/**
 * 判定理由を取得（デバッグ・ログ用）
 */
export function getAnalysisReason(
  data: VideoData,
  metrics: CalculatedMetrics,
  criteria: HybridCriteria,
  method: 'vision' | 'text' | 'cloudflare'
): string {
  if (method === 'cloudflare') {
    return 'OpenAI APIキー未設定';
  }
  
  if (criteria.mode === 'vision_all') {
    return '全動画Visionモード';
  }
  
  if (criteria.mode === 'text_all') {
    return '全動画Textモード';
  }
  
  if (method === 'vision') {
    // Tier1判定理由
    const tier1Reasons = [];
    if (criteria.tier1.views && data.views >= criteria.tier1.views) {
      tier1Reasons.push(`再生数${data.views.toLocaleString()}≧${criteria.tier1.views.toLocaleString()}`);
    }
    if (criteria.tier1.saveRate && metrics.save_rate * 100 >= criteria.tier1.saveRate) {
      tier1Reasons.push(`保存率${(metrics.save_rate * 100).toFixed(2)}%≧${criteria.tier1.saveRate}%`);
    }
    if (criteria.tier1.engagementRate && metrics.engagement_rate * 100 >= criteria.tier1.engagementRate) {
      tier1Reasons.push(`エンゲージメント${(metrics.engagement_rate * 100).toFixed(2)}%≧${criteria.tier1.engagementRate}%`);
    }
    if (criteria.tier1.likes && data.likes >= criteria.tier1.likes) {
      tier1Reasons.push(`いいね${data.likes.toLocaleString()}≧${criteria.tier1.likes.toLocaleString()}`);
    }
    
    if (tier1Reasons.length > 0) {
      return `Tier1該当: ${tier1Reasons.join(', ')}`;
    }
    
    // Tier2判定理由
    return `Tier2該当: 複数条件満たす`;
  }
  
  return '通常動画';
}

/**
 * コスト見積もり計算
 */
export function estimateCost(visionCount: number, textCount: number, cloudflareCount: number): {
  visionCost: number;
  textCost: number;
  cloudflareCost: number;
  totalCost: number;
} {
  const VISION_COST_PER_VIDEO = 0.10;  // Vision API: $0.10/動画
  const TEXT_COST_PER_VIDEO = 0.03;    // GPT-4o Text: $0.03/動画
  const CLOUDFLARE_COST = 0;           // Cloudflare AI: 無料
  
  const visionCost = visionCount * VISION_COST_PER_VIDEO;
  const textCost = textCount * TEXT_COST_PER_VIDEO;
  const cloudflareCost = cloudflareCount * CLOUDFLARE_COST;
  const totalCost = visionCost + textCost + cloudflareCost;
  
  return {
    visionCost,
    textCost,
    cloudflareCost,
    totalCost
  };
}
