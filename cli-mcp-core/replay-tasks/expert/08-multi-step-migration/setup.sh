#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src/routes" "$WORKSPACE/src/middleware" "$WORKSPACE/src/db"

# Types
cat > "$WORKSPACE/src/types.ts" << 'EOF'
export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    createdAt: string;
}

export interface CreateUserDto {
    name: string;
    email: string;
    role?: 'admin' | 'user';
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
EOF

# In-memory DB
cat > "$WORKSPACE/src/db/store.ts" << 'EOF'
import type { User } from '../types.js';

const users: Map<string, User> = new Map();

export function findAll(): User[] {
    return [...users.values()];
}

export function findById(id: string): User | undefined {
    return users.get(id);
}

export function create(user: User): User {
    users.set(user.id, user);
    return user;
}

export function remove(id: string): boolean {
    return users.delete(id);
}

export function clear(): void {
    users.clear();
}
EOF

# Express middleware — auth
cat > "$WORKSPACE/src/middleware/auth.ts" << 'EOF'
import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
    }

    // Simple token validation (in production, use JWT)
    const decoded = Buffer.from(token.slice(7), 'base64').toString();
    if (!decoded.includes(':')) {
        res.status(401).json({ success: false, error: 'Invalid token' });
        return;
    }

    const [userId, role] = decoded.split(':');
    (req as any).userId = userId;
    (req as any).userRole = role;
    next();
}

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
    if ((req as any).userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden: admin only' });
        return;
    }
    next();
}
EOF

# Express middleware — logger
cat > "$WORKSPACE/src/middleware/logger.ts" << 'EOF'
import type { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
}
EOF

# Express routes — users
cat > "$WORKSPACE/src/routes/users.ts" << 'EOF'
import { Router } from 'express';
import type { Request, Response } from 'express';
import { findAll, findById, create, remove } from '../db/store.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import type { CreateUserDto, ApiResponse, User } from '../types.js';

const router = Router();

// Public: list users
router.get('/users', (req: Request, res: Response) => {
    const users = findAll();
    const response: ApiResponse<User[]> = { success: true, data: users };
    res.json(response);
});

// Public: get user by id
router.get('/users/:id', (req: Request, res: Response) => {
    const user = findById(req.params.id);
    if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
    }
    res.json({ success: true, data: user });
});

// Protected: create user
router.post('/users', authMiddleware, (req: Request, res: Response) => {
    const body = req.body as CreateUserDto;
    if (!body.name || !body.email) {
        res.status(400).json({ success: false, error: 'Name and email required' });
        return;
    }

    const user: User = {
        id: crypto.randomUUID(),
        name: body.name,
        email: body.email,
        role: body.role ?? 'user',
        createdAt: new Date().toISOString(),
    };

    create(user);
    res.status(201).json({ success: true, data: user });
});

// Admin only: delete user
router.delete('/users/:id', authMiddleware, adminOnly, (req: Request, res: Response) => {
    const existed = remove(req.params.id);
    if (!existed) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
    }
    res.status(204).send();
});

export default router;
EOF

# Express routes — health
cat > "$WORKSPACE/src/routes/health.ts" << 'EOF'
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

export default router;
EOF

# Express app
cat > "$WORKSPACE/src/app.ts" << 'EOF'
import express from 'express';
import { loggerMiddleware } from './middleware/logger.js';
import userRoutes from './routes/users.js';
import healthRoutes from './routes/health.js';

const app = express();

// Middleware
app.use(express.json());
app.use(loggerMiddleware);

// Routes
app.use('/api', userRoutes);
app.use('/api', healthRoutes);

// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

export default app;
EOF

# Entry point
cat > "$WORKSPACE/src/index.ts" << 'EOF'
import app from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
EOF
