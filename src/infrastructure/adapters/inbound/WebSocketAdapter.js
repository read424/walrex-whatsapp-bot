const { Server } = require('socket.io');
const WebSocketPort = require('../outbound/WebSocketPort');

class WebSocketAdapter extends WebSocketPort {

    constructor(httpServer){
        super();
        try{
            this.io = new Server(httpServer, {
                cors: {
                    origin: '*',
                    method: ['GET', 'POST']
                }
            });
            this.initSocketEvents();    
        }catch(error){
            console.log('error ws: ', error)
        }
    }

    initSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Cliente conectado:', socket.id);

            // Escuchar eventos personalizados del cliente si es necesario
            socket.on('disconnect', () => {
                console.log('Cliente desconectado:', socket.id);
            });
        });
    }

    emit(event, data){
        this.io.emit(event, data);
    }

    // Método para enviar mensajes a todos los clientes conectados
    broadcast(message) {
        if (this.io) {
            this.io.emit('whatsapp_status_update', message);
        }
    }
}

module.exports = WebSocketAdapter;