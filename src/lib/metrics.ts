import { TikTokVideoData, CalculatedMetrics } from '../types';

/**
 * 動画データから各種指標を計算
 */
export function calculateMetrics(data: TikTokVideoData): CalculatedMetrics {
  const { views, likes, saves, comments, shares } = data;

  // 分母が0または無効な値の場合は0を返す
  if (!views || views <= 0) {
    return {
      like_rate: 0,
      save_rate: 0,
      comment_rate: 0,
      share_rate: 0,
      engagement_rate: 0,
    };
  }

  return {
    like_rate: likes / views,
    save_rate: saves / views,
    comment_rate: comments / views,
    share_rate: shares / views,
    engagement_rate: (likes + saves + comments + shares) / views,
  };
}

/**
 * パーセント表示用のフォーマット（UI表示用）
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * 数値を3桁区切りでフォーマット
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ja-JP');
}
