import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseCSV } from '../lib/csv-parser';
import { processVideoData } from '../lib/processor';
import { AppConfig, Platform } from '../types';
import { getPlatformSheetName, getPlatformColumnMapping } from '../lib/platform-config';

type Bindings = {
  AI?: any; // Cloudflare AI binding (optional)
};

const api = new Hono<{ Bindings: Bindings }>();

// CORS設定
api.use('/*', cors());

/**
 * POST /api/process
 * CSVファイルを受け取り、処理してスプレッドシートに保存
 */
api.post('/process', async (c) => {
  try {
    const body = await c.req.parseBody();

    // CSVファイルを取得
    const csvFile = body['csv_file'];
    if (!csvFile || typeof csvFile === 'string') {
      return c.json({ success: false, error: 'CSVファイルが見つかりません' }, 400);
    }

    // 設定を取得
    const configStr = body['config'] as string;
    if (!configStr) {
      return c.json({ success: false, error: '設定が見つかりません' }, 400);
    }

    let config: AppConfig;
    try {
      config = JSON.parse(configStr);
    } catch (error) {
      return c.json({ success: false, error: '設定のパースに失敗しました' }, 400);
    }

    // プラットフォームの検証
    const platform: Platform = config.platform || 'tiktok'; // デフォルトはTikTok（後方互換性）
    if (platform !== 'tiktok' && platform !== 'instagram') {
      return c.json(
        { success: false, error: '無効なプラットフォームが指定されました' },
        400
      );
    }

    // Google認証情報の検証
    if (!config.google_credentials) {
      return c.json(
        { success: false, error: 'Google認証情報が設定されていません' },
        400
      );
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(config.google_credentials);
    } catch (error) {
      return c.json(
        { success: false, error: 'Google認証情報のパースに失敗しました' },
        400
      );
    }

    // CSVファイルを読み込み
    const file = csvFile as File;
    const csvContent = await file.text();

    // プラットフォーム固有のシート名とカラムマッピングを取得
    const sheetName = getPlatformSheetName(platform);
    const defaultMapping = getPlatformColumnMapping(platform);
    const columnMapping = config.column_mapping || defaultMapping;

    // CSVをパース
    const { data: videoData, errors: parseErrors, mapping } = await parseCSV(
      csvContent,
      columnMapping
    );

    if (videoData.length === 0) {
      return c.json(
        {
          success: false,
          error: 'CSVから有効なデータを読み込めませんでした',
          parse_errors: parseErrors,
        },
        400
      );
    }

    // シート設定を作成
    const sheetsConfig = {
      spreadsheet_id: config.sheets.spreadsheet_id,
      sheet_name: sheetName,
    };

    // データを処理してスプレッドシートに保存
    const result = await processVideoData(
      platform,
      videoData,
      sheetsConfig,
      googleCredentials,
      c.env?.AI // Cloudflare AI binding
    );

    // パースエラーも結果に含める
    if (parseErrors.length > 0) {
      result.errors = [...result.errors, ...parseErrors];
      result.logs.push(`CSVパース時に${parseErrors.length}件のエラーがありました`);
    }

    return c.json({
      success: result.success,
      result: result,
      column_mapping: mapping,
      platform: platform,
    });
  } catch (error: any) {
    console.error('API処理エラー:', error);
    return c.json(
      {
        success: false,
        error: error.message || '処理中にエラーが発生しました',
      },
      500
    );
  }
});

/**
 * GET /api/health
 * ヘルスチェック
 */
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default api;
