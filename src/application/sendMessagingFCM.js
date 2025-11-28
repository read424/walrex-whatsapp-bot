const admin = require("./../config/firebaseConfig")

/**
 * Servicio de aplicación para envío de mensajes FCM
 * Implementa inversión de dependencias recibiendo el logger mediante DI
 */
class SendMessagingFCM {
    constructor(logger) {
        this.logger = logger;
    }

    async sendSilentMessage(token, smsData) {
        const message = {
            token: token,
            data: {
                data: smsData
            },
            android: {
                priority: 'high'
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true
                    }
                }
            }
        };

        try {
            await admin.messaging().send(message);
            this.logger.info('SendMessagingFCM', 'Mensaje enviado a FCM exitosamente', {
                token: token.substring(0, 20) + '...',
                dataLength: smsData.length
            });
        } catch (error) {
            this.logger.error('SendMessagingFCM', 'Error al enviar el mensaje a FCM', error, {
                token: token.substring(0, 20) + '...'
            });
            throw error;
        }
    }
}

module.exports = SendMessagingFCM;

// Código de testing comentado (descomentar solo para pruebas manuales)
/*
const code_bank = '0102';
const num_pago_movil = '04126847465';
const dni_number = '14397714';
const amount = '1000USD';

const message = `Pagar ${code_bank} ${num_pago_movil} ${dni_number} ${amount}`;
const token = 'fLEqa-sJR5205eVsKnpBc9:APA91bGqX-rpPaeqEPShmAFPHOHk2J05izGinLUMQtCrfRSi0xW-4V4s-ktJ12CF-EoGG8GYZQsdPjDugLQesizBZhpcVMSCGHD00jrcnKngWFDrNFlKBdaW7W4p7wWD6wqjXxmVqObm';

// Crear instancia con logger dummy para testing
const sendMessagingFCM = new SendMessagingFCM(console);
sendMessagingFCM.sendSilentMessage(token, message);
*/
