import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable extensions
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

  // Create custom types
  await knex.raw(`
    CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'dealer', 'admin');
    CREATE TYPE vehicle_status AS ENUM ('available', 'reserved', 'sold', 'inactive');
    CREATE TYPE vehicle_condition AS ENUM ('new', 'used', 'certified');
    CREATE TYPE transmission_type AS ENUM ('manual', 'automatic', 'cvt', 'dual-clutch');
    CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'electric', 'hybrid', 'plug-in-hybrid', 'lpg');
    CREATE TYPE drivetrain_type AS ENUM ('fwd', 'rwd', 'awd', '4wd');
    CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
    CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');
  `);

  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email', 255).unique().notNullable();
    table.string('username', 100).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.enum('role', null, { useNative: true, enumName: 'user_role' }).defaultTo('buyer');
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('phone', 20);
    table.string('avatar_url', 500);
    table.boolean('is_verified').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.boolean('two_factor_enabled').defaultTo(false);
    table.string('two_factor_secret', 255);
    table.timestamp('last_login_at', { useTz: true });
    table.timestamps(true, true);

    table.index('email');
    table.index('username');
    table.index('role');
  });

  // User profiles
  await knex.schema.createTable('user_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('bio');
    table.string('company_name', 255);
    table.string('tax_id', 50);
    table.string('address_line1', 255);
    table.string('address_line2', 255);
    table.string('city', 100);
    table.string('province', 100).defaultTo('Pichincha');
    table.string('postal_code', 20);
    table.string('country', 100).defaultTo('Ecuador');
    table.string('website', 255);
    table.string('social_facebook', 255);
    table.string('social_instagram', 255);
    table.string('social_whatsapp', 20);
    table.jsonb('preferences').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Brands table
  await knex.schema.createTable('brands', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).unique().notNullable();
    table.string('logo_url', 500);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Models table
  await knex.schema.createTable('models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('brand_id').notNullable().references('id').inTable('brands').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.integer('year_start');
    table.integer('year_end');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    table.unique(['brand_id', 'name']);
  });

  // Vehicles table
  await knex.schema.createTable('vehicles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('brand_id').notNullable().references('id').inTable('brands');
    table.uuid('model_id').notNullable().references('id').inTable('models');
    table.string('title', 255).notNullable();
    table.text('description');
    table.integer('year').notNullable();
    table.decimal('price', 12, 2).notNullable();
    table.boolean('negotiable').defaultTo(true);
    table.integer('mileage');
    table.string('color', 50);
    table.string('vin', 17).unique();
    table.string('license_plate', 20);
    table.string('engine_size', 20);
    table.string('engine_type', 50);
    table.enum('transmission', null, { useNative: true, enumName: 'transmission_type' });
    table.enum('fuel_type', null, { useNative: true, enumName: 'fuel_type' });
    table.enum('drivetrain', null, { useNative: true, enumName: 'drivetrain_type' });
    table.integer('doors');
    table.integer('seats');
    table.enum('condition', null, { useNative: true, enumName: 'vehicle_condition' }).notNullable();
    table.enum('status', null, { useNative: true, enumName: 'vehicle_status' }).defaultTo('available');
    table.jsonb('features').defaultTo('{}');
    table.string('location_address', 255);
    table.string('location_city', 100).defaultTo('Quito');
    table.string('location_province', 100).defaultTo('Pichincha');
    table.decimal('location_lat', 10, 8);
    table.decimal('location_lng', 11, 8);
    table.integer('views_count').defaultTo(0);
    table.integer('favorites_count').defaultTo(0);
    table.boolean('is_featured').defaultTo(false);
    table.timestamp('featured_until', { useTz: true });
    table.timestamp('published_at', { useTz: true });
    table.timestamp('sold_at', { useTz: true });
    table.timestamps(true, true);

    table.index('seller_id');
    table.index('brand_id');
    table.index('model_id');
    table.index('status');
    table.index('price');
    table.index('year');
    table.index(['location_city', 'location_province']);
  });

  // Vehicle images
  await knex.schema.createTable('vehicle_images', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('vehicle_id').notNullable().references('id').inTable('vehicles').onDelete('CASCADE');
    table.string('url', 500).notNullable();
    table.string('thumbnail_url', 500);
    table.boolean('is_primary').defaultTo(false);
    table.integer('display_order').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('vehicle_id');
  });

  // Favorites
  await knex.schema.createTable('favorites', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('vehicle_id').notNullable().references('id').inTable('vehicles').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    table.unique(['user_id', 'vehicle_id']);
    table.index('user_id');
    table.index('vehicle_id');
  });

  // Vehicle views
  await knex.schema.createTable('vehicle_views', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('vehicle_id').notNullable().references('id').inTable('vehicles').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.specificType('ip_address', 'inet');
    table.text('user_agent');
    table.timestamp('viewed_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('vehicle_id');
    table.index('viewed_at');
  });

  // Conversations
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('vehicle_id').notNullable().references('id').inTable('vehicles').onDelete('CASCADE');
    table.uuid('buyer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('last_message_at', { useTz: true });
    table.integer('buyer_unread_count').defaultTo(0);
    table.integer('seller_unread_count').defaultTo(0);
    table.timestamps(true, true);
    
    table.unique(['vehicle_id', 'buyer_id', 'seller_id']);
    table.index('buyer_id');
    table.index('seller_id');
  });

  // Messages
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    table.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('content').notNullable();
    table.boolean('is_read').defaultTo(false);
    table.timestamp('read_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('conversation_id');
    table.index('created_at');
  });

  // Transactions
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('transaction_number', 50).unique().notNullable();
    table.uuid('vehicle_id').notNullable().references('id').inTable('vehicles');
    table.uuid('buyer_id').notNullable().references('id').inTable('users');
    table.uuid('seller_id').notNullable().references('id').inTable('users');
    table.decimal('price', 12, 2).notNullable();
    table.decimal('commission_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('net_amount', 12, 2).notNullable();
    table.enum('status', null, { useNative: true, enumName: 'transaction_status' }).defaultTo('pending');
    table.string('payment_method', 50);
    table.string('payment_reference', 255);
    table.text('notes');
    table.timestamp('completed_at', { useTz: true });
    table.timestamp('cancelled_at', { useTz: true });
    table.text('cancelled_reason');
    table.timestamps(true, true);

    table.index('vehicle_id');
    table.index('buyer_id');
    table.index('seller_id');
    table.index('status');
    table.index('transaction_number');
  });

  // Commission settings
  await knex.schema.createTable('commission_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable();
    table.text('description');
    table.enum('type', null, { useNative: true, enumName: 'commission_type' }).notNullable();
    table.decimal('value', 10, 4).notNullable();
    table.decimal('min_price', 12, 2);
    table.decimal('max_price', 12, 2);
    table.enum('user_role', null, { useNative: true, enumName: 'user_role' });
    table.boolean('is_active').defaultTo(true);
    table.integer('priority').defaultTo(0);
    table.timestamps(true, true);
  });

  // Commissions
  await knex.schema.createTable('commissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('transaction_id').notNullable().references('id').inTable('transactions');
    table.uuid('commission_setting_id').references('id').inTable('commission_settings');
    table.decimal('amount', 10, 2).notNullable();
    table.decimal('percentage', 5, 2);
    table.boolean('is_paid').defaultTo(false);
    table.timestamp('paid_at', { useTz: true });
    table.string('payment_reference', 255);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('transaction_id');
    table.index('is_paid');
  });

  // Reviews
  await knex.schema.createTable('reviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('transaction_id').notNullable().references('id').inTable('transactions');
    table.uuid('reviewer_id').notNullable().references('id').inTable('users');
    table.uuid('reviewed_id').notNullable().references('id').inTable('users');
    table.integer('rating').notNullable();
    table.text('comment');
    table.boolean('is_buyer_review').notNullable();
    table.timestamps(true, true);
    
    table.unique(['transaction_id', 'reviewer_id']);
    table.index('reviewed_id');
    table.index('rating');
  });

  // Notifications
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.string('title', 255).notNullable();
    table.text('message');
    table.jsonb('data').defaultTo('{}');
    table.boolean('is_read').defaultTo(false);
    table.timestamp('read_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('is_read');
    table.index('created_at');
  });

  // Audit logs
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('entity_type', 50).notNullable();
    table.uuid('entity_id').notNullable();
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.specificType('ip_address', 'inet');
    table.text('user_agent');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('user_id');
    table.index(['entity_type', 'entity_id']);
    table.index('created_at');
  });

  // Search history
  await knex.schema.createTable('search_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('search_query').notNullable();
    table.jsonb('filters').defaultTo('{}');
    table.integer('results_count').defaultTo(0);
    table.specificType('ip_address', 'inet');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('created_at');
  });

  // Create updated_at trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Apply triggers to tables with updated_at
  const tablesWithUpdatedAt = [
    'users', 'user_profiles', 'vehicles', 'conversations', 
    'transactions', 'commission_settings', 'reviews'
  ];

  for (const tableName of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER update_${tableName}_updated_at 
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('search_history');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.dropTableIfExists('commissions');
  await knex.schema.dropTableIfExists('commission_settings');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('conversations');
  await knex.schema.dropTableIfExists('vehicle_views');
  await knex.schema.dropTableIfExists('favorites');
  await knex.schema.dropTableIfExists('vehicle_images');
  await knex.schema.dropTableIfExists('vehicles');
  await knex.schema.dropTableIfExists('models');
  await knex.schema.dropTableIfExists('brands');
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');

  // Drop function
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column()');

  // Drop types
  await knex.raw(`
    DROP TYPE IF EXISTS commission_type;
    DROP TYPE IF EXISTS transaction_status;
    DROP TYPE IF EXISTS drivetrain_type;
    DROP TYPE IF EXISTS fuel_type;
    DROP TYPE IF EXISTS transmission_type;
    DROP TYPE IF EXISTS vehicle_condition;
    DROP TYPE IF EXISTS vehicle_status;
    DROP TYPE IF EXISTS user_role;
  `);
}
