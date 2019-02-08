const fastify = require('fastify')();
const path = require('path');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

fastify.get('/', (req, res) => {
  res.sendFile('game.html');
});

fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`Webserver listening on ${address}`);
})
