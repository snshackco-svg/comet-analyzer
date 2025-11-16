import { VideoData, SheetRowData, ProcessResult, SheetsConfig, Platform, HybridCriteria } from '../types';
import { calculateMetrics } from './metrics';
import { generateAnalysis, generateAnalysisWithGPT4o, generateAnalysisWithVision } from './ai-analyzer';
import { determineAnalysisMethod, getAnalysisReason, DEFAULT_HYBRID_CRITERIA } from './hybrid-analyzer';
import {
  ensureSheetExists,
  getExistingVideoUrls,
  appendRowsToSheet,
} from './sheets-manager';
import { getPlatformDisplayName } from './platform-config';

/**
 * データ処理のメイン関数
 */
export async function processVideoData(
  platform: Platform,
  videoData: VideoData[],
  config: SheetsConfig,
  googleCredentials: any,
  ai?: any, // Cloudflare AI binding (optional)
  openaiApiKey?: string, // OpenAI API key (optional, prioritized over Cloudflare AI)
  hybridCriteria?: HybridCriteria // ハイブリッド判定基準（省略時はデフォルト）
): Promise<ProcessResult> {
  // ハイブリッド基準のデフォルト設定
  const criteria = hybridCriteria || DEFAULT_HYBRID_CRITERIA;
  const platformName = getPlatformDisplayName(platform);

  const result: ProcessResult = {
    success: false,
    platform: platform,
    total_count: videoData.length,
    new_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    logs: [],
  };

  try {
    result.logs.push(`【${platformName}】Google Sheets API接続を準備中...`);

    result.logs.push(`【${platformName}】シートの存在確認とヘッダー行の追加...`);
    await ensureSheetExists(googleCredentials, config);

    result.logs.push(`【${platformName}】既存データの重複チェック...`);
    const existingUrls = await getExistingVideoUrls(googleCredentials, config);
    result.logs.push(`【${platformName}】既存の動画数: ${existingUrls.size}件`);

    // 新規データのみをフィルタリング
    const newVideoData = videoData.filter((data) => {
      if (existingUrls.has(data.video_url.trim())) {
        result.skipped_count++;
        return false;
      }
      return true;
    });

    result.logs.push(`【${platformName}】新規追加対象: ${newVideoData.length}件`);

    if (newVideoData.length === 0) {
      result.logs.push(`【${platformName}】新規追加するデータがありません`);
      result.success = true;
      return result;
    }

    // 各動画データを処理
    const processedRows: SheetRowData[] = [];
    const now = new Date();
    const dateStr = now.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    result.logs.push(`【${platformName}】データ分析を開始...`);
    
    // Vision API使用時はバッチサイズを小さく（1動画=2-3リクエスト）
    // テキストのみの場合は3件、Vision使用時は2件
    const BATCH_SIZE = openaiApiKey ? 2 : 3;
    for (let batchStart = 0; batchStart < newVideoData.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, newVideoData.length);
      const batch = newVideoData.slice(batchStart, batchEnd);
      
      result.logs.push(`【${platformName}】AI分析生成中 (${batchStart + 1}-${batchEnd}/${newVideoData.length})...`);
      
      // バッチ内のデータを並列処理
      const batchResults = await Promise.allSettled(
        batch.map(async (data) => {
          const metrics = calculateMetrics(data);
          
          // ハイブリッド判定: どの分析方法を使うか決定
          const method = determineAnalysisMethod(data, metrics, criteria, !!openaiApiKey);
          const reason = getAnalysisReason(data, metrics, criteria, method);
          
          // 判定結果に基づいてAI分析を実行
          let analysis: string;
          if (method === 'vision') {
            // Vision API: 映像+説明文の総合分析
            analysis = await generateAnalysisWithVision(platform, data, metrics, openaiApiKey!);
          } else if (method === 'text') {
            // GPT-4o Text: 説明文のみ分析
            analysis = await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey!);
          } else {
            // Cloudflare AI: フォールバック
            analysis = await generateAnalysis(platform, data, metrics, ai);
          }
          
          // デバッグログ（判定理由を記録）
          console.log(`[Hybrid] ${data.video_url} → ${method} (${reason})`);
          
          const rowData: SheetRowData = {
            platform: platformName,
            date: dateStr,
            video_url: data.video_url,
            views: data.views,
            likes: data.likes,
            saves: data.saves,
            comments: data.comments,
            shares: data.shares,
            like_rate: metrics.like_rate,
            save_rate: metrics.save_rate,
            comment_rate: metrics.comment_rate,
            share_rate: metrics.share_rate,
            engagement_rate: metrics.engagement_rate,
            analysis: analysis,
            memo: '',
          };
          
          return rowData;
        })
      );
      
      // 結果を処理
      batchResults.forEach((batchResult, index) => {
        const data = batch[index];
        if (batchResult.status === 'fulfilled') {
          processedRows.push(batchResult.value);
        } else {
          result.error_count++;
          result.errors.push(`【${platformName}】動画 ${data.video_url} の処理エラー: ${batchResult.reason?.message || '不明なエラー'}`);
          result.logs.push(`【${platformName}】⚠️ エラー: ${data.video_url}`);
        }
      });
    }

    // スプレッドシートに追加
    if (processedRows.length > 0) {
      result.logs.push(`【${platformName}】スプレッドシートに${processedRows.length}件のデータを追加中...`);
      const addedCount = await appendRowsToSheet(googleCredentials, config, processedRows);
      result.new_count = addedCount;
      result.logs.push(`【${platformName}】✅ ${addedCount}件のデータを追加しました`);
    }

    result.success = true;
    result.logs.push(`【${platformName}】処理が正常に完了しました`);
  } catch (error: any) {
    result.success = false;
    result.errors.push(`【${platformName}】致命的エラー: ${error.message}`);
    result.logs.push(`【${platformName}】❌ エラー: ${error.message}`);
    console.error(`【${platformName}】処理エラー:`, error);
  }

  return result;
}
