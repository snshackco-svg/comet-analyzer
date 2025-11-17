/**
 * Gemini Files API テスト - ファイルアップロード方式
 * inline_dataではなく、Files APIを使用してから参照
 */

const GEMINI_API_KEY = 'AIzaSyDo056MqmiEDXkfZrDlU6sZ4O_CETin7Xo';
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

async function uploadVideoToGemini(videoBuffer) {
  console.log('[Test] Uploading video to Gemini Files API...');
  
  // Step 1: Start resumable upload
  const uploadUrl = 'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + GEMINI_API_KEY;
  
  const metadata = {
    file: {
      display_name: 'TikTok Test Video'
    }
  };
  
  const initResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': videoBuffer.byteLength.toString(),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  
  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    console.error('[Test] Init failed:', errorText);
    throw new Error(`Upload init failed: ${initResponse.status}`);
  }
  
  const uploadSessionUrl = initResponse.headers.get('X-Goog-Upload-URL');
  console.log('[Test] Got upload session URL');
  
  // Step 2: Upload the video content
  const uploadResponse = await fetch(uploadSessionUrl, {
    method: 'POST',
    headers: {
      'Content-Length': videoBuffer.byteLength.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: videoBuffer
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('[Test] Upload failed:', errorText);
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }
  
  const fileInfo = await uploadResponse.json();
  console.log('[Test] ✅ Video uploaded! File name:', fileInfo.file.name);
  
  return fileInfo.file.name; // e.g., "files/abc123"
}

async function waitForProcessing(fileName) {
  console.log('[Test] Waiting for video processing...');
  
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`
    );
    
    const fileInfo = await response.json();
    console.log('[Test] State:', fileInfo.state, '| Error:', fileInfo.error?.message || 'none');
    
    if (fileInfo.state === 'ACTIVE') {
      console.log('[Test] ✅ Video processing complete!');
      return true;
    }
    
    if (fileInfo.state === 'FAILED') {
      throw new Error(`Video processing failed: ${fileInfo.error?.message || 'unknown'}`);
    }
    
    console.log(`[Test] Processing... (${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Processing timeout');
}

async function analyzeWithFilesAPI(fileName) {
  console.log('[Test] Analyzing video with Gemini...');
  
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
  const requestBody = {
    contents: [{
      parts: [
        {
          file_data: {
            mime_type: 'video/mp4',
            file_uri: `https://generativelanguage.googleapis.com/v1beta/${fileName}`
          }
        },
        {
          text: 'この動画を簡単に説明してください'
        }
      ]
    }]
  };
  
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
    console.error('[Test] Analysis failed:', errorText);
    throw new Error(`Analysis failed: ${response.status}`);
  }
  
  const result = await response.json();
  const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  console.log('[Test] ✅ SUCCESS!');
  console.log('[Test] Analysis:', analysis);
  
  return analysis;
}

async function runTest() {
  console.log('=== Gemini Files API Test ===\n');
  
  try {
    // 1. Download video
    const videoBuffer = await downloadVideo(TEST_VIDEO_URL);
    
    // 2. Upload to Gemini Files API
    const fileName = await uploadVideoToGemini(videoBuffer);
    
    // 3. Wait for processing
    await waitForProcessing(fileName);
    
    // 4. Analyze
    await analyzeWithFilesAPI(fileName);
    
    console.log('\n=== ✅ Gemini Files API works! ===');
    console.log('この方式を本番実装に使用できます');
    
  } catch (error) {
    console.log('\n=== Test FAILED ===');
    console.error('Error:', error.message);
  }
}

runTest();
