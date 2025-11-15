import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseCSV } from '../lib/csv-parser';
import { processVideoData } from '../lib/processor';
import { AppConfig, Platform } from '../types';
import { getPlatformSheetName, getPlatformColumnMapping } from '../lib/platform-config';

type Bindings = {
  AI?: any; // Cloudflare AI binding (optional)
  SPREADSHEET_ID?: string; // Google Spreadsheet ID from environment
  GOOGLE_CREDENTIALS?: string; // Google service account credentials from environment
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

    // 環境変数から設定を取得（優先）、フォールバックでリクエストから取得
    const spreadsheetId = c.env?.SPREADSHEET_ID || config.sheets?.spreadsheet_id;
    const googleCredentialsStr = c.env?.GOOGLE_CREDENTIALS || config.google_credentials;

    if (!spreadsheetId) {
      return c.json(
        { success: false, error: 'スプレッドシートIDが設定されていません' },
        400
      );
    }

    if (!googleCredentialsStr) {
      return c.json(
        { success: false, error: 'Google認証情報が設定されていません' },
        400
      );
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(googleCredentialsStr);
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

    // シート設定を作成（環境変数優先）
    const sheetsConfig = {
      spreadsheet_id: spreadsheetId,
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
 * GET /api/download
 * スプレッドシートデータをCSVとしてダウンロード
 */
api.get('/download', async (c) => {
  try {
    // クエリパラメータから取得
    const platform = c.req.query('platform') as Platform | 'all' | undefined;
    
    // 環境変数から設定を取得
    const spreadsheetId = c.env?.SPREADSHEET_ID;
    const googleCredentialsStr = c.env?.GOOGLE_CREDENTIALS;

    if (!spreadsheetId || !googleCredentialsStr) {
      return c.json(
        { success: false, error: '環境変数が設定されていません' },
        400
      );
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(googleCredentialsStr);
    } catch (error) {
      return c.json(
        { success: false, error: 'Google認証情報のパースに失敗しました' },
        400
      );
    }

    // シート設定（統一シート名）
    const sheetsConfig = {
      spreadsheet_id: spreadsheetId,
      sheet_name: '動画データ',
    };

    // データ取得用の関数をインポート
    const { getAllSheetData } = await import('../lib/sheets-manager');
    const allData = await getAllSheetData(googleCredentials, sheetsConfig);

    if (allData.length === 0) {
      return c.json({ success: false, error: 'データが見つかりません' }, 404);
    }

    // フィルタリング
    let filteredData = allData;
    if (platform && platform !== 'all') {
      const platformName = platform === 'tiktok' ? 'TikTok' : 'Instagram';
      // ヘッダー行を保持し、データ行をフィルタリング
      filteredData = [
        allData[0], // ヘッダー行
        ...allData.slice(1).filter(row => row[0] === platformName)
      ];
    }

    // CSV形式に変換
    const csvContent = filteredData
      .map(row => row.map(cell => {
        // カンマやダブルクォートを含むセルをエスケープ
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
      .join('\n');

    // BOMを追加（Excel対応）
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // ファイル名を生成
    const timestamp = new Date().toISOString().split('T')[0];
    const platformSuffix = platform && platform !== 'all' ? `_${platform}` : '';
    const filename = `comet_analyzer${platformSuffix}_${timestamp}.csv`;

    return new Response(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('CSV Download Error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'ダウンロード中にエラーが発生しました',
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
