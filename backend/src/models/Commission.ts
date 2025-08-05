import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { Transaction } from './Transaction';
import { CommissionSetting } from './CommissionSetting';

export class Commission extends BaseModel {
  // Properties
  transaction_id!: string;
  commission_setting_id?: string;
  amount!: number;
  percentage?: number;
  is_paid!: boolean;
  paid_at?: Date;
  payment_reference?: string;

  // Relations
  transaction?: Transaction;
  commissionSetting?: CommissionSetting;

  static tableName = 'commissions';

  static jsonSchema = {
    type: 'object',
    required: ['transaction_id', 'amount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      transaction_id: { type: 'string', format: 'uuid' },
      commission_setting_id: { type: ['string', 'null'], format: 'uuid' },
      amount: { type: 'number', minimum: 0 },
      percentage: { type: ['number', 'null'], minimum: 0, maximum: 100 },
      is_paid: { type: 'boolean', default: false },
      paid_at: { type: ['string', 'null'], format: 'date-time' },
      payment_reference: { type: ['string', 'null'], maxLength: 255 },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    transaction: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Transaction,
      join: {
        from: 'commissions.transaction_id',
        to: 'transactions.id',
      },
    },
    commissionSetting: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => CommissionSetting,
      join: {
        from: 'commissions.commission_setting_id',
        to: 'commission_settings.id',
      },
    },
  };

  // Instance methods
  async markAsPaid(paymentReference: string): Promise<void> {
    await this.$query().patch({
      is_paid: true,
      paid_at: new Date(),
      payment_reference: paymentReference,
    });
  }

  getEffectivePercentage(): number {
    if (this.percentage) {
      return this.percentage;
    }
    if (this.transaction && this.transaction.price > 0) {
      return (this.amount / this.transaction.price) * 100;
    }
    return 0;
  }

  // Static methods
  static async calculateCommission(transaction: Transaction): Promise<{
    amount: number;
    percentage: number;
    settingId?: string;
  }> {
    // Get applicable commission setting
    const setting = await CommissionSetting.findApplicable(
      transaction.price,
      transaction.seller?.role
    );
    
    if (!setting) {
      // Default commission if no setting found
      return {
        amount: transaction.price * 0.05, // 5% default
        percentage: 5,
      };
    }
    
    const amount = setting.type === 'percentage'
      ? transaction.price * (setting.value / 100)
      : setting.value;
    
    const percentage = setting.type === 'percentage'
      ? setting.value
      : (amount / transaction.price) * 100;
    
    return {
      amount,
      percentage,
      settingId: setting.id,
    };
  }

  static async createForTransaction(transactionId: string): Promise<Commission> {
    const transaction = await Transaction.query()
      .findById(transactionId)
      .withGraphFetched('seller');
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    const calculation = await this.calculateCommission(transaction);
    
    return this.query().insertAndFetch({
      transaction_id: transactionId,
      commission_setting_id: calculation.settingId,
      amount: calculation.amount,
      percentage: calculation.percentage,
    });
  }

  static async findUnpaid(): Promise<Commission[]> {
    return this.query()
      .where('is_paid', false)
      .withGraphFetched('[transaction.[seller, vehicle], commissionSetting]')
      .orderBy('created_at', 'asc');
  }

  static async findBySeller(sellerId: string, isPaid?: boolean): Promise<Commission[]> {
    let query = this.query()
      .select('commissions.*')
      .join('transactions', 'commissions.transaction_id', 'transactions.id')
      .where('transactions.seller_id', sellerId)
      .withGraphFetched('[transaction.[vehicle], commissionSetting]');
    
    if (isPaid !== undefined) {
      query = query.where('commissions.is_paid', isPaid);
    }
    
    return query.orderBy('commissions.created_at', 'desc');
  }

  static async getSellerStats(sellerId: string): Promise<{
    totalEarned: number;
    totalPaid: number;
    totalPending: number;
    pendingCount: number;
  }> {
    const stats = await this.query()
      .select(
        this.raw('SUM(commissions.amount) as total'),
        this.raw('SUM(CASE WHEN commissions.is_paid THEN commissions.amount ELSE 0 END) as paid'),
        this.raw('SUM(CASE WHEN NOT commissions.is_paid THEN commissions.amount ELSE 0 END) as pending'),
        this.raw('COUNT(CASE WHEN NOT commissions.is_paid THEN 1 END) as pending_count')
      )
      .join('transactions', 'commissions.transaction_id', 'transactions.id')
      .where('transactions.seller_id', sellerId)
      .first();
    
    return {
      totalEarned: parseFloat(stats.total || '0'),
      totalPaid: parseFloat(stats.paid || '0'),
      totalPending: parseFloat(stats.pending || '0'),
      pendingCount: parseInt(stats.pending_count || '0'),
    };
  }

  static async payBatch(commissionIds: string[], paymentReference: string): Promise<number> {
    return this.query()
      .whereIn('id', commissionIds)
      .where('is_paid', false)
      .patch({
        is_paid: true,
        paid_at: new Date(),
        payment_reference: paymentReference,
      });
  }
}
