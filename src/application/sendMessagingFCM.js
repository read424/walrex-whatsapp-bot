const admin = require("./../config/firebaseConfig")

async function sendSilentMessage(token, smsData) {
    const message = {
        token:token,
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
        console.log('Mensaje enviado a FCM:', message);
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
}

const code_bank = '0102';
const num_pago_movil = '04126847465';
const dni_number = '14397714';
const amount = '1000USD';

const message = `Pagar ${code_bank} ${num_pago_movil} ${dni_number} ${amount}`;
// Suponiendo que tienes el token y los datos del SMS
// const token = 'fkorAgKgQCG8ijo3oqrLcG:APA91bEk0qC6Y10fpFlvtyTikhNWuEoxyUnGTjOBQWFHcTOMkfYwoaSjixPl5_DaB0dUE2kLqlQmW-RcLvygK5ab-SSF33n24VCi3RSAC_qBdFO69C4fQ20HmxNR4McwKwA3DffUvpqX';
const token = 'fLEqa-sJR5205eVsKnpBc9:APA91bGqX-rpPaeqEPShmAFPHOHk2J05izGinLUMQtCrfRSi0xW-4V4s-ktJ12CF-EoGG8GYZQsdPjDugLQesizBZhpcVMSCGHD00jrcnKngWFDrNFlKBdaW7W4p7wWD6wqjXxmVqObm';

sendSilentMessage(token, message)
