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

// 詳細エラーログを追加
function addDetailedErrorLog(error, debugInfo) {
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  const logsContainer = document.getElementById('logs');
  
  // エラーメッセージ
  const errorElement = document.createElement('div');
  errorElement.className = 'log-entry log-error';
  errorElement.innerHTML = `
    <div class="font-bold">
      <span class="log-time">[${timestamp}]</span>
      <i class="fas fa-exclamation-triangle mr-2"></i>
      ${error}
    </div>
  `;
  logsContainer.appendChild(errorElement);
  
  // 解決策の提案
  if (debugInfo?.suggestion) {
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'log-entry log-warning';
    suggestionElement.innerHTML = `
      <div>
        <i class="fas fa-lightbulb mr-2"></i>
        <strong>解決策:</strong> ${debugInfo.suggestion}
      </div>
    `;
    logsContainer.appendChild(suggestionElement);
  }
  
  // デバッグ情報（展開可能）
  if (debugInfo) {
    const debugElement = document.createElement('div');
    debugElement.className = 'log-entry log-info';
    debugElement.style.cursor = 'pointer';
    debugElement.innerHTML = `
      <div>
        <i class="fas fa-bug mr-2"></i>
        <strong>デバッグ情報</strong>
        <i class="fas fa-chevron-down ml-2" id="debug-toggle"></i>
      </div>
      <pre id="debug-details" class="hidden mt-2 text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">${JSON.stringify(debugInfo, null, 2)}</pre>
    `;
    
    debugElement.addEventListener('click', () => {
      const details = debugElement.querySelector('#debug-details');
      const icon = debugElement.querySelector('#debug-toggle');
      if (details.classList.contains('hidden')) {
        details.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
      } else {
        details.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
      }
    });
    
    logsContainer.appendChild(debugElement);
  }
  
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

    if (!response.ok || !data.success) {
      // 詳細なエラー情報を表示
      const errorMessage = data.error || 'サーバーエラーが発生しました';
      addDetailedErrorLog(errorMessage, data.debug);
      
      // バリデーションエラーがある場合
      if (data.validation) {
        if (data.validation.errors && data.validation.errors.length > 0) {
          data.validation.errors.forEach(err => addLog(`❌ ${err}`, 'error'));
        }
        if (data.validation.warnings && data.validation.warnings.length > 0) {
          data.validation.warnings.forEach(warn => addLog(`⚠️ ${warn}`, 'warning'));
        }
      }
      
      // パースエラーがある場合
      if (data.parse_errors && data.parse_errors.length > 0) {
        addLog(`CSVパースエラー: ${data.parse_errors.length}件`, 'error');
        data.parse_errors.slice(0, 5).forEach(err => addLog(`  - ${err}`, 'error'));
        if (data.parse_errors.length > 5) {
          addLog(`  ... 他${data.parse_errors.length - 5}件`, 'warning');
        }
      }
      
      throw new Error(errorMessage);
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
      addLog(`カラムマッピング: ${JSON.stringify(data.column_mapping, null, 2)}`, 'info');
    }
    
    // パフォーマンス情報を表示
    if (data.performance) {
      addLog(`⏱️ 処理時間: ${(data.performance.totalTime / 1000).toFixed(2)}秒`, 'info');
    }
  } catch (error) {
    // エラーメッセージは既に addDetailedErrorLog で表示されているので、
    // ここでは追加のコンテキスト情報のみ表示
    if (!error.message.includes('サーバーエラー')) {
      addLog(`❌ エラー: ${error.message}`, 'error');
    }
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
    addDetailedErrorLog(`ダウンロードエラー: ${error.message}`, {
      suggestion: 'スプレッドシートにデータが存在するか確認してください。環境変数が正しく設定されているか確認してください。',
      error: error.message,
    });
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

// スプレッドシートから読み込み
async function fetchFromSheet() {
  if (appState.processing) {
    addLog('すでに処理中です', 'warning');
    return;
  }

  const sheetButton = document.getElementById('sheet_fetch_button');
  const originalHtml = sheetButton.innerHTML;
  
  try {
    setProcessing(true);
    sheetButton.disabled = true;
    sheetButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>スプレッドシート読み込み中...';

    // パラメータを取得
    const spreadsheetId = document.getElementById('sheet_spreadsheet_id').value.trim();
    const sheetName = document.getElementById('sheet_name').value.trim() || '動画データ';

    // バリデーション
    if (!spreadsheetId) {
      addLog('❌ スプレッドシートIDを入力してください', 'error');
      return;
    }

    addLog('📊 スプレッドシートからデータを読み込み中...', 'info');
    addLog(`📍 スプレッドシートID: ${spreadsheetId}`, 'info');
    addLog(`📍 シート名: ${sheetName}`, 'info');

    // APIリクエスト
    const response = await fetch('/api/fetch-from-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_spreadsheet_id: spreadsheetId,
        source_sheet_name: sheetName,
        target_spreadsheet_id: spreadsheetId, // 同じシートに書き込み
        target_sheet_name: sheetName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      addLog('❌ スプレッドシート読み込みエラー', 'error');
      if (data.error) {
        addDetailedErrorLog(data.error, data.debug);
      }
      
      // バリデーションエラーの詳細表示
      if (data.validation && data.validation.errors.length > 0) {
        data.validation.errors.forEach(err => addLog(`  • ${err}`, 'error'));
      }
      if (data.validation && data.validation.warnings.length > 0) {
        data.validation.warnings.forEach(warn => addLog(`  ⚠️ ${warn}`, 'warning'));
      }
      
      return;
    }

    // 成功時の結果表示
    const result = data.result;
    addLog('✅ スプレッドシート処理が完了しました！', 'success');
    addLog(`📊 データソース: スプレッドシート`, 'info');
    addLog(`🎯 総データ数: ${result.total_count}件`, 'info');
    addLog(`✨ 新規処理: ${result.new_count}件`, 'success');
    addLog(`⏭️ スキップ: ${result.skipped_count}件（既に処理済み）`, 'warning');
    if (result.error_count > 0) {
      addLog(`❌ エラー: ${result.error_count}件`, 'error');
    }

    if (data.performance) {
      addLog(`⚡ 処理時間: ${(data.performance.totalTime / 1000).toFixed(1)}秒`, 'info');
    }

    // 統計カードを更新
    document.getElementById('stats_card').classList.remove('hidden');
    document.getElementById('total_count').textContent = result.total_count;
    document.getElementById('new_count').textContent = result.new_count;
    document.getElementById('skipped_count').textContent = result.skipped_count;
    document.getElementById('error_count').textContent = result.error_count;

    // エラーログの表示
    if (result.errors && result.errors.length > 0) {
      addLog('エラー詳細:', 'error');
      result.errors.forEach((error) => addLog(`  • ${error}`, 'error'));
    }

    // 処理ログの表示
    if (result.logs && result.logs.length > 0) {
      result.logs.forEach((log) => addLog(`  ${log}`, 'info'));
    }

  } catch (error) {
    addLog('❌ 予期しないエラーが発生しました', 'error');
    addDetailedErrorLog(error.message, { error: error.toString() });
    console.error('Sheet Fetch Error:', error);
  } finally {
    setProcessing(false);
    sheetButton.disabled = false;
    sheetButton.innerHTML = originalHtml;
  }
}

// Apify自動データ収集
async function fetchFromApify() {
  if (appState.processing) {
    addLog('すでに処理中です', 'warning');
    return;
  }

  const apifyButton = document.getElementById('apify_fetch_button');
  const originalHtml = apifyButton.innerHTML;
  
  try {
    setProcessing(true);
    apifyButton.disabled = true;
    apifyButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Apify実行中...（数分かかります）';

    // パラメータを取得
    const platform = appState.platform;
    const hashtagsInput = document.getElementById('apify_hashtags').value;
    const resultsPerPage = parseInt(document.getElementById('apify_results').value);

    // ハッシュタグをパース（カンマ区切り、空白を削除、#を削除）
    const hashtags = hashtagsInput
      .split(',')
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(tag => tag.length > 0);

    if (hashtags.length === 0) {
      addLog('❌ ハッシュタグを入力してください', 'error');
      addLog('例: fyp, viral, trending', 'info');
      return;
    }

    if (hashtags.length > 10) {
      addLog('❌ ハッシュタグは最大10個までです', 'error');
      addLog(`現在: ${hashtags.length}個`, 'warning');
      return;
    }

    if (resultsPerPage < 1 || resultsPerPage > 200) {
      addLog('❌ 取得件数は1〜200件の範囲で指定してください', 'error');
      return;
    }

    const platformName = platform === 'tiktok' ? 'TikTok' : 'Instagram';
    addLog(`🚀 Apify経由で${platformName}のデータ収集を開始します`, 'info');
    addLog(`📍 検索ハッシュタグ: ${hashtags.join(', ')}`, 'info');
    addLog(`📊 取得件数: ${resultsPerPage}件`, 'info');
    addLog('⏳ Apifyがデータを収集しています...（通常1-3分かかります）', 'warning');

    // APIリクエスト
    const response = await fetch('/api/fetch-apify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: platform,
        hashtags: hashtags,
        results_per_page: resultsPerPage,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      addLog('❌ Apifyデータ取得エラー', 'error');
      if (data.error) {
        addDetailedErrorLog(data.error, data.debug);
      }
      
      // バリデーションエラーの詳細表示
      if (data.validation && data.validation.errors.length > 0) {
        data.validation.errors.forEach(err => addLog(`  • ${err}`, 'error'));
      }
      if (data.validation && data.validation.warnings.length > 0) {
        data.validation.warnings.forEach(warn => addLog(`  ⚠️ ${warn}`, 'warning'));
      }
      
      return;
    }

    // 成功時の結果表示
    const result = data.result;
    addLog('✅ Apify自動収集が完了しました！', 'success');
    addLog(`📊 データソース: Apify (${platformName})`, 'info');
    addLog(`🎯 総データ数: ${result.total_count}件`, 'info');
    addLog(`✨ 新規追加: ${result.new_count}件`, 'success');
    addLog(`⏭️ スキップ: ${result.skipped_count}件（重複）`, 'warning');
    if (result.error_count > 0) {
      addLog(`❌ エラー: ${result.error_count}件`, 'error');
    }

    if (data.performance) {
      addLog(`⚡ 処理時間: ${(data.performance.totalTime / 1000).toFixed(1)}秒`, 'info');
    }

    // 統計カードを更新
    document.getElementById('stats_card').classList.remove('hidden');
    document.getElementById('total_count').textContent = result.total_count;
    document.getElementById('new_count').textContent = result.new_count;
    document.getElementById('skipped_count').textContent = result.skipped_count;
    document.getElementById('error_count').textContent = result.error_count;

    // エラーログの表示
    if (result.errors && result.errors.length > 0) {
      addLog('エラー詳細:', 'error');
      result.errors.forEach((error) => addLog(`  • ${error}`, 'error'));
    }

    // 処理ログの表示
    if (result.logs && result.logs.length > 0) {
      result.logs.forEach((log) => addLog(`  ${log}`, 'info'));
    }

  } catch (error) {
    addLog('❌ 予期しないエラーが発生しました', 'error');
    addDetailedErrorLog(error.message, { error: error.toString() });
    console.error('Apify Fetch Error:', error);
  } finally {
    setProcessing(false);
    apifyButton.disabled = false;
    apifyButton.innerHTML = originalHtml;
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // イベントリスナー設定
  document.getElementById('process_button').addEventListener('click', processData);
  document.getElementById('download_button').addEventListener('click', downloadCSV);
  document.getElementById('clear_logs_button').addEventListener('click', clearLogs);
  document.getElementById('sheet_fetch_button').addEventListener('click', fetchFromSheet);
  document.getElementById('apify_fetch_button').addEventListener('click', fetchFromApify);
  
  // プラットフォーム選択の変更イベント
  document.getElementById('platform').addEventListener('change', (e) => {
    appState.platform = e.target.value;
    const platformName = e.target.value === 'tiktok' ? 'TikTok' : 'Instagram';
    addLog(`プラットフォームを ${platformName} に切り替えました`, 'info');
  });

  // ファイル選択イベント
  document.getElementById('csv_file').addEventListener('change', updateFileDisplay);

  addLog('アプリケーションが起動しました', 'success');
  addLog('📝 3つの収集方法が使えます:', 'info');
  addLog('  1️⃣ CSV手動アップロード → シンプル', 'info');
  addLog('  2️⃣ スプレッドシート読み込み → Cometデータに指標追加', 'info');
  addLog('  3️⃣ Apify自動収集 → 完全自動（ハッシュタグ検索）', 'info');
});
