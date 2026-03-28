const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 4567;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('symphony relay ok');
});

const wss = new WebSocketServer({ server });

const state = {
  players: {},
};

function broadcast(data, excludeWs) {
  const msg = JSON.stringify(data);
  let sent = 0;
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
      sent++;
    }
  });
  console.log(`broadcast ${data.type} to ${sent} clients`);
}

wss.on('connection', (ws) => {
  let playerId = null;
  console.log(`new connection, total clients: ${wss.clients.size}`);

  // Send current state to new connection
  ws.send(JSON.stringify({ type: 'state', players: state.players }));
  console.log(`sent state with ${Object.keys(state.players).length} players`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      playerId = msg.playerId || playerId;
      console.log(`msg: ${msg.type} from ${playerId} (instrument: ${msg.instrument || 'n/a'})`);

      if (msg.type === 'join') {
        state.players[playerId] = {
          instrument: msg.instrument,
          name: msg.name,
          icon: msg.icon,
          color: msg.color
        };
        broadcast(msg);
        console.log(`players now: ${Object.keys(state.players).length}`);
      }

      if (msg.type === 'note') {
        broadcast(msg, ws);
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
    } catch(e) {
      console.error('parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`disconnect: ${playerId}`);
    if (playerId && state.players[playerId]) {
      delete state.players[playerId];
      broadcast({ type: 'leave', playerId });
      console.log(`players now: ${Object.keys(state.players).length}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Symphony relay running on port ${PORT}`);
});
