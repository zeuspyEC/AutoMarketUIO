#!/bin/bash

# AutoMarket Quito - Setup Script
# This script sets up the development environment

set -e

echo "🚗 AutoMarket Quito - Environment Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check for required tools
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    else
        print_success "Node.js $(node -v) detected"
    fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
else
    print_success "npm $(npm -v) detected"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. You'll need Docker to run the services."
else
    print_success "Docker detected"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose is not installed. You'll need Docker Compose to run the services."
else
    print_success "Docker Compose detected"
fi

# Create necessary directories
echo -e "\nCreating directories..."
mkdir -p backend/logs
mkdir -p backend/uploads
mkdir -p frontend/public/uploads
mkdir -p database/backups
mkdir -p infrastructure/nginx/conf.d
mkdir -p infrastructure/prometheus
mkdir -p infrastructure/grafana/dashboards
mkdir -p infrastructure/grafana/datasources

print_success "Directories created"

# Copy environment file
echo -e "\nSetting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env file from .env.example"
    print_warning "Please update the .env file with your configuration"
else
    print_warning ".env file already exists, skipping..."
fi

# Install dependencies
echo -e "\nInstalling dependencies..."
npm install

echo -e "\nInstalling backend dependencies..."
cd backend
npm install
cd ..

echo -e "\nInstalling frontend dependencies..."
cd frontend
npm install
cd ..

print_success "All dependencies installed"

# Generate necessary files
echo -e "\nGenerating configuration files..."

# Create knexfile.js for database migrations
cat > backend/knexfile.js << 'EOF'
module.exports = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://automarket_user:automarket_pass@localhost:5432/automarket_db',
    migrations: {
      directory: './src/migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './src/seeds',
      extension: 'ts'
    }
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './dist/migrations',
      extension: 'js'
    },
    seeds: {
      directory: './dist/seeds',
      extension: 'js'
    }
  }
};
EOF

print_success "Generated knexfile.js"

# Create Prometheus configuration
cat > infrastructure/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'automarket-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
EOF

print_success "Generated Prometheus configuration"

# Create Grafana datasource configuration
cat > infrastructure/grafana/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

print_success "Generated Grafana datasource configuration"

# Create nginx configuration
cat > infrastructure/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_status 429;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
}
EOF

print_success "Generated nginx configuration"

# Create main nginx server configuration
cat > infrastructure/nginx/conf.d/default.conf << 'EOF'
upstream backend {
    server backend:3000 max_fails=3 fail_timeout=30s;
}

upstream frontend {
    server frontend:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API with rate limiting
    location /api {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

print_success "Generated nginx server configuration"

# Create git hooks
echo -e "\nSetting up git hooks..."
mkdir -p .git/hooks

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Run linting
npm run lint

# Run tests
npm run test:unit

if [ $? -ne 0 ]; then
    echo "Pre-commit checks failed. Please fix the issues before committing."
    exit 1
fi

echo "Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit
print_success "Git hooks configured"

# Docker setup
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "\nSetting up Docker services..."
    
    # Pull images
    docker-compose pull
    
    # Start services
    print_warning "Starting Docker services..."
    docker-compose up -d postgres redis rabbitmq
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Run database migrations
    echo "Running database migrations..."
    cd backend
    npm run migrate
    cd ..
    
    print_success "Docker services started"
else
    print_warning "Docker not found. Please run 'docker-compose up' manually to start services."
fi

# Final instructions
echo -e "\n${GREEN}✨ Setup completed successfully!${NC}"
echo -e "\nNext steps:"
echo "1. Update the .env file with your configuration"
echo "2. Run 'docker-compose up' to start all services"
echo "3. Run 'npm run dev' to start the development servers"
echo "4. Access the application at http://localhost"
echo "5. Access the API documentation at http://localhost:3000/api-docs"
echo -e "\nHappy coding! 🚀"
