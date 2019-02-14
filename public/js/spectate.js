const host = location.origin.replace(/^http/, 'ws');
const ws = new WebSocket(host);
ws.onmessage = msg => handleMessage(JSON.parse(msg.data));

let gameState = {};
let smashTimeout = null;

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
    case 'PLAYER_SMASHED':
      playSmashed(msg.message);
      break;
    case 'UPDATE_PLAYERLIST':
      generateLobby(msg.playerList);
      break;
    case 'BALL_SERVED_SPECTATOR':
      gameState = msg.gameState;

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
    case 'PLAYER_WIN':
      drawPlayerWinnerScreen(`${msg.player.name} wins!`);
      break;
    case 'VOLLEY_FAILED':
      showMessage(msg.playerMessage);
      break;
    case 'PLAYER_ELIMINATED':
      showMessage(msg.playerMessage);
      break;
    default:
    // Boo hoo haa haa
  }
}

function playSmashed(msg) {
  clearTimeout(smashTimeout);

  const smashContainer = document.getElementById('smashContainer');
  smashContainer.style.display = 'flex';
  smashContainer.innerHTML = `
    <h1 class="animated wobble text-center">🏓💯🔥🔥💯🏓</h1>
    <h1 class="animated tada">${msg}</h1>
    <h1 class="animated wobble text-center">🏓💯🔥🔥💯🏓</h1>
  `;

  smashTimeout = setTimeout(function() {
    smashContainer.style.display = 'none';
    smashContainer.innerHTML = '';
  }, 2200);
}

function generateLobby(players, title, extraMsg) {
  document.getElementById('header').style.display = 'flex';
  document.body.style.backgroundColor = 'transparent';

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

function getGameStatus() {
  sendMessage({ msgType: 'GET_SPECTATOR_STATUS' });
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

  setTimeout(function () {
    messageContainer.classList.remove('open');
  }, 2800);
}

// WS Sender
function sendMessage(msg) {
  ws.send(JSON.stringify(msg));
}