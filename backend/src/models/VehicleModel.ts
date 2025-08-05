import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { Brand } from './Brand';
import { Vehicle } from './Vehicle';

export class VehicleModel extends BaseModel {
  // Properties
  brand_id!: string;
  name!: string;
  year_start?: number;
  year_end?: number;
  is_active!: boolean;

  // Relations
  brand?: Brand;
  vehicles?: Vehicle[];

  static tableName = 'models';

  static jsonSchema = {
    type: 'object',
    required: ['brand_id', 'name'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      brand_id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      year_start: { type: ['integer', 'null'], minimum: 1900 },
      year_end: { type: ['integer', 'null'], minimum: 1900 },
      is_active: { type: 'boolean', default: true },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    brand: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Brand,
      join: {
        from: 'models.brand_id',
        to: 'brands.id',
      },
    },
    vehicles: {
      relation: Model.HasManyRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'models.id',
        to: 'vehicles.model_id',
      },
    },
  };

  // Instance methods
  isAvailableForYear(year: number): boolean {
    if (this.year_start && year < this.year_start) {
      return false;
    }
    if (this.year_end && year > this.year_end) {
      return false;
    }
    return true;
  }

  // Static methods
  static async findByBrand(brandId: string): Promise<VehicleModel[]> {
    return this.query()
      .where('brand_id', brandId)
      .where('is_active', true)
      .orderBy('name');
  }

  static async findByBrandAndName(brandId: string, name: string): Promise<VehicleModel | undefined> {
    return this.query()
      .findOne({ brand_id: brandId, name });
  }

  static async findAvailableForYear(year: number): Promise<VehicleModel[]> {
    return this.query()
      .where('is_active', true)
      .where((builder) => {
        builder
          .whereNull('year_start')
          .orWhere('year_start', '<=', year);
      })
      .where((builder) => {
        builder
          .whereNull('year_end')
          .orWhere('year_end', '>=', year);
      })
      .withGraphFetched('brand')
      .orderBy('brand.name')
      .orderBy('name');
  }

  static async findPopular(limit: number = 10): Promise<VehicleModel[]> {
    return this.query()
      .select('models.*')
      .count('vehicles.id as vehicle_count')
      .leftJoin('vehicles', 'models.id', 'vehicles.model_id')
      .where('models.is_active', true)
      .where('vehicles.status', 'available')
      .groupBy('models.id')
      .orderBy('vehicle_count', 'desc')
      .limit(limit)
      .withGraphFetched('brand');
  }
}
