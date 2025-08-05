-- AutoMarket Quito Database Schema
-- PostgreSQL Database Schema for Vehicle E-commerce Platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'dealer', 'admin');
CREATE TYPE vehicle_status AS ENUM ('available', 'reserved', 'sold', 'inactive');
CREATE TYPE vehicle_condition AS ENUM ('new', 'used', 'certified');
CREATE TYPE transmission_type AS ENUM ('manual', 'automatic', 'cvt', 'dual-clutch');
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'electric', 'hybrid', 'plug-in-hybrid', 'lpg');
CREATE TYPE drivetrain_type AS ENUM ('fwd', 'rwd', 'awd', '4wd');
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'buyer',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- User profiles (additional information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    company_name VARCHAR(255),
    tax_id VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    province VARCHAR(100) DEFAULT 'Pichincha',
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Ecuador',
    website VARCHAR(255),
    social_facebook VARCHAR(255),
    social_instagram VARCHAR(255),
    social_whatsapp VARCHAR(20),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle brands
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle models
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    year_start INTEGER,
    year_end INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, name)
);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id),
    model_id UUID NOT NULL REFERENCES models(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    negotiable BOOLEAN DEFAULT TRUE,
    mileage INTEGER CHECK (mileage >= 0),
    color VARCHAR(50),
    vin VARCHAR(17) UNIQUE,
    license_plate VARCHAR(20),
    engine_size VARCHAR(20),
    engine_type VARCHAR(50),
    transmission transmission_type,
    fuel_type fuel_type,
    drivetrain drivetrain_type,
    doors INTEGER CHECK (doors >= 2 AND doors <= 6),
    seats INTEGER CHECK (seats >= 1 AND seats <= 50),
    condition vehicle_condition NOT NULL,
    status vehicle_status DEFAULT 'available',
    features JSONB DEFAULT '[]',
    location_address VARCHAR(255),
    location_city VARCHAR(100) DEFAULT 'Quito',
    location_province VARCHAR(100) DEFAULT 'Pichincha',
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    views_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    featured_until TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for vehicles
CREATE INDEX idx_vehicles_seller ON vehicles(seller_id);
CREATE INDEX idx_vehicles_brand ON vehicles(brand_id);
CREATE INDEX idx_vehicles_model ON vehicles(model_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_price ON vehicles(price);
CREATE INDEX idx_vehicles_year ON vehicles(year);
CREATE INDEX idx_vehicles_location ON vehicles(location_city, location_province);
CREATE INDEX idx_vehicles_search ON vehicles USING gin(to_tsvector('spanish', title || ' ' || COALESCE(description, '')));

-- Vehicle images
CREATE TABLE vehicle_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicle_images_vehicle ON vehicle_images(vehicle_id);

-- Vehicle favorites
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, vehicle_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_vehicle ON favorites(vehicle_id);

-- Vehicle views tracking
CREATE TABLE vehicle_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicle_views_vehicle ON vehicle_views(vehicle_id);
CREATE INDEX idx_vehicle_views_date ON vehicle_views(viewed_at);

-- Messages/Chat
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    buyer_unread_count INTEGER DEFAULT 0,
    seller_unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_id, buyer_id, seller_id)
);

CREATE INDEX idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX idx_conversations_seller ON conversations(seller_id);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    price DECIMAL(12, 2) NOT NULL,
    commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12, 2) NOT NULL,
    status transaction_status DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_vehicle ON transactions(vehicle_id);
CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_number ON transactions(transaction_number);

-- Commission settings
CREATE TABLE commission_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type commission_type NOT NULL,
    value DECIMAL(10, 4) NOT NULL,
    min_price DECIMAL(12, 2),
    max_price DECIMAL(12, 2),
    user_role user_role,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commission history
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    commission_setting_id UUID REFERENCES commission_settings(id),
    amount DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2),
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commissions_transaction ON commissions(transaction_id);
CREATE INDEX idx_commissions_paid ON commissions(is_paid);

-- Reviews and ratings
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewed_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_buyer_review BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewed ON reviews(reviewed_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Search history
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_created ON search_history(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_settings_updated_at BEFORE UPDATE ON commission_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for vehicle statistics
CREATE VIEW vehicle_statistics AS
SELECT 
    v.id,
    v.seller_id,
    COUNT(DISTINCT vv.id) as total_views,
    COUNT(DISTINCT f.id) as total_favorites,
    COUNT(DISTINCT m.id) as total_messages,
    AVG(r.rating) as seller_rating
FROM vehicles v
LEFT JOIN vehicle_views vv ON v.id = vv.vehicle_id
LEFT JOIN favorites f ON v.id = f.vehicle_id
LEFT JOIN conversations c ON v.id = c.vehicle_id
LEFT JOIN messages m ON c.id = m.conversation_id
LEFT JOIN reviews r ON v.seller_id = r.reviewed_id
GROUP BY v.id, v.seller_id;

-- Create materialized view for popular vehicles
CREATE MATERIALIZED VIEW popular_vehicles AS
SELECT 
    v.*,
    COUNT(DISTINCT vv.id) as view_count_7d,
    COUNT(DISTINCT f.id) as favorite_count_7d
FROM vehicles v
LEFT JOIN vehicle_views vv ON v.id = vv.vehicle_id 
    AND vv.viewed_at >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN favorites f ON v.id = f.vehicle_id 
    AND f.created_at >= CURRENT_DATE - INTERVAL '7 days'
WHERE v.status = 'available'
GROUP BY v.id
ORDER BY view_count_7d DESC, favorite_count_7d DESC;

-- Create index on materialized view
CREATE INDEX idx_popular_vehicles_counts ON popular_vehicles(view_count_7d, favorite_count_7d);

-- Grant permissions (adjust as needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO automarket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO automarket_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO automarket_user;
