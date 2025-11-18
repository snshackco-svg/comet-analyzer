// プラットフォーム種別
export type Platform = 'tiktok' | 'instagram';

// 動画データの型定義（TikTok/Instagram共通）
export interface VideoData {
  video_url: string;        // 動画ファイルのURL（分析用）
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  // メタデータ（オプション）- Vision APIでの詳細分析に使用
  caption?: string;         // 動画の説明文・キャプション
  author_name?: string;     // 投稿者の表示名
  author_username?: string; // 投稿者のユーザー名/ID
  tiktok_web_url?: string;  // TikTokのWebページURL（スプレッドシート保存用）
  instagram_web_url?: string; // InstagramのWebページURL（スプレッドシート保存用）
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
  videoUrl?: string; // shouldDownloadVideos: false の場合の動画URL（存在しない場合あり）
  webVideoUrl: string; // TikTokページURL
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
  // shouldDownloadVideos: true の場合、Apifyストレージに保存される
  // ダウンロードされた動画ファイルへの参照
  videoMeta?: {
    downloadUrl?: string; // Apifyストレージの動画URL
    [key: string]: any;
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

// ハイブリッド分析モードの判定基準
export interface HybridCriteria {
  mode: 'vision_all' | 'hybrid_strict' | 'hybrid_balanced' | 'hybrid_generous' | 'custom' | 'text_all';
  
  // Tier 1: 超重要動画（いずれか1つ満たせばVision API使用）
  tier1: {
    views?: number;           // 再生数
    saveRate?: number;        // 保存率（%単位: 2.0 = 2%）
    engagementRate?: number;  // エンゲージメント率（%単位）
    likes?: number;           // いいね数
    commentRate?: number;     // コメント率（%単位）
  };
  
  // Tier 2: 重要動画（minConditions個以上満たせばVision API使用）
  tier2: {
    minConditions: number;    // 最低満たすべき条件数（デフォルト2）
    views?: number;           // 再生数
    saveRate?: number;        // 保存率（%単位）
    likeRate?: number;        // いいね率（%単位）
    commentRate?: number;     // コメント率（%単位）
    engagementRate?: number;  // エンゲージメント率（%単位）
  };
}

// ハイブリッド分析の統計情報
export interface HybridStats {
  total: number;           // 総動画数
  visionCount: number;     // Vision API使用数
  textCount: number;       // GPT-4o Text使用数
  cloudflareCount: number; // Cloudflare AI使用数
  visionCost: number;      // Vision APIコスト
  textCost: number;        // GPT-4o Textコスト
  totalCost: number;       // 合計コスト
}
