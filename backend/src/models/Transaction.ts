import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Vehicle } from './Vehicle';
import { Commission } from './Commission';
import { Review } from './Review';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export class Transaction extends BaseModel {
  // Properties
  transaction_number!: string;
  vehicle_id!: string;
  buyer_id!: string;
  seller_id!: string;
  price!: number;
  commission_amount!: number;
  net_amount!: number;
  status!: TransactionStatus;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  completed_at?: Date;
  cancelled_at?: Date;
  cancelled_reason?: string;

  // Relations
  vehicle?: Vehicle;
  buyer?: User;
  seller?: User;
  commission?: Commission;
  reviews?: Review[];

  static tableName = 'transactions';

  static jsonSchema = {
    type: 'object',
    required: ['transaction_number', 'vehicle_id', 'buyer_id', 'seller_id', 'price', 'net_amount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      transaction_number: { type: 'string', maxLength: 50 },
      vehicle_id: { type: 'string', format: 'uuid' },
      buyer_id: { type: 'string', format: 'uuid' },
      seller_id: { type: 'string', format: 'uuid' },
      price: { type: 'number', minimum: 0 },
      commission_amount: { type: 'number', minimum: 0, default: 0 },
      net_amount: { type: 'number', minimum: 0 },
      status: { type: 'string', enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING },
      payment_method: { type: ['string', 'null'], maxLength: 50 },
      payment_reference: { type: ['string', 'null'], maxLength: 255 },
      notes: { type: ['string', 'null'] },
      completed_at: { type: ['string', 'null'], format: 'date-time' },
      cancelled_at: { type: ['string', 'null'], format: 'date-time' },
      cancelled_reason: { type: ['string', 'null'] },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    vehicle: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'transactions.vehicle_id',
        to: 'vehicles.id',
      },
    },
    buyer: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'transactions.buyer_id',
        to: 'users.id',
      },
    },
    seller: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'transactions.seller_id',
        to: 'users.id',
      },
    },
    commission: {
      relation: Model.HasOneRelation,
      modelClass: () => Commission,
      join: {
        from: 'transactions.id',
        to: 'commissions.transaction_id',
      },
    },
    reviews: {
      relation: Model.HasManyRelation,
      modelClass: () => Review,
      join: {
        from: 'transactions.id',
        to: 'reviews.transaction_id',
      },
    },
  };

  // Hooks
  async $beforeInsert() {
    await super.$beforeInsert();
    
    if (!this.transaction_number) {
      this.transaction_number = await this.generateTransactionNumber();
    }
  }

  // Instance methods
  async generateTransactionNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `TXN-${year}${month}${day}-${random}`;
  }

  async complete(paymentReference: string): Promise<void> {
    await this.$query().patch({
      status: TransactionStatus.COMPLETED,
      payment_reference: paymentReference,
      completed_at: new Date(),
    });

    // Mark vehicle as sold
    await Vehicle.query()
      .where('id', this.vehicle_id)
      .patch({
        status: 'sold',
        sold_at: new Date(),
      });
  }

  async cancel(reason: string): Promise<void> {
    await this.$query().patch({
      status: TransactionStatus.CANCELLED,
      cancelled_reason: reason,
      cancelled_at: new Date(),
    });

    // Mark vehicle as available again
    await Vehicle.query()
      .where('id', this.vehicle_id)
      .patch({
        status: 'available',
      });
  }

  async process(): Promise<void> {
    await this.$query().patch({
      status: TransactionStatus.PROCESSING,
    });
  }

  canBeCancelled(): boolean {
    return [TransactionStatus.PENDING, TransactionStatus.PROCESSING].includes(this.status);
  }

  canBeCompleted(): boolean {
    return this.status === TransactionStatus.PROCESSING;
  }

  // Static methods
  static async findByUser(userId: string, role: 'buyer' | 'seller'): Promise<Transaction[]> {
    const field = role === 'buyer' ? 'buyer_id' : 'seller_id';
    
    return this.query()
      .where(field, userId)
      .withGraphFetched('[vehicle, buyer, seller]')
      .orderBy('created_at', 'desc');
  }

  static async findPending(): Promise<Transaction[]> {
    return this.query()
      .where('status', TransactionStatus.PENDING)
      .withGraphFetched('[vehicle, buyer, seller]')
      .orderBy('created_at', 'asc');
  }

  static async findByStatus(status: TransactionStatus): Promise<Transaction[]> {
    return this.query()
      .where('status', status)
      .withGraphFetched('[vehicle, buyer, seller]')
      .orderBy('created_at', 'desc');
  }

  static async findByTransactionNumber(transactionNumber: string): Promise<Transaction | undefined> {
    return this.query()
      .findOne({ transaction_number: transactionNumber })
      .withGraphFetched('[vehicle, buyer, seller, commission]');
  }

  static async calculateStats(userId: string, role: 'buyer' | 'seller') {
    const field = role === 'buyer' ? 'buyer_id' : 'seller_id';
    
    const stats = await this.query()
      .select(
        this.raw('COUNT(*) as total'),
        this.raw('COUNT(CASE WHEN status = ? THEN 1 END) as completed', TransactionStatus.COMPLETED),
        this.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending', TransactionStatus.PENDING),
        this.raw('COUNT(CASE WHEN status = ? THEN 1 END) as cancelled', TransactionStatus.CANCELLED),
        this.raw('SUM(CASE WHEN status = ? THEN price ELSE 0 END) as total_amount', TransactionStatus.COMPLETED),
      )
      .where(field, userId)
      .first();
    
    return {
      total: parseInt(stats.total),
      completed: parseInt(stats.completed),
      pending: parseInt(stats.pending),
      cancelled: parseInt(stats.cancelled),
      totalAmount: parseFloat(stats.total_amount || '0'),
    };
  }
}
