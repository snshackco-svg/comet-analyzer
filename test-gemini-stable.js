/**
 * Gemini Video API テスト - 安定版モデル使用
 */

const GEMINI_API_KEY = 'AIzaSyDo056MqmiEDXkfZrDlU6sZ4O_CETin7Xo';

// より短い動画でテスト
const TEST_VIDEO_URL = 'https://www.tiktok.com/@bellababy/video/7450862813196553473';

async function downloadVideo(url) {
  console.log('[Test] Downloading video from:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`[Test] Downloaded ${sizeMB}MB`);
  
  return buffer;
}

function arrayBufferToBase64(buffer) {
  console.log('[Test] Encoding to Base64...');
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  const base64 = Buffer.from(binary, 'binary').toString('base64');
  console.log(`[Test] Base64 encoded (${(base64.length / 1024).toFixed(0)}KB)`);
  return base64;
}

async function testWithStableModel(base64Video) {
  console.log('[Test] Testing with gemini-2.5-flash (stable)...');
  
  // 安定版Gemini 2.5 Flashを使用
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
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
          text: 'この動画を簡単に説明してください'
        }
      ]
    }]
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
      console.error('[Test] API Error:', errorText.substring(0, 300));
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('[Test] ✅ SUCCESS!');
    console.log('[Test] Analysis:', analysis);
    return true;
    
  } catch (error) {
    console.error('[Test] Failed:', error.message);
    return false;
  }
}

async function runTest() {
  console.log('=== Gemini Video API Test (Stable Model) ===\n');
  
  try {
    const videoBuffer = await downloadVideo(TEST_VIDEO_URL);
    const base64Video = arrayBufferToBase64(videoBuffer);
    
    const success = await testWithStableModel(base64Video);
    
    if (success) {
      console.log('\n=== ✅ Gemini can analyze TikTok videos! ===');
    } else {
      console.log('\n=== ❌ Video analysis not working ===');
      console.log('\n推奨: GPT-4o Text分析を使用');
    }
    
  } catch (error) {
    console.log('\n=== Test FAILED ===');
    console.error('Error:', error.message);
  }
}

runTest();
