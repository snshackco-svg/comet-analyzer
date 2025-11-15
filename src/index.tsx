import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';

type Bindings = {
  AI?: any; // Cloudflare AI binding (optional)
};

const app = new Hono<{ Bindings: Bindings }>();

// 静的ファイルの提供
app.use('/static/*', serveStatic({ root: './public' }));
app.use('/favicon.svg', serveStatic({ root: './public', path: './favicon.svg' }));

// APIルート
app.route('/api', api);

// トップページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comet Analyzer - TikTokデータ収集＆分析ツール</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen py-8 px-4">
            <div class="max-w-6xl mx-auto">
                <!-- ヘッダー -->
                <div class="text-center mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-comet text-purple-600 mr-3"></i>
                        Comet Analyzer
                    </h1>
                    <p class="text-gray-600">TikTokデータ収集＆分析ツール</p>
                </div>

                <!-- 統計カード（初期は非表示） -->
                <div id="stats_card" class="card hidden">
                    <div class="card-title">
                        <span><i class="fas fa-chart-bar mr-2"></i>処理結果</span>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">総データ数</div>
                            <div class="stat-value" id="total_count">0</div>
                        </div>
                        <div class="stat-item success">
                            <div class="stat-label">新規追加</div>
                            <div class="stat-value" id="new_count">0</div>
                        </div>
                        <div class="stat-item warning">
                            <div class="stat-label">スキップ</div>
                            <div class="stat-value" id="skipped_count">0</div>
                        </div>
                        <div class="stat-item error">
                            <div class="stat-label">エラー</div>
                            <div class="stat-value" id="error_count">0</div>
                        </div>
                    </div>
                </div>

                <!-- メインカード -->
                <div class="card">
                    <!-- プラットフォーム選択 -->
                    <div class="form-group">
                        <label for="platform" class="form-label">
                            <i class="fas fa-layer-group mr-2"></i>
                            対象プラットフォーム
                        </label>
                        <select id="platform" class="form-input">
                            <option value="tiktok">TikTok</option>
                            <option value="instagram">Instagram</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">
                            選択したプラットフォームに応じて、異なるシートに保存されます
                        </p>
                    </div>

                    <!-- ファイルアップロード -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-file-csv mr-2"></i>
                            CometからエクスポートしたCSVファイル
                        </label>
                        <div class="file-input-wrapper">
                            <input type="file" id="csv_file" accept=".csv" />
                            <div class="file-input-label">
                                <div class="text-center">
                                    <i class="fas fa-cloud-upload-alt text-4xl text-purple-600 mb-3"></i>
                                    <p class="text-gray-700 font-medium">CSVファイルを選択またはドロップ</p>
                                    <p class="text-gray-500 text-sm mt-2">対応形式: .csv</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 処理ボタン -->
                    <button id="process_button" class="btn-primary">
                        <i class="fas fa-play mr-2"></i>
                        データ収集＆スプレッドシート反映
                    </button>
                </div>

                <!-- スプレッドシート読み込みカード -->
                <div class="card">
                    <div class="card-title">
                        <span><i class="fas fa-table mr-2"></i>スプレッドシートから読み込み</span>
                    </div>

                    <div class="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-500 p-4 mb-4">
                        <div class="flex">
                            <i class="fas fa-file-excel text-green-500 text-2xl mt-1 mr-3"></i>
                            <div class="text-sm text-green-800">
                                <p class="font-bold mb-1">📊 Cometが入力したスプレッドシートを読み込み</p>
                                <p class="mb-2">Cometが生データ+分析を入力したスプレッドシートを読み込み、指標計算とシステムAI分析を追加します。</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Cometの分析を保持（I列）</li>
                                    <li>システムAI分析を追加（O列）</li>
                                    <li>指標自動計算（J〜N列）</li>
                                    <li>同じシートに結果を追記</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- スプレッドシートID入力 -->
                    <div class="form-group">
                        <label for="sheet_spreadsheet_id" class="form-label">
                            <i class="fas fa-link mr-2"></i>
                            スプレッドシートID
                        </label>
                        <input 
                            type="text" 
                            id="sheet_spreadsheet_id" 
                            class="form-input" 
                            placeholder="例: 1ABC...xyz"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                            URLの「/d/」と「/edit」の間の文字列です<br>
                            例: https://docs.google.com/spreadsheets/d/<strong>1ABC...xyz</strong>/edit
                        </p>
                    </div>

                    <!-- シート名入力 -->
                    <div class="form-group">
                        <label for="sheet_name" class="form-label">
                            <i class="fas fa-file-alt mr-2"></i>
                            シート名
                        </label>
                        <input 
                            type="text" 
                            id="sheet_name" 
                            class="form-input" 
                            placeholder="動画データ"
                            value="動画データ"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                            Cometがデータを入力したシート名（デフォルト: 動画データ）
                        </p>
                    </div>

                    <!-- 列構成の説明 -->
                    <div class="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
                        <p class="text-xs font-semibold text-gray-700 mb-2">📋 必要な列構成（A〜I列）</p>
                        <div class="grid grid-cols-2 gap-1 text-xs text-gray-600">
                            <div>A: プラットフォーム</div>
                            <div>B: 取得日時</div>
                            <div>C: 動画リンク</div>
                            <div>D: 再生数</div>
                            <div>E: いいね数</div>
                            <div>F: 保存数</div>
                            <div>G: コメント数</div>
                            <div>H: シェア数</div>
                            <div class="col-span-2">I: Comet分析</div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            ⚠️ このシステムがJ〜P列に指標とAI分析を追加します
                        </p>
                    </div>

                    <!-- 読み込みボタン -->
                    <button id="sheet_fetch_button" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        <i class="fas fa-table mr-2"></i>
                        スプレッドシートから読み込み＆処理
                    </button>
                </div>

                <!-- Apify自動収集カード -->
                <div class="card">
                    <div class="card-title">
                        <span><i class="fas fa-robot mr-2"></i>Apify自動データ収集</span>
                    </div>

                    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-4 mb-4">
                        <div class="flex">
                            <i class="fas fa-magic text-purple-500 text-2xl mt-1 mr-3"></i>
                            <div class="text-sm text-purple-800">
                                <p class="font-bold mb-1">🚀 ハッシュタグからトレンド動画を自動収集</p>
                                <p class="mb-2">ボタン1つでTikTok/Instagramのトレンド動画データを自動取得し、AI分析してスプレッドシートに保存します。</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Comet不要、完全自動化</li>
                                    <li>複数ハッシュタグ一括検索</li>
                                    <li>AI分析自動生成（1000文字）</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- ハッシュタグ設定 -->
                    <div class="form-group">
                        <label for="apify_hashtags" class="form-label">
                            <i class="fas fa-hashtag mr-2"></i>
                            検索ハッシュタグ（カンマ区切り）
                        </label>
                        <input 
                            type="text" 
                            id="apify_hashtags" 
                            class="form-input" 
                            placeholder="例: fyp, viral, trending, おすすめ"
                            value="fyp, viral, trending"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                            複数のハッシュタグをカンマで区切って入力してください（#記号は不要、最大10個）
                        </p>
                    </div>

                    <!-- 取得件数設定 -->
                    <div class="form-group">
                        <label for="apify_results" class="form-label">
                            <i class="fas fa-list-ol mr-2"></i>
                            取得件数
                        </label>
                        <select id="apify_results" class="form-input">
                            <option value="20">20件（テスト用）</option>
                            <option value="50" selected>50件（推奨）</option>
                            <option value="100">100件</option>
                            <option value="200">200件</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">
                            💰 料金目安: 50件 = 約$0.50、100件 = 約$1.00（処理時間: 通常1〜3分）
                        </p>
                    </div>

                    <!-- 注意事項 -->
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                        <div class="flex">
                            <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-2"></i>
                            <div class="text-xs text-yellow-800">
                                <p class="font-semibold mb-1">⚠️ 注意事項</p>
                                <ul class="list-disc list-inside space-y-1">
                                    <li>Apify APIトークンが環境変数に設定されている必要があります</li>
                                    <li>ハッシュタグは最大10個まで指定可能</li>
                                    <li>取得件数は1〜200件の範囲で指定できます</li>
                                    <li>処理には通常1〜3分かかります（最大5分）</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- Apify実行ボタン -->
                    <button id="apify_fetch_button" class="btn-primary" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
                        <i class="fas fa-robot mr-2"></i>
                        Apifyで自動収集＆AI分析
                    </button>
                </div>

                <!-- CSVダウンロードカード -->
                <div class="card">
                    <div class="card-title">
                        <span><i class="fas fa-download mr-2"></i>データエクスポート</span>
                    </div>

                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <div class="flex">
                            <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                            <div class="text-sm text-blue-700">
                                <p class="font-semibold mb-1">Google Sheetsのデータをダウンロード</p>
                                <p>スプレッドシートに保存されているデータをCSVファイルとしてダウンロードできます</p>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="download_platform" class="form-label">
                            <i class="fas fa-filter mr-2"></i>
                            ダウンロードするデータ
                        </label>
                        <select id="download_platform" class="form-input">
                            <option value="all">全データ（TikTok + Instagram）</option>
                            <option value="tiktok">TikTokのみ</option>
                            <option value="instagram">Instagramのみ</option>
                        </select>
                    </div>

                    <button id="download_button" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        <i class="fas fa-file-download mr-2"></i>
                        CSVダウンロード
                    </button>
                </div>

                <!-- ログカード -->
                <div class="card">
                    <div class="card-title">
                        <span><i class="fas fa-terminal mr-2"></i>実行ログ</span>
                        <button id="clear_logs_button" class="btn-secondary">
                            <i class="fas fa-trash mr-1"></i>クリア
                        </button>
                    </div>
                    <div id="logs" class="logs-container"></div>
                </div>

                <!-- フッター -->
                <div class="text-center text-gray-500 text-sm mt-8">
                    <p>
                        <i class="fas fa-code mr-1"></i>
                        Powered by Cloudflare Pages & Hono
                    </p>
                    <p class="mt-2">
                        <i class="fas fa-book mr-1"></i>
                        使い方については
                        <a href="https://github.com/yourusername/comet-analyzer" class="text-purple-600 hover:underline" target="_blank">
                            ドキュメント
                        </a>
                        を参照してください
                    </p>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `);
});

export default app;
