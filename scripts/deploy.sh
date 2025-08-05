#!/bin/bash

# AutoMarket Quito - Deployment Script
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Default values
ENVIRONMENT="production"
VERSION=""
ROLLBACK=false
DRY_RUN=false
SKIP_TESTS=false
SKIP_MIGRATIONS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -e, --environment    Target environment (development|staging|production)"
            echo "  -v, --version        Version to deploy (git tag or commit hash)"
            echo "  -r, --rollback       Rollback to previous version"
            echo "  -d, --dry-run        Show what would be done without doing it"
            echo "  --skip-tests         Skip running tests"
            echo "  --skip-migrations    Skip database migrations"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Get current version if not specified
if [ -z "$VERSION" ]; then
    VERSION=$(git describe --tags --always)
fi

echo "🚗 AutoMarket Quito - Deployment Script"
echo "======================================"
print_info "Environment: $ENVIRONMENT"
print_info "Version: $VERSION"
print_info "Dry Run: $DRY_RUN"
echo ""

# Function to execute commands (respects dry run)
execute() {
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] $@"
    else
        eval "$@"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Pre-deployment checks
print_info "Running pre-deployment checks..."

# Check required tools
for tool in git docker docker-compose kubectl; do
    if ! command_exists $tool; then
        print_error "$tool is not installed"
        exit 1
    fi
done

print_success "All required tools are installed"

# Check git status
if [ "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Checkout version
print_info "Checking out version $VERSION..."
execute "git fetch --all --tags"
execute "git checkout $VERSION"

# Run tests if not skipped
if [ "$SKIP_TESTS" = false ]; then
    print_info "Running tests..."
    execute "npm run test:unit"
    execute "npm run test:integration"
    print_success "All tests passed"
else
    print_warning "Skipping tests"
fi

# Build application
print_info "Building application..."
execute "npm run build"
print_success "Build completed"

# Build Docker images
print_info "Building Docker images..."
TIMESTAMP=$(date +%Y%m%d%H%M%S)
IMAGE_TAG="${VERSION}-${TIMESTAMP}"

execute "docker build -t automarket-backend:$IMAGE_TAG ./backend"
execute "docker build -t automarket-frontend:$IMAGE_TAG ./frontend"
print_success "Docker images built"

# Tag images for registry
REGISTRY="ghcr.io/your-org"
execute "docker tag automarket-backend:$IMAGE_TAG $REGISTRY/automarket-backend:$IMAGE_TAG"
execute "docker tag automarket-frontend:$IMAGE_TAG $REGISTRY/automarket-frontend:$IMAGE_TAG"
execute "docker tag automarket-backend:$IMAGE_TAG $REGISTRY/automarket-backend:$ENVIRONMENT"
execute "docker tag automarket-frontend:$IMAGE_TAG $REGISTRY/automarket-frontend:$ENVIRONMENT"

# Push images to registry
print_info "Pushing images to registry..."
execute "docker push $REGISTRY/automarket-backend:$IMAGE_TAG"
execute "docker push $REGISTRY/automarket-frontend:$IMAGE_TAG"
execute "docker push $REGISTRY/automarket-backend:$ENVIRONMENT"
execute "docker push $REGISTRY/automarket-frontend:$ENVIRONMENT"
print_success "Images pushed to registry"

# Deploy to Kubernetes
print_info "Deploying to Kubernetes..."

# Set kubectl context based on environment
case $ENVIRONMENT in
    development)
        KUBE_CONTEXT="automarket-dev"
        NAMESPACE="development"
        ;;
    staging)
        KUBE_CONTEXT="automarket-staging"
        NAMESPACE="staging"
        ;;
    production)
        KUBE_CONTEXT="automarket-prod"
        NAMESPACE="production"
        ;;
esac

execute "kubectl config use-context $KUBE_CONTEXT"

# Run database migrations if not skipped
if [ "$SKIP_MIGRATIONS" = false ]; then
    print_info "Running database migrations..."
    execute "kubectl run migrations-$TIMESTAMP \
        --image=$REGISTRY/automarket-backend:$IMAGE_TAG \
        --namespace=$NAMESPACE \
        --rm -i --restart=Never \
        -- npm run migrate:deploy"
    print_success "Migrations completed"
else
    print_warning "Skipping database migrations"
fi

# Update Kubernetes deployments
print_info "Updating deployments..."

# Update backend
execute "kubectl set image deployment/automarket-backend \
    backend=$REGISTRY/automarket-backend:$IMAGE_TAG \
    --namespace=$NAMESPACE"

# Update frontend
execute "kubectl set image deployment/automarket-frontend \
    frontend=$REGISTRY/automarket-frontend:$IMAGE_TAG \
    --namespace=$NAMESPACE"

# Wait for rollout to complete
print_info "Waiting for rollout to complete..."
execute "kubectl rollout status deployment/automarket-backend --namespace=$NAMESPACE"
execute "kubectl rollout status deployment/automarket-frontend --namespace=$NAMESPACE"

# Run health checks
print_info "Running health checks..."
BACKEND_URL="https://api-$ENVIRONMENT.automarket-quito.com/health"
FRONTEND_URL="https://$ENVIRONMENT.automarket-quito.com/health"

if [ "$DRY_RUN" = false ]; then
    # Check backend health
    if curl -f $BACKEND_URL > /dev/null 2>&1; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
        exit 1
    fi

    # Check frontend health
    if curl -f $FRONTEND_URL > /dev/null 2>&1; then
        print_success "Frontend health check passed"
    else
        print_error "Frontend health check failed"
        exit 1
    fi
fi

# Clear CDN cache
print_info "Clearing CDN cache..."
execute "aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths '/*'"

# Update monitoring
print_info "Updating monitoring dashboards..."
execute "kubectl apply -f infrastructure/k8s/monitoring/ --namespace=monitoring"

# Send deployment notification
print_info "Sending deployment notification..."
if [ "$DRY_RUN" = false ]; then
    curl -X POST $SLACK_WEBHOOK_URL \
        -H 'Content-type: application/json' \
        -d "{
            \"text\": \"✅ Deployment completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                    {\"title\": \"Version\", \"value\": \"$VERSION\", \"short\": true},
                    {\"title\": \"Deployed by\", \"value\": \"$(git config user.name)\", \"short\": true},
                    {\"title\": \"Timestamp\", \"value\": \"$(date)\", \"short\": true}
                ]
            }]
        }"
fi

# Create deployment record
print_info "Recording deployment..."
execute "echo '$VERSION|$ENVIRONMENT|$(date)|$(git config user.name)' >> deployments.log"

# Success message
echo ""
print_success "🎉 Deployment completed successfully!"
echo ""
echo "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Version: $VERSION"
echo "  Image Tag: $IMAGE_TAG"
echo "  Duration: $SECONDS seconds"
echo ""
echo "URLs:"
echo "  Frontend: https://$ENVIRONMENT.automarket-quito.com"
echo "  Backend: https://api-$ENVIRONMENT.automarket-quito.com"
echo "  API Docs: https://api-$ENVIRONMENT.automarket-quito.com/api-docs"
echo ""

# Rollback function
if [ "$ROLLBACK" = true ]; then
    print_warning "Rollback requested"
    read -p "Are you sure you want to rollback? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Rolling back deployment..."
        execute "kubectl rollout undo deployment/automarket-backend --namespace=$NAMESPACE"
        execute "kubectl rollout undo deployment/automarket-frontend --namespace=$NAMESPACE"
        print_success "Rollback completed"
    fi
fi
