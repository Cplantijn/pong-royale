const fastify = require('fastify')();

fastify.register(require('fastify-websocket'), { handle: handleSocket });

function handleSocket(conn) {
  conn.pipe(conn);
}

fastify.listen(34567);