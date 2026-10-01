let words = [];
let lastScannedUid = null;
let ws;

const grid = document.getElementById('words-grid');
const lastScanEl = document.getElementById('last-scan-uid');
const registeredCountEl = document.getElementById('registered-count');
const totalCountEl = document.getElementById('total-count');

async function loadWords() {
  const res = await fetch('/api/words');
  const data = await res.json();
  words = data.words;
  totalCountEl.textContent = words.length;
  render();
}

function render() {
  const registered = words.filter(w => w.cardUid).length;
  registeredCountEl.textContent = registered;

  grid.innerHTML = words.map(w => `
    <div class="word-card ${w.cardUid ? 'registered' : ''}" id="card-${w.id}">
      <div class="word-header">
        <span class="word-emoji">${w.emoji}</span>
        <div class="word-info">
          <h3>${w.english}</h3>
          <div class="word-hebrew">${w.hebrewNikkud}</div>
        </div>
      </div>
      <div class="word-category">${w.category}</div>
      <div class="card-uid-display ${w.cardUid ? '' : 'none'}">
        ${w.cardUid ? 'UID: ' + w.cardUid : 'No card assigned'}
      </div>
      <div class="word-actions">
        <button class="btn btn-use-last" onclick="assignLastScan('${w.id}')"
          ${lastScannedUid ? '' : 'disabled'}>
          Use Last Scan
        </button>
        ${w.cardUid
          ? `<button class="btn btn-remove" onclick="removeCard('${w.id}')">Remove</button>`
          : ''
        }
      </div>
    </div>
  `).join('');
}

async function assignLastScan(wordId) {
  if (!lastScannedUid) return;

  const res = await fetch(`/api/words/${wordId}/card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: lastScannedUid })
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'Failed to register card');
    return;
  }

  const word = words.find(w => w.id === wordId);
  if (word) word.cardUid = lastScannedUid;
  render();
}

async function removeCard(wordId) {
  const res = await fetch(`/api/words/${wordId}/card`, { method: 'DELETE' });
  if (!res.ok) {
    alert('Failed to remove card');
    return;
  }

  const word = words.find(w => w.id === wordId);
  if (word) word.cardUid = null;
  render();
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.event === 'cardScanned') {
      lastScannedUid = data.uid;
      lastScanEl.textContent = data.uid;
      lastScanEl.style.animation = 'none';
      requestAnimationFrame(() => {
        lastScanEl.style.animation = 'listenPulse 0.5s ease';
      });
      render();
    }

    if (data.event === 'cardRegistered') {
      const word = words.find(w => w.id === data.wordId);
      if (word) word.cardUid = data.uid;
      render();
    }

    if (data.event === 'cardUnregistered') {
      const word = words.find(w => w.id === data.wordId);
      if (word) word.cardUid = null;
      render();
    }
  };

  ws.onclose = () => setTimeout(connectWebSocket, 2000);
}

async function init() {
  await loadWords();

  const statusRes = await fetch('/api/status');
  const status = await statusRes.json();
  if (status.lastScannedUid) {
    lastScannedUid = status.lastScannedUid;
    lastScanEl.textContent = lastScannedUid;
    render();
  }

  connectWebSocket();
}

init();
