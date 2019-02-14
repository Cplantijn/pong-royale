const fastify = require('fastify')();
const path = require('path');
const uuid = require('uuid/v4');

require('./gameState');

const SERVER_PORT = 3000;
const connectedClients = {};

fastify.register(require('fastify-ws'));
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

fastify.get('/', (req, res) => {
  if (GameState.isGameActive()) {
    res.redirect('/spectate');
  } else {
    res.sendFile('game.html');
  }
});

fastify.get('/spectate', (req, res) => {
  res.sendFile('spectate.html');
});

fastify.ready(err => {
  if (err) throw err;

  // Websockets
  fastify.ws.on('connection', socket => {
    // Register Individual Socket
    const socketId = uuid();
    connectedClients[socketId] = socket;

    // Send connection back
    socket.send(JSON.stringify({ msgType: 'CONNECTED', connectionId: socketId }));

    socket.on('message', msg => {
      if (!msg || !msg.length) return;
      const payload = JSON.parse(msg);

      switch (payload.msgType) {
        case 'ADD_PLAYER':
          GameState.createPlayer({
            id: payload.connectionId,
            name: payload.playerName
          });

          sendMessageToAll({
            msgType: 'UPDATE_PLAYERLIST',
            playerList: GameState.getPlayers(),
            eventType: 'PLAYER_ADDED'
          });
          break;
        case 'SET_PLAYER_READYSTATE':
          GameState.setPlayerById(socketId, payload.player);

          sendMessageToAll({
            msgType: 'UPDATE_PLAYERLIST',
            playerList: GameState.getPlayers(),
            eventType: 'PLAYER_READY_TOGGLE'
          });

          const readyPlayers = GameState.getPlayers().filter(p => p.isReady);
          if (readyPlayers.length > 1 && GameState.allPlayersReady()) {
            GameState.activateGame();
            sendMessageToAll({
              msgType: 'GAME_START',
              playerList: GameState.getPlayers().filter(p => p.isReady)
            });
          }
          break;
        case 'SET_PLAYER_CANVAS_READY':
          GameState.setPlayerCanvasReady(socketId);

          if (GameState.allCanvasesReady()) {
            GameState.resetVolley();
            const playerServed = GameState.serveBallToRandomPlayer();
            sendMessageToClient(playerServed.id, {
              msgType: 'BALL_SERVED',
              gameState: {
                ballVelocity: GameState.getBallVelocity()
              },
              player: GameState.getPlayerById(socketId)
            });

            sendMessageToAll({
              msgType: 'BALL_SERVED_SPECTATOR',
              ballSpeed: `~${(GameState.getBallVelocity() * 16).toFixed(2)} units per second`,
              playerList: GameState.getPlayers().filter(p => p.isCanvasReady),
              gameState: { ballVelocity: GameState.getBallVelocity() },
              playerServed
            })
          }
          break;
        case 'GET_PLAYERLIST':
          if (GameState.isGameActive()) {
            socket.send(JSON.stringify({
              msgType: 'GAME_IN_PROGRESS',
              playerList: GameState.getPlayers()
            }))
          } else {
            socket.send(JSON.stringify({
              msgType: 'UPDATE_PLAYERLIST',
              playerList: GameState.getPlayers()
            }));
          }
          break;
        case 'VOLLEY_FAILED': {
          let scoringPlayer = 'The Server';
          const runningVolley = GameState.getVolleyTally();
  
          if (runningVolley.length) {
            scoringPlayer = runningVolley[runningVolley.length - 1].name;
          }

          const speed = `~${(GameState.getBallVelocity() * 16).toFixed(2)} units per second`;
          const updatedPlayer = GameState.removeLifeFromPlayer(socketId);
          const playersLeft = GameState.getPlayers().filter(p => p.isReady && p.lives > 0);

          let playerMessage;

          sendMessageToClient(socketId, {
            msgType: 'LIFE_LOST',
            lives: updatedPlayer.lives
          });

          if (updatedPlayer.lives > 0) {
            playerMessage = `<strong>${GameState.getPlayerById(socketId).name}</strong> was defeated by <strong>${scoringPlayer}</strong> with a ball clocked at <strong>${speed}</strong>.<br />Next Serve Coming Soon`;

            sendMessageToAll({
              msgType: 'VOLLEY_FAILED',
              playerMessage
            }, [socketId]);

            sendMessageToClient(socketId, {
              msgType: 'VOLLEY_FAILED',
              playerMessage: `<strong>${scoringPlayer}</strong> bested you with a ball clocked at <strong>${speed}</strong>.<br />Next Serve Coming Soon`
            });

          } else {
            sendMessageToClient(socketId, {
              msgType: 'PLAYER_ELIMINATED',
              playerMessage: `You have been <div class="animated heartBeat"><span class="extra">ELIMINATED</span> by ${scoringPlayer}</div>`,
              playerList: playersLeft
            });

            const playersRemain = `<strong>${playersLeft.length}</strong> players remain`;
            playerMessage = `<div class="animated heartBeat"><span class="extra">${GameState.getPlayerById(socketId).name} has been ELIMINATED</span></div> by <strong>${scoringPlayer}</strong> with a ball clocked at <strong>${speed}</strong>.<br />${playersRemain}<br/>Next Serve Coming Soon`;
            
            sendMessageToAll({
              msgType: 'PLAYER_ELIMINATED',
              playerMessage: `<strong>${GameState.getPlayerById(socketId).name}</strong> has been <div class="animated heartBeat"><span class="extra">ELIMINATED</span> by ${scoringPlayer}</div>`,
              playerList: playersLeft,
              allPlayers: GameState.getPlayers()
            }, [socketId]);
          }

          if (playersLeft.length > 1) {
            setTimeout(function () {
              GameState.resetVolley();
              GameState.resetBallVelocity();

              const playerServed = GameState.serveBallToRandomPlayer();
              sendMessageToClient(playerServed.id, {
                msgType: 'BALL_SERVED',
                gameState: {
                  ballVelocity: GameState.getBallVelocity()
                }
              });

              sendMessageToAll({
                msgType: 'BALL_SERVED_SPECTATOR',
                ballSpeed: `~${(GameState.getBallVelocity() * 16).toFixed(2)} units per second`,
                playerList: GameState.getPlayers().filter(p => p.isCanvasReady),
                gameState: { ballVelocity: GameState.getBallVelocity() },
                playerServed
              })
            }, 3500);
          } else {
            sendMessageToAll({
              msgType: 'PLAYER_WIN',
              player: playersLeft[0]
            });

            setTimeout(function() {
              GameState.resetEverything();
              sendMessageToAll({
                msgType: 'GO_TO_LOBBY'
              });

              setTimeout(function() {
                sendMessageToAll({
                  msgType: 'UPDATE_PLAYERLIST',
                  playerList: GameState.getPlayers()
                });
              }, 200);
            }, 10000);
          }
          break;
        }
        case 'VOLLEY_SUCCESS': {
          GameState.increaseBallVelocity(payload.wasSmashed);
          GameState.tallyVolley(socketId);
          const playerServed = GameState.serveBallToRandomPlayer(socketId);

          sendMessageToClient(playerServed.id, {
            msgType: 'BALL_SERVED',
            gameState: { ballVelocity: GameState.getBallVelocity()}
          });

          sendMessageToAll({
            msgType: 'BALL_SERVED_SPECTATOR',
            ballSpeed: `~${(GameState.getBallVelocity() * 16).toFixed(2)} units per second`,
            playerList: GameState.getPlayers().filter(p => p.isCanvasReady),
            gameState: { ballVelocity: GameState.getBallVelocity() },
            playerServed
          })
          break;
        }
        case 'PLAYER_SMASHED':
          sendMessageToAll({
            msgType: 'PLAYER_SMASHED',
            message: `${GameState.getPlayerById(socketId).name} SMASHED THE BALL AT ${((GameState.getBallVelocity() * 2) * 16).toFixed(2)} UNITS/S!`
          });
          break;
        case 'GET_SPECTATOR_STATUS':
          if (!GameState.isGameActive()) {
            sendMessageToClient(socketId, {
              msgType: 'SEND_TO_LOBBY',
              playerList: GameState.getPlayers()
            });
          }
          break;
        default:
        // Nada
      }
    });

    socket.on('close', () => {
      console.log(`Client ${socketId} Disconnected`);
      
      GameState.removePlayerById(socketId);
      delete connectedClients[socketId];

      if (!global.GameState.getPlayers().filter(p => p.isReady).length) {
        global.GameState.resetGame();
      }

      if (global.GameState.isGameActive()) {
        sendMessageToAll({
          msgType: 'GAME_IN_PROGRESS',
          playerList: global.GameState.getPlayers()
        });
      } else {
        sendMessageToAll({
          msgType: 'UPDATE_PLAYERLIST',
          playerList: global.GameState.getPlayers()
        });
      }
    });
  });
});

function sendMessageToClient(socketId, msg) {
  if (!connectedClients[socketId]) {
    console.error(`Error finding client ${socketId}`);
  } else {
    connectedClients[socketId].send(JSON.stringify(msg));
  }
}
function sendMessageToAll(msg, excludeIds) {
  Object.keys(connectedClients).forEach(clientId => {
    if (!excludeIds || !excludeIds.includes(clientId)) {
      connectedClients[clientId].send(JSON.stringify(msg));
    }
  });
}

// Start Server
fastify.listen(SERVER_PORT, '0.0.0.0', (err, address) => {
  if (err) throw err;
  console.log(`Webserver listening on ${address}`);
});