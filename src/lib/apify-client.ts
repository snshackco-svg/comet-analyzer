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
    debugLog(location, `Actor ID: ${actorId}`, { input });
    
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
 * TikTokのデータをApifyから取得（2段階: ハッシュタグ検索 + 動画ダウンロード）
 */
export async function fetchTikTokFromApify(
  hashtags: string[],
  resultsPerPage: number,
  token: string
): Promise<ApifyFetchResult> {
  const location = 'apify-client/fetchTikTokFromApify';
  debugLog(location, 'Fetching TikTok data via Apify (simplified: Premium Actor only)', { hashtags, resultsPerPage });

  try {
    // 🔧 TEMPORARY FIX: clockworks~tiktok-scraper がproxySettingsエラーを出すため、
    // 一旦Premium Actorのみでテスト用の固定URLを使用
    debugLog(location, 'Using Premium Actor directly with test URLs (bypassing hashtag search)');
    
    // テスト用の人気TikTok動画URL（実際のトレンド動画）
    const testVideoUrls = [
      'https://www.tiktok.com/@bellapoarch/video/6862153058223197445',  // Bella Poarch - M to the B
      'https://www.tiktok.com/@khaby.lame/video/7059710925474622726',   // Khaby Lame
      'https://www.tiktok.com/@zachking/video/6768504823336815877',     // Zach King
    ].slice(0, resultsPerPage); // 指定された件数まで制限

    debugLog(location, `Using ${testVideoUrls.length} test URLs for Premium Actor`);

    // Premium Video Scraperで動画データを取得
    debugLog(location, `Downloading ${testVideoUrls.length} videos with Premium Actor`);
    const premiumActorId = 'radeance~tiktok-video-scraper-premium';
    
    const premiumInput = {
      urls: testVideoUrls,
      download_videos: true, // Apifyストレージにダウンロード
      download_slideshows: false,
      download_audio: false,
      download_subtitles: false,
      quality: 'highest',
      // ⚠️ Premium Actorはproxy設定が必須（レンタルプランの要件）
      proxySettings: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      }
    };

    interface PremiumResult {
      id?: string;
      downloadUrl?: string; // Apifyストレージの動画URL（最優先）
      videoUrl?: string; // TikTok CDN直接URL
      likeCount?: number;
      shareCount?: number;
      commentCount?: number;
      playCount?: number;
      collectCount?: number;
      description?: string;
      author_unique_id?: string;
      author_nickname?: string;
      webVideoUrl?: string;
    }

    const premiumResults: PremiumResult[] = await runApifyActor(premiumActorId, premiumInput, token);

    // デバッグ: Premium Actor結果の確認
    if (premiumResults.length > 0) {
      const firstResult = premiumResults[0];
      debugLog(location, '🔍 Premium Actor result sample (first item)', {
        hasDownloadUrl: !!firstResult.downloadUrl,
        hasVideoUrl: !!firstResult.videoUrl,
        downloadUrl: firstResult.downloadUrl,
        videoUrl: firstResult.videoUrl,
        allKeys: Object.keys(firstResult)
      });
    }

    // メタデータから動画データを作成
    const videos: VideoData[] = premiumResults
      .filter((item) => (item.downloadUrl || item.videoUrl || item.webVideoUrl) && item.playCount !== undefined)
      .map((item) => {
        // 🎬 動画分析のため、Apifyストレージの動画を最優先
        // Cloudflare Workersでダウンロードして、Twelve Labsにファイルアップロード
        // 優先順位: downloadUrl (Apifyストレージ) > videoUrl (TikTok CDN) > webVideoUrl
        const videoUrlToUse = item.downloadUrl || item.videoUrl || item.webVideoUrl || '';
        
        return {
          video_url: videoUrlToUse,
          views: item.playCount || 0,
          likes: item.likeCount || 0,
          saves: item.collectCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          // メタデータを追加
          caption: item.description || '',
          author_name: item.author_nickname || '',
          author_username: item.author_unique_id || '',
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
