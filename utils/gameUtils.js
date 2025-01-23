const generateCrashMultiplier = () => {
    return (Math.random() * 5 + 1).toFixed(2); // Random crash between 1.00 and 6.00
  };
  
  module.exports = {
    generateCrashMultiplier,
  };