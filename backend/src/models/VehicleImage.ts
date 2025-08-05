import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { Vehicle } from './Vehicle';

export class VehicleImage extends BaseModel {
  // Properties
  vehicle_id!: string;
  url!: string;
  thumbnail_url?: string;
  is_primary!: boolean;
  display_order!: number;

  // Relations
  vehicle?: Vehicle;

  static tableName = 'vehicle_images';

  static jsonSchema = {
    type: 'object',
    required: ['vehicle_id', 'url'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      vehicle_id: { type: 'string', format: 'uuid' },
      url: { type: 'string', maxLength: 500 },
      thumbnail_url: { type: ['string', 'null'], maxLength: 500 },
      is_primary: { type: 'boolean', default: false },
      display_order: { type: 'integer', default: 0 },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    vehicle: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'vehicle_images.vehicle_id',
        to: 'vehicles.id',
      },
    },
  };

  // Static methods
  static async findByVehicle(vehicleId: string): Promise<VehicleImage[]> {
    return this.query()
      .where('vehicle_id', vehicleId)
      .orderBy('display_order')
      .orderBy('created_at');
  }

  static async findPrimary(vehicleId: string): Promise<VehicleImage | undefined> {
    return this.query()
      .where('vehicle_id', vehicleId)
      .where('is_primary', true)
      .first();
  }

  static async setPrimary(vehicleId: string, imageId: string): Promise<void> {
    await this.transaction(async (trx) => {
      // Remove current primary
      await this.query(trx)
        .where('vehicle_id', vehicleId)
        .where('is_primary', true)
        .patch({ is_primary: false });

      // Set new primary
      await this.query(trx)
        .where('id', imageId)
        .where('vehicle_id', vehicleId)
        .patch({ is_primary: true });
    });
  }

  static async reorder(vehicleId: string, imageIds: string[]): Promise<void> {
    await this.transaction(async (trx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await this.query(trx)
          .where('id', imageIds[i])
          .where('vehicle_id', vehicleId)
          .patch({ display_order: i });
      }
    });
  }
}
