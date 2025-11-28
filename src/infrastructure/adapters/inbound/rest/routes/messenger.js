const express = require('express');
const router = express.Router();

/**
 * Rutas para el webhook de Facebook Messenger
 *
 * GET /webhook/messenger - Verificación del webhook por Facebook
 * POST /webhook/messenger - Recibir eventos del webhook
 */

let messengerWebhookController = null;

/**
 * Inyectar el controlador de Messenger (llamado desde CompositionRoot)
 * @param {MessengerWebhookController} controller - Controlador inyectado
 */
function setMessengerWebhookController(controller) {
    messengerWebhookController = controller;
}

/**
 * GET /webhook/messenger
 * Verificación del webhook por Facebook
 *
 * Facebook llama este endpoint una sola vez al configurar el webhook con:
 * - hub.mode=subscribe
 * - hub.verify_token=<tu_token>
 * - hub.challenge=<random_string>
 */
router.get('/', (req, res) => {
    if (!messengerWebhookController) {
        return res.status(503).json({
            success: false,
            message: 'Messenger webhook controller not initialized'
        });
    }

    messengerWebhookController.verifyWebhook(req, res);
});

/**
 * POST /webhook/messenger
 * Recibir eventos de Facebook Messenger
 *
 * Facebook llama este endpoint cuando hay eventos:
 * - Mensajes recibidos
 * - Postbacks (botones presionados)
 * - Entregas
 * - Lecturas
 */
router.post('/', async (req, res) => {
    if (!messengerWebhookController) {
        return res.status(503).json({
            success: false,
            message: 'Messenger webhook controller not initialized'
        });
    }

    await messengerWebhookController.receiveWebhook(req, res);
});

module.exports = router;
module.exports.setMessengerWebhookController = setMessengerWebhookController;