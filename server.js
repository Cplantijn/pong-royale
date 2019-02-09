const fastify = require('fastify')();
const path = require('path');

const SERVER_PORT = 3000;

// Game Logic
let gameIsRunning = false;

fastify.register(require('fastify-ws'));
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

fastify.get('/', (req, res) => {
  res.sendFile('game.html');
});

fastify.ready(err => {
  if (err) throw err;

  // Websockets
  fastify.ws.on('connection', socket => {
    socket.on('message', msg => socket.send(msg));
    socket.on('close', () => console.log('Client disconnected.'));

    if (!gameIsRunning) {
      socket.send(JSON.stringify({
        action: 'JOIN_LOBBY'
      }));
    }
  });
});


// Start Server
fastify.listen(SERVER_PORT, (err, address) => {
  if (err) throw err;
  console.log(`Webserver listening on ${address}`);
});