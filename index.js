const WebSocket = require('ws');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const GameController = require('./controllers/gameController');
const UserController = require('./controllers/userController');
const clients = new Map(); // To track individual player states

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

  clients.set(ws, {
    isBetted: false,
    isTook: false,
    cntBalance: 100,
    cntBet: 0,
});

  ws.on('message', async (message) => {
    try {
      const playerState = clients.get(ws);
      const data = JSON.parse(message);

    switch (data.type) {
      case 'BTN_BET_CLICKED':
        if (!playerState.isBetted && isGameRunning) {
            // Player places a bet
            playerState.cntBet = Math.min(data.bet, playerState.cntBalance);
            playerState.isBetted = true;
            playerState.cntBalance -= playerState.cntBet;
            ws.send(JSON.stringify({ action: 'BET_MADE', player: data.walletAddress, bet: data.bet, currency: data.currency}))
            ws.send(JSON.stringify({ action: 'CNT_BALANCE', balance: playerState.cntBalance.toFixed(2) }));
        } else if (playerState.isBetted && isGameRunning && !playerState.isTook) {
            // Player cashes out
            playerState.cntBalance += playerState.cntBet * currentMultiplier;
            playerState.isTook = true;
            ws.send(JSON.stringify({ action: 'WON', bet: playerState.cntBet, mult: currentMultiplier.toFixed(2) }));
        }
        await GameController.handleBet(ws, data);
        break;
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
  } catch (error) {
    console.error('Error processing message:', error);
    ws.send(JSON.stringify({ action: 'ERROR', message: 'An error occurred while processing the message.' }));
  }
  });

  ws.on('close', () => console.log('Client disconnected.'));
});

GameController.startGame(wss);