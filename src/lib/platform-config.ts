import { Platform, PlatformConfig, ColumnMapping } from '../types';

/**
 * 共通シート名（すべてのプラットフォームで使用）
 */
const SHARED_SHEET_NAME = '動画データ';

/**
 * TikTok用のデフォルト設定
 */
const TIKTOK_CONFIG: PlatformConfig = {
  sheet_name: SHARED_SHEET_NAME,
  display_name: 'TikTok',
  column_mapping: {
    video_url: 'video_url',
    views: 'views',
    likes: 'likes',
    saves: 'saves',
    comments: 'comments',
    shares: 'shares',
  },
};

/**
 * Instagram用のデフォルト設定
 */
const INSTAGRAM_CONFIG: PlatformConfig = {
  sheet_name: SHARED_SHEET_NAME,
  display_name: 'Instagram',
  column_mapping: {
    video_url: 'video_url',
    views: 'views',
    likes: 'likes',
    saves: 'saves',
    comments: 'comments',
    shares: 'shares',
  },
};

/**
 * プラットフォーム設定のマップ
 */
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  tiktok: TIKTOK_CONFIG,
  instagram: INSTAGRAM_CONFIG,
};

/**
 * プラットフォーム設定を取得
 */
export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

/**
 * プラットフォーム一覧を取得
 */
export function getAllPlatforms(): Platform[] {
  return Object.keys(PLATFORM_CONFIGS) as Platform[];
}

/**
 * プラットフォームの表示名を取得
 */
export function getPlatformDisplayName(platform: Platform): string {
  return getPlatformConfig(platform).display_name;
}

/**
 * プラットフォームのシート名を取得
 */
export function getPlatformSheetName(platform: Platform): string {
  return getPlatformConfig(platform).sheet_name;
}

/**
 * プラットフォームのデフォルトカラムマッピングを取得
 */
export function getPlatformColumnMapping(platform: Platform): ColumnMapping {
  return getPlatformConfig(platform).column_mapping;
}
