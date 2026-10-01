const screens = {
  welcome: document.getElementById('screen-welcome'),
  playing: document.getElementById('screen-playing'),
  gameover: document.getElementById('screen-gameover')
};

const els = {
  btnStart: document.getElementById('btn-start'),
  startError: document.getElementById('start-error'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  welcomeError: document.getElementById('welcome-error'),
  nikkudWelcome: document.getElementById('nikkud-toggle-welcome'),
  nikkudGame: document.getElementById('nikkud-toggle-game'),
  roundNumber: document.getElementById('round-number'),
  totalRounds: document.getElementById('total-rounds'),
  turnBanner: document.getElementById('turn-banner'),
  wordDisplay: document.getElementById('word-display'),
  wordFeedback: document.getElementById('word-feedback'),
  wordReveal: document.getElementById('word-reveal'),
  revealEmoji: document.getElementById('reveal-emoji'),
  revealEnglish: document.getElementById('reveal-english'),
  scoreValue1: document.getElementById('score-value-1'),
  scoreValue2: document.getElementById('score-value-2'),
  scorePlayer1: document.getElementById('score-player1'),
  scorePlayer2: document.getElementById('score-player2'),
  timerBar: document.getElementById('timer-bar'),
  confettiContainer: document.getElementById('confetti-container'),
  gameoverTitle: document.getElementById('gameover-title'),
  finalScore1: document.getElementById('final-score-1'),
  finalScore2: document.getElementById('final-score-2'),
  trophy: document.getElementById('trophy')
};

let ws;
let showNikkud = true;
let currentWord = null;
let audioCtx;
let timerWarningTimeout;

// ===== Sound Effects =====

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playChime() {
  const ctx = getAudioCtx();
  [523, 659, 784].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2), i * 120);
  });
}

function playCorrect() {
  playTone(784, 0.15);
  setTimeout(() => playTone(1047, 0.3), 100);
}

function playWrong() {
  playTone(200, 0.3, 'square', 0.15);
}

function playGameOver() {
  const notes = [262, 294, 330, 349, 392, 440, 494, 523];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15), i * 80);
  });
}

function playTick() {
  playTone(1000, 0.05, 'sine', 0.1);
}

// ===== Screen Management =====

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== Confetti =====

function spawnConfetti() {
  els.confettiContainer.innerHTML = '';
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE066', '#FF8E53', '#2ECC71', '#9B59B6', '#3498DB'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.width = (8 + Math.random() * 12) + 'px';
    piece.style.height = (8 + Math.random() * 12) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px';
    els.confettiContainer.appendChild(piece);
  }
  setTimeout(() => { els.confettiContainer.innerHTML = ''; }, 4000);
}

// ===== Timer =====

function startTimer(durationMs) {
  clearTimeout(timerWarningTimeout);
  els.timerBar.style.transition = 'none';
  els.timerBar.style.width = '100%';
  els.timerBar.classList.remove('warning');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.timerBar.style.transition = `width ${durationMs / 1000}s linear`;
      els.timerBar.style.width = '0%';
    });
  });

  timerWarningTimeout = setTimeout(() => {
    els.timerBar.classList.add('warning');
    for (let i = 0; i < 5; i++) {
      setTimeout(playTick, i * 1000);
    }
  }, durationMs - 5000);
}

function stopTimer() {
  clearTimeout(timerWarningTimeout);
  const currentWidth = els.timerBar.getBoundingClientRect().width;
  const parentWidth = els.timerBar.parentElement.getBoundingClientRect().width;
  els.timerBar.style.transition = 'none';
  els.timerBar.style.width = (currentWidth / parentWidth * 100) + '%';
}

// ===== UI Updates =====

function updateWord(word) {
  currentWord = word;
  if (!word) {
    els.wordDisplay.textContent = '';
    return;
  }
  els.wordDisplay.textContent = showNikkud ? word.hebrewNikkud : word.hebrew;
  els.wordDisplay.style.animation = 'none';
  requestAnimationFrame(() => {
    els.wordDisplay.style.animation = 'wordAppear 0.5s ease';
  });
}

function updateScores(scores) {
  els.scoreValue1.textContent = scores.player1;
  els.scoreValue2.textContent = scores.player2;
}

function showFeedback(text, color) {
  els.wordFeedback.textContent = text;
  els.wordFeedback.style.color = color;
  setTimeout(() => { els.wordFeedback.textContent = ''; }, 2000);
}

function revealWord(word) {
  els.wordReveal.classList.remove('hidden');
  els.revealEmoji.textContent = word.emoji;
  els.revealEnglish.textContent = word.english;
}

function hideReveal() {
  els.wordReveal.classList.add('hidden');
}

function pulseScore(player) {
  const el = player === 'player1' ? els.scorePlayer1 : els.scorePlayer2;
  el.classList.remove('score-pulse');
  requestAnimationFrame(() => el.classList.add('score-pulse'));
  setTimeout(() => el.classList.remove('score-pulse'), 600);
}

function shakeWord() {
  els.wordDisplay.classList.remove('word-shake');
  requestAnimationFrame(() => els.wordDisplay.classList.add('word-shake'));
  setTimeout(() => els.wordDisplay.classList.remove('word-shake'), 600);
}

function highlightWinner(player) {
  const el = player === 'player1' ? els.scorePlayer1 : els.scorePlayer2;
  el.classList.add('player-winner');
  setTimeout(() => el.classList.remove('player-winner'), 3000);
}

function setActivePlayer(player) {
  els.scorePlayer1.classList.toggle('active-turn', player === 'player1');
  els.scorePlayer2.classList.toggle('active-turn', player === 'player2');
  els.turnBanner.textContent = player === 'player1' ? "Player 1's Turn" : "Player 2's Turn";
  els.turnBanner.className = 'turn-banner ' + (player === 'player1' ? 'player1-bg' : 'player2-bg');
}

function clearActivePlayer() {
  els.scorePlayer1.classList.remove('active-turn');
  els.scorePlayer2.classList.remove('active-turn');
  els.turnBanner.textContent = '';
  els.turnBanner.className = 'turn-banner';
}

// ===== WebSocket =====

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => console.log('Connected to server');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleEvent(data);
  };

  ws.onclose = () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(connectWebSocket, 2000);
  };
}

function sendEvent(event, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, ...payload }));
  }
}

function handleEvent(data) {
  switch (data.event) {
    case 'connected':
      showNikkud = data.showNikkud;
      els.nikkudWelcome.checked = showNikkud;
      els.nikkudGame.checked = showNikkud;
      if (data.status === 'playing' && data.currentWord) {
        showScreen('playing');
        updateWord(data.currentWord);
        updateScores(data.scores);
        els.roundNumber.textContent = data.roundNumber;
        els.totalRounds.textContent = data.totalRounds;
        if (data.currentPlayer) setActivePlayer(data.currentPlayer);
      }
      break;

    case 'gameStarted':
      if (els.startError) els.startError.textContent = '';
      showScreen('playing');
      els.totalRounds.textContent = data.totalRounds;
      hideReveal();
      break;

    case 'startError':
      if (els.startError) els.startError.textContent = data.message;
      break;

    case 'newRound':
      showScreen('playing');
      hideReveal();
      els.wordFeedback.textContent = '';
      els.roundNumber.textContent = data.roundNumber;
      els.totalRounds.textContent = data.totalRounds;
      updateWord(data.word);
      updateScores(data.scores);
      startTimer(data.roundDurationMs || 30000);
      playChime();
      break;

    case 'wrongAnswer': {
      const name = data.player === 'player1' ? 'Player 1' : 'Player 2';
      showFeedback(`${name} - Try again!`, 'var(--wrong)');
      shakeWord();
      playWrong();
      break;
    }

    case 'roundResult': {
      stopTimer();
      const winnerName = data.winner === 'player1' ? 'Player 1' : 'Player 2';
      showFeedback(`${winnerName} got it! ⭐`, 'var(--correct)');
      updateScores(data.scores);
      pulseScore(data.winner);
      highlightWinner(data.winner);
      revealWord(data.word);
      spawnConfetti();
      playCorrect();
      break;
    }

    case 'roundTimeout': {
      stopTimer();
      const who = data.currentPlayer === 'player2' ? 'Player 2' : 'Player 1';
      showFeedback(`${who} - Time's up! ⏰`, '#E67E22');
      if (data.word) revealWord(data.word);
      break;
    }

    case 'roundSkipped':
      stopTimer();
      showFeedback('Skipped!', '#95A5A6');
      if (data.word) revealWord(data.word);
      break;

    case 'gameOver': {
      playGameOver();
      clearActivePlayer();
      setTimeout(() => {
        showScreen('gameover');
        els.finalScore1.textContent = data.scores.player1;
        els.finalScore2.textContent = data.scores.player2;

        if (data.winner === 'tie') {
          els.gameoverTitle.textContent = "It's a Tie! 🤝";
        } else {
          const name = data.winner === 'player1' ? 'Player 1' : 'Player 2';
          els.gameoverTitle.textContent = `${name} Wins! 🎉`;
        }
        spawnConfetti();
      }, 800);
      break;
    }

    case 'nikkudChanged':
      showNikkud = data.show;
      els.nikkudWelcome.checked = showNikkud;
      els.nikkudGame.checked = showNikkud;
      if (currentWord) updateWord(currentWord);
      break;

    case 'cardScanned':
      break;

    case 'startError':
      showStartError(data.message);
      break;
  }
}

function showStartError(message) {
  if (!els.welcomeError) return;
  els.welcomeError.textContent = message;
  els.welcomeError.classList.add('visible');
  clearTimeout(showStartError._t);
  showStartError._t = setTimeout(() => {
    els.welcomeError.classList.remove('visible');
  }, 5000);
}

// ===== Event Listeners =====

els.btnStart.addEventListener('click', () => {
  if (audioCtx) audioCtx.resume();
  getAudioCtx();
  if (els.welcomeError) els.welcomeError.classList.remove('visible');
  sendEvent('startGame');
});

els.btnPlayAgain.addEventListener('click', () => {
  sendEvent('startGame');
});

function handleNikkudToggle(e) {
  showNikkud = e.target.checked;
  els.nikkudWelcome.checked = showNikkud;
  els.nikkudGame.checked = showNikkud;
  sendEvent('toggleNikkud', { show: showNikkud });
  if (currentWord) updateWord(currentWord);
}

els.nikkudWelcome.addEventListener('change', handleNikkudToggle);
els.nikkudGame.addEventListener('change', handleNikkudToggle);

// ===== Init =====

document.fonts.ready.then(() => {
  connectWebSocket();
});
