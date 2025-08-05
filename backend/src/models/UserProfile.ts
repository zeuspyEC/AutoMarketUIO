import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';

export interface UserPreferences {
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    newMessage?: boolean;
    newOffer?: boolean;
    priceChange?: boolean;
  };
  privacy?: {
    showPhone?: boolean;
    showEmail?: boolean;
    showLocation?: boolean;
  };
  search?: {
    savedFilters?: any[];
    recentSearches?: string[];
  };
}

export class UserProfile extends BaseModel {
  // Properties
  user_id!: string;
  bio?: string;
  company_name?: string;
  tax_id?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province!: string;
  postal_code?: string;
  country!: string;
  website?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_whatsapp?: string;
  preferences!: UserPreferences;

  // Relations
  user?: User;

  static tableName = 'user_profiles';

  static jsonSchema = {
    type: 'object',
    required: ['user_id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      bio: { type: ['string', 'null'] },
      company_name: { type: ['string', 'null'], maxLength: 255 },
      tax_id: { type: ['string', 'null'], maxLength: 50 },
      address_line1: { type: ['string', 'null'], maxLength: 255 },
      address_line2: { type: ['string', 'null'], maxLength: 255 },
      city: { type: ['string', 'null'], maxLength: 100 },
      province: { type: 'string', maxLength: 100, default: 'Pichincha' },
      postal_code: { type: ['string', 'null'], maxLength: 20 },
      country: { type: 'string', maxLength: 100, default: 'Ecuador' },
      website: { type: ['string', 'null'], maxLength: 255 },
      social_facebook: { type: ['string', 'null'], maxLength: 255 },
      social_instagram: { type: ['string', 'null'], maxLength: 255 },
      social_whatsapp: { type: ['string', 'null'], maxLength: 20 },
      preferences: { type: 'object', default: {} },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'user_profiles.user_id',
        to: 'users.id',
      },
    },
  };

  // Instance methods
  getFullAddress(): string | null {
    if (!this.address_line1) return null;
    
    const parts = [
      this.address_line1,
      this.address_line2,
      this.city,
      this.province,
      this.postal_code,
      this.country,
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  isComplete(): boolean {
    return !!(
      this.address_line1 &&
      this.city &&
      this.province &&
      this.postal_code
    );
  }

  hasBusinessInfo(): boolean {
    return !!(this.company_name || this.tax_id);
  }

  hasSocialMedia(): boolean {
    return !!(
      this.social_facebook ||
      this.social_instagram ||
      this.social_whatsapp ||
      this.website
    );
  }

  // Static methods
  static async findByUserId(userId: string): Promise<UserProfile | undefined> {
    return this.query().findOne({ user_id: userId });
  }

  static async createOrUpdate(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      return existing.$query().patchAndFetch(data);
    } else {
      return this.query().insertAndFetch({
        ...data,
        user_id: userId,
      });
    }
  }

  // Hooks
  async $afterFind() {
    // Parse preferences JSON if it's a string
    if (typeof this.preferences === 'string') {
      try {
        this.preferences = JSON.parse(this.preferences);
      } catch (e) {
        this.preferences = {};
      }
    }
  }
}
