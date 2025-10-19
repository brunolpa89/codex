const datasetStore = new Map();
let lastScanTimestamp = 0;

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isElementVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function elementToDatasetId(element, prefix) {
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className) {
      const className = normalizeText(current.className).replace(/\s+/g, '.');
      if (className) selector += `.${className}`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  const base = path.slice(-3).join('>') || prefix;
  return `${prefix}-${base}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function buildDataset({ id, type, label, headers, rows }) {
  const dataset = { id, type, label, headers: [...headers], rows: rows.map(row => ({ ...row })) };
  datasetStore.set(id, dataset);
  const previewRows = dataset.rows.slice(0, 15);
  return { id, type, label, headers: [...headers], previewRows };
}

function extractFromTable(table) {
  const headers = [];
  const headerCells = table.querySelectorAll('thead th');
  if (headerCells.length) {
    headerCells.forEach((th, index) => {
      const text = normalizeText(th.textContent) || `Column ${index + 1}`;
      headers.push(text);
    });
  } else {
    const firstRowCells = table.querySelectorAll('tr:first-of-type th, tr:first-of-type td');
    firstRowCells.forEach((cell, index) => {
      const text = normalizeText(cell.textContent) || `Column ${index + 1}`;
      headers.push(text);
    });
  }

  if (!headers.length) return null;

  const rows = [];
  table.querySelectorAll('tbody tr').forEach(row => {
    const rowData = {};
    const cells = row.querySelectorAll('th, td');
    cells.forEach((cell, index) => {
      const header = headers[index] || `Column ${index + 1}`;
      rowData[header] = normalizeText(cell.textContent);
    });
    if (Object.values(rowData).some(value => value)) {
      rows.push(rowData);
    }
  });

  if (!rows.length) {
    const fallbackRows = [];
    table.querySelectorAll('tr').forEach((row, rowIndex) => {
      if (rowIndex === 0) return;
      const rowData = {};
      row.querySelectorAll('th, td').forEach((cell, cellIndex) => {
        const header = headers[cellIndex] || `Column ${cellIndex + 1}`;
        rowData[header] = normalizeText(cell.textContent);
      });
      if (Object.values(rowData).some(value => value)) {
        fallbackRows.push(rowData);
      }
    });
    if (!fallbackRows.length) return null;
    return buildDataset({
      id: elementToDatasetId(table, 'table'),
      type: 'table',
      label: table.getAttribute('aria-label') || headers.join(', ').slice(0, 80),
      headers,
      rows: fallbackRows
    });
  }

  return buildDataset({
    id: elementToDatasetId(table, 'table'),
    type: 'table',
    label: table.getAttribute('aria-label') || headers.join(', ').slice(0, 80),
    headers,
    rows
  });
}

function extractListData(list) {
  const items = Array.from(list.children).filter(child => child.matches('li, article, div'));
  if (items.length < 2) return null;
  const rows = items.map(item => {
    const textContent = normalizeText(item.innerText);
    return { Item: textContent };
  });
  if (!rows.length) return null;
  return buildDataset({
    id: elementToDatasetId(list, 'list'),
    type: 'list',
    label: list.getAttribute('aria-label') || normalizeText(list.previousElementSibling?.textContent) || 'List Items',
    headers: ['Item'],
    rows
  });
}

function extractAriaGrid(grid) {
  const rowElements = grid.querySelectorAll('[role="row"]');
  if (rowElements.length < 2) return null;
  const headers = [];
  const headerCells = grid.querySelectorAll('[role="columnheader"]');
  if (headerCells.length) {
    headerCells.forEach((cell, index) => {
      headers.push(normalizeText(cell.textContent) || `Column ${index + 1}`);
    });
  }
  const rows = [];
  rowElements.forEach(row => {
    const cells = row.querySelectorAll('[role="cell"],[role="gridcell"],[role="columnheader"]');
    if (!cells.length) return;
    const rowData = {};
    cells.forEach((cell, index) => {
      const header = headers[index] || `Column ${index + 1}`;
      rowData[header] = normalizeText(cell.textContent);
    });
    if (Object.values(rowData).some(Boolean)) {
      rows.push(rowData);
    }
  });
  if (!rows.length) return null;
  if (!headers.length) {
    const maxColumns = Math.max(...rows.map(row => Object.keys(row).length));
    for (let i = 0; i < maxColumns; i += 1) {
      headers.push(`Column ${i + 1}`);
    }
  }
  return buildDataset({
    id: elementToDatasetId(grid, 'grid'),
    type: 'grid',
    label: grid.getAttribute('aria-label') || 'ARIA Grid',
    headers,
    rows
  });
}

function extractDefinitionList(dl) {
  const terms = dl.querySelectorAll('dt');
  const definitions = dl.querySelectorAll('dd');
  if (!terms.length || !definitions.length) return null;
  const rows = [];
  for (let i = 0; i < Math.min(terms.length, definitions.length); i += 1) {
    rows.push({ Term: normalizeText(terms[i].textContent), Definition: normalizeText(definitions[i].textContent) });
  }
  if (!rows.length) return null;
  return buildDataset({
    id: elementToDatasetId(dl, 'definition'),
    type: 'definition-list',
    label: 'Definition List',
    headers: ['Term', 'Definition'],
    rows
  });
}

function guessRepeatedCards() {
  const candidates = [];
  document.querySelectorAll('section, main, div').forEach(container => {
    if (container.children.length < 3 || container.children.length > 200) return;
    const classCounts = {};
    Array.from(container.children).forEach(child => {
      const className = normalizeText(child.className);
      if (!className) return;
      classCounts[className] = (classCounts[className] || 0) + 1;
    });
    const dominantClass = Object.entries(classCounts).find(([, count]) => count >= 3);
    if (dominantClass) {
      candidates.push({ container, className: dominantClass[0] });
    }
  });

  const datasets = [];
  candidates.forEach(({ container, className }) => {
    const cards = Array.from(container.children).filter(child => normalizeText(child.className) === className);
    if (cards.length < 3) return;
    const rows = cards.map(card => ({ Content: normalizeText(card.innerText) })).filter(row => row.Content);
    if (rows.length) {
      datasets.push(buildDataset({
        id: elementToDatasetId(container, 'cards'),
        type: 'cards',
        label: `Repeated cards (${className || 'items'})`,
        headers: ['Content'],
        rows
      }));
    }
  });

  return datasets;
}

function scanPage() {
  datasetStore.clear();
  const datasets = [];
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const dataset = extractFromTable(table);
    if (dataset) datasets.push(dataset);
  });

  const lists = document.querySelectorAll('ul, ol');
  lists.forEach(list => {
    const dataset = extractListData(list);
    if (dataset) datasets.push(dataset);
  });

  const grids = document.querySelectorAll('[role="grid"], [role="table"]');
  grids.forEach(grid => {
    const dataset = extractAriaGrid(grid);
    if (dataset) datasets.push(dataset);
  });

  const dls = document.querySelectorAll('dl');
  dls.forEach(dl => {
    const dataset = extractDefinitionList(dl);
    if (dataset) datasets.push(dataset);
  });

  guessRepeatedCards().forEach(dataset => datasets.push(dataset));

  lastScanTimestamp = Date.now();
  return datasets;
}

async function autoScroll({ step = window.innerHeight, maxSteps = 120, idleThreshold = 3, wait = 800 } = {}) {
  let steps = 0;
  let idleCount = 0;
  let lastHeight = document.body.scrollHeight;
  while (steps < maxSteps && idleCount < idleThreshold) {
    window.scrollBy({ top: step, behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, wait));
    const newHeight = document.body.scrollHeight;
    if (newHeight <= lastHeight + 10) {
      idleCount += 1;
    } else {
      idleCount = 0;
    }
    lastHeight = newHeight;
    steps += 1;
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  return { stepsTaken: steps, finalHeight: lastHeight };
}

function findNextButtons() {
  const selectors = ['a', 'button', '[role="button"]', '[role="link"]'];
  const keywords = [/next/i, /more/i, /older/i, /load more/i, /show more/i, />/, /»/, /→/];
  const candidates = [];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      const text = normalizeText(element.innerText || element.getAttribute('aria-label') || element.getAttribute('title'));
      if (!text) return;
      if (keywords.some(regex => regex.test(text))) {
        if (isElementVisible(element) && !element.disabled) {
          candidates.push(element);
        }
      }
    });
  });

  if (!candidates.length) {
    document.querySelectorAll('a[rel="next"], link[rel="next"]').forEach(el => {
      if (el instanceof HTMLLinkElement) {
        const anchor = document.createElement('a');
        anchor.href = el.href;
        candidates.push(anchor);
      } else if (el instanceof HTMLAnchorElement) {
        candidates.push(el);
      }
    });
  }

  return candidates;
}

function clickNextButton() {
  const candidates = findNextButtons();
  if (!candidates.length) {
    return { success: false, message: 'No next or load more button found.' };
  }
  const target = candidates[0];
  if (target instanceof HTMLAnchorElement && target.href && target.href !== '#') {
    target.click();
    return { success: true, message: 'Triggered anchor navigation.' };
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return { success: true, message: 'Clicked next/load more button.' };
}

function datasetToCSV(dataset) {
  const headers = dataset.headers;
  const escapeCell = value => {
    if (value === null || value === undefined) return '';
    const cell = String(value);
    if (/[",\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  const rows = dataset.rows.map(row => headers.map(header => escapeCell(row[header] || '')).join(','));
  return [headers.map(escapeCell).join(','), ...rows].join('\n');
}

function datasetToJSON(dataset) {
  return JSON.stringify(dataset.rows, null, 2);
}

function updateHeaders(dataset, newHeaders) {
  const sanitized = newHeaders.map(header => header && header.trim() ? header.trim() : null);
  const fallbackHeaders = dataset.headers.map((header, index) => sanitized[index] || header || `Column ${index + 1}`);
  const transformedRows = dataset.rows.map(row => {
    const newRow = {};
    dataset.headers.forEach((oldHeader, index) => {
      newRow[fallbackHeaders[index]] = row[oldHeader];
    });
    return newRow;
  });
  dataset.headers = fallbackHeaders;
  dataset.rows = transformedRows;
  return dataset;
}

function collectContextSnapshot({ maxLength = 6000 } = {}) {
  const text = normalizeText(document.body.innerText || '');
  return text.slice(0, maxLength);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'scanPage': {
        const datasets = scanPage();
        sendResponse({ success: true, datasets, timestamp: lastScanTimestamp });
        break;
      }
      case 'autoScroll': {
        const result = await autoScroll(message.options || {});
        sendResponse({ success: true, result });
        break;
      }
      case 'clickNext': {
        const result = clickNextButton();
        sendResponse(result);
        break;
      }
      case 'copyDataset': {
        const dataset = datasetStore.get(message.id);
        if (!dataset) {
          sendResponse({ success: false, error: 'Dataset not found. Please rescan the page.' });
          break;
        }
        const format = message.format || 'csv';
        const content = format === 'json' ? datasetToJSON(dataset) : datasetToCSV(dataset);
        try {
          await navigator.clipboard.writeText(content);
          sendResponse({ success: true, format });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
      }
      case 'updateHeaders': {
        const dataset = datasetStore.get(message.id);
        if (!dataset) {
          sendResponse({ success: false, error: 'Dataset not found. Rescan the page.' });
          break;
        }
        const updated = updateHeaders(dataset, message.headers || []);
        datasetStore.set(message.id, updated);
        sendResponse({ success: true, dataset: {
          id: updated.id,
          headers: [...updated.headers],
          previewRows: updated.rows.slice(0, 15)
        }});
        break;
      }
      case 'getDataset': {
        const dataset = datasetStore.get(message.id);
        if (!dataset) {
          sendResponse({ success: false, error: 'Dataset not found.' });
          break;
        }
        sendResponse({ success: true, dataset });
        break;
      }
      case 'getContextSnapshot': {
        const context = collectContextSnapshot(message.options || {});
        sendResponse({ success: true, context });
        break;
      }
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true;
});
