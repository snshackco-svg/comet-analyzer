import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';

type Bindings = {
  AI?: any; // Cloudflare AI binding (optional)
};

const app = new Hono<{ Bindings: Bindings }>();

// 静的ファイルの提供
app.use('/static/*', serveStatic({ root: './public' }));

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
