const express = require('express');
const connectionsRoutes = require('./connections');
const whatsappRoutes = require('./whatsapp');
const tradingRoutes = require('./trading');
const packageRoutes = require('./packages');

const router = express.Router();

// Rutas de conexiones
router.use('/connections', connectionsRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/trading', tradingRoutes);
router.use('/packages', packageRoutes);

module.exports = router;