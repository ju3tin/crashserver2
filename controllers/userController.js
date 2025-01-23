const User = require('../models/User');

const handleCreateUser = async (ws, data) => {
    const { username } = data;
  
    if (!username) {
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Username is required.' }));
      return;
    }
  
    try {
      // Check if username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        ws.send(JSON.stringify({ action: 'ERROR', message: 'Username already exists.' }));
        return;
      }
  
      // Create a new user
      const user = new User({
        username,
        balances: { SOL: 1000, CHIPPY: 1000, DEMO: 1000 }, // Default balances
      });
      await user.save();
  
      ws.send(JSON.stringify({
        action: 'USER_CREATED',
        userId: user._id,
        username: user.username,
        balances: user.balances,
      }));
    } catch (err) {
      console.error('Error creating user:', err);
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Failed to create user.' }));
    }
  };
  

const createUser = async (username) => {
    const user = new User({
      username,
      balances: { SOL: 1000, CHIPPY: 1000, DEMO: 1000 }, // Default balances
    });
    await user.save();
    return user;
  };

const getUser = async (userId) => {
  return User.findById(userId);
};

const handleCashout = async (ws, data) => {
    // Implementation goes here
    // Example implementation:
    try {
        const { userId, amount } = data;
        const user = await User.findById(userId);
        if (!user) {
            ws.send(JSON.stringify({ action: 'ERROR', message: 'User not found.' }));
            return;
        }
        // Add cashout logic here
        ws.send(JSON.stringify({ action: 'CASHOUT_SUCCESS', amount }));
    } catch (err) {
        console.error('Error processing cashout:', err);
        ws.send(JSON.stringify({ action: 'ERROR', message: 'Failed to process cashout.' }));
    }
};

module.exports = {
    handleCreateUser,
    createUser,
    getUser,
    handleCashout,
};