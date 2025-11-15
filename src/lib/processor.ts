import { TikTokVideoData, SheetRowData, ProcessResult, SheetsConfig } from '../types';
import { calculateMetrics } from './metrics';
import { generateAnalysis, generateSimpleAnalysis } from './ai-analyzer';
import {
  ensureSheetExists,
  getExistingVideoUrls,
  appendRowsToSheet,
} from './sheets-manager';

/**
 * データ処理のメイン関数
 */
export async function processVideoData(
  videoData: TikTokVideoData[],
  config: SheetsConfig,
  googleCredentials: any,
  ai?: any // Cloudflare AI binding (optional)
): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: false,
    total_count: videoData.length,
    new_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    logs: [],
  };

  try {
    result.logs.push('Google Sheets API接続を準備中...');

    result.logs.push('シートの存在確認とヘッダー行の追加...');
    await ensureSheetExists(googleCredentials, config);

    result.logs.push('既存データの重複チェック...');
    const existingUrls = await getExistingVideoUrls(googleCredentials, config);
    result.logs.push(`既存の動画数: ${existingUrls.size}件`);

    // 新規データのみをフィルタリング
    const newVideoData = videoData.filter((data) => {
      if (existingUrls.has(data.video_url.trim())) {
        result.skipped_count++;
        return false;
      }
      return true;
    });

    result.logs.push(`新規追加対象: ${newVideoData.length}件`);

    if (newVideoData.length === 0) {
      result.logs.push('新規追加するデータがありません');
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

    result.logs.push('データ分析を開始...');
    for (let i = 0; i < newVideoData.length; i++) {
      const data = newVideoData[i];

      try {
        // 指標計算
        const metrics = calculateMetrics(data);

        // AI分析生成（利用可能な場合）
        let analysis: string;
        if (ai) {
          result.logs.push(`AI分析生成中 (${i + 1}/${newVideoData.length})...`);
          analysis = await generateAnalysis(data, metrics, ai);
        } else {
          result.logs.push(`簡易分析生成中 (${i + 1}/${newVideoData.length})...`);
          analysis = generateSimpleAnalysis(data, metrics);
        }

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
        result.errors.push(`動画 ${data.video_url} の処理エラー: ${error.message}`);
        result.logs.push(`⚠️ エラー: ${data.video_url}`);
      }
    }

    // スプレッドシートに追加
    if (processedRows.length > 0) {
      result.logs.push(`スプレッドシートに${processedRows.length}件のデータを追加中...`);
      const addedCount = await appendRowsToSheet(googleCredentials, config, processedRows);
      result.new_count = addedCount;
      result.logs.push(`✅ ${addedCount}件のデータを追加しました`);
    }

    result.success = true;
    result.logs.push('処理が正常に完了しました');
  } catch (error: any) {
    result.success = false;
    result.errors.push(`致命的エラー: ${error.message}`);
    result.logs.push(`❌ エラー: ${error.message}`);
    console.error('処理エラー:', error);
  }

  return result;
}
