const admin = require("firebase-admin");
const serviceAccount = require('./walrex-app-firebase-adminsdk-mq.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Función para enviar notificaciones
const sendNotification = async (token, message) => {
    const payload = {
      notification: {
        title: 'Título de la Notificación',
        body: message,
      },
    };
  
    try {
      await admin.messaging().sendToDevice(token, payload);
      console.log('Notificación enviada');
    } catch (error) {
      console.error('Error enviando la notificación:', error);
    }
};

sendNotification('fLEqa-sJR5205eVsKnpBc9:APA91bGqX-rpPaeqEPShmAFPHOHk2J05izGinLUMQtCrfRSi0xW-4V4s-ktJ12CF-EoGG8GYZQsdPjDugLQesizBZhpcVMSCGHD00jrcnKngWFDrNFlKBdaW7W4p7wWD6wqjXxmVqObm', 'Hola, nuevamente');