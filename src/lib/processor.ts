import { VideoData, SheetRowData, ProcessResult, SheetsConfig, Platform, HybridCriteria } from '../types';
import { calculateMetrics } from './metrics';
import { generateAnalysis, generateAnalysisWithGPT4o } from './ai-analyzer';
import { generateAnalysisWithGeminiVideo } from './gemini-analyzer';
import { analyzeWithTwelveLabs } from './twelvelabs-analyzer';
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
  openaiApiKey?: string, // OpenAI API key (optional) - for GPT-4o text analysis
  geminiApiKey?: string, // Gemini API key (optional) - for video analysis
  twelveLabsApiKey?: string, // Twelve Labs API key (optional) - for video analysis
  hybridCriteria?: HybridCriteria, // ハイブリッド判定基準（省略時はデフォルト）
  stopOnVideoAnalysisFailure: boolean = true // 動画分析失敗時に処理を停止するか（デフォルト: true）
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
    // WebページURL（tiktok_web_url / instagram_web_url）があればそれを、なければvideo_urlを使用
    const newVideoData = videoData.filter((data) => {
      const urlToCheck = (data as any).tiktok_web_url || (data as any).instagram_web_url || data.video_url;
      if (existingUrls.has(urlToCheck.trim())) {
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
    
    // ハイブリッドモードではVision/Text混在のため、最も安全なバッチサイズ1を使用
    // Vision API: 1動画=約3リクエスト、Text: 1動画=約2リクエスト
    // 20件まで対応: 20動画 × 2.5リクエスト平均 = 50リクエスト（上限ギリギリ）
    const BATCH_SIZE = 1;
    for (let batchStart = 0; batchStart < newVideoData.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, newVideoData.length);
      const batch = newVideoData.slice(batchStart, batchEnd);
      
      result.logs.push(`【${platformName}】AI分析生成中 (${batchStart + 1}-${batchEnd}/${newVideoData.length})...`);
      
      // バッチ内のデータを並列処理
      const batchResults = await Promise.allSettled(
        batch.map(async (data) => {
          const metrics = calculateMetrics(data);
          
          // ハイブリッド判定: どの分析方法を使うか決定
          // Twelve Labs APIキーがある場合は動画分析可能（優先）
          const hasVideoAnalysis = !!twelveLabsApiKey || !!geminiApiKey;
          const method = determineAnalysisMethod(data, metrics, criteria, hasVideoAnalysis);
          const reason = getAnalysisReason(data, metrics, criteria, method);
          
          // 判定結果に基づいてAI分析を実行
          let analysis: string;
          if (method === 'vision') {
            // 動画分析: Twelve Labs（失敗時は処理停止）
            if (twelveLabsApiKey) {
              // Twelve Labs APIで動画分析（失敗時はエラーを投げる）
              analysis = await analyzeWithTwelveLabs(data.video_url, platform, data, metrics, twelveLabsApiKey);
            } else if (geminiApiKey) {
              // Gemini Video API（失敗時はエラーを投げる）
              analysis = await generateAnalysisWithGeminiVideo(platform, data, metrics, geminiApiKey);
            } else {
              // 動画分析APIが設定されていない場合はエラー
              throw new Error('動画分析APIキー（TWELVE_LABS_API_KEY または GEMINI_API_KEY）が設定されていません');
            }
          } else if (method === 'text' && openaiApiKey) {
            // GPT-4o Text: 説明文のみ分析
            analysis = await generateAnalysisWithGPT4o(platform, data, metrics, openaiApiKey);
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
      let shouldStop = false;
      batchResults.forEach((batchResult, index) => {
        const data = batch[index];
        if (batchResult.status === 'fulfilled') {
          processedRows.push(batchResult.value);
        } else {
          result.error_count++;
          const errorMessage = batchResult.reason?.message || '不明なエラー';
          
          // 動画分析失敗の場合は特別な警告
          if (errorMessage.includes('Twelve Labs') || errorMessage.includes('Gemini') || errorMessage.includes('動画分析')) {
            result.errors.push(`【${platformName}】❌ 動画分析失敗: ${data.video_url}\n理由: ${errorMessage}\n\n⚠️ 動画の映像分析ができませんでした。APIキーと設定を確認してください。`);
            result.logs.push(`【${platformName}】❌ 動画分析失敗: ${errorMessage}`);
            
            // 動画分析失敗時に処理停止フラグが有効なら、処理を中断
            if (stopOnVideoAnalysisFailure) {
              shouldStop = true;
              result.logs.push(`【${platformName}】⚠️ 動画分析が必須のため、処理を中断します`);
            }
          } else {
            result.errors.push(`【${platformName}】動画 ${data.video_url} の処理エラー: ${errorMessage}`);
            result.logs.push(`【${platformName}】⚠️ エラー: ${data.video_url}`);
          }
        }
      });
      
      // 動画分析失敗で停止フラグが立った場合は処理中断
      if (shouldStop) {
        break;
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
