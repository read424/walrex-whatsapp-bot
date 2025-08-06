const amqp = require("amqplib")
const admin = require("./../config/firebaseConfig");

class RabbitMQFCMService {

    constructor(rabbiMQUrl, queueName){
        this.rabbiMQUrl= rabbiMQUrl;
        this.queueName = queueName;
    }

    // Inicializa la conexión a RabbitMQ
    async connectToRabbitMQ() {
        try {
            this.connection = await amqp.connect(this.rabbitMQUrl);
            this.channel = await this.connection.createChannel();
            await this.channel.assertQueue(this.queueName, { durable: true });
            console.log(`Conectado a RabbitMQ, escuchando en la cola: ${this.queueName}`);
        } catch (error) {
            console.error('Error al conectar con RabbitMQ:', error);
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
            console.log('Notificación enviada a FCM');
        } catch (error) {
            console.error('Error al enviar notificación a FCM:', error);
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

                    console.log(`Mensaje recibido desde RabbitMQ: ${messageContent}`);
                    
                    // Enviar notificación a FCM
                    await this.sendNotificationToFCM(fcmToken, payload);

                    // Confirmar que el mensaje fue procesado
                    this.channel.ack(msg);
                }
            }, { noAck: false });
        } catch (error) {
            console.error('Error al consumir mensajes de RabbitMQ:', error);
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
        console.log('Conexión a RabbitMQ cerrada');
    }  

}

module.exports = RabbitMQFCMService