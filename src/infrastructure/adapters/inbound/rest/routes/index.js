const express = require('express');
const connectionsRoutes = require('./connections');
const whatsappRoutes = require('./whatsapp');
const tradingRoutes = require('./trading');
const packageRoutes = require('./packages');
const chatRoutes = require('./chat');
const inboxRoutes = require('./inbox');
const authRoutes = require('./auth');
const messengerRoutes = require('./messenger');

const router = express.Router();

// Rutas de conexiones
router.use('/connections', connectionsRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/trading', tradingRoutes);
router.use('/packages', packageRoutes);
router.use('/chat', chatRoutes);
router.use('/inbox', inboxRoutes);
router.use('/auth', authRoutes);
router.use('/webhook/messenger', messengerRoutes);

module.exports = router;