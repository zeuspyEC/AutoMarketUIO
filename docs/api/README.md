# API Documentation - AutoMarket Quito

## Base URL
- Development: `http://localhost:3000/api/v1`
- Staging: `https://api-staging.automarket-quito.com/api/v1`
- Production: `https://api.automarket-quito.com/api/v1`

## Authentication
La API utiliza JWT (JSON Web Tokens) para autenticación. Incluye el token en el header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Authentication

#### POST /auth/register
Registra un nuevo usuario.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+593987654321",
  "role": "buyer" // buyer, seller, dealer
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "role": "buyer"
  },
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /auth/login
Inicia sesión.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "user": { ... },
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### Vehicles

#### GET /vehicles
Lista vehículos con filtros y paginación.

**Query Parameters:**
- `page` (int): Página actual (default: 1)
- `limit` (int): Elementos por página (default: 20, max: 100)
- `q` (string): Búsqueda de texto
- `brand_id` (uuid): Filtrar por marca
- `model_id` (uuid): Filtrar por modelo
- `year_min` (int): Año mínimo
- `year_max` (int): Año máximo
- `price_min` (decimal): Precio mínimo
- `price_max` (decimal): Precio máximo
- `condition` (string): new, used, certified
- `transmission` (string): manual, automatic, cvt, dual-clutch
- `fuel_type` (string): gasoline, diesel, electric, hybrid, plug-in-hybrid, lpg
- `city` (string): Ciudad
- `sort` (string): Campo de ordenamiento (price, year, created_at)
- `order` (string): asc o desc

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Toyota Corolla 2022",
      "price": 25000,
      "year": 2022,
      "mileage": 15000,
      "condition": "used",
      "location_city": "Quito",
      "images": [
        {
          "url": "https://...",
          "is_primary": true
        }
      ],
      "seller": {
        "id": "uuid",
        "username": "dealer123",
        "rating": 4.5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### GET /vehicles/:id
Obtiene detalles de un vehículo.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Toyota Corolla 2022",
  "description": "Excelente estado...",
  "price": 25000,
  "negotiable": true,
  "year": 2022,
  "mileage": 15000,
  "color": "Plata",
  "vin": "1HGBH41JXMN109186",
  "engine_size": "1.8L",
  "transmission": "automatic",
  "fuel_type": "gasoline",
  "doors": 4,
  "seats": 5,
  "condition": "used",
  "features": {
    "safety": ["ABS", "Airbags", "Control de estabilidad"],
    "comfort": ["Aire acondicionado", "Asientos de cuero"],
    "technology": ["Bluetooth", "Pantalla táctil"]
  },
  "location_address": "Av. República del Salvador",
  "location_city": "Quito",
  "location_lat": -0.1807,
  "location_lng": -78.4678,
  "views_count": 234,
  "favorites_count": 12,
  "images": [...],
  "seller": {
    "id": "uuid",
    "username": "dealer123",
    "first_name": "Juan",
    "last_name": "Pérez",
    "phone": "+593987654321",
    "rating": 4.5,
    "reviews_count": 23,
    "active_listings": 15
  },
  "brand": {
    "id": "uuid",
    "name": "Toyota"
  },
  "model": {
    "id": "uuid",
    "name": "Corolla"
  }
}
```

#### POST /vehicles
Crea un nuevo vehículo (requiere autenticación).

**Request Body:**
```json
{
  "brand_id": "uuid",
  "model_id": "uuid",
  "title": "Toyota Corolla 2022 - Excelente Estado",
  "description": "Único dueño, mantenimientos al día...",
  "year": 2022,
  "price": 25000,
  "negotiable": true,
  "mileage": 15000,
  "color": "Plata",
  "vin": "1HGBH41JXMN109186",
  "license_plate": "PBA-1234",
  "engine_size": "1.8L",
  "engine_type": "4 cilindros",
  "transmission": "automatic",
  "fuel_type": "gasoline",
  "drivetrain": "fwd",
  "doors": 4,
  "seats": 5,
  "condition": "used",
  "features": {
    "safety": ["ABS", "Airbags"],
    "comfort": ["Aire acondicionado"]
  },
  "location_address": "Av. República del Salvador",
  "location_city": "Quito"
}
```

**Response:** `201 Created`

#### PUT /vehicles/:id
Actualiza un vehículo (requiere ser el propietario).

#### DELETE /vehicles/:id
Elimina un vehículo (requiere ser el propietario).

### Transactions

#### POST /transactions
Crea una nueva transacción.

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "offer_price": 24000,
  "payment_method": "transfer",
  "notes": "Incluye transferencia de dominio"
}
```

#### GET /transactions
Lista transacciones del usuario.

### Messages

#### GET /conversations
Lista conversaciones del usuario.

#### POST /messages
Envía un mensaje.

**Request Body:**
```json
{
  "conversation_id": "uuid",
  "content": "¿Aún está disponible el vehículo?"
}
```

### Favorites

#### POST /favorites
Añade un vehículo a favoritos.

**Request Body:**
```json
{
  "vehicle_id": "uuid"
}
```

#### DELETE /favorites/:vehicle_id
Elimina de favoritos.

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Vehicle not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting
- 100 requests per 15 minutes per IP
- 1000 requests per hour for authenticated users

## Webhooks
Los webhooks están disponibles para eventos importantes:
- `vehicle.created`
- `vehicle.sold`
- `transaction.completed`
- `message.received`

## WebSocket Events
Conectarse a `wss://api.automarket-quito.com` para eventos en tiempo real:
- `vehicle:update`
- `message:new`
- `notification:new`
