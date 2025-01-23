const express = require('express');
const { handleCreateUser } = require('../controllers/userController');
const router = express.Router();

router.post('/', handleCreateUser);

module.exports = router;