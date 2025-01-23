const mongoose = require('mongoose');

const GameRoundSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  crashMultiplier: { type: Number, required: true },
  currentMultiplier: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  bets: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      cashedOut: { type: Boolean, default: false },
    },
  ],
});

module.exports = mongoose.model('GameRound', GameRoundSchema);