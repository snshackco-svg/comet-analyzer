/**
 * デバッグ用ユーティリティ
 * 開発環境でのエラー追跡を容易にする
 */

export interface DebugInfo {
  timestamp: string;
  location: string;
  message: string;
  data?: any;
  error?: any;
}

/**
 * デバッグログを記録
 */
export function debugLog(location: string, message: string, data?: any): void {
  const info: DebugInfo = {
    timestamp: new Date().toISOString(),
    location,
    message,
    data,
  };

  console.log(`[DEBUG] [${info.location}] ${info.message}`, data || '');
}

/**
 * エラーログを記録（スタックトレース付き）
 */
export function errorLog(
  location: string,
  message: string,
  error: any,
  data?: any
): void {
  const info: DebugInfo = {
    timestamp: new Date().toISOString(),
    location,
    message,
    data,
    error: {
      name: error?.name || 'Unknown Error',
      message: error?.message || 'Unknown error occurred',
      stack: error?.stack || 'No stack trace available',
    },
  };

  console.error(`[ERROR] [${info.location}] ${info.message}`, {
    error: info.error,
    data: data || {},
  });
}

/**
 * 詳細なエラー情報を生成
 */
export function createDetailedError(
  location: string,
  error: any,
  context?: any
): {
  location: string;
  message: string;
  suggestion: string;
  details: string;
  timestamp: string;
} {
  // エラーメッセージから原因を推測
  const errorMessage = error?.message || String(error);
  let suggestion = '';

  // よくあるエラーパターンに対する解決策を提案
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    suggestion = '指定されたリソースが見つかりません。スプレッドシートIDやシート名を確認してください。';
  } else if (
    errorMessage.includes('permission') ||
    errorMessage.includes('403')
  ) {
    suggestion =
      'アクセス権限がありません。サービスアカウントにスプレッドシートの編集権限を付与してください。';
  } else if (
    errorMessage.includes('parse') ||
    errorMessage.includes('JSON')
  ) {
    suggestion = 'データの形式が正しくありません。JSONやCSVの形式を確認してください。';
  } else if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch')
  ) {
    suggestion =
      'ネットワークエラーが発生しました。インターネット接続を確認してください。';
  } else if (
    errorMessage.includes('token') ||
    errorMessage.includes('auth')
  ) {
    suggestion =
      '認証に失敗しました。Google認証情報が正しく設定されているか確認してください。';
  } else if (errorMessage.includes('AI') || errorMessage.includes('analysis')) {
    suggestion =
      'AI分析に失敗しました。Cloudflare Workers AIが有効になっているか確認してください。';
  } else {
    suggestion =
      'エラーの詳細を確認し、ログを参照してください。問題が解決しない場合はサポートに連絡してください。';
  }

  return {
    location,
    message: errorMessage,
    suggestion,
    details: JSON.stringify(
      {
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack?.split('\n').slice(0, 5).join('\n'), // 最初の5行のみ
        },
        context,
      },
      null,
      2
    ),
    timestamp: new Date().toISOString(),
  };
}

/**
 * パフォーマンス計測
 */
export class PerformanceTimer {
  private startTime: number;
  private location: string;

  constructor(location: string) {
    this.location = location;
    this.startTime = Date.now();
    debugLog(location, 'Started');
  }

  end(message?: string): number {
    const duration = Date.now() - this.startTime;
    debugLog(
      this.location,
      `Completed in ${duration}ms${message ? ': ' + message : ''}`
    );
    return duration;
  }
}

/**
 * データバリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * スプレッドシート設定のバリデーション
 */
export function validateSpreadsheetConfig(
  spreadsheetId?: string,
  credentials?: string
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // スプレッドシートIDの検証
  if (!spreadsheetId || spreadsheetId.trim() === '') {
    result.valid = false;
    result.errors.push(
      'スプレッドシートIDが設定されていません。環境変数 SPREADSHEET_ID を確認してください。'
    );
  } else if (spreadsheetId.includes('http') || spreadsheetId.includes('/')) {
    result.valid = false;
    result.errors.push(
      'スプレッドシートIDにURLが含まれています。IDのみを指定してください。'
    );
  } else if (spreadsheetId.length < 20) {
    result.warnings.push(
      'スプレッドシートIDが短すぎる可能性があります。正しいIDか確認してください。'
    );
  }

  // Google認証情報の検証
  if (!credentials || credentials.trim() === '') {
    result.valid = false;
    result.errors.push(
      'Google認証情報が設定されていません。環境変数 GOOGLE_CREDENTIALS を確認してください。'
    );
  } else {
    try {
      const parsed = JSON.parse(credentials);

      if (!parsed.type || parsed.type !== 'service_account') {
        result.valid = false;
        result.errors.push(
          'Google認証情報のtypeが "service_account" ではありません。'
        );
      }

      if (!parsed.private_key || !parsed.private_key.includes('BEGIN PRIVATE KEY')) {
        result.valid = false;
        result.errors.push('Google認証情報に秘密鍵が含まれていません。');
      }

      if (!parsed.client_email || !parsed.client_email.includes('@')) {
        result.valid = false;
        result.errors.push(
          'Google認証情報にクライアントメールアドレスが含まれていません。'
        );
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(
        `Google認証情報のJSON形式が正しくありません: ${error}`
      );
    }
  }

  return result;
}

/**
 * CSVデータのバリデーション
 */
export function validateCSVData(data: any[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!data || data.length === 0) {
    result.valid = false;
    result.errors.push('CSVデータが空です。');
    return result;
  }

  if (data.length === 1) {
    result.warnings.push(
      'データが1件のみです。ヘッダー行のみの可能性があります。'
    );
  }

  // 必須フィールドの確認
  const requiredFields = ['video_url'];
  const missingFields = requiredFields.filter(
    (field) => !data[0].hasOwnProperty(field)
  );

  if (missingFields.length > 0) {
    result.valid = false;
    result.errors.push(
      `必須フィールドが見つかりません: ${missingFields.join(', ')}`
    );
  }

  // 数値フィールドの確認
  const numericFields = ['views', 'likes', 'saves', 'comments', 'shares'];
  const invalidNumericFields: string[] = [];

  data.slice(0, 5).forEach((row, index) => {
    numericFields.forEach((field) => {
      if (row[field] !== undefined && isNaN(Number(row[field]))) {
        invalidNumericFields.push(`${field} (行 ${index + 1})`);
      }
    });
  });

  if (invalidNumericFields.length > 0) {
    result.warnings.push(
      `数値でないデータが含まれています: ${invalidNumericFields.join(', ')}`
    );
  }

  return result;
}
