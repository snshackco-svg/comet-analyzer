// プラットフォーム種別
export type Platform = 'tiktok' | 'instagram';

// 動画データの型定義（TikTok/Instagram共通）
export interface VideoData {
  video_url: string;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  // メタデータ（オプション）- Vision APIでの詳細分析に使用
  caption?: string;         // 動画の説明文・キャプション
  author_name?: string;     // 投稿者の表示名
  author_username?: string; // 投稿者のユーザー名/ID
}

// 後方互換性のため残す
export interface TikTokVideoData extends VideoData {}

// CSVカラムマッピング設定
export interface ColumnMapping {
  video_url: string;
  views: string;
  likes: string;
  saves: string;
  comments: string;
  shares: string;
}

// 計算された指標
export interface CalculatedMetrics {
  like_rate: number;
  save_rate: number;
  comment_rate: number;
  share_rate: number;
  engagement_rate: number;
}

// スプレッドシート出力用のデータ
export interface SheetRowData extends VideoData, CalculatedMetrics {
  platform: string; // プラットフォーム名（TikTok/Instagram）
  date: string; // 取得日時
  analysis: string; // AI分析結果
  memo: string; // メモ/タグ
}

// 処理結果
export interface ProcessResult {
  success: boolean;
  platform: Platform; // プラットフォーム名
  total_count: number;
  new_count: number;
  skipped_count: number;
  error_count: number;
  errors: string[];
  logs: string[];
}

// Google Sheets設定
export interface SheetsConfig {
  spreadsheet_id: string;
  sheet_name: string;
}

// プラットフォーム固有の設定
export interface PlatformConfig {
  sheet_name: string; // シート名
  display_name: string; // 表示名
  column_mapping: ColumnMapping; // デフォルトのカラムマッピング
}

// アプリケーション設定
export interface AppConfig {
  platform: Platform; // 選択されたプラットフォーム
  sheets: SheetsConfig;
  column_mapping?: ColumnMapping; // カスタムマッピング（省略時はプラットフォームのデフォルト使用）
  google_credentials?: string; // OAuth認証情報（JSON文字列）
}

// Apify関連の型定義
export interface ApifyConfig {
  tiktok_hashtags: string[]; // TikTok検索ハッシュタグ
  instagram_hashtags: string[]; // Instagram検索ハッシュタグ
  results_per_page: number; // 取得件数
}

// ApifyのTikTok Scraperのレスポンス型
export interface ApifyTikTokResult {
  id?: string;
  webVideoUrl: string;
  playCount: number;
  diggCount: number; // likes
  collectCount: number; // saves
  commentCount: number;
  shareCount: number;
  createTime?: number;
  createTimeISO?: string;
  text?: string; // caption
  authorMeta?: {
    name?: string;
    nickName?: string;
  };
}

// ApifyのInstagram Scraperのレスポンス型
export interface ApifyInstagramResult {
  url: string;
  likesCount: number;
  commentsCount: number;
  displayUrl?: string;
  timestamp?: string;
  caption?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  // Instagram APIには保存数とシェア数が含まれないため、0として扱う
}

// Apify API実行結果
export interface ApifyFetchResult {
  success: boolean;
  platform: Platform;
  source: 'apify'; // データソース識別用
  videos: VideoData[];
  error?: string;
  debug?: any;
}

// スプレッドシートから読み込んだCometデータ（A〜H列のみ）
export interface CometSheetRowData {
  platform: string; // A列: プラットフォーム
  comet_date: string; // B列: Comet取得日時
  video_url: string; // C列: 動画リンク
  views: number; // D列: 再生数
  likes: number; // E列: いいね数
  saves: number; // F列: 保存数
  comments: number; // G列: コメント数
  shares: number; // H列: シェア数
  // I列以降はシステムが自動生成
}

// スプレッドシート出力用のデータ（I〜O列を追加）
// A〜H: Comet入力データ
// I〜M: システム計算指標（like_rate, save_rate, comment_rate, share_rate, engagement_rate）
// N: システムAI分析
// O: メモ（予約）
export interface EnhancedSheetRowData extends CometSheetRowData, CalculatedMetrics {
  system_analysis: string; // N列: システムAI分析
  memo: string; // O列: メモ/タグ
}

// スプレッドシート読み込みリクエスト
export interface FetchFromSheetRequest {
  source_spreadsheet_id: string; // 読み込み元のスプレッドシートID
  source_sheet_name: string; // 読み込み元のシート名
  target_spreadsheet_id?: string; // 書き込み先のスプレッドシートID（省略時は同じ）
  target_sheet_name?: string; // 書き込み先のシート名（省略時は同じ）
}
