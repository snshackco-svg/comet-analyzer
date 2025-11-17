/**
 * Twelve Labs API テスト
 * 
 * 必要な環境変数:
 * - TWELVE_LABS_API_KEY
 * 
 * テストフロー:
 * 1. Indexの作成または既存Index使用
 * 2. TikTok動画URLをIndexに追加
 * 3. タスク完了を待機
 * 4. 動画を分析
 */

const TWELVE_LABS_API_KEY = process.env.TWELVE_LABS_API_KEY || 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://api.twelvelabs.io/v1.2';

// テスト用TikTok動画URL（Apify経由で取得する実際の動画URL）
const TEST_VIDEO_URL = 'https://example.com/test.mp4'; // 実際のURLに置き換え

/**
 * Step 1: Indexを作成
 */
async function createIndex() {
  console.log('[Step 1] Creating index...');
  
  const response = await fetch(`${BASE_URL}/indexes`, {
    method: 'POST',
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      index_name: 'tiktok-analyzer',
      engines: [
        {
          engine_name: 'marengo2.6',
          engine_options: ['visual', 'conversation', 'text_in_video', 'logo']
        }
      ],
      addons: ['thumbnail']
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create index: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log('[Step 1] ✅ Index created:', data._id);
  return data._id;
}

/**
 * Step 2: 既存のIndexを取得
 */
async function listIndexes() {
  console.log('[Step 2] Listing existing indexes...');
  
  const response = await fetch(`${BASE_URL}/indexes?page=1&page_limit=10`, {
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list indexes: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log('[Step 2] Found indexes:', data.data.length);
  
  if (data.data.length > 0) {
    const index = data.data[0];
    console.log('[Step 2] Using existing index:', index._id);
    return index._id;
  }
  
  return null;
}

/**
 * Step 3: 動画をIndexに追加
 */
async function uploadVideo(indexId, videoUrl) {
  console.log('[Step 3] Uploading video to index...');
  console.log('[Step 3] Video URL:', videoUrl);
  
  const response = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      index_id: indexId,
      video_url: videoUrl,
      language: 'en'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload video: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log('[Step 3] ✅ Task created:', data._id);
  return data._id;
}

/**
 * Step 4: タスク完了を待機
 */
async function waitForTaskCompletion(taskId, maxAttempts = 30) {
  console.log('[Step 4] Waiting for task completion...');
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      headers: {
        'x-api-key': TWELVE_LABS_API_KEY
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check task status: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    console.log(`[Step 4] Attempt ${i + 1}/${maxAttempts} - Status: ${data.status}`);
    
    if (data.status === 'ready') {
      console.log('[Step 4] ✅ Task completed! Video ID:', data.video_id);
      return data.video_id;
    }
    
    if (data.status === 'failed') {
      throw new Error(`Task failed: ${JSON.stringify(data)}`);
    }
    
    // 10秒待機
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  throw new Error('Task timeout');
}

/**
 * Step 5: 動画を分析（Generate Text）
 */
async function analyzeVideo(videoId) {
  console.log('[Step 5] Analyzing video with Twelve Labs...');
  
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'x-api-key': TWELVE_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_id: videoId,
      prompt: `Analyze this TikTok video in detail. Provide:

1. **Visual Analysis** (200 words):
   - Color scheme and visual style
   - Composition and framing
   - Text overlays and their placement
   - Visual effects and transitions

2. **Content Structure** (200 words):
   - Hook in first 3 seconds
   - Main content flow
   - Pacing and editing tempo
   - Call-to-action at the end

3. **Engagement Factors** (150 words):
   - What makes this video engaging?
   - Target audience indicators
   - Virality potential

4. **Improvement Suggestions** (150 words):
   - What could be improved?
   - Specific actionable recommendations

Total: ~700 words`
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to analyze video: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log('[Step 5] ✅ Analysis completed!\n');
  console.log('=== ANALYSIS RESULT ===\n');
  console.log(data.data);
  console.log('\n======================\n');
  
  return data.data;
}

/**
 * メインテスト実行
 */
async function runTest() {
  console.log('=== Twelve Labs API Test ===\n');
  
  try {
    // Step 1 & 2: Indexの取得または作成
    let indexId = await listIndexes();
    if (!indexId) {
      indexId = await createIndex();
    }
    
    // Step 3: 動画アップロード
    const taskId = await uploadVideo(indexId, TEST_VIDEO_URL);
    
    // Step 4: タスク完了待機
    const videoId = await waitForTaskCompletion(taskId);
    
    // Step 5: 動画分析
    const analysis = await analyzeVideo(videoId);
    
    console.log('\n=== ✅ Test Completed Successfully! ===');
    console.log('Index ID:', indexId);
    console.log('Video ID:', videoId);
    console.log('Analysis length:', analysis.length, 'characters');
    
  } catch (error) {
    console.error('\n=== ❌ Test Failed ===');
    console.error('Error:', error.message);
    
    if (error.message.includes('401')) {
      console.error('\n💡 APIキーが無効です。TWELVE_LABS_API_KEYを確認してください。');
    }
  }
}

// 使い方を表示
if (!process.env.TWELVE_LABS_API_KEY) {
  console.log(`
使い方:
1. Twelve Labs APIキーを取得: https://www.twelvelabs.io/
2. 環境変数を設定:
   export TWELVE_LABS_API_KEY="your_api_key_here"
3. テスト用動画URLを設定（TEST_VIDEO_URLを編集）
4. 実行:
   node test-twelvelabs.js

または直接APIキーを指定:
TWELVE_LABS_API_KEY="your_key" node test-twelvelabs.js
`);
  process.exit(0);
}

runTest();
