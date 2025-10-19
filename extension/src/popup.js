const datasetSelect = document.getElementById('datasetSelect');
const datasetMeta = document.getElementById('datasetMeta');
const headerEditor = document.getElementById('headerEditor');
const preview = document.getElementById('preview');
const statusEl = document.getElementById('status');
const gptOutput = document.getElementById('gptOutput');
const gptGoalInput = document.getElementById('gptGoal');

let datasetCache = new Map();
let activeDatasetId = null;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = type;
  if (message) {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
        statusEl.className = '';
      }
    }, 5000);
  }
}

async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  return callback(tab.id);
}

async function sendToContent(action, payload = {}) {
  return withActiveTab(async tabId => {
    try {
      return await chrome.tabs.sendMessage(tabId, { action, ...payload });
    } catch (error) {
      throw new Error(error?.message || 'Unable to reach content script. Try refreshing the tab.');
    }
  });
}

function renderDatasetOptions() {
  datasetSelect.innerHTML = '';
  const entries = Array.from(datasetCache.values());
  if (!entries.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No data detected yet.';
    datasetSelect.appendChild(option);
    datasetSelect.disabled = true;
    activeDatasetId = null;
    return;
  }
  datasetSelect.disabled = false;
  entries.forEach((dataset, index) => {
    const option = document.createElement('option');
    option.value = dataset.id;
    option.textContent = `${index + 1}. ${dataset.label || dataset.type}`;
    datasetSelect.appendChild(option);
  });
  if (!activeDatasetId || !datasetCache.has(activeDatasetId)) {
    activeDatasetId = entries[0].id;
  }
  datasetSelect.value = activeDatasetId;
  renderActiveDataset();
}

function renderHeaderInputs(dataset) {
  headerEditor.innerHTML = '';
  dataset.headers.forEach((header, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'header-input';
    const label = document.createElement('span');
    label.textContent = `Column ${index + 1}`;
    const input = document.createElement('input');
    input.value = header;
    input.dataset.index = index.toString();
    input.addEventListener('change', handleHeaderChange);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    headerEditor.appendChild(wrapper);
  });
}

function renderPreviewTable(dataset) {
  preview.innerHTML = '';
  if (!dataset.previewRows?.length) {
    preview.textContent = 'No preview available.';
    return;
  }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  dataset.headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  dataset.previewRows.forEach(row => {
    const tr = document.createElement('tr');
    dataset.headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header] || '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  preview.appendChild(table);
}

function renderActiveDataset() {
  const dataset = datasetCache.get(activeDatasetId);
  if (!dataset) {
    datasetMeta.textContent = '';
    headerEditor.innerHTML = '';
    preview.innerHTML = '';
    return;
  }
  datasetMeta.textContent = `${dataset.type.toUpperCase()} · ${dataset.previewRows.length} preview rows`;
  renderHeaderInputs(dataset);
  renderPreviewTable(dataset);
}

async function handleScan() {
  setStatus('Scanning page...', '');
  try {
    const response = await sendToContent('scanPage');
    if (!response?.success) {
      throw new Error(response?.error || 'Scan failed.');
    }
    datasetCache = new Map(response.datasets.map(dataset => [dataset.id, dataset]));
    renderDatasetOptions();
    setStatus(`Found ${datasetCache.size} dataset(s).`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(error.message, 'error');
  }
}

async function handleAutoScroll() {
  setStatus('Auto scrolling...', '');
  try {
    const response = await sendToContent('autoScroll', { options: { wait: 900 } });
    if (!response?.success) throw new Error(response?.error || 'Auto scroll failed.');
    setStatus(`Scrolled ${response.result.stepsTaken} steps.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function handleNextClick() {
  setStatus('Hunting for next buttons...', '');
  try {
    const response = await sendToContent('clickNext');
    if (!response?.success) throw new Error(response?.message || response?.error || 'No button clicked.');
    setStatus(response.message, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function copyDataset(format) {
  if (!activeDatasetId) {
    setStatus('Pick a dataset first.', 'error');
    return;
  }
  try {
    const response = await sendToContent('copyDataset', { id: activeDatasetId, format });
    if (!response?.success) throw new Error(response?.error || 'Copy failed.');
    setStatus(`Copied as ${format.toUpperCase()}.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function handleHeaderChange() {
  if (!activeDatasetId) return;
  const dataset = datasetCache.get(activeDatasetId);
  if (!dataset) return;
  const inputs = headerEditor.querySelectorAll('input');
  const newHeaders = Array.from(inputs).map(input => input.value);
  try {
    const response = await sendToContent('updateHeaders', { id: activeDatasetId, headers: newHeaders });
    if (!response?.success) throw new Error(response?.error || 'Unable to update headers.');
    const updated = { ...dataset, headers: response.dataset.headers, previewRows: response.dataset.previewRows };
    datasetCache.set(activeDatasetId, updated);
    renderActiveDataset();
    setStatus('Headers updated.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function handleGptAssist() {
  const goal = gptGoalInput.value.trim() || 'Identify the most relevant data to scrape.';
  gptOutput.textContent = 'Gathering context...';
  try {
    const contextResponse = await sendToContent('getContextSnapshot', { options: { maxLength: 6000 } });
    if (!contextResponse?.success) throw new Error(contextResponse?.error || 'Unable to read page content.');
    gptOutput.textContent = 'Asking GPT-4.1 mini...';
    const aiResponse = await chrome.runtime.sendMessage({ action: 'gptAssist', goal, context: contextResponse.context });
    if (!aiResponse?.success) throw new Error(aiResponse?.error || 'OpenAI request failed.');
    gptOutput.textContent = JSON.stringify(aiResponse.result, null, 2);
    setStatus('AI suggestion ready.', 'success');
  } catch (error) {
    gptOutput.textContent = `Error: ${error.message}`;
    setStatus(error.message, 'error');
  }
}

function registerEvents() {
  document.getElementById('scanBtn').addEventListener('click', handleScan);
  document.getElementById('autoScrollBtn').addEventListener('click', handleAutoScroll);
  document.getElementById('nextBtn').addEventListener('click', handleNextClick);
  document.getElementById('copyCsvBtn').addEventListener('click', () => copyDataset('csv'));
  document.getElementById('copyJsonBtn').addEventListener('click', () => copyDataset('json'));
  document.getElementById('gptAssistBtn').addEventListener('click', handleGptAssist);
  document.getElementById('openOptions').addEventListener('click', event => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  datasetSelect.addEventListener('change', () => {
    activeDatasetId = datasetSelect.value;
    renderActiveDataset();
  });
}

registerEvents();
renderDatasetOptions();
