import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { UserRole } from './User';

export enum CommissionType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CommissionSetting extends BaseModel {
  // Properties
  name!: string;
  description?: string;
  type!: CommissionType;
  value!: number;
  min_price?: number;
  max_price?: number;
  user_role?: UserRole;
  is_active!: boolean;
  priority!: number;

  static tableName = 'commission_settings';

  static jsonSchema = {
    type: 'object',
    required: ['name', 'type', 'value'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: ['string', 'null'] },
      type: { type: 'string', enum: Object.values(CommissionType) },
      value: { type: 'number', minimum: 0 },
      min_price: { type: ['number', 'null'], minimum: 0 },
      max_price: { type: ['number', 'null'], minimum: 0 },
      user_role: { type: ['string', 'null'], enum: Object.values(UserRole) },
      is_active: { type: 'boolean', default: true },
      priority: { type: 'integer', default: 0 },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  // Instance methods
  appliesToPrice(price: number): boolean {
    if (this.min_price && price < this.min_price) {
      return false;
    }
    if (this.max_price && price > this.max_price) {
      return false;
    }
    return true;
  }

  appliesToRole(role?: UserRole): boolean {
    if (!this.user_role) {
      return true; // Applies to all roles
    }
    return this.user_role === role;
  }

  calculateAmount(price: number): number {
    if (this.type === CommissionType.PERCENTAGE) {
      return price * (this.value / 100);
    }
    return this.value;
  }

  getDescription(): string {
    if (this.description) {
      return this.description;
    }
    
    let desc = this.name + ': ';
    
    if (this.type === CommissionType.PERCENTAGE) {
      desc += `${this.value}% del precio`;
    } else {
      desc += `$${this.value} fijo`;
    }
    
    if (this.min_price || this.max_price) {
      desc += ' (';
      if (this.min_price && this.max_price) {
        desc += `precios entre $${this.min_price} y $${this.max_price}`;
      } else if (this.min_price) {
        desc += `precios desde $${this.min_price}`;
      } else if (this.max_price) {
        desc += `precios hasta $${this.max_price}`;
      }
      desc += ')';
    }
    
    if (this.user_role) {
      desc += ` - Solo para ${this.user_role}`;
    }
    
    return desc;
  }

  // Static methods
  static async findActive(): Promise<CommissionSetting[]> {
    return this.query()
      .where('is_active', true)
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc');
  }

  static async findApplicable(price: number, userRole?: UserRole): Promise<CommissionSetting | undefined> {
    const settings = await this.query()
      .where('is_active', true)
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc');
    
    for (const setting of settings) {
      if (setting.appliesToPrice(price) && setting.appliesToRole(userRole)) {
        return setting;
      }
    }
    
    return undefined;
  }

  static async createDefault(): Promise<void> {
    const defaults = [
      {
        name: 'Comisión estándar',
        description: 'Comisión por defecto para todas las ventas',
        type: CommissionType.PERCENTAGE,
        value: 5,
        priority: 0,
      },
      {
        name: 'Comisión premium',
        description: 'Comisión reducida para dealers premium',
        type: CommissionType.PERCENTAGE,
        value: 3,
        user_role: UserRole.DEALER,
        priority: 10,
      },
      {
        name: 'Comisión vehículos económicos',
        description: 'Comisión fija para vehículos de bajo precio',
        type: CommissionType.FIXED,
        value: 500,
        max_price: 10000,
        priority: 5,
      },
      {
        name: 'Comisión vehículos de lujo',
        description: 'Comisión especial para vehículos de alto valor',
        type: CommissionType.PERCENTAGE,
        value: 2,
        min_price: 50000,
        priority: 15,
      },
    ];
    
    for (const setting of defaults) {
      const exists = await this.query()
        .where('name', setting.name)
        .first();
      
      if (!exists) {
        await this.query().insert(setting);
      }
    }
  }

  static async getCommissionTable(): Promise<CommissionSetting[]> {
    return this.query()
      .where('is_active', true)
      .orderBy('priority', 'desc')
      .orderBy('min_price', 'asc')
      .orderBy('created_at', 'asc');
  }
}
