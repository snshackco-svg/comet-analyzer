// アプリケーション状態管理
const appState = {
  processing: false,
  platform: 'tiktok', // デフォルトはTikTok
  config: {
    spreadsheet_id: '',
    google_credentials: '',
  },
  logs: [],
};

// ローカルストレージからの設定読み込み
function loadConfig() {
  const savedConfig = localStorage.getItem('comet_analyzer_config');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      appState.config = { ...appState.config, ...parsed };
      updateConfigUI();
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
    }
  }
}

// ローカルストレージへの設定保存
function saveConfig() {
  localStorage.setItem('comet_analyzer_config', JSON.stringify(appState.config));
}

// UI更新
function updateConfigUI() {
  document.getElementById('spreadsheet_id').value = appState.config.spreadsheet_id;
  document.getElementById('google_credentials').value = appState.config.google_credentials;
  
  // プラットフォーム選択を復元
  const platformSelect = document.getElementById('platform');
  if (platformSelect && appState.platform) {
    platformSelect.value = appState.platform;
  }
}

// ログ追加
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  const logEntry = { timestamp, message, type };
  appState.logs.push(logEntry);

  const logsContainer = document.getElementById('logs');
  const logElement = document.createElement('div');
  logElement.className = `log-entry log-${type}`;
  logElement.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;

  logsContainer.appendChild(logElement);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// ログクリア
function clearLogs() {
  appState.logs = [];
  document.getElementById('logs').innerHTML = '';
}

// 処理状態の更新
function setProcessing(processing) {
  appState.processing = processing;
  const button = document.getElementById('process_button');
  const fileInput = document.getElementById('csv_file');

  if (processing) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理中...';
    fileInput.disabled = true;
  } else {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-play mr-2"></i>データ収集＆スプレッドシート反映';
    fileInput.disabled = false;
  }
}

// 統計表示の更新
function updateStats(result) {
  document.getElementById('total_count').textContent = result.total_count || 0;
  document.getElementById('new_count').textContent = result.new_count || 0;
  document.getElementById('skipped_count').textContent = result.skipped_count || 0;
  document.getElementById('error_count').textContent = result.error_count || 0;

  const statsCard = document.getElementById('stats_card');
  statsCard.classList.remove('hidden');
}

// 設定の検証
function validateConfig() {
  if (!appState.config.spreadsheet_id) {
    throw new Error('スプレッドシートIDが設定されていません');
  }
  if (!appState.config.google_credentials) {
    throw new Error('Google認証情報が設定されていません');
  }
  try {
    JSON.parse(appState.config.google_credentials);
  } catch (error) {
    throw new Error('Google認証情報のJSON形式が正しくありません');
  }
}

// メイン処理
async function processData() {
  const fileInput = document.getElementById('csv_file');
  const file = fileInput.files[0];

  if (!file) {
    addLog('CSVファイルを選択してください', 'error');
    return;
  }

  // 設定を保存
  appState.platform = document.getElementById('platform').value;
  appState.config.spreadsheet_id = document.getElementById('spreadsheet_id').value.trim();
  appState.config.google_credentials = document.getElementById('google_credentials').value.trim();
  saveConfig();

  // 検証
  try {
    validateConfig();
  } catch (error) {
    addLog(error.message, 'error');
    return;
  }

  setProcessing(true);
  clearLogs();
  
  const platformName = appState.platform === 'tiktok' ? 'TikTok' : 'Instagram';
  addLog(`【${platformName}】処理を開始します...`);
  addLog(`ファイル: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

  try {
    // FormDataを作成
    const formData = new FormData();
    formData.append('csv_file', file);
    formData.append('config', JSON.stringify({
      platform: appState.platform,
      sheets: {
        spreadsheet_id: appState.config.spreadsheet_id,
        sheet_name: '', // シート名はプラットフォームに応じてバックエンドで自動設定
      },
      google_credentials: appState.config.google_credentials,
      column_mapping: null, // デフォルトマッピングを使用
    }));

    // APIにリクエスト
    addLog('サーバーにデータを送信中...');
    const response = await fetch('/api/process', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'サーバーエラーが発生しました');
    }

    if (!data.success) {
      throw new Error(data.error || '処理に失敗しました');
    }

    // 結果をログに表示
    const result = data.result;
    result.logs.forEach((log) => {
      addLog(log);
    });

    if (result.errors.length > 0) {
      addLog(`⚠️ ${result.errors.length}件のエラーがありました`, 'warning');
      result.errors.forEach((error) => {
        addLog(error, 'error');
      });
    }

    // 統計を更新
    updateStats(result);

    // 完了メッセージ
    addLog(`✅ 処理が完了しました。${result.new_count}件のデータを追加しました。`, 'success');

    // 使用されたカラムマッピングを表示
    if (data.column_mapping) {
      addLog(`カラムマッピング: ${JSON.stringify(data.column_mapping, null, 2)}`);
    }
  } catch (error) {
    addLog(`❌ エラー: ${error.message}`, 'error');
    console.error('処理エラー:', error);
  } finally {
    setProcessing(false);
  }
}

// 設定の展開/折りたたみ
function toggleConfig() {
  const configContent = document.getElementById('config_content');
  const toggleIcon = document.getElementById('config_toggle_icon');

  if (configContent.classList.contains('hidden')) {
    configContent.classList.remove('hidden');
    toggleIcon.classList.remove('fa-chevron-down');
    toggleIcon.classList.add('fa-chevron-up');
  } else {
    configContent.classList.add('hidden');
    toggleIcon.classList.remove('fa-chevron-up');
    toggleIcon.classList.add('fa-chevron-down');
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();

  // イベントリスナー設定
  document.getElementById('process_button').addEventListener('click', processData);
  document.getElementById('config_toggle').addEventListener('click', toggleConfig);
  document.getElementById('clear_logs_button').addEventListener('click', clearLogs);
  
  // プラットフォーム選択の変更イベント
  document.getElementById('platform').addEventListener('change', (e) => {
    appState.platform = e.target.value;
    saveConfig();
    const platformName = e.target.value === 'tiktok' ? 'TikTok' : 'Instagram';
    addLog(`プラットフォームを ${platformName} に切り替えました`, 'info');
  });

  addLog('アプリケーションが起動しました', 'success');
});
