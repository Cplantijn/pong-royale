const host = location.origin.replace(/^http/, 'ws');
const ws = new WebSocket(host);
ws.onmessage = msg => handleMessage(JSON.parse(msg.data));

const CANVAS_EASY_ZONE_CUTOFF_RATIO = .5;
const CANVAS_HARD_ZONE_CUTOFF_RATIO = .85;
const CANVAS_MOTION_BLUR_SAMPLES = 5;
let gameState = {};

function handleMessage(msg) {
  switch (msg.msgType) {
    case 'CONNECTED':
      getGameStatus();
      break;
    case 'SEND_TO_LOBBY':
      generateLobby(msg.playerList);
      break;
    case 'GAME_START':
      generateLobby(msg.playerList.map(p => ({...p, isReady: false })), 'Player Lobby', 'Game is about to start...');
      break;
    case 'UPDATE_PLAYERLIST':
      generateLobby(msg.playerList);
      break;
    case 'BALL_SERVED_SPECTATOR':
      gameState = {
        ...msg.gameState,
        ballVertPosition: 0,
        hasSwung: false,
        ballInMotion: true,
        wasSmashed: false,
        direction: 1
      };
      console.log({gameState})
      const players = msg.playerList.map(p => {
        p.isReady = false;

        if (p.id === msg.playerServed.id) {
          return {
            ...p,
            isBeingServed: true,
          };
        }
        return p;
      });

      generateLobby(players, '', `Ball Speed: ${msg.ballSpeed}`);
      drawCanvas()
    default:
    // Boo hoo haa haa
  }
}

function generateLobby(players, title, extraMsg) {
  const gameContainer = document.getElementById('gameContainer');
  const titl = typeof title === 'string' ? title : 'Player Lobby';

  let html = `
    <h1 class="text-center">${titl}</h1>
    <div class="lobby-players">
  `;
  html += players.reduce((htmlString, currentPlayer) => {
    const className = (currentPlayer.isReady || currentPlayer.isBeingServed) ? 'lobby-player is-ready' : 'lobby-player';

    return htmlString.concat(`
      <div>
        <div class="${className}">
          <span>${currentPlayer.name}</span>
        </div>
        ${drawStatus(currentPlayer)}
      </div>
    `)
  }, '');
  html += '</div>';

  if (extraMsg) {
    html += `<h2 class="text-center">${extraMsg}</h2>`;
  }

  gameContainer.innerHTML = html;
}

function drawStatus(player) {
  let html = '<div class="status-container">';
  for (let i = 1; i <= player.lives; i++) {
    const id = i === player.lives ? ' id="lastStatusHeart"' : '';
    html += `<img${id} src="/public/assets/heart.png" alt="Heart" />`;
  }
  html += '</div>';

  return html;
}

function drawCanvas() {
  const canvas = document.getElementById('gameCanvas');
  const canvasCtx = canvas.getContext('2d');

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

    requestAnimationFrame(drawCanvas);
  }
}

function getGameStatus() {
  sendMessage({ msgType: 'GET_SPECTATOR_STATUS' });
}

// WS Sender
function sendMessage(msg) {
  ws.send(JSON.stringify(msg));
}