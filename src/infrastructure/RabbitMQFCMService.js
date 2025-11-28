const amqp = require("amqplib")
const admin = require("./../config/firebaseConfig");

/**
 * Servicio de infraestructura para integración RabbitMQ + FCM
 * Implementa inversión de dependencias recibiendo el logger mediante DI
 */
class RabbitMQFCMService {

    constructor(rabbiMQUrl, queueName, logger){
        this.rabbiMQUrl= rabbiMQUrl;
        this.queueName = queueName;
        this.logger = logger;
    }

    // Inicializa la conexión a RabbitMQ
    async connectToRabbitMQ() {
        try {
            this.connection = await amqp.connect(this.rabbitMQUrl);
            this.channel = await this.connection.createChannel();
            await this.channel.assertQueue(this.queueName, { durable: true });
            this.logger.info('RabbitMQFCMService', 'Conectado a RabbitMQ exitosamente', {
                queueName: this.queueName
            });
        } catch (error) {
            this.logger.error('RabbitMQFCMService', 'Error al conectar con RabbitMQ', error, {
                rabbitMQUrl: this.rabbiMQUrl,
                queueName: this.queueName
            });
            throw error;
        }
    }

    // Enviar notificación con FCM
    async sendNotificationToFCM(token, payload) {
        try {
            await admin.messaging().send({
                token: token,
                notification: {
                    title: payload.title,
                    body: payload.body
                },
                data: payload.data || {}, // Datos adicionales si es necesario
            });
            this.logger.info('RabbitMQFCMService', 'Notificación enviada a FCM exitosamente', {
                token: token.substring(0, 20) + '...',
                title: payload.title
            });
        } catch (error) {
            this.logger.error('RabbitMQFCMService', 'Error al enviar notificación a FCM', error, {
                token: token.substring(0, 20) + '...',
                payload: { title: payload.title, body: payload.body?.substring(0, 50) }
            });
        }
    }
  
    // Consumir mensajes de RabbitMQ y enviar a FCM
    async consumeMessages() {
        try {
            await this.channel.consume(this.queueName, async (msg) => {
                if (msg !== null) {
                    const messageContent = msg.content.toString();
                    const messageData = JSON.parse(messageContent);

                    // Aquí esperamos que messageData contenga el token FCM y el payload
                    const { fcmToken, payload } = messageData;

                    this.logger.info('RabbitMQFCMService', 'Mensaje recibido desde RabbitMQ', {
                        messageLength: messageContent.length,
                        hasToken: !!fcmToken,
                        payloadTitle: payload?.title
                    });

                    // Enviar notificación a FCM
                    await this.sendNotificationToFCM(fcmToken, payload);

                    // Confirmar que el mensaje fue procesado
                    this.channel.ack(msg);
                }
            }, { noAck: false });

            this.logger.info('RabbitMQFCMService', 'Consumidor de mensajes iniciado', {
                queueName: this.queueName
            });
        } catch (error) {
            this.logger.error('RabbitMQFCMService', 'Error al consumir mensajes de RabbitMQ', error, {
                queueName: this.queueName
            });
        }
    }

    // Cerrar la conexión a RabbitMQ
    async closeConnection() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.logger.info('RabbitMQFCMService', 'Conexión a RabbitMQ cerrada');
    }  

}

module.exports = RabbitMQFCMService