/**
 * スプレッドシート読み込み処理
 * Cometが入力したデータを読み込み、指標計算とAI分析を追加
 */

import type {
  Platform,
  CometSheetRowData,
  EnhancedSheetRowData,
  CalculatedMetrics,
  SheetsConfig,
  ProcessResult,
} from '../types';
import { calculateMetrics } from './metrics';
import { generateAnalysis, generateAnalysisWithGPT4o } from './ai-analyzer';
import { generateAnalysisWithGeminiVideo } from './gemini-analyzer';
import { determineAnalysisMethod, getAnalysisReason, DEFAULT_HYBRID_CRITERIA } from './hybrid-analyzer';
import { getAllSheetData, updateRowsInSheet } from './sheets-manager';
import { debugLog, errorLog, PerformanceTimer } from './debug';

/**
 * スプレッドシートからCometデータを読み込み
 */
export async function readCometDataFromSheet(
  credentials: any,
  config: SheetsConfig
): Promise<CometSheetRowData[]> {
  const location = 'sheet-reader/readCometDataFromSheet';
  debugLog(location, 'Reading Comet data from sheet', config);

  try {
    const allData = await getAllSheetData(credentials, config);

    if (allData.length === 0) {
      debugLog(location, 'No data found in sheet');
      return [];
    }

    // ヘッダー行を除外
    const dataRows = allData.slice(1);

    // Cometデータに変換（A〜H列のみ）
    const cometData: CometSheetRowData[] = dataRows
      .filter((row) => row.length >= 8) // 最低8列必要（A〜H）
      .map((row) => ({
        platform: String(row[0] || '').trim(),
        comet_date: String(row[1] || '').trim(),
        video_url: String(row[2] || '').trim(),
        views: parseFloat(String(row[3] || '0')) || 0,
        likes: parseFloat(String(row[4] || '0')) || 0,
        saves: parseFloat(String(row[5] || '0')) || 0,
        comments: parseFloat(String(row[6] || '0')) || 0,
        shares: parseFloat(String(row[7] || '0')) || 0,
      }))
      .filter((data) => data.video_url !== ''); // URLが空の行は除外

    debugLog(location, `Read ${cometData.length} Comet data rows`);

    return cometData;
  } catch (error: any) {
    errorLog(location, 'Failed to read Comet data from sheet', error);
    throw error;
  }
}

/**
 * スプレッドシートの既存データをチェック（J列以降があるか）
 */
export async function checkProcessedRows(
  credentials: any,
  config: SheetsConfig
): Promise<Set<string>> {
  const location = 'sheet-reader/checkProcessedRows';
  debugLog(location, 'Checking processed rows');

  try {
    const allData = await getAllSheetData(credentials, config);

    if (allData.length === 0) {
      return new Set();
    }

    // ヘッダー行を除外
    const dataRows = allData.slice(1);

    // J列（いいね率）が存在する行のURLを記録
    const processedUrls = new Set<string>();

    dataRows.forEach((row) => {
      if (row.length >= 9 && row[8] !== undefined && row[8] !== '') {
        // I列（インデックス8・いいね率）に値がある = 処理済み
        const url = String(row[2] || '').trim(); // C列（動画URL）
        if (url) {
          processedUrls.add(url);
        }
      }
    });

    debugLog(location, `Found ${processedUrls.size} processed rows`);

    return processedUrls;
  } catch (error: any) {
    errorLog(location, 'Failed to check processed rows', error);
    return new Set();
  }
}

/**
 * CometデータにAI分析と指標を追加
 */
export async function enhanceCometData(
  cometData: CometSheetRowData[],
  platform: Platform,
  ai: any,
  openaiApiKey?: string,
  geminiApiKey?: string,
  hybridCriteria?: import('../types').HybridCriteria
): Promise<EnhancedSheetRowData[]> {
  // ハイブリッド基準のデフォルト設定
  const criteria = hybridCriteria || DEFAULT_HYBRID_CRITERIA;
  const location = 'sheet-reader/enhanceCometData';
  debugLog(location, `Enhancing ${cometData.length} rows with AI analysis`);

  const enhancedData: EnhancedSheetRowData[] = [];

  for (const data of cometData) {
    try {
      // 指標計算
      const metrics: CalculatedMetrics = calculateMetrics({
        video_url: data.video_url,
        views: data.views,
        likes: data.likes,
        saves: data.saves,
        comments: data.comments,
        shares: data.shares,
      });

      // AI分析生成（Cometの分析とは別）- ハイブリッド判定を使用
      let systemAnalysis = '';
      if (openaiApiKey || ai) {
        try {
          const videoData = {
            video_url: data.video_url,
            views: data.views,
            likes: data.likes,
            saves: data.saves,
            comments: data.comments,
            shares: data.shares,
          };

          // ハイブリッド判定: どの分析方法を使うか決定
          const hasVideoAnalysis = !!geminiApiKey;
          const method = determineAnalysisMethod(videoData, metrics, criteria, hasVideoAnalysis);
          const reason = getAnalysisReason(videoData, metrics, criteria, method);

          // 判定結果に基づいてAI分析を実行
          if (method === 'vision' && geminiApiKey) {
            // Gemini Video API: 実際の動画を分析
            try {
              systemAnalysis = await generateAnalysisWithGeminiVideo(
                platform,
                videoData,
                metrics,
                geminiApiKey
              );
            } catch (error: any) {
              console.error('[Hybrid] Gemini video analysis failed, falling back to GPT-4o text:', error.message);
              // Gemini失敗時はGPT-4oテキスト分析にフォールバック
              if (openaiApiKey) {
                systemAnalysis = await generateAnalysisWithGPT4o(
                  platform,
                  videoData,
                  metrics,
                  openaiApiKey
                );
              } else {
                systemAnalysis = await generateAnalysis(
                  platform,
                  videoData,
                  metrics,
                  ai
                );
              }
            }
          } else if (method === 'text' && openaiApiKey) {
            // GPT-4o Text: 説明文のみ分析
            systemAnalysis = await generateAnalysisWithGPT4o(
              platform,
              videoData,
              metrics,
              openaiApiKey
            );
          } else {
            // Cloudflare AI: フォールバック
            systemAnalysis = await generateAnalysis(
              platform,
              videoData,
              metrics,
              ai
            );
          }

          // デバッグログ（判定理由を記録）
          console.log(`[Hybrid] ${data.video_url} → ${method} (${reason})`);
        } catch (error: any) {
          errorLog(location, `AI analysis failed for ${data.video_url}`, error);
          systemAnalysis = '[AI分析に失敗しました]';
        }
      } else {
        systemAnalysis = '[AI未設定]';
      }

      enhancedData.push({
        ...data,
        ...metrics,
        system_analysis: systemAnalysis,
        memo: '', // O列: メモ欄（空欄）
      });
    } catch (error: any) {
      errorLog(location, `Failed to enhance data for ${data.video_url}`, error);
    }
  }

  debugLog(location, `Enhanced ${enhancedData.length} rows`);

  return enhancedData;
}

/**
 * スプレッドシートを更新（I〜O列を追加）
 */
export async function updateSheetWithEnhancedData(
  credentials: any,
  config: SheetsConfig,
  enhancedData: EnhancedSheetRowData[]
): Promise<number> {
  const location = 'sheet-reader/updateSheetWithEnhancedData';
  debugLog(location, `Updating sheet with ${enhancedData.length} rows`);

  try {
    // まず全データを取得して行番号を特定
    const allData = await getAllSheetData(credentials, config);
    const dataRows = allData.slice(1); // ヘッダー除外

    // URLと行番号のマップを作成
    const urlToRowIndex = new Map<string, number>();
    dataRows.forEach((row, index) => {
      const url = String(row[2] || '').trim(); // C列
      if (url) {
        urlToRowIndex.set(url, index + 2); // +2 = ヘッダー(1行目) + インデックス0始まり
      }
    });

    // 更新データを準備
    const updates: { range: string; values: any[][] }[] = [];

    enhancedData.forEach((data) => {
      const rowIndex = urlToRowIndex.get(data.video_url);
      if (rowIndex) {
        // I〜O列を更新
        updates.push({
          range: `${config.sheet_name}!I${rowIndex}:O${rowIndex}`,
          values: [
            [
              data.like_rate, // I列
              data.save_rate, // J列
              data.comment_rate, // K列
              data.share_rate, // L列
              data.engagement_rate, // M列
              data.system_analysis, // N列
              data.memo, // O列
            ],
          ],
        });
      }
    });

    // 一括更新
    if (updates.length > 0) {
      await updateRowsInSheet(credentials, config, updates);
    }

    debugLog(location, `Updated ${updates.length} rows`);

    return updates.length;
  } catch (error: any) {
    errorLog(location, 'Failed to update sheet', error);
    throw error;
  }
}

/**
 * メイン処理: スプレッドシートからデータ読み込み → 処理 → 更新
 */
export async function processSheetData(
  credentials: any,
  sourceConfig: SheetsConfig,
  targetConfig: SheetsConfig,
  platform: Platform,
  ai: any,
  openaiApiKey?: string
): Promise<ProcessResult> {
  const location = 'sheet-reader/processSheetData';
  const timer = new PerformanceTimer(location);

  const result: ProcessResult = {
    success: false,
    platform,
    total_count: 0,
    new_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    logs: [],
  };

  try {
    // 1. Cometデータを読み込み
    result.logs.push('スプレッドシートからCometデータを読み込み中...');
    const cometData = await readCometDataFromSheet(credentials, sourceConfig);
    result.total_count = cometData.length;
    result.logs.push(`${cometData.length}件のデータを読み込みました`);

    if (cometData.length === 0) {
      result.logs.push('処理するデータがありません');
      result.success = true;
      return result;
    }

    // 2. 既に処理済みの行をチェック
    result.logs.push('処理済みデータをチェック中...');
    const processedUrls = await checkProcessedRows(credentials, targetConfig);
    result.logs.push(`${processedUrls.size}件が既に処理済みです`);

    // 3. 未処理のデータをフィルタ
    const unprocessedData = cometData.filter((data) => !processedUrls.has(data.video_url));
    result.skipped_count = cometData.length - unprocessedData.length;
    result.logs.push(`${unprocessedData.length}件の未処理データを処理します`);

    if (unprocessedData.length === 0) {
      result.logs.push('新しく処理するデータがありません');
      result.success = true;
      return result;
    }

    // 4. AI分析と指標計算
    result.logs.push('AI分析と指標計算を実行中...');
    const enhancedData = await enhanceCometData(unprocessedData, platform, ai, openaiApiKey);
    result.logs.push(`${enhancedData.length}件のデータを処理しました`);

    // 5. スプレッドシートを更新
    result.logs.push('スプレッドシートを更新中...');
    const updatedCount = await updateSheetWithEnhancedData(
      credentials,
      targetConfig,
      enhancedData
    );
    result.new_count = updatedCount;
    result.logs.push(`${updatedCount}件のデータを追加しました`);

    result.success = true;
    result.logs.push(`処理完了 (${timer.end()}ms)`);

    return result;
  } catch (error: any) {
    errorLog(location, 'Processing failed', error);
    result.errors.push(error.message);
    result.error_count = 1;
    return result;
  }
}
