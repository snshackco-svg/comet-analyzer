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
