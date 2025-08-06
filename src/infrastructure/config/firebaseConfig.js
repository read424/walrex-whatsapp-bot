const admin = require("firebase-admin");
const serviceAccount = require('./walrex-app-firebase-adminsdk-mq357-671eaa3936.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;