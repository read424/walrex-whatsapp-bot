const { Contact, ChatSession, ChatMessage} = require('../../models');
const { WhatsAppConnection } = require('../../models');
const structuredLogger = require('../../infrastructure/config/StructuredLogger');

class ChatService {
    constructor(webSocketAdapter){
        this.webSocketAdapter = webSocketAdapter;
    }

    async processIncomingMessage(whatsappMessage, connectionId, tenantId){
        try {
            structuredLogger.info('ChatService', 'Process Message Incoming', {whatsappMessage, connectionId, tenantId});
            const contact = await this.findOrCreateContact(
                whatsappMessage.from.replace('@c.us', ''),
                whatsappMessage._data.notifyName || whatsappMessage.from.replace('@c.us', ''),
                tenantId
            );

            const chatSession = await this.findOrCreateChatSession(
                contact.id,
                connectionId,
                tenantId,
                whatsappMessage.from.replace('@c.us', '')
            );


            const message = await this.createChatMessage({
                chat_session_id:chatSession.id,
                contact_id:contact.id,
                content: whatsappMessage.body,
                message_type: this.getMessageType(whatsappMessage),
                direction: 'incoming',
                whatsapp_message_id: whatsappMessage.id._serialized,
                media_url: await this.extractMediaUrl(whatsappMessage),
                media_metadata: await this.extractMediaMetadata(whatsappMessage),
                tenant_id: parseInt(tenantId) 
            });

            await this.webSocketAdapter.emitToTenant(tenantId, 'newMessage', {
                message,
                chatSession,
                contact
            });

            structuredLogger.info('ChatService', 'Message processed successfully', {
                messageId: message.id,
                contactPhone: contact.phoneNumber,
                sessionId: chatSession.id
            });

            return { message, chatSession, contact };

        }catch (error){
            structuredLogger.error('ChatService', 'Error processing incoming message', error);
            throw error;
        }
    }

    async findOrCreateContact(phoneNumber, name, tenantId){
        try{
            structuredLogger.info('ChatService', 'New contact created', {
                phoneNumber,
                name,
                tenantId
            });
            const recordContact = await Contact.findOne({
                where: {
                    phone_number: phoneNumber,
                    tenant_id: parseInt(tenantId)
                }
            });
            structuredLogger.info('ChatService', 'Record Contact', recordContact);
            if(!recordContact){
                const contact = await Contact.create({
                    phone_number: phoneNumber,
                    name,
                    tenant_id: parseInt(tenantId),
                    metadata: {
                        source: 'whatsapp',
                        createdFrom: 'incoming_message'
                    }
                });
                structuredLogger.info('ChatService', 'Create Contact', contact);
                return contact;
            }else if(recordContact.name !== name && name){
                recordContact.name = name;
                await recordContact.save();
                structuredLogger.info('ChatService', 'Update Contact', recordContact);
            }        
            return recordContact;
        }catch(error){
            throw error;
        }
    }

    async findOrCreateChatSession(contactId, connectionId, tenantId, phoneNumber){
        structuredLogger.info('ChatService', 'Find or create chat session', {
            contactId,
            connectionId,
            tenantId,
            phoneNumber
        });
        let chatSession = await ChatSession.findOne({
            where: {
                contact_id: parseInt(contactId),
                connection_id: connectionId,
                status: 'active',
                tenant_id: tenantId
            },
            include: [
                { model: Contact, as: 'contact' }
            ]
        });

        if(!chatSession){
            chatSession = await ChatSession.create({
                contact_id: contactId,
                phone_number: phoneNumber,
                connection_id: connectionId,
                status: 'active',
                tenant_id: tenantId,
                startedAt: new Date(),
                metadata: {
                    source: 'whatsapp',
                    autoCreated: true
                }
            });

            chatSession = await ChatSession.findByPk(chatSession.id, {
                include: [{ model: Contact, as: 'contact' }]
            });

            structuredLogger.info('ChatService', 'New chat session created', {
                sessionId: chatSession.id,
                contact_id: contactId,
                connection_id: connectionId
            });
        }

        return chatSession;
    }

    async createChatMessage(messageData){
        const message = await ChatMessage.create(messageData);

        const fullMessage = await ChatMessage.findByPk(message.id, {
            include: [
                { model: Contact, as: 'contact' },
                { model: ChatSession, as: 'chatSession' },
            ]
        });

        return fullMessage;
    }

    async sendOutgoingMessage(chatSessionId, content, advisorId, messageType = 'text'){
        try{
            const chatSession = await ChatSession.findByPk(chatSessionId, {
                include: [
                    { model: Contact, as: 'contact' },
                ]
            });

            if(!chatSession){
                throw new Error('Chat session not found');
            }

            const message = await this.createChatMessage({
                chatSessionId,
                contactId: chatSession.contactId,
                content,
                messageType,
                direction: 'outgoing',
                status: 0,
                respondedBy: advisorId,
                responderType: 'human',
                tenantId: chatSession.tenantId
            });

            this.webSocketAdapter.emitToTenant(chatSession.tenantId, 'messageSent', {
                message,
                chatSession,
                contact: chatSession.contact
            });

            return message;

        }catch(error){
            structuredLogger.error('ChatService', 'Error sending outgoing message', error);
            throw error;
        }
    }

    async getChatSessions(tenantId, filters = {}){
        const where = { tenantId };

        if (filters.status) where.status = filters.status;
        if (filters.contactId) where.contactId = filters.contactId;

        const sessions = await ChatSession.findAll({
            where,
            include: [
                {
                    model: Contact,
                    as: 'contact'
                },
                {
                    model: ChatMessage,
                    as: 'messages',
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        return sessions;
    }

    async getChatMessages(chatSessionId, limit = 50, offset = 0){
        const messages = await ChatMessage.findAll({
            where: { chatSessionId },
            include: [
                { model: Contact, as: 'contact' },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        return messages;
    }

    getMessageType(whatsappMessage){
        const type = whatsappMessage.type;
        switch(type){
            case 'image': return 'image';
            case 'audio': 
            case 'ptt': return 'audio';
            case 'video': return 'video';
            case 'document': return 'document';
            case 'location': return 'location';
            case 'vcard': return 'contact';
            default: return 'text';
        }
    }

    async extractMediaUrl(whatsappMessage){
        if(whatsappMessage.hasMedia){
            try{
                const media = await whatsappMessage.downloadMedia();
                return `data:${media.mimeType};base64,${media.data}`;
            }catch(error){
                structuredLogger.error('ChatService', 'Error extracting media', error);
                return null;
            }
        }
        return null;
    }

    async extractMediaMetadata(whatsappMessage){
        if(whatsappMessage.hasMedia){
            const media = await whatsappMessage.downloadMedia();
            return {
                mimeType: media.mimeType,
                fileName: media.filename,
                fileSize: media.data?.length || 0
            };
        }

        return null;
    }

    async updateChatSessionStatus(whatsappMessageId, status){
        // Validar que whatsappMessageId no sea undefined o null
        if (!whatsappMessageId) {
            structuredLogger.warn('ChatService', 'updateChatSessionStatus called with invalid whatsappMessageId', {
                whatsappMessageId,
                status
            });
            return;
        }

        const message = await ChatMessage.findOne({
            where: { whatsapp_message_id: whatsappMessageId }
        });

        if(message){
            message.status = status;
            await message.save();

            this.webSocketAdapter.emitToTenant(message.tenantId, 'messageStatusUpdated', {
                messageId: message.id,
                whatsappMessageId,
                status
            });
        } else {
            structuredLogger.warn('ChatService', 'Message not found for whatsappMessageId', {
                whatsappMessageId,
                status
            });
        }
    }
}

module.exports = ChatService;