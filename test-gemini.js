/**
 * Gemini Video API テストスクリプト
 * 実際のTikTok動画URLでテスト
 */

const GEMINI_API_KEY = 'AIzaSyDo056MqmiEDXkfZrDlU6sZ4O_CETin7Xo';

// テスト用のTikTok動画URL（短い動画を使用）
const TEST_VIDEO_URL = 'https://www.tiktok.com/@bellababy/video/7450862813196553473';

async function downloadVideo(url) {
  console.log('[Test] Downloading video from:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[Test] Downloaded ${sizeMB}MB`);
    
    return buffer;
  } catch (error) {
    console.error('[Test] Download failed:', error.message);
    throw error;
  }
}

function arrayBufferToBase64(buffer) {
  console.log('[Test] Encoding to Base64...');
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  const base64 = Buffer.from(binary, 'binary').toString('base64');
  console.log(`[Test] Base64 encoded (${(base64.length / 1024).toFixed(0)}KB text)`);
  return base64;
}

async function analyzeWithGemini(base64Video) {
  console.log('[Test] Sending to Gemini API...');
  
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
  
  const requestBody = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: 'video/mp4',
            data: base64Video
          }
        },
        {
          text: 'この動画を簡単に説明してください（100文字程度）'
        }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500
    }
  };
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    const result = await response.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!analysis) {
      throw new Error('No analysis returned from Gemini');
    }
    
    console.log('[Test] ✅ Analysis received!');
    console.log('[Test] Analysis:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('[Test] ❌ Gemini API failed:', error.message);
    throw error;
  }
}

async function runTest() {
  console.log('=== Gemini Video API Test ===\n');
  
  try {
    // Step 1: Download video
    const videoBuffer = await downloadVideo(TEST_VIDEO_URL);
    
    // Step 2: Encode to Base64
    const base64Video = arrayBufferToBase64(videoBuffer);
    
    // Step 3: Analyze with Gemini
    const analysis = await analyzeWithGemini(base64Video);
    
    console.log('\n=== Test SUCCESSFUL ===');
    console.log('Gemini can analyze TikTok videos! ✅');
    
  } catch (error) {
    console.log('\n=== Test FAILED ===');
    console.error('Error:', error.message);
    console.log('\n考えられる原因:');
    console.log('1. TikTok動画のダウンロード制限');
    console.log('2. 動画サイズが大きすぎる');
    console.log('3. Gemini APIの制約');
  }
}

runTest();
