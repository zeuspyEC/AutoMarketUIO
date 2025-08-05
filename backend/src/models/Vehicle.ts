import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Brand } from './Brand';
import { VehicleModel } from './VehicleModel';
import { VehicleImage } from './VehicleImage';
import { Transaction } from './Transaction';
import { Favorite } from './Favorite';

export enum VehicleStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  INACTIVE = 'inactive',
}

export enum VehicleCondition {
  NEW = 'new',
  USED = 'used',
  CERTIFIED = 'certified',
}

export enum TransmissionType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  CVT = 'cvt',
  DUAL_CLUTCH = 'dual-clutch',
}

export enum FuelType {
  GASOLINE = 'gasoline',
  DIESEL = 'diesel',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
  PLUG_IN_HYBRID = 'plug-in-hybrid',
  LPG = 'lpg',
}

export enum DrivetrainType {
  FWD = 'fwd',
  RWD = 'rwd',
  AWD = 'awd',
  FOUR_WD = '4wd',
}

export interface VehicleFeatures {
  safety?: string[];
  comfort?: string[];
  technology?: string[];
  exterior?: string[];
  interior?: string[];
  performance?: string[];
}

export class Vehicle extends BaseModel {
  // Properties
  seller_id!: string;
  brand_id!: string;
  model_id!: string;
  title!: string;
  description?: string;
  year!: number;
  price!: number;
  negotiable!: boolean;
  mileage?: number;
  color?: string;
  vin?: string;
  license_plate?: string;
  engine_size?: string;
  engine_type?: string;
  transmission?: TransmissionType;
  fuel_type?: FuelType;
  drivetrain?: DrivetrainType;
  doors?: number;
  seats?: number;
  condition!: VehicleCondition;
  status!: VehicleStatus;
  features!: VehicleFeatures;
  location_address?: string;
  location_city!: string;
  location_province!: string;
  location_lat?: number;
  location_lng?: number;
  views_count!: number;
  favorites_count!: number;
  is_featured!: boolean;
  featured_until?: Date;
  published_at?: Date;
  sold_at?: Date;

  // Relations
  seller?: User;
  brand?: Brand;
  model?: VehicleModel;
  images?: VehicleImage[];
  transactions?: Transaction[];
  favorites?: Favorite[];

  static tableName = 'vehicles';

  static jsonSchema = {
    type: 'object',
    required: ['seller_id', 'brand_id', 'model_id', 'title', 'year', 'price', 'condition'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      seller_id: { type: 'string', format: 'uuid' },
      brand_id: { type: 'string', format: 'uuid' },
      model_id: { type: 'string', format: 'uuid' },
      title: { type: 'string', minLength: 5, maxLength: 255 },
      description: { type: ['string', 'null'] },
      year: { type: 'integer', minimum: 1900, maximum: new Date().getFullYear() + 1 },
      price: { type: 'number', minimum: 0 },
      negotiable: { type: 'boolean', default: true },
      mileage: { type: ['integer', 'null'], minimum: 0 },
      color: { type: ['string', 'null'], maxLength: 50 },
      vin: { type: ['string', 'null'], minLength: 17, maxLength: 17 },
      license_plate: { type: ['string', 'null'], maxLength: 20 },
      engine_size: { type: ['string', 'null'], maxLength: 20 },
      engine_type: { type: ['string', 'null'], maxLength: 50 },
      transmission: { type: ['string', 'null'], enum: Object.values(TransmissionType) },
      fuel_type: { type: ['string', 'null'], enum: Object.values(FuelType) },
      drivetrain: { type: ['string', 'null'], enum: Object.values(DrivetrainType) },
      doors: { type: ['integer', 'null'], minimum: 2, maximum: 6 },
      seats: { type: ['integer', 'null'], minimum: 1, maximum: 50 },
      condition: { type: 'string', enum: Object.values(VehicleCondition) },
      status: { type: 'string', enum: Object.values(VehicleStatus), default: VehicleStatus.AVAILABLE },
      features: { type: 'object', default: {} },
      location_address: { type: ['string', 'null'], maxLength: 255 },
      location_city: { type: 'string', default: 'Quito' },
      location_province: { type: 'string', default: 'Pichincha' },
      location_lat: { type: ['number', 'null'] },
      location_lng: { type: ['number', 'null'] },
      views_count: { type: 'integer', default: 0 },
      favorites_count: { type: 'integer', default: 0 },
      is_featured: { type: 'boolean', default: false },
      featured_until: { type: ['string', 'null'], format: 'date-time' },
      published_at: { type: ['string', 'null'], format: 'date-time' },
      sold_at: { type: ['string', 'null'], format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    seller: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'vehicles.seller_id',
        to: 'users.id',
      },
    },
    brand: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Brand,
      join: {
        from: 'vehicles.brand_id',
        to: 'brands.id',
      },
    },
    model: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => VehicleModel,
      join: {
        from: 'vehicles.model_id',
        to: 'models.id',
      },
    },
    images: {
      relation: Model.HasManyRelation,
      modelClass: () => VehicleImage,
      join: {
        from: 'vehicles.id',
        to: 'vehicle_images.vehicle_id',
      },
      modify: (query) => query.orderBy('display_order', 'asc'),
    },
    transactions: {
      relation: Model.HasManyRelation,
      modelClass: () => Transaction,
      join: {
        from: 'vehicles.id',
        to: 'transactions.vehicle_id',
      },
    },
    favorites: {
      relation: Model.HasManyRelation,
      modelClass: () => Favorite,
      join: {
        from: 'vehicles.id',
        to: 'favorites.vehicle_id',
      },
    },
  };

  // Instance methods
  async incrementViewCount() {
    await Vehicle.query()
      .where('id', this.id)
      .increment('views_count', 1);
  }

  async updateFavoriteCount() {
    const count = await Favorite.query()
      .where('vehicle_id', this.id)
      .count()
      .first();
    
    await Vehicle.query()
      .where('id', this.id)
      .patch({ favorites_count: parseInt(count?.count as string || '0') });
  }

  async markAsSold(buyerId: string) {
    await this.$query().patch({
      status: VehicleStatus.SOLD,
      sold_at: new Date(),
    });
  }

  async markAsReserved() {
    await this.$query().patch({
      status: VehicleStatus.RESERVED,
    });
  }

  async markAsAvailable() {
    await this.$query().patch({
      status: VehicleStatus.AVAILABLE,
    });
  }

  // Static methods
  static async findAvailable() {
    return this.query()
      .where('status', VehicleStatus.AVAILABLE)
      .whereNotNull('published_at')
      .orderBy('created_at', 'desc');
  }

  static async findFeatured() {
    return this.query()
      .where('status', VehicleStatus.AVAILABLE)
      .where('is_featured', true)
      .where('featured_until', '>', new Date())
      .orderBy('featured_until', 'desc');
  }

  static async findByLocation(city: string, province?: string) {
    let query = this.query()
      .where('status', VehicleStatus.AVAILABLE)
      .where('location_city', city);
    
    if (province) {
      query = query.where('location_province', province);
    }
    
    return query.orderBy('created_at', 'desc');
  }

  static async search(params: any) {
    let query = this.query()
      .where('status', VehicleStatus.AVAILABLE)
      .whereNotNull('published_at');

    // Text search
    if (params.q) {
      query = query.where((builder) => {
        builder
          .where('title', 'ilike', `%${params.q}%`)
          .orWhere('description', 'ilike', `%${params.q}%`);
      });
    }

    // Filters
    if (params.brand_id) query = query.where('brand_id', params.brand_id);
    if (params.model_id) query = query.where('model_id', params.model_id);
    if (params.year_min) query = query.where('year', '>=', params.year_min);
    if (params.year_max) query = query.where('year', '<=', params.year_max);
    if (params.price_min) query = query.where('price', '>=', params.price_min);
    if (params.price_max) query = query.where('price', '<=', params.price_max);
    if (params.mileage_max) query = query.where('mileage', '<=', params.mileage_max);
    if (params.condition) query = query.where('condition', params.condition);
    if (params.transmission) query = query.where('transmission', params.transmission);
    if (params.fuel_type) query = query.where('fuel_type', params.fuel_type);
    if (params.drivetrain) query = query.where('drivetrain', params.drivetrain);
    if (params.color) query = query.where('color', 'ilike', `%${params.color}%`);
    if (params.city) query = query.where('location_city', params.city);
    if (params.province) query = query.where('location_province', params.province);

    // Sorting
    const sortBy = params.sort || 'created_at';
    const order = params.order || 'desc';
    query = query.orderBy(sortBy, order);

    return query;
  }

  // Hooks
  async $afterFind() {
    // Parse features JSON if it's a string
    if (typeof this.features === 'string') {
      try {
        this.features = JSON.parse(this.features);
      } catch (e) {
        this.features = {};
      }
    }
  }
}
