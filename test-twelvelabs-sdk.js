/**
 * Twelve Labs SDK テスト
 * 公式SDKを使った動画分析
 */

import { TwelveLabs } from 'twelvelabs-js';

const API_KEY = 'tlk_01X92XB27BGG2W21DJ04Q0FVY9AA';
const TEST_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

async function runTest() {
  console.log('=== Twelve Labs SDK Test ===\n');

  try {
    // クライアント初期化
    const client = new TwelveLabs({ apiKey: API_KEY });
    console.log('✅ Client initialized');

    // 既存のIndexを取得
    console.log('\n[1] Fetching indexes...');
    const indexesPage = await client.indexes.list();
    console.log(`    Found ${indexesPage.data.length} indexes`);
    console.log(`    Index structure:`, JSON.stringify(indexesPage.data[0], null, 2).substring(0, 200));

    if (indexesPage.data.length === 0) {
      console.log('    Creating new index...');
      const newIndex = await client.indexes.create({
        name: 'comet-analyzer-videos',
        engines: [
          {
            name: 'marengo2.7',
            options: ['visual', 'conversation']
          }
        ],
        addons: ['thumbnail']
      });
      console.log(`    ✅ Index created: ${newIndex._id}`);
    }

    const indexData = indexesPage.data[0];
    const indexId = indexData._id || indexData.id;
    console.log(`    Using index: ${indexId}`);

    // 動画をアップロード
    console.log('\n[2] Uploading video...');
    console.log(`    URL: ${TEST_VIDEO_URL}`);
    
    const task = await client.tasks.create({
      indexId: indexId,
      url: TEST_VIDEO_URL,
      language: 'en'
    });
    console.log(`    ✅ Task created: ${task._id}`);

    // タスク完了を待機
    console.log('\n[3] Waiting for video processing...');
    let taskStatus = task;
    while (taskStatus.status !== 'ready') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      taskStatus = await client.tasks.retrieve(task._id);
      console.log(`    Status: ${taskStatus.status}`);
      if (taskStatus.status === 'failed') {
        throw new Error('Video processing failed');
      }
    }
    console.log(`    ✅ Video ready! Video ID: ${taskStatus.videoId}`);

    // 動画を分析（Gist - 要約）
    console.log('\n[4] Generating video summary (gist)...');
    const gistResult = await client.gist({
      videoId: taskStatus.videoId,
      types: ['title', 'topic', 'hashtag']
    });
    
    console.log('\n=== 📊 GIST RESULT ===\n');
    console.log(JSON.stringify(gistResult, null, 2));

    // テキスト生成を試す
    console.log('\n[5] Generating detailed text analysis...');
    const textResult = await client.analyze({
      videoId: taskStatus.videoId,
      prompt: 'Describe this video in detail. What happens in the video? What are the key visual elements?'
    });
    
    console.log('\n=== 📝 DETAILED ANALYSIS ===\n');
    console.log(textResult);

    console.log('\n=== ✅ TEST SUCCESSFUL! ===');

  } catch (error) {
    console.error('\n=== ❌ TEST FAILED ===');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

runTest();
