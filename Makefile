# AutoMarket Quito - Makefile
# Comandos útiles para desarrollo y operaciones

.PHONY: help
help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Configura el entorno de desarrollo
	@echo "🚗 Configurando AutoMarket Quito..."
	@chmod +x scripts/setup.sh
	@./scripts/setup.sh

.PHONY: install
install: ## Instala todas las dependencias
	npm install
	cd backend && npm install
	cd frontend && npm install

.PHONY: dev
dev: ## Inicia el entorno de desarrollo
	docker-compose up -d postgres redis rabbitmq
	npm run dev

.PHONY: build
build: ## Construye la aplicación para producción
	npm run build

.PHONY: test
test: ## Ejecuta todos los tests
	npm run test:all

.PHONY: test-unit
test-unit: ## Ejecuta tests unitarios
	npm run test:unit

.PHONY: test-integration
test-integration: ## Ejecuta tests de integración
	npm run test:integration

.PHONY: test-e2e
test-e2e: ## Ejecuta tests end-to-end
	npm run test:e2e

.PHONY: lint
lint: ## Ejecuta el linter
	npm run lint

.PHONY: format
format: ## Formatea el código
	npm run format

.PHONY: docker-build
docker-build: ## Construye las imágenes Docker
	docker-compose build

.PHONY: docker-up
docker-up: ## Levanta todos los servicios con Docker
	docker-compose up -d

.PHONY: docker-down
docker-down: ## Detiene todos los servicios Docker
	docker-compose down

.PHONY: docker-logs
docker-logs: ## Muestra los logs de Docker
	docker-compose logs -f

.PHONY: db-migrate
db-migrate: ## Ejecuta las migraciones de base de datos
	cd backend && npm run migrate

.PHONY: db-rollback
db-rollback: ## Revierte la última migración
	cd backend && npm run migrate:rollback

.PHONY: db-seed
db-seed: ## Ejecuta los seeders de base de datos
	cd backend && npm run seed

.PHONY: db-reset
db-reset: ## Resetea la base de datos (¡CUIDADO!)
	cd backend && npm run migrate:rollback && npm run migrate && npm run seed

.PHONY: cache-clear
cache-clear: ## Limpia el cache de Redis
	docker-compose exec redis redis-cli FLUSHALL

.PHONY: logs-backend
logs-backend: ## Muestra logs del backend
	docker-compose logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Muestra logs del frontend
	docker-compose logs -f frontend

.PHONY: shell-backend
shell-backend: ## Abre una shell en el contenedor del backend
	docker-compose exec backend sh

.PHONY: shell-frontend
shell-frontend: ## Abre una shell en el contenedor del frontend
	docker-compose exec frontend sh

.PHONY: shell-db
shell-db: ## Abre psql en el contenedor de PostgreSQL
	docker-compose exec postgres psql -U automarket_user -d automarket_db

.PHONY: backup-db
backup-db: ## Crea un backup de la base de datos
	@mkdir -p database/backups
	docker-compose exec postgres pg_dump -U automarket_user automarket_db > database/backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backup creado en database/backups/"

.PHONY: restore-db
restore-db: ## Restaura la base de datos desde el último backup
	@echo "Restaurando desde el último backup..."
	@LATEST_BACKUP=$$(ls -t database/backups/*.sql | head -1); \
	if [ -z "$$LATEST_BACKUP" ]; then \
		echo "❌ No se encontraron backups"; \
		exit 1; \
	fi; \
	echo "Usando backup: $$LATEST_BACKUP"; \
	docker-compose exec -T postgres psql -U automarket_user automarket_db < $$LATEST_BACKUP

.PHONY: analyze
analyze: ## Analiza el bundle del frontend
	cd frontend && npm run analyze

.PHONY: docs
docs: ## Genera la documentación
	npm run docs:generate

.PHONY: security-check
security-check: ## Ejecuta verificación de seguridad
	npm run security:check

.PHONY: deploy-dev
deploy-dev: ## Despliega a desarrollo
	@chmod +x scripts/deploy.sh
	./scripts/deploy.sh -e development

.PHONY: deploy-staging
deploy-staging: ## Despliega a staging
	@chmod +x scripts/deploy.sh
	./scripts/deploy.sh -e staging

.PHONY: deploy-prod
deploy-prod: ## Despliega a producción
	@chmod +x scripts/deploy.sh
	./scripts/deploy.sh -e production

.PHONY: monitor
monitor: ## Abre las herramientas de monitoreo
	@echo "Abriendo herramientas de monitoreo..."
	@echo "Grafana: http://localhost:3002 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "RabbitMQ: http://localhost:15672 (automarket/automarket_pass)"
	@echo "Kibana: http://localhost:5601"
	@echo "Jaeger: http://localhost:16686"

.PHONY: clean
clean: ## Limpia archivos generados
	npm run clean
	rm -rf node_modules
	rm -rf backend/node_modules
	rm -rf frontend/node_modules
	rm -rf backend/dist
	rm -rf frontend/dist

.PHONY: full-clean
full-clean: clean docker-down ## Limpieza completa incluyendo Docker
	docker system prune -af --volumes

# Comandos de desarrollo rápido
.PHONY: m
m: db-migrate ## Alias corto para migraciones

.PHONY: s
s: db-seed ## Alias corto para seeders

.PHONY: t
t: test ## Alias corto para tests

.PHONY: d
d: dev ## Alias corto para desarrollo

.PHONY: l
l: logs-backend ## Alias corto para logs

# Variables de entorno
export DATABASE_URL ?= postgresql://automarket_user:automarket_pass@localhost:5432/automarket_db
export REDIS_URL ?= redis://localhost:6379
export NODE_ENV ?= development
