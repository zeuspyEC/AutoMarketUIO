import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Transaction } from './Transaction';

export class Review extends BaseModel {
  // Properties
  transaction_id!: string;
  reviewer_id!: string;
  reviewed_id!: string;
  rating!: number;
  comment?: string;
  is_buyer_review!: boolean;

  // Relations
  transaction?: Transaction;
  reviewer?: User;
  reviewed?: User;

  static tableName = 'reviews';

  static jsonSchema = {
    type: 'object',
    required: ['transaction_id', 'reviewer_id', 'reviewed_id', 'rating', 'is_buyer_review'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      transaction_id: { type: 'string', format: 'uuid' },
      reviewer_id: { type: 'string', format: 'uuid' },
      reviewed_id: { type: 'string', format: 'uuid' },
      rating: { type: 'integer', minimum: 1, maximum: 5 },
      comment: { type: ['string', 'null'] },
      is_buyer_review: { type: 'boolean' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    transaction: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Transaction,
      join: {
        from: 'reviews.transaction_id',
        to: 'transactions.id',
      },
    },
    reviewer: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'reviews.reviewer_id',
        to: 'users.id',
      },
    },
    reviewed: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'reviews.reviewed_id',
        to: 'users.id',
      },
    },
  };

  // Instance methods
  getRatingStars(): string {
    return '★'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
  }

  isPositive(): boolean {
    return this.rating >= 4;
  }

  isNegative(): boolean {
    return this.rating <= 2;
  }

  // Static methods
  static async findByUser(userId: string, type: 'received' | 'given' = 'received'): Promise<Review[]> {
    const field = type === 'received' ? 'reviewed_id' : 'reviewer_id';
    
    return this.query()
      .where(field, userId)
      .withGraphFetched('[transaction.vehicle, reviewer, reviewed]')
      .orderBy('created_at', 'desc');
  }

  static async findByTransaction(transactionId: string): Promise<Review[]> {
    return this.query()
      .where('transaction_id', transactionId)
      .withGraphFetched('[reviewer, reviewed]');
  }

  static async canReview(transactionId: string, userId: string): Promise<{ canReview: boolean; reason?: string }> {
    // Get transaction
    const transaction = await Transaction.query()
      .findById(transactionId)
      .withGraphFetched('[buyer, seller]');
    
    if (!transaction) {
      return { canReview: false, reason: 'Transaction not found' };
    }
    
    // Check if transaction is completed
    if (transaction.status !== 'completed') {
      return { canReview: false, reason: 'Transaction must be completed' };
    }
    
    // Check if user is part of transaction
    const isBuyer = transaction.buyer_id === userId;
    const isSeller = transaction.seller_id === userId;
    
    if (!isBuyer && !isSeller) {
      return { canReview: false, reason: 'User is not part of this transaction' };
    }
    
    // Check if already reviewed
    const existingReview = await this.query()
      .where('transaction_id', transactionId)
      .where('reviewer_id', userId)
      .first();
    
    if (existingReview) {
      return { canReview: false, reason: 'Already reviewed' };
    }
    
    return { canReview: true };
  }

  static async createReview(data: {
    transaction_id: string;
    reviewer_id: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    // Get transaction to determine reviewed user
    const transaction = await Transaction.query()
      .findById(data.transaction_id);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    const isBuyer = transaction.buyer_id === data.reviewer_id;
    const reviewed_id = isBuyer ? transaction.seller_id : transaction.buyer_id;
    
    return this.query().insertAndFetch({
      ...data,
      reviewed_id,
      is_buyer_review: isBuyer,
    });
  }

  static async getStats(userId: string): Promise<{
    average: number;
    total: number;
    distribution: Record<number, number>;
    positive: number;
    negative: number;
  }> {
    const reviews = await this.query()
      .where('reviewed_id', userId);
    
    if (reviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        positive: 0,
        negative: 0,
      };
    }
    
    const total = reviews.length;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const average = sum / total;
    
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let positive = 0;
    let negative = 0;
    
    reviews.forEach((review) => {
      distribution[review.rating]++;
      if (review.rating >= 4) positive++;
      if (review.rating <= 2) negative++;
    });
    
    return {
      average: Math.round(average * 10) / 10,
      total,
      distribution,
      positive,
      negative,
    };
  }
}
