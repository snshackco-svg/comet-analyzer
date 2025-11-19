/**
 * Apify API クライアント
 * TikTok/Instagram のデータを自動取得
 */

import type { 
  Platform, 
  VideoData, 
  ApifyTikTokResult, 
  ApifyInstagramResult,
  ApifyFetchResult 
} from '../types';
import { debugLog, errorLog } from './debug';

const APIFY_API_BASE = 'https://api.apify.com/v2';

/**
 * Apify Actor を実行してデータを取得
 */
async function runApifyActor(
  actorId: string,
  input: any,
  token: string
): Promise<any[]> {
  const location = 'apify-client/runApifyActor';
  debugLog(location, `Starting Apify actor: ${actorId}`, { input });

  try {
    // 1. Actorを起動
    // Authorizationヘッダーを使用（推奨）
    const url = `${APIFY_API_BASE}/acts/${actorId}/runs`;
    debugLog(location, `Calling Apify API: POST ${url}`);
    debugLog(location, `Actor ID: ${actorId}`);
    debugLog(location, `Input:`, JSON.stringify(input, null, 2));
    
    const runResponse = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(input), // 入力を直接送信（ラップしない）
    });

    debugLog(location, `Response status: ${runResponse.status}`);

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      errorLog(location, `API Error: ${runResponse.status}`, { url: url.replace(/token=[^&]+/, 'token=***'), response: errorText });
      throw new Error(`Failed to start actor: ${runResponse.status} ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    debugLog(location, `Actor started with run ID: ${runId}, dataset: ${datasetId}`);

    // 2. 実行完了を待つ（ポーリング）
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60; // 最大5分待機（5秒 x 60）

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5秒待機
      attempts++;

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`Failed to check status: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      status = statusData.data.status;
      debugLog(location, `Actor status: ${status} (attempt ${attempts}/${maxAttempts})`);
    }

    if (status === 'RUNNING') {
      throw new Error(`Actor execution timed out after ${maxAttempts * 5} seconds. Status: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Actor did not complete successfully. Status: ${status}. Please check your Apify account for details.`);
    }

    // 3. 結果を取得
    const datasetResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch results: ${datasetResponse.status}`);
    }

    const results = await datasetResponse.json();
    debugLog(location, `Retrieved ${results.length} items from dataset`);

    return results;
  } catch (error: any) {
    errorLog(location, 'Apify actor execution failed', error);
    throw error;
  }
}

/**
 * TikTokのデータをApifyから取得（TikTok Hashtag Scraper使用）
 */
export async function fetchTikTokFromApify(
  hashtags: string[],
  resultsPerPage: number,
  token: string
): Promise<ApifyFetchResult> {
  const location = 'apify-client/fetchTikTokFromApify';
  debugLog(location, 'Fetching TikTok data via Apify (TikTok Hashtag Scraper)', { hashtags, resultsPerPage });

  try {
    // 🔧 ハッシュタグの形式を統一（#を削除）
    let cleanHashtags = hashtags.map(tag => tag.replace(/^#/, '').trim());
    
    // ⚠️ CRITICAL FIX: Cloudflare Workers制限対応
    // Apify Actorは複数ハッシュタグの場合、ハッシュタグごとにresultsPerPageを返す
    // 例: hashtags=["美容","ネイル"], resultsPerPage=2 → 合計4件返される
    // 解決策: ハッシュタグを1つだけに制限（最初のハッシュタグを使用）
    if (cleanHashtags.length > 1) {
      debugLog(location, `⚠️ Multiple hashtags detected (${cleanHashtags.length}). Using only first hashtag to avoid Workers limit.`, {
        allHashtags: cleanHashtags,
        selectedHashtag: cleanHashtags[0]
      });
      cleanHashtags = [cleanHashtags[0]]; // 最初のハッシュタグのみ使用
    }
    
    debugLog(location, `Using TikTok Hashtag Scraper:`, { 
      originalHashtags: hashtags,
      cleanHashtags: cleanHashtags,
      resultsPerPage 
    });

    // 🎯 clockworks~tiktok-scraper - Apify Consoleで確認した正しい入力形式
    const hashtagActorId = 'clockworks~tiktok-scraper';
    
    // ✅ 正しい入力形式（Apify Consoleで確認済み）:
    // - hashtags: string[] (ハッシュタグ名の配列 - 1つだけ使用）
    // - resultsPerPage: number
    const hashtagInput = {
      hashtags: cleanHashtags, // ハッシュタグ1つだけ（上で制限済み）
      resultsPerPage: resultsPerPage, // そのまま使用
      shouldDownloadVideos: true, // ✅ Apifyに動画ファイルをダウンロードさせる
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    };
    
    debugLog(location, `clockworks~tiktok-scraper input (verified format):`, {
      actorId: hashtagActorId,
      hashtags: cleanHashtags,
      hashtagCount: cleanHashtags.length,
      resultsPerPage: resultsPerPage,
      expectedMaxResults: resultsPerPage, // ハッシュタグ1つなので結果数=resultsPerPage
      inputKeys: Object.keys(hashtagInput),
      fullInput: JSON.stringify(hashtagInput)
    });

    // 🔧 Apify Consoleの実際のレスポンス構造に合わせる
    // フラット構造でドット記法のキー名を使用
    interface HashtagResult {
      id?: string;
      webVideoUrl?: string; // TikTokページURL
      videoUrl?: string; // TikTok CDN直接URL（オプション）
      mediaUrls?: string[]; // shouldDownloadVideos=trueの場合の動画URL配列
      diggCount?: number; // likes
      shareCount?: number;
      commentCount?: number;
      playCount?: number;
      collectCount?: number; // saves
      text?: string; // description
      // ドット記法のキー（Apify Consoleの実際のフォーマット）
      'authorMeta.id'?: string;
      'authorMeta.name'?: string;
      'authorMeta.nickName'?: string;
      'videoMeta.duration'?: number;
    }

    let hashtagResults: HashtagResult[] = await runApifyActor(hashtagActorId, hashtagInput, token);
    
    debugLog(location, `Actor execution complete:`, {
      resultCount: hashtagResults?.length || 0,
      requestedCount: resultsPerPage,
      hasResults: !!(hashtagResults && hashtagResults.length > 0)
    });

    if (!hashtagResults || hashtagResults.length === 0) {
      // エラーの詳細をログ出力
      debugLog(location, '❌ No results returned from Actor:', {
        actorId: hashtagActorId,
        inputHashtags: cleanHashtags,
        resultsPerPage,
        resultType: typeof hashtagResults,
        resultValue: hashtagResults
      });
      throw new Error(`No TikTok videos found for hashtags: ${hashtags.join(', ')}. Actor may not support hashtag search or input format is incorrect.`);
    }

    // 🔧 Cloudflare Workers制限対応: 取得結果を指定件数に制限
    if (hashtagResults.length > resultsPerPage) {
      debugLog(location, `⚠️ Limiting results from ${hashtagResults.length} to ${resultsPerPage} (Cloudflare Workers subrequest limit)`);
      hashtagResults = hashtagResults.slice(0, resultsPerPage);
    }

    debugLog(location, `✅ Retrieved ${hashtagResults.length} videos from Actor`);

    // デバッグ: 結果の詳細確認
    if (hashtagResults.length > 0) {
      const firstResult = hashtagResults[0];
      debugLog(location, '🔍 First result analysis:', {
        hasWebVideoUrl: !!firstResult.webVideoUrl,
        hasVideoUrl: !!firstResult.videoUrl,
        hasMediaUrls: !!firstResult.mediaUrls,
        mediaUrlsLength: firstResult.mediaUrls?.length || 0,
        mediaUrlsSample: firstResult.mediaUrls?.[0]?.substring(0, 80),
        webVideoUrl: firstResult.webVideoUrl?.substring(0, 80),
        videoUrl: firstResult.videoUrl?.substring(0, 80),
        text: firstResult.text?.substring(0, 100),
        hashtag: cleanHashtags[0],
        textIncludesHashtag: firstResult.text?.toLowerCase().includes(cleanHashtags[0].toLowerCase()),
        allKeys: Object.keys(firstResult).join(', '),
        // 動画URL関連のキーを全て確認
        videoRelatedKeys: Object.keys(firstResult).filter(k => k.toLowerCase().includes('video') || k.toLowerCase().includes('media')).join(', ')
      });
    }

    // メタデータから動画データを作成
    const videos: VideoData[] = hashtagResults
      .filter((item) => item.webVideoUrl) // ✅ webVideoUrlがあればOK
      .map((item) => {
        // 動画ファイルURLの優先順位:
        // 1. mediaUrls[0] (shouldDownloadVideos=trueの場合)
        // 2. videoUrl (直接URL)
        // 3. webVideoUrl (WebページURL - Twelve Labsでダウンロードエラーになる)
        let videoFileUrl = item.webVideoUrl!; // デフォルト
        if (item.mediaUrls && item.mediaUrls.length > 0) {
          videoFileUrl = item.mediaUrls[0]; // 最優先
        } else if (item.videoUrl) {
          videoFileUrl = item.videoUrl;
        }
        
        return {
          video_url: videoFileUrl, // 動画ファイルのURL（分析用）
          tiktok_web_url: item.webVideoUrl!, // TikTokのWebページURL（スプレッドシート用）
          views: item.playCount || 0,
          likes: item.diggCount || 0,
          saves: item.collectCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          // メタデータを追加（ドット記法のキーに対応）
          caption: item.text || '',
          author_name: item['authorMeta.nickName'] || '',
          author_username: item['authorMeta.name'] || item['authorMeta.id'] || '',
        };
      });

    debugLog(location, `Converted ${videos.length} TikTok videos to VideoData format`);

    return {
      success: true,
      platform: 'tiktok',
      source: 'apify',
      videos: videos,
    };
  } catch (error: any) {
    errorLog(location, 'Failed to fetch TikTok data from Apify', error);
    return {
      success: false,
      platform: 'tiktok',
      source: 'apify',
      videos: [],
      error: error.message,
      debug: { error: String(error) },
    };
  }
}

/**
 * Instagramのデータをapifyから取得
 */
export async function fetchInstagramFromApify(
  hashtags: string[],
  resultsPerPage: number,
  token: string
): Promise<ApifyFetchResult> {
  const location = 'apify-client/fetchInstagramFromApify';
  debugLog(location, 'Fetching Instagram data via Apify', { hashtags, resultsPerPage });

  try {
    // Instagram ScraperのActor ID
    const actorId = 'apify~instagram-scraper'; // TODO: 正確なActor IDを確認
    const input = {
      hashtags: hashtags,
      resultsLimit: resultsPerPage,
      addParentData: false,
    };

    const results: ApifyInstagramResult[] = await runApifyActor(actorId, input, token);

    // 安全のため、結果を20件に制限（Cloudflare無料プランの上限対応）
    const limitedResults = results.slice(0, 20);
    debugLog(location, `Limited results from ${results.length} to ${limitedResults.length} (max 20)`);

    // Apifyの結果を共通のVideoData形式に変換
    // Instagram APIには保存数とシェア数が含まれないため、0として扱う
    const videos: VideoData[] = limitedResults
      .filter((item) => item.url && item.likesCount !== undefined)
      .map((item) => ({
        video_url: item.url,
        views: 0, // Instagramの公開APIでは再生数が取得できない
        likes: item.likesCount || 0,
        saves: 0, // Instagram Scraperでは保存数が取得できない
        comments: item.commentsCount || 0,
        shares: 0, // Instagram Scraperではシェア数が取得できない
        // メタデータを追加（Vision API分析用）
        caption: item.caption || '',
        author_name: item.ownerFullName || '',
        author_username: item.ownerUsername || '',
      }));

    debugLog(location, `Converted ${videos.length} Instagram posts to VideoData format`);

    return {
      success: true,
      platform: 'instagram',
      source: 'apify',
      videos: videos,
    };
  } catch (error: any) {
    errorLog(location, 'Failed to fetch Instagram data from Apify', error);
    return {
      success: false,
      platform: 'instagram',
      source: 'apify',
      videos: [],
      error: error.message,
      debug: { error: String(error) },
    };
  }
}

/**
 * プラットフォームに応じてApifyからデータを取得
 */
export async function fetchFromApify(
  platform: Platform,
  hashtags: string[],
  resultsPerPage: number,
  token: string
): Promise<ApifyFetchResult> {
  if (platform === 'tiktok') {
    return fetchTikTokFromApify(hashtags, resultsPerPage, token);
  } else {
    return fetchInstagramFromApify(hashtags, resultsPerPage, token);
  }
}
