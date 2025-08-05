import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';

export class Brand extends BaseModel {
  // Properties
  name!: string;
  logo_url?: string;
  is_active!: boolean;

  static tableName = 'brands';

  static jsonSchema = {
    type: 'object',
    required: ['name'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      logo_url: { type: ['string', 'null'], maxLength: 500 },
      is_active: { type: 'boolean', default: true },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    models: {
      relation: Model.HasManyRelation,
      modelClass: () => require('./VehicleModel').VehicleModel,
      join: {
        from: 'brands.id',
        to: 'models.brand_id',
      },
    },
    vehicles: {
      relation: Model.HasManyRelation,
      modelClass: () => require('./Vehicle').Vehicle,
      join: {
        from: 'brands.id',
        to: 'vehicles.brand_id',
      },
    },
  };

  // Static methods
  static async findActive(): Promise<Brand[]> {
    return this.query().where('is_active', true).orderBy('name');
  }

  static async findByName(name: string): Promise<Brand | undefined> {
    return this.query().findOne({ name });
  }

  static async findPopular(limit: number = 10): Promise<Brand[]> {
    return this.query()
      .select('brands.*')
      .count('vehicles.id as vehicle_count')
      .leftJoin('vehicles', 'brands.id', 'vehicles.brand_id')
      .where('brands.is_active', true)
      .where('vehicles.status', 'available')
      .groupBy('brands.id')
      .orderBy('vehicle_count', 'desc')
      .limit(limit);
  }
}
