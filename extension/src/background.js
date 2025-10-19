const OPENAI_STORAGE_KEY = 'monster_scraper_openai_key';

async function saveApiKey(key) {
  await chrome.storage.sync.set({ [OPENAI_STORAGE_KEY]: key });
  return { success: true };
}

async function getApiKey() {
  const result = await chrome.storage.sync.get(OPENAI_STORAGE_KEY);
  return result[OPENAI_STORAGE_KEY] || null;
}

async function callOpenAI(goal, context) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Set it from the options page.');
  }

  const payload = {
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are Monster Scraper, an AI that helps identify scraping strategies. Return JSON with keys "strategy" (string summary), "selectors" (array of CSS selectors if available), and "notes" (optional extra tips).'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Scrape goal: ${goal}\n\nObserved content:\n${context}`
          }
        ]
      }
    ],
    temperature: 0.2
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${errorText}`);
  }

  const data = await response.json();
  const outputText = data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text) || 'No response text available.';

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (err) {
    parsed = { strategy: outputText, selectors: [], notes: 'Model returned unstructured text.' };
  }

  return parsed;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'saveApiKey': {
          const result = await saveApiKey(message.key);
          sendResponse({ success: true, result });
          break;
        }
        case 'getApiKey': {
          const key = await getApiKey();
          sendResponse({ success: true, key });
          break;
        }
        case 'gptAssist': {
          const result = await callOpenAI(message.goal || 'Identify scraping strategy', message.context || '');
          sendResponse({ success: true, result });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});
