/**
 * 動画ダウンロード＆Base64エンコードユーティリティ
 */

/**
 * ArrayBufferをBase64文字列に変換
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  
  // チャンク処理で大きなバッファも対応
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

/**
 * 動画URLからダウンロードしてBase64エンコード
 * @param videoUrl - TikTok/Instagram動画のURL
 * @returns Base64エンコードされた動画データ
 */
export async function downloadAndEncodeVideo(videoUrl: string): Promise<string> {
  console.log('[Video Download] Starting download:', videoUrl);
  
  try {
    // 動画をダウンロード
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }
    
    // Content-Typeチェック
    const contentType = response.headers.get('content-type');
    console.log('[Video Download] Content-Type:', contentType);
    
    if (contentType && !contentType.includes('video')) {
      console.warn('[Video Download] Warning: Content-Type is not video:', contentType);
    }
    
    // ArrayBufferとして取得
    const videoBuffer = await response.arrayBuffer();
    const sizeInMB = (videoBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[Video Download] Downloaded ${sizeInMB}MB`);
    
    // サイズチェック（20MB以下推奨）
    if (videoBuffer.byteLength > 20 * 1024 * 1024) {
      console.warn(`[Video Download] Warning: Video size (${sizeInMB}MB) exceeds 20MB. May fail with Gemini API.`);
    }
    
    // Base64エンコード
    console.log('[Video Download] Encoding to Base64...');
    const base64Video = arrayBufferToBase64(videoBuffer);
    console.log(`[Video Download] Encoded to Base64 (${(base64Video.length / 1024).toFixed(0)}KB text)`);
    
    return base64Video;
    
  } catch (error: any) {
    console.error('[Video Download] Error:', error);
    throw new Error(`Video download failed: ${error.message}`);
  }
}

/**
 * 動画のMIMEタイプを推測
 * @param videoUrl - 動画URL
 * @returns MIMEタイプ
 */
export function guessVideoMimeType(videoUrl: string): string {
  const url = videoUrl.toLowerCase();
  
  if (url.includes('.mp4') || url.includes('video/mp4')) {
    return 'video/mp4';
  } else if (url.includes('.webm')) {
    return 'video/webm';
  } else if (url.includes('.mov')) {
    return 'video/mov';
  } else if (url.includes('.avi')) {
    return 'video/avi';
  }
  
  // デフォルトはmp4（TikTok/Instagramは通常mp4）
  return 'video/mp4';
}
