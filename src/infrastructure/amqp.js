const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const structuredLogger = require('./config/StructuredLogger');
const amqp = require('amqplib');

async function sendMessage(){

    const user = 'read424';
    const password = 'Kromina.24$';
    const port_amqp = '5672';
    const host_amqp = 'rabbitmq.walrex.lat';//amqps://b-36210962-610e-484f-ba21-50e8d4398e80.mq.us-east-1.amazonaws.com:5671
    const vhost = 'app_walrex';
    const url = `amqp://${user}:${password}@${host_amqp}:${port_amqp}/${vhost}`;
    const connectionOptions = {
        frameMax: 131072  // 128 KB (el valor predeterminado en RabbitMQ)
    };
    try{
        const connection = await amqp.connect(url, connectionOptions);
        logger.info('Connected to RabbitMQ');

        const channel = await connection.createChannel();

        const code_bank = '0102';
        const num_pago_movil = '04126847465';
        const dni_number = '14397714';
        const amount = '200';
        const currency = 'VES';

        const exchange = 'pay_pago_movil';
        // Asegúrate de que el exchange existe
        await channel.assertExchange(exchange, 'direct', { durable: true });

        const queue = 'sms_payment';
        await channel.assertQueue( queue, {
            durable: true
        });
        
        const message = `Pagar ${code_bank} ${num_pago_movil} ${dni_number} ${amount}|${currency}`;

        channel.sendToQueue(queue, Buffer.from(message), {
            persistent: true
        });
        // channel.publish(exchange, queue, Buffer.from(message), {
        //     persistent: true
        // });
        logger.info(`[x] Sent ${message}`);
        await channel.close();
        await connection.close();
    }catch(error){
        logger.error(error);
    }
}

sendMessage();

