import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import { cache, cacheKeys } from '../config/redis';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Main authentication middleware
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.substring(7);
    req.token = token;
    
    // Check if token is blacklisted
    const isBlacklisted = await cache.sismember('blacklisted_tokens', token);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }
    
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;
    
    // Check cache for user
    const cacheKey = cacheKeys.user(decoded.id);
    let user = await cache.get<User>(cacheKey);
    
    if (!user) {
      // Get user from database
      user = await User.query()
        .findById(decoded.id)
        .withGraphFetched('profile');
      
      if (!user) {
        throw new UnauthorizedError('User not found');
      }
      
      // Cache user for 5 minutes
      await cache.set(cacheKey, user, 300);
    }
    
    // Check if user is active
    if (!user.is_active) {
      throw new ForbiddenError('Account is deactivated');
    }
    
    // Attach user to request
    req.user = user;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.token = token;
      
      // Check if token is blacklisted
      const isBlacklisted = await cache.sismember('blacklisted_tokens', token);
      if (!isBlacklisted) {
        // Verify token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key'
        ) as JWTPayload;
        
        // Get user from cache or database
        const cacheKey = cacheKeys.user(decoded.id);
        let user = await cache.get<User>(cacheKey);
        
        if (!user) {
          user = await User.query()
            .findById(decoded.id)
            .withGraphFetched('profile');
          
          if (user && user.is_active) {
            await cache.set(cacheKey, user, 300);
            req.user = user;
          }
        } else if (user.is_active) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  
  next();
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError('You do not have permission to access this resource')
      );
    }
    
    next();
  };
};

// Check if user owns the resource
export const checkOwnership = (
  resourceGetter: (req: Request) => Promise<any>,
  ownerField: string = 'user_id'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }
      
      const resource = await resourceGetter(req);
      
      if (!resource) {
        return next(new ForbiddenError('Resource not found'));
      }
      
      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Check ownership
      const ownerId = resource[ownerField] || resource.owner_id || resource.seller_id;
      
      if (ownerId !== req.user.id) {
        return next(new ForbiddenError('You do not own this resource'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Verify email middleware
export const requireVerifiedEmail = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  if (!req.user.is_verified) {
    return next(new ForbiddenError('Email verification required'));
  }
  
  next();
};

// Two-factor authentication check
export const requireTwoFactor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  if (req.user.two_factor_enabled) {
    const twoFactorToken = req.headers['x-2fa-token'] as string;
    
    if (!twoFactorToken) {
      return next(new UnauthorizedError('Two-factor authentication required'));
    }
    
    // Verify 2FA token (implement your 2FA logic here)
    // For now, we'll skip the actual verification
  }
  
  next();
};

// API key authentication for external services
export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(new UnauthorizedError('API key required'));
  }
  
  // Verify API key (implement your API key logic here)
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
  
  if (!validApiKeys.includes(apiKey)) {
    return next(new UnauthorizedError('Invalid API key'));
  }
  
  next();
};
