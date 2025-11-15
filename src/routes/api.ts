import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseCSV } from '../lib/csv-parser';
import { processVideoData } from '../lib/processor';
import { AppConfig } from '../types';

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

    // CSVをパース
    const { data: videoData, errors: parseErrors, mapping } = await parseCSV(
      csvContent,
      config.column_mapping
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

    // データを処理してスプレッドシートに保存
    const result = await processVideoData(
      videoData,
      config.sheets,
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
