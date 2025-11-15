import Papa from 'papaparse';
import { VideoData, ColumnMapping } from '../types';

/**
 * デフォルトのカラムマッピング設定
 */
export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  video_url: 'video_url',
  views: 'views',
  likes: 'likes',
  saves: 'saves',
  comments: 'comments',
  shares: 'shares',
};

/**
 * よくある別名カラムを自動検出してマッピング
 */
function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...DEFAULT_COLUMN_MAPPING };

  // 小文字に変換して比較
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // video_url の別名を検出
  const urlVariants = ['url', 'link', 'video_link', 'videourl', 'video url'];
  for (const variant of urlVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.video_url = headers[idx];
      break;
    }
  }

  // views の別名を検出
  const viewsVariants = ['view', 'viewcount', 'view_count', 'play', 'playcount'];
  for (const variant of viewsVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.views = headers[idx];
      break;
    }
  }

  // likes の別名を検出
  const likesVariants = ['like', 'likecount', 'like_count', 'favorite', 'favoritecount'];
  for (const variant of likesVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.likes = headers[idx];
      break;
    }
  }

  // saves の別名を検出
  const savesVariants = ['save', 'savecount', 'save_count', 'collect', 'collection'];
  for (const variant of savesVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.saves = headers[idx];
      break;
    }
  }

  // comments の別名を検出
  const commentsVariants = ['comment', 'commentcount', 'comment_count'];
  for (const variant of commentsVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.comments = headers[idx];
      break;
    }
  }

  // shares の別名を検出
  const sharesVariants = ['share', 'sharecount', 'share_count', 'forward'];
  for (const variant of sharesVariants) {
    const idx = lowerHeaders.findIndex((h) => h.includes(variant));
    if (idx >= 0) {
      mapping.shares = headers[idx];
      break;
    }
  }

  return mapping;
}

/**
 * 文字列を数値に変換（カンマ除去などの処理を含む）
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;

  // カンマや空白を除去
  const cleaned = value.replace(/[,\s]/g, '');

  // K, M などの単位を処理
  if (cleaned.toLowerCase().endsWith('k')) {
    return parseFloat(cleaned.slice(0, -1)) * 1000;
  }
  if (cleaned.toLowerCase().endsWith('m')) {
    return parseFloat(cleaned.slice(0, -1)) * 1000000;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * CSVファイルをパースしてVideoDataの配列に変換
 */
export async function parseCSV(
  fileContent: string,
  customMapping?: Partial<ColumnMapping>
): Promise<{ data: VideoData[]; errors: string[]; mapping: ColumnMapping }> {
  const errors: string[] = [];

  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];

        // カラムマッピングを決定（カスタム > 自動検出 > デフォルト）
        let mapping = detectColumnMapping(headers);
        if (customMapping) {
          mapping = { ...mapping, ...customMapping };
        }

        const videoData: VideoData[] = [];

        results.data.forEach((row: any, index: number) => {
          try {
            // 必須フィールドのチェック
            const videoUrl = row[mapping.video_url];
            if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
              errors.push(`行${index + 2}: 動画URLが見つかりません`);
              return;
            }

            // データを抽出
            const data: VideoData = {
              video_url: videoUrl.trim(),
              views: parseNumber(row[mapping.views]),
              likes: parseNumber(row[mapping.likes]),
              saves: parseNumber(row[mapping.saves]),
              comments: parseNumber(row[mapping.comments]),
              shares: parseNumber(row[mapping.shares]),
            };

            videoData.push(data);
          } catch (error) {
            errors.push(`行${index + 2}: データ解析エラー - ${error}`);
          }
        });

        resolve({ data: videoData, errors, mapping });
      },
      error: (error) => {
        errors.push(`CSVパースエラー: ${error.message}`);
        resolve({ data: [], errors, mapping: DEFAULT_COLUMN_MAPPING });
      },
    });
  });
}

/**
 * ファイルをテキストとして読み込む（ブラウザ用）
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(new Error('ファイル読み込みエラー'));
    reader.readAsText(file, 'utf-8');
  });
}
