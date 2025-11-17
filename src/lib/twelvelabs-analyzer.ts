/**
 * Twelve Labs Video Analysis Integration
 * 
 * TikTok/Instagram動画をTwelve Labs APIで分析
 */

import type { Platform, VideoData, CalculatedMetrics } from '../types';

const BASE_URL = 'https://api.twelvelabs.io/v1.2';

interface TwelveLabsConfig {
  apiKey: string;
  indexId?: string; // 既存のIndexを使う場合
}

interface TaskResponse {
  _id: string;
  status: 'pending' | 'validating' | 'indexing' | 'ready' | 'failed';
  video_id?: string;
}

/**
 * Indexを作成（初回のみ）
 */
export async function createTwelveLabsIndex(apiKey: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/indexes`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      index_name: 'comet-analyzer-videos',
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
    throw new Error(`Twelve Labs: Failed to create index (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data._id;
}

/**
 * 既存のIndexを取得
 */
export async function getTwelveLabsIndex(apiKey: string): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/indexes?page=1&page_limit=1`, {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0]._id;
  }

  return null;
}

/**
 * 動画をIndexに追加してタスク作成
 */
async function uploadVideoToIndex(
  apiKey: string,
  indexId: string,
  videoUrl: string
): Promise<string> {
  const response = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
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
    throw new Error(`Twelve Labs: Failed to upload video (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data._id; // task_id
}

/**
 * タスク完了を待機（ポーリング）
 */
async function waitForTask(
  apiKey: string,
  taskId: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Twelve Labs: Failed to check task status (${response.status})`);
    }

    const data: TaskResponse = await response.json();

    if (data.status === 'ready' && data.video_id) {
      return data.video_id;
    }

    if (data.status === 'failed') {
      throw new Error('Twelve Labs: Video processing failed');
    }

    // 待機
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Twelve Labs: Task timeout (video processing took too long)');
}

/**
 * 動画を分析（Generate Text）
 */
async function generateAnalysis(
  apiKey: string,
  videoId: string,
  platform: Platform,
  videoData: VideoData,
  metrics: CalculatedMetrics
): Promise<string> {
  const prompt = buildAnalysisPrompt(platform, videoData, metrics);

  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_id: videoId,
      prompt: prompt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twelve Labs: Failed to generate analysis (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * プラットフォーム別の分析プロンプト
 */
function buildAnalysisPrompt(platform: Platform, videoData: VideoData, metrics: CalculatedMetrics): string {
  const platformName = platform === 'tiktok' ? 'TikTok' : 'Instagram Reels';
  
  return `Analyze this ${platformName} video in detail. The video has the following metrics:
- Views: ${videoData.views.toLocaleString()}
- Likes: ${videoData.likes.toLocaleString()} (${(metrics.like_rate * 100).toFixed(2)}%)
- Comments: ${videoData.comments.toLocaleString()} (${(metrics.comment_rate * 100).toFixed(2)}%)
- Shares: ${videoData.shares.toLocaleString()} (${(metrics.share_rate * 100).toFixed(2)}%)
- Engagement Rate: ${(metrics.engagement_rate * 100).toFixed(2)}%

Provide a comprehensive analysis in Japanese (日本語) covering these sections:

## 1. パフォーマンス評価（250-300文字）
- エンゲージメント率の業界基準との比較
- 各指標（いいね率、コメント率、シェア率）の評価
- 総合的なパフォーマンススコア

## 2. 映像編集・構成分析（350-400文字）
- カット割りの頻度とテンポ感
- 画面構成と縦型動画最適化度
- テキストオーバーレイの配置・サイズ・デザイン
- 色彩・ビジュアルエフェクト・フィルター
- トランジション・ズーム・アニメーション演出
- 全体的な編集クオリティ

## 3. ストーリー構成分析（350-400文字）
- 導入部（0-3秒）のフック強度と視聴維持力
- 本編の情報提示順序とテンポ配分
- 結末のCTA（行動喚起）の明確さ
- 視聴維持のための工夫と演出

## 4. ビジュアル戦略分析（350-400文字）
- サムネイル的価値（最初のフレームの魅力）
- テキストの可読性と視認性
- ブランディング要素の有無
- ターゲット層とビジュアルの整合性

## 5. ターゲット層推定（250-300文字）
- メトリクスパターンと映像スタイルから推測される視聴者層
- 年齢層・興味関心・視聴シーン

## 6. 成功要因の統合分析（350-400文字）
- 数値 + 映像 + 編集の総合評価
- なぜこの動画が成功したか（または改善が必要か）

## 7. 改善提案（350-400文字）
- カット割り・テンポの最適化案
- テキスト配置・色彩調整の具体案
- フック強化の具体的方法
- エンゲージメント向上施策

## 8. アクションプラン（400-500文字）
- 優先順位付きの実行可能施策（3-5項目）
- 各施策の期待効果と実装難易度

Total: 2000-2500文字`;
}

/**
 * メイン関数: Twelve Labsで動画分析
 * 
 * @param videoUrl - 実際の動画URL（Apifyから取得した video_url）
 * @param platform - プラットフォーム（TikTok or Instagram）
 * @param metrics - 計算済みメトリクス
 * @param apiKey - Twelve Labs APIキー
 * @param indexId - （オプション）既存のIndex ID
 * @returns 分析テキスト（日本語、2000-2500文字）
 */
export async function analyzeWithTwelveLabs(
  videoUrl: string,
  platform: Platform,
  videoData: VideoData,
  metrics: CalculatedMetrics,
  apiKey: string,
  indexId?: string
): Promise<string> {
  try {
    // Step 1: Index IDを取得または作成
    let finalIndexId = indexId;
    if (!finalIndexId) {
      finalIndexId = await getTwelveLabsIndex(apiKey);
      if (!finalIndexId) {
        finalIndexId = await createTwelveLabsIndex(apiKey);
      }
    }

    // Step 2: 動画をアップロード
    const taskId = await uploadVideoToIndex(apiKey, finalIndexId, videoUrl);

    // Step 3: タスク完了を待機（最大5分）
    const videoId = await waitForTask(apiKey, taskId, 60, 5000);

    // Step 4: 分析実行
    const analysis = await generateAnalysis(apiKey, videoId, platform, videoData, metrics);

    return analysis;

  } catch (error: any) {
    console.error('[Twelve Labs] Analysis failed:', error.message);
    
    // エラーの種類に応じて詳細なメッセージを提供
    let detailedError = 'Twelve Labs動画分析エラー: ';
    
    if (error.message.includes('401') || error.message.includes('invalid')) {
      detailedError += 'APIキーが無効です。TWELVE_LABS_API_KEYを確認してください。';
    } else if (error.message.includes('429') || error.message.includes('quota')) {
      detailedError += '無料枠を超過しました。使用状況を確認するか、有料プランにアップグレードしてください。';
    } else if (error.message.includes('timeout')) {
      detailedError += '動画処理がタイムアウトしました。動画が長すぎるか、サーバーが混雑している可能性があります。';
    } else if (error.message.includes('upload') || error.message.includes('Upload')) {
      detailedError += '動画のアップロードに失敗しました。動画URLが有効か確認してください。';
    } else if (error.message.includes('processing failed')) {
      detailedError += '動画処理に失敗しました。動画フォーマット（MP4推奨）を確認してください。';
    } else {
      detailedError += error.message;
    }
    
    throw new Error(detailedError);
  }
}
