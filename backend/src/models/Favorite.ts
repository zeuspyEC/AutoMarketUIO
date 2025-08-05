import { BaseModel } from './BaseModel';
import { RelationMappings, Model } from 'objection';
import { User } from './User';
import { Vehicle } from './Vehicle';

export class Favorite extends BaseModel {
  // Properties
  user_id!: string;
  vehicle_id!: string;

  // Relations
  user?: User;
  vehicle?: Vehicle;

  static tableName = 'favorites';

  static jsonSchema = {
    type: 'object',
    required: ['user_id', 'vehicle_id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      vehicle_id: { type: 'string', format: 'uuid' },
      created_at: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings: RelationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'favorites.user_id',
        to: 'users.id',
      },
    },
    vehicle: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => Vehicle,
      join: {
        from: 'favorites.vehicle_id',
        to: 'vehicles.id',
      },
    },
  };

  // Static methods
  static async findByUser(userId: string): Promise<Favorite[]> {
    return this.query()
      .where('user_id', userId)
      .withGraphFetched('vehicle.[brand, model, images]')
      .orderBy('created_at', 'desc');
  }

  static async exists(userId: string, vehicleId: string): Promise<boolean> {
    const favorite = await this.query()
      .findOne({ user_id: userId, vehicle_id: vehicleId });
    
    return !!favorite;
  }

  static async toggle(userId: string, vehicleId: string): Promise<{ added: boolean }> {
    const existing = await this.query()
      .findOne({ user_id: userId, vehicle_id: vehicleId });
    
    if (existing) {
      await existing.$query().delete();
      await Vehicle.query()
        .where('id', vehicleId)
        .decrement('favorites_count', 1);
      return { added: false };
    } else {
      await this.query().insert({
        user_id: userId,
        vehicle_id: vehicleId,
      });
      await Vehicle.query()
        .where('id', vehicleId)
        .increment('favorites_count', 1);
      return { added: true };
    }
  }

  static async countByVehicle(vehicleId: string): Promise<number> {
    const result = await this.query()
      .where('vehicle_id', vehicleId)
      .count()
      .first();
    
    return parseInt(result?.count as string || '0');
  }
}
