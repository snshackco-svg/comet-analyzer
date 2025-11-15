import { SheetRowData, SheetsConfig } from '../types';

/**
 * Google OAuth2アクセストークンを取得
 */
async function getAccessToken(credentials: any): Promise<string> {
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // JWT署名は実装が複雑なため、代わりにサービスアカウントのキーを直接使用する方法に変更
  // Cloudflare Workersで利用可能なWeb Crypto APIを使用

  const encoder = new TextEncoder();

  // ヘッダーとペイロードをbase64url エンコード
  const base64UrlEncode = (data: any) => {
    const str = JSON.stringify(data);
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const header = base64UrlEncode(jwtHeader);
  const payload = base64UrlEncode(jwtClaim);
  const unsignedToken = `${header}.${payload}`;

  // 秘密鍵をインポート
  const privateKey = credentials.private_key;

  // PEM形式の秘密鍵を処理
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  // Base64デコード
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  // 秘密鍵をインポート
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // 署名を生成
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  // 署名をbase64urlエンコード
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const signatureBase64Url = signatureBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${unsignedToken}.${signatureBase64Url}`;

  // JWTを使ってアクセストークンを取得
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`アクセストークンの取得に失敗: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * スプレッドシートから全データを取得（CSVダウンロード用）
 */
export async function getAllSheetData(
  credentials: any,
  config: SheetsConfig
): Promise<any[][]> {
  try {
    const accessToken = await getAccessToken(credentials);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const error = await response.text();
      throw new Error(`データ取得エラー: ${error}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return [];
    }
    throw error;
  }
}

/**
 * スプレッドシートから既存のデータを取得（重複チェック用）
 */
export async function getExistingVideoUrls(
  credentials: any,
  config: SheetsConfig
): Promise<Set<string>> {
  try {
    const accessToken = await getAccessToken(credentials);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}!C:C`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return new Set();
      }
      const error = await response.text();
      throw new Error(`データ取得エラー: ${error}`);
    }

    const data = await response.json();
    const values = data.values || [];

    // ヘッダー行をスキップして、URLのセットを作成
    const urls = new Set<string>();
    values.slice(1).forEach((row: any[]) => {
      if (row[0]) {
        urls.add(row[0].trim());
      }
    });

    return urls;
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return new Set();
    }
    throw error;
  }
}

/**
 * シートにデータ行を追加
 */
export async function appendRowsToSheet(
  credentials: any,
  config: SheetsConfig,
  rows: SheetRowData[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const accessToken = await getAccessToken(credentials);

  // データを配列形式に変換
  const values = rows.map((row) => [
    row.platform, // A列: プラットフォーム
    row.date, // B列: 取得日
    row.video_url, // C列: 動画リンク
    row.views, // D列: 再生数
    row.likes, // E列: いいね数
    row.saves, // F列: 保存数
    row.comments, // G列: コメント数
    row.shares, // H列: シェア数
    row.like_rate, // I列: いいね率
    row.save_rate, // J列: 保存率
    row.comment_rate, // K列: コメント率
    row.share_rate, // L列: シェア率
    row.engagement_rate, // M列: エンゲージメント率
    row.analysis, // N列: 分析結果
    row.memo, // O列: メモ/タグ
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}!A:O:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: values,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`データ追加エラー: ${error}`);
  }

  const data = await response.json();
  return data.updates?.updatedRows || 0;
}

/**
 * シートが存在しない場合は作成し、ヘッダー行を追加
 */
export async function ensureSheetExists(
  credentials: any,
  config: SheetsConfig
): Promise<void> {
  try {
    const accessToken = await getAccessToken(credentials);

    // スプレッドシートの情報を取得
    const spreadsheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!spreadsheetResponse.ok) {
      if (spreadsheetResponse.status === 404) {
        throw new Error(
          'スプレッドシートが見つかりません。スプレッドシートIDを確認してください。'
        );
      }
      const error = await spreadsheetResponse.text();
      throw new Error(`スプレッドシート取得エラー: ${error}`);
    }

    const spreadsheetData = await spreadsheetResponse.json();

    // シートが存在するか確認
    const sheetExists = spreadsheetData.sheets?.some(
      (sheet: any) => sheet.properties?.title === config.sheet_name
    );

    // シートが存在しない場合は作成
    if (!sheetExists) {
      const createSheetResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: config.sheet_name,
                  },
                },
              },
            ],
          }),
        }
      );

      if (!createSheetResponse.ok) {
        const error = await createSheetResponse.text();
        throw new Error(`シート作成エラー: ${error}`);
      }

      // ヘッダー行を追加
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}!A1:O1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [
              [
                'プラットフォーム',
                '取得日',
                '動画リンク',
                '再生数',
                'いいね数',
                '保存数',
                'コメント数',
                'シェア数',
                'いいね率',
                '保存率',
                'コメント率',
                'シェア率',
                'エンゲージメント率',
                '分析結果',
                'メモ/タグ',
              ],
            ],
          }),
        }
      );

      return;
    }

    // ヘッダー行が存在するか確認
    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}!A1:O1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const headerData = await headerResponse.json();

    if (!headerData.values || headerData.values.length === 0) {
      // ヘッダー行を追加
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${config.sheet_name}!A1:O1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [
              [
                'プラットフォーム',
                '取得日',
                '動画リンク',
                '再生数',
                'いいね数',
                '保存数',
                'コメント数',
                'シェア数',
                'いいね率',
                '保存率',
                'コメント率',
                'シェア率',
                'エンゲージメント率',
                '分析結果',
                'メモ/タグ',
              ],
            ],
          }),
        }
      );
    }
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error(
        'スプレッドシートが見つかりません。スプレッドシートIDを確認してください。'
      );
    }
    throw error;
  }
}
