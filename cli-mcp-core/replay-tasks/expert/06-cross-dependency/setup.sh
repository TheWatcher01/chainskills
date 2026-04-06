#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src/models" "$WORKSPACE/src/services" "$WORKSPACE/src/utils" "$WORKSPACE/src/config"

# Config — innocent, no circular deps here
cat > "$WORKSPACE/src/config/constants.ts" << 'EOF'
export const MAX_RETRIES = 3;
export const TIMEOUT_MS = 5000;
export const DEFAULT_LOCALE = 'en-US';
EOF

# Utils — depends on config (ok)
cat > "$WORKSPACE/src/utils/retry.ts" << 'EOF'
import { MAX_RETRIES, TIMEOUT_MS } from '../config/constants.js';

export async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e as Error;
            await new Promise(r => setTimeout(r, Math.min(1000 * (i + 1), TIMEOUT_MS)));
        }
    }
    throw lastError ?? new Error('Max retries exceeded');
}
EOF

cat > "$WORKSPACE/src/utils/format.ts" << 'EOF'
import { DEFAULT_LOCALE } from '../config/constants.js';
// CIRCULAR: imports from services/user.ts which imports from models/user.ts which imports from utils/format.ts
import { getCurrentUser } from '../services/user.js';

export function formatName(first: string, last: string): string {
    return `${first} ${last}`;
}

export function formatCurrency(amount: number, locale = DEFAULT_LOCALE): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount);
}

// This function creates the circular dep — it's used for "smart" formatting
// that adapts to the current user's preferences
export function formatForCurrentUser(value: number): string {
    const user = getCurrentUser();
    return formatCurrency(value, user?.locale ?? DEFAULT_LOCALE);
}
EOF

# Models — depends on utils/format (creates part of the cycle)
cat > "$WORKSPACE/src/models/user.ts" << 'EOF'
import { formatName } from '../utils/format.js';

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    locale: string;
    role: 'admin' | 'user' | 'guest';
}

export function createUser(data: Omit<User, 'id'>): User {
    return {
        id: crypto.randomUUID(),
        ...data,
    };
}

export function getDisplayName(user: User): string {
    return formatName(user.firstName, user.lastName);
}
EOF

cat > "$WORKSPACE/src/models/order.ts" << 'EOF'
import { formatCurrency } from '../utils/format.js';

export interface OrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

export interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    total: number;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
    createdAt: string;
}

export function createOrder(userId: string, items: OrderItem[]): Order {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
        id: crypto.randomUUID(),
        userId,
        items,
        total,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
}

export function formatOrderTotal(order: Order): string {
    return formatCurrency(order.total);
}
EOF

# Services — user service imports from models AND is imported by utils/format
cat > "$WORKSPACE/src/services/user.ts" << 'EOF'
import type { User } from '../models/user.js';
import { createUser, getDisplayName } from '../models/user.js';
import { withRetry } from '../utils/retry.js';

let currentUser: User | null = null;

export function getCurrentUser(): User | null {
    return currentUser;
}

export async function loginUser(firstName: string, lastName: string, email: string): Promise<User> {
    const user = await withRetry(async () => {
        return createUser({ firstName, lastName, email, locale: 'en-US', role: 'user' });
    });
    currentUser = user;
    return user;
}

export function logoutUser(): void {
    currentUser = null;
}

export function getUserDisplayName(): string {
    if (!currentUser) return 'Anonymous';
    return getDisplayName(currentUser);
}
EOF

# Order service — clean, no circular deps here
cat > "$WORKSPACE/src/services/order.ts" << 'EOF'
import type { Order, OrderItem } from '../models/order.js';
import { createOrder, formatOrderTotal } from '../models/order.js';
import { withRetry } from '../utils/retry.js';

const orders: Order[] = [];

export async function placeOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const order = await withRetry(async () => createOrder(userId, items));
    orders.push(order);
    return order;
}

export function getOrderSummary(order: Order): string {
    return `Order ${order.id}: ${order.items.length} items, ${formatOrderTotal(order)}`;
}

export function getUserOrders(userId: string): Order[] {
    return orders.filter(o => o.userId === userId);
}
EOF

# Notification service — clean dependency
cat > "$WORKSPACE/src/services/notification.ts" << 'EOF'
import { getUserDisplayName } from './user.js';

export function sendWelcome(): string {
    const name = getUserDisplayName();
    return `Welcome, ${name}!`;
}

export function sendOrderConfirmation(orderId: string): string {
    const name = getUserDisplayName();
    return `${name}, your order ${orderId} has been confirmed.`;
}
EOF

# Index — re-exports everything (this triggers the circular import at load time)
cat > "$WORKSPACE/src/index.ts" << 'EOF'
export { formatName, formatCurrency, formatForCurrentUser } from './utils/format.js';
export { withRetry } from './utils/retry.js';
export type { User } from './models/user.js';
export { createUser, getDisplayName } from './models/user.js';
export type { Order, OrderItem } from './models/order.js';
export { createOrder, formatOrderTotal } from './models/order.js';
export { getCurrentUser, loginUser, logoutUser, getUserDisplayName } from './services/user.js';
export { placeOrder, getOrderSummary, getUserOrders } from './services/order.js';
export { sendWelcome, sendOrderConfirmation } from './services/notification.js';
export { MAX_RETRIES, TIMEOUT_MS, DEFAULT_LOCALE } from './config/constants.js';
EOF
