const host = location.origin.replace(/^http/, 'ws');
const ws = new WebSocket(host);
ws.onmessage = msg => handleMessage(JSON.parse(msg.data));

function handleMessage(msg) {
  switch(msg.action) {
    case 'JOIN_LOBBY':
      hideGameLoading();
      showLobby();
      break;
    default:
      // Boo hoo haa haa
  }
}

function hideGameLoading() {
  document.getElementById('gameLoadingContainer').style.display = 'none';
}

function showLobby() {
  document.getElementById('gameLobby').style.display = 'flex';
}