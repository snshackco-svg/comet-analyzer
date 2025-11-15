import { VideoData, SheetRowData, ProcessResult, SheetsConfig, Platform } from '../types';
import { calculateMetrics } from './metrics';
import { generateAnalysis } from './ai-analyzer';
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
  ai?: any // Cloudflare AI binding (optional)
): Promise<ProcessResult> {
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
    for (let i = 0; i < newVideoData.length; i++) {
      const data = newVideoData[i];

      try {
        // 指標計算
        const metrics = calculateMetrics(data);

        // AI分析生成（必須）
        result.logs.push(`【${platformName}】AI分析生成中 (${i + 1}/${newVideoData.length})...`);
        const analysis = await generateAnalysis(platform, data, metrics, ai);

        // シート行データを作成
        const rowData: SheetRowData = {
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

        processedRows.push(rowData);
      } catch (error: any) {
        result.error_count++;
        result.errors.push(`【${platformName}】動画 ${data.video_url} の処理エラー: ${error.message}`);
        result.logs.push(`【${platformName}】⚠️ エラー: ${data.video_url}`);
      }
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
