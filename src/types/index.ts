// TikTok動画データの型定義
export interface TikTokVideoData {
  video_url: string;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
}

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
export interface SheetRowData extends TikTokVideoData, CalculatedMetrics {
  date: string; // 取得日時
  analysis: string; // AI分析結果
  memo: string; // メモ/タグ
}

// 処理結果
export interface ProcessResult {
  success: boolean;
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

// アプリケーション設定
export interface AppConfig {
  sheets: SheetsConfig;
  column_mapping: ColumnMapping;
  google_credentials?: string; // OAuth認証情報（JSON文字列）
}
