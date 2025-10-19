const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveKey');
const clearButton = document.getElementById('clearKey');
const statusEl = document.getElementById('status');

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = type;
  if (message) {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
        statusEl.className = '';
      }
    }, 4000);
  }
}

async function loadKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    if (response?.success && response.key) {
      apiKeyInput.value = response.key;
    }
  } catch (error) {
    console.error('Unable to load API key', error);
  }
}

async function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith('sk-')) {
    setStatus('Key should start with "sk-".', 'error');
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({ action: 'saveApiKey', key });
    if (!response?.success) throw new Error(response?.error || 'Save failed.');
    setStatus('API key saved.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function clearKey() {
  apiKeyInput.value = '';
  try {
    const response = await chrome.runtime.sendMessage({ action: 'saveApiKey', key: '' });
    if (!response?.success) throw new Error(response?.error || 'Clear failed.');
    setStatus('API key cleared.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

saveButton.addEventListener('click', saveKey);
clearButton.addEventListener('click', clearKey);

loadKey();
