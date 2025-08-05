import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Conversation } from './Conversation';

export class Message extends BaseModel {
  // Properties
  conversation_id!: string;
  sender_id!: string;
  content!: string;
  is_read!: boolean;
  read_at?: Date;

  // Relations
  conversation?: Conversation;
  sender?: User;

  static tableName = 'messages';

  static jsonSchema = {
    type: 'object',
    required: ['conversation_id', 'sender_id', 'content'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      conversation_id: { type: 'string', format: 'uuid' },
      sender_id: { type: 'string', format: 'uuid' },
      content: { type: 'string', minLength: 1 },
      is_read: { type: 'boolean', default: false },
      read_at: { type: ['string', 'null'], format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    conversation: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Conversation,
      join: {
        from: 'messages.conversation_id',
        to: 'conversations.id',
      },
    },
    sender: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'messages.sender_id',
        to: 'users.id',
      },
    },
  };

  // Instance methods
  async markAsRead(): Promise<void> {
    if (!this.is_read) {
      await this.$query().patch({
        is_read: true,
        read_at: new Date(),
      });
    }
  }

  // Static methods
  static async findByConversation(conversationId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.query()
      .where('conversation_id', conversationId)
      .withGraphFetched('sender')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  static async findUnreadByUser(userId: string): Promise<Message[]> {
    return this.query()
      .select('messages.*')
      .join('conversations', 'messages.conversation_id', 'conversations.id')
      .where('messages.is_read', false)
      .whereNot('messages.sender_id', userId)
      .where((builder) => {
        builder
          .where('conversations.buyer_id', userId)
          .orWhere('conversations.seller_id', userId);
      })
      .withGraphFetched('[conversation, sender]')
      .orderBy('messages.created_at', 'desc');
  }

  static async markConversationMessagesAsRead(conversationId: string, userId: string): Promise<number> {
    const result = await this.query()
      .where('conversation_id', conversationId)
      .whereNot('sender_id', userId)
      .where('is_read', false)
      .patch({
        is_read: true,
        read_at: new Date(),
      });
    
    return result;
  }

  static async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    return this.transaction(async (trx) => {
      // Create message
      const message = await this.query(trx)
        .insertAndFetch({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
        })
        .withGraphFetched('sender');
      
      // Update conversation
      const conversation = await Conversation.query(trx)
        .findById(conversationId);
      
      if (conversation) {
        await conversation.incrementUnreadCount(senderId);
      }
      
      return message;
    });
  }

  static async searchInConversation(conversationId: string, query: string): Promise<Message[]> {
    return this.query()
      .where('conversation_id', conversationId)
      .where('content', 'ilike', `%${query}%`)
      .withGraphFetched('sender')
      .orderBy('created_at', 'desc');
  }
}
