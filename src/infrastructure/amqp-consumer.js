const structuredLogger = require('./config/StructuredLogger');
const amqp = require('amqplib');

const user = 'read424';
const password = 'Kromina.24$';
const host = 'rabbitmq.walrex.lat';
const port = '5672';
const queue = 'payment';
const vhost = 'app_walrex';
const url = `amqp://${user}:${password}@${host}:${port}/${vhost}`;

async function consumeMessages() {
    try {
        const connection = await amqp.connect(url);
        logger.info('Connected to RabbitMQ');

        const channel = await connection.createChannel();
        await channel.assertQueue(queue, {
            durable: true // Asegúrate de que coincida con la configuración de la cola
        });

        logger.info(`Waiting for messages in queue: ${queue}`);

        channel.consume(queue, (message) => {
            if (message !== null) {
                const msgContent = message.content.toString();
                logger.info(`Received message: ${msgContent}`);

                // Aquí puedes procesar el mensaje según sea necesario
                // Por ejemplo, descomponer el mensaje y realizar acciones específicas
                const [code_bank, num_pago_movil, dni_number, amount_currency] = msgContent.split(' ');
                logger.info(`Processing payment for bank code: ${code_bank}, mobile number: ${num_pago_movil}, dni: ${dni_number}, amount and currency: ${amount_currency}`);

                // Acknowledge the message so it gets removed from the queue
                channel.ack(message);
                logger.info(`Message acknowledged: ${msgContent}`);
            }
        }, { noAck: false }); // Se recomienda establecer noAck en false para poder usar ack

    } catch (error) {
        logger.error(`Error in RabbitMQ consumer: ${error.message}`, error);
    }
}

consumeMessages();