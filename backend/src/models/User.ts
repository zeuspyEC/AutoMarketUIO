import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import bcrypt from 'bcryptjs';
import { Vehicle } from './Vehicle';
import { UserProfile } from './UserProfile';
import { Transaction } from './Transaction';
import { Review } from './Review';
import { Favorite } from './Favorite';
import { Conversation } from './Conversation';

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  DEALER = 'dealer',
  ADMIN = 'admin',
}

export class User extends BaseModel {
  // Properties
  email!: string;
  username!: string;
  password_hash!: string;
  role!: UserRole;
  first_name!: string;
  last_name!: string;
  phone?: string;
  avatar_url?: string;
  is_verified!: boolean;
  is_active!: boolean;
  two_factor_enabled!: boolean;
  two_factor_secret?: string;
  last_login_at?: Date;

  // Virtual properties
  password?: string;

  // Relations
  profile?: UserProfile;
  vehicles?: Vehicle[];
  purchases?: Transaction[];
  sales?: Transaction[];
  reviewsGiven?: Review[];
  reviewsReceived?: Review[];
  favorites?: Favorite[];
  buyerConversations?: Conversation[];
  sellerConversations?: Conversation[];

  static tableName = 'users';

  static jsonSchema = {
    type: 'object',
    required: ['email', 'username', 'first_name', 'last_name'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', maxLength: 255 },
      username: { type: 'string', minLength: 3, maxLength: 100 },
      password_hash: { type: 'string' },
      role: { type: 'string', enum: Object.values(UserRole), default: UserRole.BUYER },
      first_name: { type: 'string', minLength: 1, maxLength: 100 },
      last_name: { type: 'string', minLength: 1, maxLength: 100 },
      phone: { type: ['string', 'null'], maxLength: 20 },
      avatar_url: { type: ['string', 'null'], maxLength: 500 },
      is_verified: { type: 'boolean', default: false },
      is_active: { type: 'boolean', default: true },
      two_factor_enabled: { type: 'boolean', default: false },
      two_factor_secret: { type: ['string', 'null'] },
      last_login_at: { type: ['string', 'null'], format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    profile: {
      relation: Model.HasOneRelation,
      modelClass: () => UserProfile,
      join: {
        from: 'users.id',
        to: 'user_profiles.user_id',
      },
    },
    vehicles: {
      relation: Model.HasManyRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'users.id',
        to: 'vehicles.seller_id',
      },
    },
    purchases: {
      relation: Model.HasManyRelation,
      modelClass: () => Transaction,
      join: {
        from: 'users.id',
        to: 'transactions.buyer_id',
      },
    },
    sales: {
      relation: Model.HasManyRelation,
      modelClass: () => Transaction,
      join: {
        from: 'users.id',
        to: 'transactions.seller_id',
      },
    },
    reviewsGiven: {
      relation: Model.HasManyRelation,
      modelClass: () => Review,
      join: {
        from: 'users.id',
        to: 'reviews.reviewer_id',
      },
    },
    reviewsReceived: {
      relation: Model.HasManyRelation,
      modelClass: () => Review,
      join: {
        from: 'users.id',
        to: 'reviews.reviewed_id',
      },
    },
    favorites: {
      relation: Model.HasManyRelation,
      modelClass: () => Favorite,
      join: {
        from: 'users.id',
        to: 'favorites.user_id',
      },
    },
    buyerConversations: {
      relation: Model.HasManyRelation,
      modelClass: () => Conversation,
      join: {
        from: 'users.id',
        to: 'conversations.buyer_id',
      },
    },
    sellerConversations: {
      relation: Model.HasManyRelation,
      modelClass: () => Conversation,
      join: {
        from: 'users.id',
        to: 'conversations.seller_id',
      },
    },
  };

  // Hooks
  async $beforeInsert() {
    await super.$beforeInsert();
    
    if (this.password) {
      this.password_hash = await bcrypt.hash(this.password, 10);
      delete this.password;
    }
  }

  async $beforeUpdate() {
    await super.$beforeUpdate();
    
    if (this.password) {
      this.password_hash = await bcrypt.hash(this.password, 10);
      delete this.password;
    }
  }

  // Instance methods
  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  async updateLastLogin() {
    await this.$query().patch({
      last_login_at: new Date(),
    });
  }

  getFullName(): string {
    return `${this.first_name} ${this.last_name}`;
  }

  isDealer(): boolean {
    return this.role === UserRole.DEALER;
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  canSell(): boolean {
    return [UserRole.SELLER, UserRole.DEALER, UserRole.ADMIN].includes(this.role);
  }

  async getAverageRating(): Promise<number | null> {
    const result = await Review.query()
      .where('reviewed_id', this.id)
      .avg('rating as average')
      .first();
    
    return result?.average ? parseFloat(result.average as string) : null;
  }

  async getReviewCount(): Promise<number> {
    const result = await Review.query()
      .where('reviewed_id', this.id)
      .count()
      .first();
    
    return parseInt(result?.count as string || '0');
  }

  async getActiveVehicleCount(): Promise<number> {
    const result = await Vehicle.query()
      .where('seller_id', this.id)
      .where('status', 'available')
      .count()
      .first();
    
    return parseInt(result?.count as string || '0');
  }

  async getSoldVehicleCount(): Promise<number> {
    const result = await Vehicle.query()
      .where('seller_id', this.id)
      .where('status', 'sold')
      .count()
      .first();
    
    return parseInt(result?.count as string || '0');
  }

  // Static methods
  static async findByEmail(email: string): Promise<User | undefined> {
    return this.query().findOne({ email: email.toLowerCase() });
  }

  static async findByUsername(username: string): Promise<User | undefined> {
    return this.query().findOne({ username: username.toLowerCase() });
  }

  static async findActive(): Promise<User[]> {
    return this.query().where('is_active', true);
  }

  static async findVerified(): Promise<User[]> {
    return this.query()
      .where('is_active', true)
      .where('is_verified', true);
  }

  static async findDealers(): Promise<User[]> {
    return this.query()
      .where('role', UserRole.DEALER)
      .where('is_active', true);
  }

  static async search(query: string): Promise<User[]> {
    return this.query()
      .where('is_active', true)
      .where((builder) => {
        builder
          .where('username', 'ilike', `%${query}%`)
          .orWhere('email', 'ilike', `%${query}%`)
          .orWhere('first_name', 'ilike', `%${query}%`)
          .orWhere('last_name', 'ilike', `%${query}%`);
      });
  }

  // Hide sensitive data in JSON
  $formatJson(json: any) {
    json = super.$formatJson(json);
    delete json.password;
    delete json.password_hash;
    delete json.two_factor_secret;
    return json;
  }
}
