const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { ChatSession } = require('../../../models');
const { TIME_CONSTANTS } = require('../../../domain/constants/WhatsAppConstants');

class ChatSessionRepository {

    async createChatSession(phoneNumber){
        try{
            const session = await ChatSession.create({
                phone_number: phoneNumber,
                started_at: new Date()
            });
            return session;
        }catch(erro){
            throw erro;
        }
    }
    
    async getLatestChatToday(phoneNumber){
        try{
            const latestSession = await ChatSession.findOne({
                where: { phone_number: phoneNumber },
                order: [['started_at', 'DESC']],
                limit: 1
            });
            if(!latestSession)
                return null;
            return latestSession;
        }catch(erro){
            throw erro;
        }
    }

    async updateResponseChatSession(session_id){
        try{
            const session = await ChatSession.update({
                ended_at: new Date()
            },{
                where: { id: session_id }
            });
            return session;
        }catch(error){
            throw error;
        }
    }

    async getSessionEnabled(phoneNumber){
        try{
            const tenMinutesAgo = moment().tz("America/Lima").subtract(TIME_CONSTANTS.SESSION_TIMEOUT_MINUTES, 'minutes').toDate();

            const session = await ChatSession.findOne({
                where: { 
                    phone_number: phoneNumber, 
                    [ Op.or ]: [
                        { ended_at: null },
                        { ended_at: { [ Op.gt]: tenMinutesAgo } }
                    ]
                }
            });
            return session;
        }catch(error){
            throw error;
        }
    }
}

module.exports = ChatSessionRepository;