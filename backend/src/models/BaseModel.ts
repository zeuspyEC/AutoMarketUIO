import { Model, ModelOptions, QueryContext } from 'objection';
import { v4 as uuidv4 } from 'uuid';

export class BaseModel extends Model {
  id!: string;
  created_at!: Date;
  updated_at!: Date;

  // Generate UUID before insert
  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext);
    
    if (!this.id) {
      this.id = uuidv4();
    }
    
    const now = new Date();
    this.created_at = now;
    this.updated_at = now;
  }

  // Update timestamp before update
  async $beforeUpdate(opt: ModelOptions, queryContext: QueryContext) {
    await super.$beforeUpdate(opt, queryContext);
    this.updated_at = new Date();
  }

  // Format dates when converting to JSON
  $formatJson(json: any) {
    json = super.$formatJson(json);
    
    // Convert dates to ISO strings
    if (json.created_at) {
      json.created_at = new Date(json.created_at).toISOString();
    }
    if (json.updated_at) {
      json.updated_at = new Date(json.updated_at).toISOString();
    }
    
    return json;
  }

  // Common query modifiers
  static query(...args: any[]) {
    return super.query(...args);
  }

  // Soft delete support (if needed)
  static queryWithDeleted(...args: any[]) {
    return super.query(...args);
  }

  static queryOnlyDeleted(...args: any[]) {
    return super.query(...args).whereNotNull('deleted_at');
  }
}

// Export common types
export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Pagination helper
export async function paginate<T extends Model>(
  query: any,
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  // Get total count
  const totalResult = await query.clone().count('* as total').first();
  const total = parseInt(totalResult.total);

  // Apply ordering
  if (params.orderBy) {
    query = query.orderBy(params.orderBy, params.order || 'asc');
  }

  // Get paginated results
  const data = await query.limit(limit).offset(offset);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
