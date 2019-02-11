const host = location.origin.replace(/^http/, 'ws');
const ws = new WebSocket(host);
ws.onmessage = msg => handleMessage(JSON.parse(msg.data));

let localPlayer = {};
let gameState = {};

const CANVAS_EASY_ZONE_CUTOFF_RATIO = .5;
const CANVAS_HARD_ZONE_CUTOFF_RATIO = .85;
const CANVAS_MOTION_BLUR_SAMPLES = 5;

let canvas = null;
let canvasCtx = null;

function handleMessage(msg) {
  switch(msg.msgType) {
    case 'CONNECTED':
      localPlayer.id = msg.connectionId;
      addNewPlayerToServer();
      break;
    case 'UPDATE_PLAYERLIST':
      localPlayer = msg.playerList.find(player => player.id === localPlayer.id) || {};
      drawPlayers(msg.playerList);
      break;
    case 'GAME_START':
      drawGameCountdown();
      break;
    case 'GAME_IN_PROGRESS':
      if (localPlayer.isReady) {
        window.location = '/spectate';
      }
      break;
    case 'BALL_SERVED':
      gameState = {
        ...msg.gameState,
        ballVertPosition: 0,
        hasSwung: false,
        ballInMotion: true,
        wasSmashed: false,
        direction: 1
      }
      setPlayerStatus();
      drawStuffOnCanvas();
      break;
    case 'VOLLEY_FAILED':
      showMessage(msg.playerMessage);
      break;
    case 'LIFE_LOST':
      localPlayer.lives = msg.lives;
      updatePlayerLives();
      break;
    case 'PLAYER_ELIMINATED':
      document.getElementById('header').style.display = 'flex';
      localPlayer.isReady = false;
      showMessage(msg.playerMessage);
      break;
    case 'PLAYER_WIN':
      const message = msg.player === localPlayer.id ? 'You Win!!' : `${msg.player.name} wins!`;
      drawPlayerWinnerScreen(message);
      break;
    case 'GO_TO_LOBBY':
      drawLobby();
      break;
    default:
      // Boo hoo haa haa
  }
}

// Game Stuff
function drawLobby() {
  document.getElementById('header').style.display = 'flex';
  document.body.style.backgroundColor = 'transparent';
  const gameContainer = document.getElementById('gameContainer');
  gameContainer.classList.remove('flex-middle', 'flex-center', 'is-countdown', 'flex-one');
  gameContainer.innerHTML = '';
}

function drawPlayerWinnerScreen(msg) {
  document.getElementById('header').style.display = 'none';
  const gameContainer = document.getElementById('gameContainer');
  gameContainer.classList.remove('flex-middle', 'flex-center', 'is-countdown', 'flex-one');
  gameContainer.innerHTML = `
    <div class="game-canvas-container">
      <canvas id="gameCanvas" width="${window.innerWidth}" height="${window.innerHeight}">
    </div>
  `;

  drawConfetti(msg);
}

async function drawGameCountdown() {
  let logo = '';

  document.getElementById('header').style.display = 'none';
  logo = '<img class="countdown-logo" src="/public/assets/multi_pong_logo.svg" alt="MultiPong Logo" />'

  const gameContainer = document.getElementById('gameContainer');
  gameContainer.innerHTML = `${logo}<h1 class="text-center">Starting the game in...</h1><div id="countdownDigit"><h1 class="text-center animated zoomOut">3</h1></div>`;
  gameContainer.classList.add('flex-middle', 'flex-center', 'is-countdown', 'flex-one');

  let countdown = [2, 1];
  let countdownInterval = null;

  countdownInterval = setInterval(function() {
    document.getElementById('countdownDigit').innerHTML = '';

    if (countdown.length) {
      document.getElementById('countdownDigit').innerHTML = `<h1 class="text-center animated zoomOut">${countdown[0]}</h1>`;
      countdown.shift();
    } else {
      clearInterval(countdownInterval);
      drawCanvas();
    }
  }, 1000);
}

function updatePlayerLives() {
  const lastHeart = document.getElementById('lastStatusHeart');
  let wait = 0;

  if (lastHeart) {
    lastHeart.classList.add('animated', 'fadeOutUp');
    wait = 500;
  }

  setTimeout(() => {
    setPlayerStatus();
  }, wait);
}

// Player Management
function addNewPlayerToServer() {
  const playerName = prompt('What is your name?');
  if (playerName && playerName.length) {
    sendMessage({
      msgType: 'ADD_PLAYER',
      playerName
    })
  } else {
    window.location = '/spectate';
  }
}

function drawPlayers(players) {
  const gameContainer = document.getElementById('gameContainer');
  gameContainer.classList.remove('flex-middle', 'flex-center', 'is-countdown', 'flex-one');

  let html = `
    <h1 class="text-center">Player Lobby</h1>
    <div class="lobby-players">
  `;
  html += players.reduce((htmlString, currentPlayer) => {
    const id = currentPlayer.id == localPlayer.id ? ' id="localPlayer"' : '';
    const className = currentPlayer.isReady ? 'lobby-player is-ready' : 'lobby-player';

    return htmlString.concat(`
      <div${id} class="${className}">
        <span>${currentPlayer.name}</span>
      </div>
    `);

  }, '');
  html += '</div>';
  gameContainer.innerHTML = html;

  const localPlayerPill = document.getElementById('localPlayer');
  localPlayerPill && localPlayerPill.addEventListener('click', function(e) {
    if (localPlayer.isReady) {
      sendMessage({ msgType: 'SET_PLAYER_READYSTATE', player: { isReady: false }});
    } else {
      sendMessage({ msgType: 'SET_PLAYER_READYSTATE', player: { isReady: true }});
    }
  }, 'false');
}


// Canvas Management
function setPlayerStatus() {
  const statusContainer = document.getElementById('playerStatus');
  if (!statusContainer) return;
  html = '<div class="player-lives">';

  for (let i = 1; i <= localPlayer.lives; i++) {
    const id = i === localPlayer.lives ? ' id="lastStatusHeart"' : '';
    html += `<img${id} src="/public/assets/heart.png" alt="Heart" />`;
  }
  html += '</div>';

  html += `
    <div class="player-swing">
      <img class="swing-indicator${gameState.hasSwung ? ' swung': ''}" src="/public/assets/pong_solo.svg" />
    </div>
  `;

  statusContainer.innerHTML = html;
}

function handleCanvasTouchEvent() {
  if (!gameState.hasSwung) {
    if (gameState.ballVertPosition > canvas.height * CANVAS_EASY_ZONE_CUTOFF_RATIO) {
      if (gameState.ballVertPosition > canvas.height * CANVAS_HARD_ZONE_CUTOFF_RATIO) {
        gameState.ballVelocity = gameState.ballVelocity * 2;
        gameState.smashedBall = true;
        vibrate(100);
      } else {
        gameState.ballVelocity = gameState.ballVelocity * 1.2;
        vibrate(50);
      }

      gameState.direction = -1;
    } else {
      vibrate(10);
    }

    gameState.hasSwung = true;
  }

  setPlayerStatus();
}

function drawCanvas() {
  const gameContainer = document.getElementById('gameContainer');
  gameContainer.classList.remove('flex-middle', 'flex-center', 'is-countdown', 'flex-one');
  gameContainer.innerHTML = `
    <div class="game-canvas-container">
      <div id="playerStatus"></div>
      <canvas id="gameCanvas" width="${window.innerWidth}" height="${window.innerHeight}">
    </div>
  `;

  canvas = document.getElementById('gameCanvas');
  canvasCtx = canvas.getContext('2d');
  canvas.addEventListener('touchstart', handleCanvasTouchEvent, false);

  setPlayerStatus();
  drawStuffOnCanvas();
  sendMessage({ msgType: 'SET_PLAYER_CANVAS_READY' });
}

function drawStuffOnCanvas() {
  if (!canvasCtx) return;

  // Set up background
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.fillStyle = '#337201';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Easy Hit Zone
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  canvasCtx.fillRect(0, canvas.height * CANVAS_EASY_ZONE_CUTOFF_RATIO, canvas.width, canvas.height * (CANVAS_HARD_ZONE_CUTOFF_RATIO - CANVAS_EASY_ZONE_CUTOFF_RATIO));

  // Draw Hard Hit Zone
  canvasCtx.fillStyle = '#ef8917';
  canvasCtx.fillRect(0, canvas.height * CANVAS_HARD_ZONE_CUTOFF_RATIO, canvas.width, canvas.height - (canvas.height * CANVAS_HARD_ZONE_CUTOFF_RATIO));

  // Smash Zone Text
  canvasCtx.font = '24px Arial';
  canvasCtx.textAlign = 'center'; 
  canvasCtx.fillStyle = '#fff';
  canvasCtx.fillText('💯🏓🔥 Smash Zone!! 💯🏓🔥', canvas.width / 2, canvas.height - (canvas.height * ((1 - CANVAS_HARD_ZONE_CUTOFF_RATIO) / 2) - 12));

  // Draw Ball
  if (gameState.ballInMotion) {
    if (gameState.ballVelocity > 10) {
      for (let i = 1; i < CANVAS_MOTION_BLUR_SAMPLES; i++) {
        canvasCtx.beginPath();
        canvasCtx.arc((canvas.width / 2), gameState.ballVertPosition - (i + (gameState.ballVelocity / 2)), 20, 0, Math.PI * 2);
        canvasCtx.fillStyle = `rgba(255, 255, 255, ${i / 10})`;
        canvasCtx.fill();
        canvasCtx.closePath();
      }
    }

    canvasCtx.beginPath();
    canvasCtx.arc((canvas.width / 2), gameState.ballVertPosition, 20, 0, Math.PI * 2);
    canvasCtx.fillStyle = "#fff";
    canvasCtx.fill();
    canvasCtx.closePath();
    gameState.ballVertPosition += (gameState.ballVelocity * gameState.direction);

    if (gameState.ballVertPosition >= canvas.height) {
      gameState.ballInMotion = false;
      gameState.hasSwung = false;
      setPlayerStatus();
      sendMessage({ msgType: 'VOLLEY_FAILED' });
    }

    if (gameState.ballVertPosition <= 0) {
      gameState.ballInMotion = false;
      gameState.hasSwung = false;
      setPlayerStatus();
      sendMessage({ msgType: 'VOLLEY_SUCCESS', wasSmashed: gameState.wasSmashed });
    }

    requestAnimationFrame(drawStuffOnCanvas);
  } 
} 

// WS Sender
function sendMessage(msg) {
  ws.send(JSON.stringify(Object.assign({}, { connectionId: localPlayer.id }, msg)));
}

// Notifications
function showMessage(message) {
  const messageContainer = document.getElementById('messageContainer');
  if (!messageContainer) return;

  messageContainer.innerHTML = `
    <div class="message-content">
      ${message}
    </div>
  `;

  messageContainer.classList.add('open');

  setTimeout(function() {
    messageContainer.classList.remove('open');
  }, 2800);
}

// Misc
function vibrate(ms) {
  if (window.navigator.vibrate) {
    window.navigator.vibrate(ms);
  }
}
