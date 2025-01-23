const GameRound = require('../models/GameRound');
const User = require('../models/User');
const { generateCrashMultiplier } = require('../utils/gameUtils');

let currentMultiplier = 1.0;
let isRunning = false;
let gameState = 'waiting';
const DELAY_PER_DELTA_MULT = 0.002;

const GAME_INTERVAL = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const startGame = async (wss) => {
  gameState = 'waiting';
  isRunning = false;
  currentMultiplier = 1.0;

  // Create a new game round and save it with a default crashMultiplier
  const gameRound = new GameRound({ startTime: new Date(), crashMultiplier: 0, bets: [] });
  await gameRound.save();

  // Notify clients that the game is waiting
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ action: 'GAME_WAITING', message: 'The game is waiting for the next round. Please place your bets!' }));
    }
  });

  // Countdown from 10 seconds
  let countdown = 9;
  const countdownInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ action: 'COUNTDOWN', time: countdown, data: countdown, seconds: countdown }));
        client.send(JSON.stringify({action: 'SECOND_BEFORE_START', data: countdown }));
      }
    });

    countdown -= 1;

    if (countdown < 1) {
      clearInterval(countdownInterval); // Clear the interval when countdown reaches zero
    }
  }, 1000); // Send countdown every second

  // Wait for 10 seconds before starting the game
  setTimeout(async () => {
    gameState = 'running';
    isRunning = true;

    // Notify clients that the round has started
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ action: 'ROUND_STARTED', message: 'The round has started! Place your bets!' }));
      }
    });

    const crashPoint = generateCrashMultiplier();
    gameRound.crashMultiplier = crashPoint;
    await gameRound.save();

    const interval = setInterval(async () => {
      currentMultiplier += 0.01;

      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ action: 'CNT_MULTIPLY', data: currentMultiplier.toFixed(2), multiplier: currentMultiplier.toFixed(2) }));
        }
      });

      if (currentMultiplier >= crashPoint) {
        clearInterval(interval);
        isRunning = false;
        await endGame(wss, gameRound._id);
      }
    }, GAME_INTERVAL);
  }, 10000);
};

const endGame = async (wss, gameRoundId) => {
  const gameRound = await GameRound.findById(gameRoundId);
  gameRound.crashMultiplier = currentMultiplier;
  await gameRound.save();

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ action: 'ROUND_CRASHED', data: currentMultiplier.toFixed(2), multiplier: currentMultiplier.toFixed(2) }));
    }
  });

  setTimeout(() => startGame(wss), 5000);
};

const handleBet = async (ws, data) => {
    const { userId, amount, currency } = data;
  
    // Check if game is in waiting or ended state
    if (gameState !== 'waiting' && gameState !== 'ended') {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Bets can only be placed when the game is waiting or has ended.' }));
      return;
    }
  
    // Validate currency
    const supportedCurrencies = ['SOL', 'CHIPPY', 'DEMO'];
    if (!supportedCurrencies.includes(currency)) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Unsupported currency.' }));
      return;
    }
  
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'User not found.' }));
      return;
    }
  
    // Check if user has already cashed out in the current round
    const currentRound = await GameRound.findOne().sort({ startTime: -1 });
    const existingBet = currentRound.bets.find(bet => bet.userId.toString() === userId);
    if (existingBet && existingBet.cashedOut) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'You cannot place a new bet after cashing out.' }));
      return;
    }
  
    // Check balance
    if (user.balances[currency] < amount) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Insufficient balance.' }));
      return;
    }
  
    // Check if user already has an active bet in current round
    if (existingBet) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'You already have an active bet in this round.' }));
      return;
    }
  
    // Deduct balance and save
    user.balances[currency] -= amount;
    await user.save();
  
    // Add bet to the current game round
    currentRound.bets.push({ userId, amount, currency });
    await currentRound.save();
  
    ws.send(JSON.stringify({
      action: 'BET_PLACED',
      currency,
      amount,
      balance: user.balances[currency],
    }));
};

const handleCashout = async (ws, data) => {
    try {
        const { userId } = data;
        
        // Check if game is still running
        if (!isRunning) {
            ws.send(JSON.stringify({ action: 'ERROR', message: 'Cannot cashout when game is not running.' }));
            return;
        }

        // Find current round
        const currentRound = await GameRound.findOne().sort({ startTime: -1 });
        
        // Find user's bet in current round
        const bet = currentRound.bets.find(bet => bet.userId.toString() === userId);
        if (!bet) {
            ws.send(JSON.stringify({ action: 'ERROR', message: 'No active bet found.' }));
            return;
        }

        // Check if bet already cashed out
        if (bet.cashedOut) {
            ws.send(JSON.stringify({ action: 'ERROR', message: 'You can only cash out once per game.' }));
            return;
        }

        // Calculate winnings using current multiplier
        const betAmount = parseFloat(bet.amount);
        const winnings = Math.floor(betAmount * currentMultiplier * 100) / 100; // Round to 2 decimal places

        // Update user balance
        const user = await User.findById(userId);
        if (!user.balances[bet.currency]) {
            user.balances[bet.currency] = 0;
        }

        user.balances[bet.currency] = parseFloat((user.balances[bet.currency] + winnings).toFixed(2));
        await user.save();

        // Mark bet as cashed out
        bet.cashedOut = true;
        await currentRound.save(); // Save the updated game round

        // Optionally, you can also keep track of total cashouts in the GameRound if needed
        // currentRound.totalCashouts = (currentRound.totalCashouts || 0) + 1;
        // await currentRound.save();

        ws.send(JSON.stringify({
            action: 'CASHOUT_SUCCESS',
            currency: bet.currency,
            winnings,
            balance: user.balances[bet.currency],
            crashPoint: currentMultiplier
        }));
    } catch (error) {
        console.error('Cashout error:', error);
        ws.send(JSON.stringify({ action: 'ERROR', message: 'Failed to process cashout.' }));
    }
};

module.exports = {
  startGame,
  handleBet,
  handleCashout,
};