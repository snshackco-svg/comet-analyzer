import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseCSV } from '../lib/csv-parser';
import { processVideoData } from '../lib/processor';
import { AppConfig, Platform, VideoData, FetchFromSheetRequest } from '../types';
import { getPlatformSheetName, getPlatformColumnMapping } from '../lib/platform-config';
import {
  debugLog,
  errorLog,
  createDetailedError,
  PerformanceTimer,
  validateSpreadsheetConfig,
  validateCSVData,
} from '../lib/debug';
import { fetchFromApify } from '../lib/apify-client';
import { processSheetData } from '../lib/sheet-reader';

type Bindings = {
  AI?: any; // Cloudflare AI binding (optional)
  SPREADSHEET_ID?: string; // Google Spreadsheet ID from environment
  GOOGLE_CREDENTIALS?: string; // Google service account credentials from environment
  APIFY_TOKEN?: string; // Apify API token from environment
  OPENAI_API_KEY?: string; // OpenAI API key for GPT-4o text analysis
  GEMINI_API_KEY?: string; // Gemini API key for video analysis
  TWELVE_LABS_API_KEY?: string; // Twelve Labs API key for video analysis
};

const api = new Hono<{ Bindings: Bindings }>();

// CORS設定
api.use('/*', cors());

/**
 * POST /api/process
 * CSVファイルを受け取り、処理してスプレッドシートに保存
 */
api.post('/process', async (c) => {
  const timer = new PerformanceTimer('API /process');

  try {
    debugLog('API /process', 'Request received');
    const body = await c.req.parseBody();

    // CSVファイルを取得
    const csvFile = body['csv_file'];
    if (!csvFile || typeof csvFile === 'string') {
      const error = createDetailedError(
        'API /process',
        new Error('CSVファイルが見つかりません'),
        { hasFile: !!csvFile, fileType: typeof csvFile }
      );
      errorLog('API /process', 'CSV file validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          debug: error,
        },
        400
      );
    }

    // 設定を取得
    const configStr = body['config'] as string;
    if (!configStr) {
      const error = createDetailedError(
        'API /process',
        new Error('設定が見つかりません'),
        { hasConfig: !!configStr }
      );
      errorLog('API /process', 'Config validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          debug: error,
        },
        400
      );
    }

    let config: AppConfig;
    try {
      config = JSON.parse(configStr);
      debugLog('API /process', 'Config parsed successfully', {
        platform: config.platform,
      });
    } catch (error) {
      const detailedError = createDetailedError(
        'API /process - Config Parse',
        error,
        { configStr: configStr.substring(0, 100) }
      );
      errorLog('API /process', 'Config parse failed', detailedError);
      return c.json(
        {
          success: false,
          error: detailedError.message,
          suggestion: detailedError.suggestion,
          debug: detailedError,
        },
        400
      );
    }

    // プラットフォームの検証
    const platform: Platform = config.platform || 'tiktok'; // デフォルトはTikTok（後方互換性）
    debugLog('API /process', 'Platform selected', { platform });

    if (platform !== 'tiktok' && platform !== 'instagram') {
      const error = createDetailedError(
        'API /process - Platform Validation',
        new Error('無効なプラットフォームが指定されました'),
        { platform, validPlatforms: ['tiktok', 'instagram'] }
      );
      errorLog('API /process', 'Invalid platform', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: 'プラットフォームは "tiktok" または "instagram" を指定してください。',
          debug: error,
        },
        400
      );
    }

    // 環境変数から設定を取得（優先）、フォールバックでリクエストから取得
    const spreadsheetId = c.env?.SPREADSHEET_ID || config.sheets?.spreadsheet_id;
    const googleCredentialsStr = c.env?.GOOGLE_CREDENTIALS || config.google_credentials;

    debugLog('API /process', 'Validating spreadsheet config', {
      hasSpreadsheetId: !!spreadsheetId,
      hasCredentials: !!googleCredentialsStr,
      usingEnvVar: !!c.env?.SPREADSHEET_ID,
    });

    // 設定のバリデーション
    const validation = validateSpreadsheetConfig(
      spreadsheetId,
      googleCredentialsStr
    );

    if (!validation.valid) {
      const error = createDetailedError(
        'API /process - Config Validation',
        new Error(validation.errors.join(', ')),
        {
          errors: validation.errors,
          warnings: validation.warnings,
        }
      );
      errorLog('API /process', 'Config validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          validation: validation,
          debug: error,
        },
        400
      );
    }

    // 警告があれば記録
    if (validation.warnings.length > 0) {
      debugLog('API /process', 'Config validation warnings', {
        warnings: validation.warnings,
      });
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(googleCredentialsStr!);
      debugLog('API /process', 'Google credentials parsed successfully');
    } catch (error) {
      const detailedError = createDetailedError(
        'API /process - Credentials Parse',
        error,
        {
          credentialsPreview: googleCredentialsStr?.substring(0, 50),
        }
      );
      errorLog('API /process', 'Credentials parse failed', detailedError);
      return c.json(
        {
          success: false,
          error: detailedError.message,
          suggestion: detailedError.suggestion,
          debug: detailedError,
        },
        400
      );
    }

    // CSVファイルを読み込み
    const file = csvFile as File;
    debugLog('API /process', 'Reading CSV file', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const csvContent = await file.text();
    debugLog('API /process', 'CSV content loaded', {
      contentLength: csvContent.length,
      firstLine: csvContent.split('\n')[0]?.substring(0, 100),
    });

    // プラットフォーム固有のシート名とカラムマッピングを取得
    const sheetName = getPlatformSheetName(platform);
    const defaultMapping = getPlatformColumnMapping(platform);
    const columnMapping = config.column_mapping || defaultMapping;

    debugLog('API /process', 'Sheet configuration', {
      sheetName,
      platform,
      columnMapping,
    });

    // CSVをパース
    const csvTimer = new PerformanceTimer('CSV Parse');
    const { data: videoData, errors: parseErrors, mapping } = await parseCSV(
      csvContent,
      columnMapping
    );
    csvTimer.end(`Parsed ${videoData.length} rows`);

    debugLog('API /process', 'CSV parsed', {
      dataCount: videoData.length,
      errorCount: parseErrors.length,
      mapping,
    });

    if (videoData.length === 0) {
      const error = createDetailedError(
        'API /process - CSV Parse',
        new Error('CSVから有効なデータを読み込めませんでした'),
        {
          parseErrors,
          fileInfo: {
            name: file.name,
            size: file.size,
            firstLine: csvContent.split('\n')[0],
          },
        }
      );
      errorLog('API /process', 'No data parsed from CSV', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion:
            'CSVファイルのフォーマットを確認してください。ヘッダー行と少なくとも1行のデータが必要です。',
          parse_errors: parseErrors,
          debug: error,
        },
        400
      );
    }

    // CSVデータのバリデーション
    const dataValidation = validateCSVData(videoData);
    if (!dataValidation.valid) {
      const error = createDetailedError(
        'API /process - Data Validation',
        new Error(dataValidation.errors.join(', ')),
        {
          validation: dataValidation,
          sampleData: videoData.slice(0, 2),
        }
      );
      errorLog('API /process', 'CSV data validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          validation: dataValidation,
          debug: error,
        },
        400
      );
    }

    if (dataValidation.warnings.length > 0) {
      debugLog('API /process', 'CSV data validation warnings', {
        warnings: dataValidation.warnings,
      });
    }

    // シート設定を作成（環境変数優先）
    const sheetsConfig = {
      spreadsheet_id: spreadsheetId!,
      sheet_name: sheetName,
    };

    debugLog('API /process', 'Starting data processing', {
      dataCount: videoData.length,
      platform,
      sheetName,
    });

    // データを処理してスプレッドシートに保存
    const processTimer = new PerformanceTimer('Data Processing');
    const result = await processVideoData(
      platform,
      videoData,
      sheetsConfig,
      googleCredentials,
      c.env?.AI, // Cloudflare AI binding
      c.env?.OPENAI_API_KEY, // OpenAI API key for GPT-4o text analysis
      c.env?.GEMINI_API_KEY, // Gemini API key for video analysis
      c.env?.TWELVE_LABS_API_KEY // Twelve Labs API key for video analysis
    );
    processTimer.end(
      `Processed ${result.new_count}/${result.total_count} items`
    );

    // パースエラーも結果に含める
    if (parseErrors.length > 0) {
      result.errors = [...result.errors, ...parseErrors];
      result.logs.push(`CSVパース時に${parseErrors.length}件のエラーがありました`);
    }

    timer.end('Request completed');

    return c.json({
      success: result.success,
      result: result,
      column_mapping: mapping,
      platform: platform,
      performance: {
        totalTime: timer.end(),
      },
    });
  } catch (error: any) {
    const detailedError = createDetailedError(
      'API /process - Unexpected Error',
      error,
      {
        stack: error?.stack,
      }
    );
    errorLog('API /process', 'Unexpected error', detailedError);

    return c.json(
      {
        success: false,
        error: detailedError.message,
        suggestion: detailedError.suggestion,
        debug: detailedError,
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
 * POST /api/fetch-apify
 * Apify経由でTikTok/Instagramのデータを自動取得して処理
 */
api.post('/fetch-apify', async (c) => {
  const timer = new PerformanceTimer('API /fetch-apify');

  try {
    debugLog('API /fetch-apify', 'Request received');
    const body = await c.req.json();

    // パラメータを取得
    const platform: Platform = body.platform || 'tiktok';
    const hashtags: string[] = body.hashtags || [];
    const resultsPerPage: number = body.results_per_page || 50;

    debugLog('API /fetch-apify', 'Request parameters', {
      platform,
      hashtags,
      resultsPerPage,
    });

    // パラメータ検証
    if (!hashtags || hashtags.length === 0) {
      const error = createDetailedError(
        'API /fetch-apify',
        new Error('ハッシュタグが指定されていません'),
        { hashtags }
      );
      errorLog('API /fetch-apify', 'Hashtag validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: '少なくとも1つのハッシュタグを指定してください。例: fyp, viral, trending',
          debug: error,
        },
        400
      );
    }

    // ハッシュタグの数を制限（コスト管理）
    if (hashtags.length > 10) {
      const error = createDetailedError(
        'API /fetch-apify',
        new Error(`ハッシュタグが多すぎます（${hashtags.length}件）`),
        { hashtags, limit: 10 }
      );
      errorLog('API /fetch-apify', 'Too many hashtags', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: 'ハッシュタグは最大10個までにしてください。',
          debug: error,
        },
        400
      );
    }

    // 取得件数のバリデーション
    if (resultsPerPage < 1 || resultsPerPage > 200) {
      const error = createDetailedError(
        'API /fetch-apify',
        new Error(`取得件数が範囲外です（${resultsPerPage}件）`),
        { resultsPerPage, allowedRange: '1-200' }
      );
      errorLog('API /fetch-apify', 'Invalid results count', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: '取得件数は1〜200件の範囲で指定してください。',
          debug: error,
        },
        400
      );
    }

    // 環境変数からApifyトークンを取得
    const apifyToken = c.env?.APIFY_TOKEN;
    if (!apifyToken) {
      const error = createDetailedError(
        'API /fetch-apify',
        new Error('Apify APIトークンが設定されていません'),
        { hasToken: !!apifyToken }
      );
      errorLog('API /fetch-apify', 'Apify token not found', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion:
            'Cloudflareダッシュボードで環境変数 APIFY_TOKEN を設定してください。Apifyのトークンは https://console.apify.com/account/integrations から取得できます。',
          debug: error,
        },
        500
      );
    }

    // Apifyトークンの形式検証（基本的なチェック）
    if (!apifyToken.startsWith('apify_api_')) {
      const error = createDetailedError(
        'API /fetch-apify',
        new Error('Apify APIトークンの形式が無効です'),
        { tokenPrefix: apifyToken.substring(0, 10) }
      );
      errorLog('API /fetch-apify', 'Invalid Apify token format', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion:
            'Apify APIトークンは "apify_api_" で始まる必要があります。Apifyダッシュボードで正しいトークンを確認してください。',
          debug: error,
        },
        400
      );
    }

    // Apifyからデータを取得
    const apifyTimer = new PerformanceTimer('Apify Fetch');
    const apifyResult = await fetchFromApify(
      platform,
      hashtags,
      resultsPerPage,
      apifyToken
    );
    apifyTimer.end(`Fetched ${apifyResult.videos.length} videos`);

    if (!apifyResult.success) {
      const error = createDetailedError(
        'API /fetch-apify - Apify Fetch',
        new Error(apifyResult.error || 'Apifyからのデータ取得に失敗しました'),
        apifyResult.debug
      );
      errorLog('API /fetch-apify', 'Apify fetch failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          debug: error,
        },
        500
      );
    }

    debugLog('API /fetch-apify', 'Apify data fetched successfully', {
      videoCount: apifyResult.videos.length,
    });

    // 環境変数から設定を取得
    const spreadsheetId = c.env?.SPREADSHEET_ID;
    const googleCredentialsStr = c.env?.GOOGLE_CREDENTIALS;

    debugLog('API /fetch-apify', 'Validating spreadsheet config', {
      hasSpreadsheetId: !!spreadsheetId,
      hasCredentials: !!googleCredentialsStr,
    });

    // 設定のバリデーション
    const validation = validateSpreadsheetConfig(
      spreadsheetId,
      googleCredentialsStr
    );

    if (!validation.valid) {
      const error = createDetailedError(
        'API /fetch-apify - Config Validation',
        new Error(validation.errors.join(', ')),
        {
          errors: validation.errors,
          warnings: validation.warnings,
        }
      );
      errorLog('API /fetch-apify', 'Config validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          validation: validation,
          debug: error,
        },
        400
      );
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(googleCredentialsStr!);
      debugLog('API /fetch-apify', 'Google credentials parsed successfully');
    } catch (error) {
      const detailedError = createDetailedError(
        'API /fetch-apify - Credentials Parse',
        error,
        {
          credentialsPreview: googleCredentialsStr?.substring(0, 50),
        }
      );
      errorLog('API /fetch-apify', 'Credentials parse failed', detailedError);
      return c.json(
        {
          success: false,
          error: detailedError.message,
          suggestion: detailedError.suggestion,
          debug: detailedError,
        },
        400
      );
    }

    // プラットフォーム固有のシート名を取得
    const sheetName = getPlatformSheetName(platform);

    debugLog('API /fetch-apify', 'Processing video data', {
      sheetName,
      platform,
      videoCount: apifyResult.videos.length,
    });

    // データを処理してスプレッドシートに保存
    const processTimer = new PerformanceTimer('Process & Save');
    const result = await processVideoData(
      platform,
      apifyResult.videos,
      {
        spreadsheet_id: spreadsheetId!,
        sheet_name: sheetName,
      },
      googleCredentials,
      c.env?.AI,
      c.env?.OPENAI_API_KEY, // OpenAI API key for GPT-4o text analysis
      c.env?.GEMINI_API_KEY, // Gemini API key for video analysis
      c.env?.TWELVE_LABS_API_KEY // Twelve Labs API key for video analysis
    );
    processTimer.end(`Processed ${result.total_count} videos`);

    debugLog('API /fetch-apify', 'Processing completed', result);

    const totalTime = timer.end();

    return c.json({
      success: result.success,
      result: {
        ...result,
        source: 'apify', // データソース識別用
      },
      performance: {
        totalTime,
      },
    });
  } catch (error: any) {
    const detailedError = createDetailedError(
      'API /fetch-apify',
      error,
      {
        stack: error.stack,
      }
    );
    errorLog('API /fetch-apify', 'Unexpected error', detailedError);

    return c.json(
      {
        success: false,
        error: detailedError.message,
        suggestion: detailedError.suggestion,
        debug: detailedError,
      },
      500
    );
  }
});

/**
 * POST /api/fetch-from-sheet
 * スプレッドシートからCometデータを読み込み、AI分析と指標を追加
 */
api.post('/fetch-from-sheet', async (c) => {
  const timer = new PerformanceTimer('API /fetch-from-sheet');

  try {
    debugLog('API /fetch-from-sheet', 'Request received');
    const body = await c.req.json<FetchFromSheetRequest>();

    // パラメータを取得
    const sourceSpreadsheetId = body.source_spreadsheet_id;
    const sourceSheetName = body.source_sheet_name || '動画データ';
    const targetSpreadsheetId = body.target_spreadsheet_id || sourceSpreadsheetId;
    const targetSheetName = body.target_sheet_name || sourceSheetName;

    debugLog('API /fetch-from-sheet', 'Request parameters', {
      sourceSpreadsheetId,
      sourceSheetName,
      targetSpreadsheetId,
      targetSheetName,
    });

    // パラメータ検証
    if (!sourceSpreadsheetId) {
      const error = createDetailedError(
        'API /fetch-from-sheet',
        new Error('スプレッドシートIDが指定されていません'),
        { sourceSpreadsheetId }
      );
      errorLog('API /fetch-from-sheet', 'Spreadsheet ID validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: '読み込み元のスプレッドシートIDを指定してください。',
          debug: error,
        },
        400
      );
    }

    // 環境変数から設定を取得
    const googleCredentialsStr = c.env?.GOOGLE_CREDENTIALS;

    debugLog('API /fetch-from-sheet', 'Validating credentials', {
      hasCredentials: !!googleCredentialsStr,
    });

    // 設定のバリデーション
    const validation = validateSpreadsheetConfig(
      sourceSpreadsheetId,
      googleCredentialsStr
    );

    if (!validation.valid) {
      const error = createDetailedError(
        'API /fetch-from-sheet - Config Validation',
        new Error(validation.errors.join(', ')),
        {
          errors: validation.errors,
          warnings: validation.warnings,
        }
      );
      errorLog('API /fetch-from-sheet', 'Config validation failed', error);
      return c.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          validation: validation,
          debug: error,
        },
        400
      );
    }

    let googleCredentials: any;
    try {
      googleCredentials = JSON.parse(googleCredentialsStr!);
      debugLog('API /fetch-from-sheet', 'Google credentials parsed successfully');
    } catch (error) {
      const detailedError = createDetailedError(
        'API /fetch-from-sheet - Credentials Parse',
        error,
        {
          credentialsPreview: googleCredentialsStr?.substring(0, 50),
        }
      );
      errorLog('API /fetch-from-sheet', 'Credentials parse failed', detailedError);
      return c.json(
        {
          success: false,
          error: detailedError.message,
          suggestion: detailedError.suggestion,
          debug: detailedError,
        },
        400
      );
    }

    // プラットフォームは最初の行から判定（後で実装）
    // とりあえずTikTokとして処理
    const platform: Platform = 'tiktok';

    debugLog('API /fetch-from-sheet', 'Processing sheet data', {
      sourceSpreadsheetId,
      sourceSheetName,
      platform,
    });

    // スプレッドシートからデータ読み込み → 処理 → 更新
    const processTimer = new PerformanceTimer('Process Sheet Data');
    const result = await processSheetData(
      googleCredentials,
      {
        spreadsheet_id: sourceSpreadsheetId,
        sheet_name: sourceSheetName,
      },
      {
        spreadsheet_id: targetSpreadsheetId,
        sheet_name: targetSheetName,
      },
      platform,
      c.env?.AI,
      c.env?.OPENAI_API_KEY, // OpenAI API key for GPT-4o text analysis
      c.env?.GEMINI_API_KEY // Gemini API key for video analysis
    );
    processTimer.end(`Processed ${result.total_count} rows`);

    debugLog('API /fetch-from-sheet', 'Processing completed', result);

    const totalTime = timer.end();

    return c.json({
      success: result.success,
      result: {
        ...result,
        source: 'sheet', // データソース識別用
      },
      performance: {
        totalTime,
      },
    });
  } catch (error: any) {
    const detailedError = createDetailedError(
      'API /fetch-from-sheet',
      error,
      {
        stack: error.stack,
      }
    );
    errorLog('API /fetch-from-sheet', 'Unexpected error', detailedError);

    return c.json(
      {
        success: false,
        error: detailedError.message,
        suggestion: detailedError.suggestion,
        debug: detailedError,
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
