import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Vehicle } from './Vehicle';
import { Message } from './Message';

export class Conversation extends BaseModel {
  // Properties
  vehicle_id!: string;
  buyer_id!: string;
  seller_id!: string;
  last_message_at?: Date;
  buyer_unread_count!: number;
  seller_unread_count!: number;

  // Relations
  vehicle?: Vehicle;
  buyer?: User;
  seller?: User;
  messages?: Message[];

  static tableName = 'conversations';

  static jsonSchema = {
    type: 'object',
    required: ['vehicle_id', 'buyer_id', 'seller_id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      vehicle_id: { type: 'string', format: 'uuid' },
      buyer_id: { type: 'string', format: 'uuid' },
      seller_id: { type: 'string', format: 'uuid' },
      last_message_at: { type: ['string', 'null'], format: 'date-time' },
      buyer_unread_count: { type: 'integer', default: 0 },
      seller_unread_count: { type: 'integer', default: 0 },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    vehicle: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'conversations.vehicle_id',
        to: 'vehicles.id',
      },
    },
    buyer: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'conversations.buyer_id',
        to: 'users.id',
      },
    },
    seller: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'conversations.seller_id',
        to: 'users.id',
      },
    },
    messages: {
      relation: Model.HasManyRelation,
      modelClass: () => Message,
      join: {
        from: 'conversations.id',
        to: 'messages.conversation_id',
      },
      modify: (query) => query.orderBy('created_at', 'desc'),
    },
  };

  // Instance methods
  isBuyer(userId: string): boolean {
    return this.buyer_id === userId;
  }

  isSeller(userId: string): boolean {
    return this.seller_id === userId;
  }

  isParticipant(userId: string): boolean {
    return this.isBuyer(userId) || this.isSeller(userId);
  }

  getUnreadCount(userId: string): number {
    if (this.isBuyer(userId)) {
      return this.buyer_unread_count;
    } else if (this.isSeller(userId)) {
      return this.seller_unread_count;
    }
    return 0;
  }

  async markAsRead(userId: string): Promise<void> {
    const update: any = {};
    
    if (this.isBuyer(userId)) {
      update.buyer_unread_count = 0;
    } else if (this.isSeller(userId)) {
      update.seller_unread_count = 0;
    } else {
      return;
    }
    
    await this.$query().patch(update);
    
    // Mark all messages as read
    await Message.query()
      .where('conversation_id', this.id)
      .whereNot('sender_id', userId)
      .where('is_read', false)
      .patch({
        is_read: true,
        read_at: new Date(),
      });
  }

  async incrementUnreadCount(senderId: string): Promise<void> {
    const update: any = {};
    
    if (this.isBuyer(senderId)) {
      update.seller_unread_count = this.seller_unread_count + 1;
    } else if (this.isSeller(senderId)) {
      update.buyer_unread_count = this.buyer_unread_count + 1;
    }
    
    update.last_message_at = new Date();
    
    await this.$query().patch(update);
  }

  // Static methods
  static async findOrCreate(vehicleId: string, buyerId: string, sellerId: string): Promise<Conversation> {
    const existing = await this.query()
      .findOne({
        vehicle_id: vehicleId,
        buyer_id: buyerId,
        seller_id: sellerId,
      });
    
    if (existing) {
      return existing;
    }
    
    return this.query().insertAndFetch({
      vehicle_id: vehicleId,
      buyer_id: buyerId,
      seller_id: sellerId,
    });
  }

  static async findByUser(userId: string): Promise<Conversation[]> {
    return this.query()
      .where('buyer_id', userId)
      .orWhere('seller_id', userId)
      .withGraphFetched('[vehicle.[brand, model, images], buyer, seller, messages(latest)]')
      .modifiers({
        latest(builder) {
          builder.orderBy('created_at', 'desc').limit(1);
        },
      })
      .orderBy('last_message_at', 'desc');
  }

  static async findByUserAndVehicle(userId: string, vehicleId: string): Promise<Conversation[]> {
    return this.query()
      .where('vehicle_id', vehicleId)
      .where((builder) => {
        builder
          .where('buyer_id', userId)
          .orWhere('seller_id', userId);
      })
      .withGraphFetched('[vehicle, buyer, seller]');
  }

  static async countUnread(userId: string): Promise<number> {
    const result = await this.query()
      .where((builder) => {
        builder
          .where('buyer_id', userId)
          .where('buyer_unread_count', '>', 0);
      })
      .orWhere((builder) => {
        builder
          .where('seller_id', userId)
          .where('seller_unread_count', '>', 0);
      })
      .count()
      .first();
    
    return parseInt(result?.count as string || '0');
  }
}
