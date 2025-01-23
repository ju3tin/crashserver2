const WebSocket = require('ws');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const GameController = require('./controllers/gameController');
const UserController = require('./controllers/userController');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));


const PORT = process.env.PORT || 8080;


const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


const wss = new WebSocket.Server({ server }, () => {
    console.log(`WebSocket server attached to HTTP server`);
});

wss.on('connection', (ws) => {
  console.log('Client connected.');

  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'PLACE_BET':
        await GameController.handleBet(ws, data);
        break;

      case 'FINISH_BET':
        await GameController.handleCashout(ws, data);
        break;

      case 'CREATE_USER':
        await UserController.handleCreateUser(ws, data);
        break;

      default:
        ws.send(JSON.stringify({ action: 'ERROR', message: 'Unsupported action.' }));
        break;
    }
  });

  ws.on('close', () => console.log('Client disconnected.'));
});

GameController.startGame(wss);