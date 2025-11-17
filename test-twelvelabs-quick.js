/**
 * Twelve Labs API クイックテスト
 * 既存のIndexを使って動画分析をテスト
 */

// Node.js 18+ のFormDataを使用
const { FormData } = await import('undici');

const TWELVE_LABS_API_KEY = process.env.TWELVE_LABS_API_KEY || 'tlk_01X92XB27BGG2W21DJ04Q0FVY9AA';
const BASE_URL = 'https://api.twelvelabs.io/v1.3';

// 既存のIndex ID（前回のテストで取得）
const INDEX_ID = '691b28dc6d1759f51fb576db';

// テスト用の公開動画URL（短い動画）
// Cloudflare R2の公開動画を使用
const TEST_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

async function uploadVideo(videoUrl) {
  console.log('[1] Uploading video to Twelve Labs...');
  console.log('    Video URL:', videoUrl);
  
  // multipart/form-data形式で送信
  const formData = new FormData();
  formData.append('index_id', INDEX_ID);
  formData.append('video_url', videoUrl);
  formData.append('language', 'en');
  
  const response = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY
      // Content-Typeは自動設定されるため指定しない
    },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  console.log('    ✅ Task created:', data._id);
  return data._id;
}

async function waitForTask(taskId) {
  console.log('[2] Waiting for video processing...');
  
  for (let i = 0; i < 30; i++) {
    const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      headers: {
        'x-api-key': TWELVE_LABS_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`    [${i + 1}/30] Status: ${data.status}`);
    
    if (data.status === 'ready' && data.video_id) {
      console.log('    ✅ Video processing complete!');
      console.log('    Video ID:', data.video_id);
      return data.video_id;
    }
    
    if (data.status === 'failed') {
      throw new Error(`Video processing failed: ${JSON.stringify(data)}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Task timeout');
}

async function analyzeVideo(videoId) {
  console.log('[3] Analyzing video...');
  
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_id: videoId,
      prompt: 'Describe this video in detail. What do you see? What is happening?'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  console.log('    ✅ Analysis complete!\n');
  return data.data;
}

async function runTest() {
  console.log('=== Twelve Labs API Quick Test ===\n');
  console.log('API Key:', TWELVE_LABS_API_KEY.substring(0, 20) + '...');
  console.log('Index ID:', INDEX_ID);
  console.log('');
  
  try {
    const taskId = await uploadVideo(TEST_VIDEO_URL);
    const videoId = await waitForTask(taskId);
    const analysis = await analyzeVideo(videoId);
    
    console.log('=== 📊 ANALYSIS RESULT ===\n');
    console.log(analysis);
    console.log('\n=== ✅ TEST SUCCESSFUL! ===');
    
  } catch (error) {
    console.error('\n=== ❌ TEST FAILED ===');
    console.error('Error:', error.message);
  }
}

runTest();
