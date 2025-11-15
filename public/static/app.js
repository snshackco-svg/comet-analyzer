// アプリケーション状態管理
const appState = {
  processing: false,
  platform: 'tiktok', // デフォルトはTikTok
  logs: [],
};

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

// メイン処理
async function processData() {
  const fileInput = document.getElementById('csv_file');
  const file = fileInput.files[0];

  if (!file) {
    addLog('CSVファイルを選択してください', 'error');
    return;
  }

  appState.platform = document.getElementById('platform').value;

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
        spreadsheet_id: '', // 環境変数から取得
        sheet_name: '', // シート名はバックエンドで自動設定
      },
      google_credentials: '', // 環境変数から取得
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

// CSVダウンロード処理
async function downloadCSV() {
  const downloadButton = document.getElementById('download_button');
  const platform = document.getElementById('download_platform').value;
  
  const originalHtml = downloadButton.innerHTML;
  downloadButton.disabled = true;
  downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>ダウンロード中...';

  try {
    addLog('CSVダウンロードを開始...', 'info');
    
    const response = await fetch(`/api/download?platform=${platform}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'ダウンロードに失敗しました');
    }

    // Blobとしてダウンロード
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // ファイル名を取得（レスポンスヘッダーから）
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'comet_analyzer.csv';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    addLog(`✅ CSVダウンロード完了: ${filename}`, 'success');
  } catch (error) {
    addLog(`❌ ダウンロードエラー: ${error.message}`, 'error');
    console.error('ダウンロードエラー:', error);
  } finally {
    downloadButton.disabled = false;
    downloadButton.innerHTML = originalHtml;
  }
}

// ファイル選択時の表示更新
function updateFileDisplay() {
  const fileInput = document.getElementById('csv_file');
  const file = fileInput.files[0];
  
  if (file) {
    addLog(`ファイルを選択: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'success');
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // イベントリスナー設定
  document.getElementById('process_button').addEventListener('click', processData);
  document.getElementById('download_button').addEventListener('click', downloadCSV);
  document.getElementById('clear_logs_button').addEventListener('click', clearLogs);
  
  // プラットフォーム選択の変更イベント
  document.getElementById('platform').addEventListener('change', (e) => {
    appState.platform = e.target.value;
    const platformName = e.target.value === 'tiktok' ? 'TikTok' : 'Instagram';
    addLog(`プラットフォームを ${platformName} に切り替えました`, 'info');
  });

  // ファイル選択イベント
  document.getElementById('csv_file').addEventListener('change', updateFileDisplay);

  addLog('アプリケーションが起動しました', 'success');
  addLog('📝 設定不要！CSVファイルをアップロードするだけで使えます', 'info');
});
