const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 4567;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('symphony relay ok');
});

const wss = new WebSocketServer({ server });

const state = {
  players: {},     // playerId -> { instrument, icon, color, name }
};

function broadcast(data, excludeWs) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  let playerId = null;

  // Send current state to new connection
  ws.send(JSON.stringify({ type: 'state', players: state.players }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      playerId = msg.playerId || playerId;

      if (msg.type === 'join') {
        state.players[playerId] = {
          instrument: msg.instrument,
          name: msg.name,
          icon: msg.icon,
          color: msg.color
        };
        broadcast(msg);
      }

      if (msg.type === 'note') {
        broadcast(msg, ws); // don't echo back to sender
      }

      if (msg.type === 'switch') {
        if (state.players[playerId]) {
          state.players[playerId].instrument = msg.instrument;
          state.players[playerId].name = msg.name;
          state.players[playerId].icon = msg.icon;
          state.players[playerId].color = msg.color;
        }
        broadcast(msg);
      }
    } catch(e) {}
  });

  ws.on('close', () => {
    if (playerId && state.players[playerId]) {
      delete state.players[playerId];
      broadcast({ type: 'leave', playerId });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Symphony relay running on port ${PORT}`);
});
