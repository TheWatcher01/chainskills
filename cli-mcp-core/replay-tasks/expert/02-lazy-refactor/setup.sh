#!/bin/bash
rm -rf /tmp/replay-test
mkdir -p /tmp/replay-test/src/{orders,payments,shipping}

# Duplicated validation logic in 3 modules
cat > /tmp/replay-test/src/orders/validate.ts << 'EOF'
export function validateOrder(order: { items: any[]; total: number; email: string }): string[] {
    const errors: string[] = [];
    if (!order.items || order.items.length === 0) errors.push('No items');
    if (order.total <= 0) errors.push('Invalid total');
    if (!order.email || !order.email.includes('@')) errors.push('Invalid email');
    if (order.total > 10000) errors.push('Amount exceeds limit');
    return errors;
}
EOF

cat > /tmp/replay-test/src/payments/validate.ts << 'EOF'
export function validatePayment(payment: { amount: number; email: string; method: string }): string[] {
    const errors: string[] = [];
    if (payment.amount <= 0) errors.push('Invalid amount');
    if (!payment.email || !payment.email.includes('@')) errors.push('Invalid email');
    if (payment.amount > 10000) errors.push('Amount exceeds limit');
    if (!payment.method) errors.push('No payment method');
    return errors;
}
EOF

cat > /tmp/replay-test/src/shipping/validate.ts << 'EOF'
export function validateShipment(shipment: { items: any[]; address: string; email: string }): string[] {
    const errors: string[] = [];
    if (!shipment.items || shipment.items.length === 0) errors.push('No items');
    if (!shipment.email || !shipment.email.includes('@')) errors.push('Invalid email');
    if (!shipment.address || shipment.address.length < 5) errors.push('Invalid address');
    return errors;
}
EOF

# Duplicated formatting in 3 modules
cat > /tmp/replay-test/src/orders/format.ts << 'EOF'
export function formatOrder(order: { id: string; total: number; date: string }): string {
    const d = new Date(order.date);
    const formatted = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `Order #${order.id} | $${order.total.toFixed(2)} | ${formatted}`;
}
EOF

cat > /tmp/replay-test/src/payments/format.ts << 'EOF'
export function formatPayment(payment: { id: string; amount: number; date: string }): string {
    const d = new Date(payment.date);
    const formatted = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `Payment #${payment.id} | $${payment.amount.toFixed(2)} | ${formatted}`;
}
EOF

cat > /tmp/replay-test/src/shipping/format.ts << 'EOF'
export function formatShipment(shipment: { id: string; cost: number; date: string }): string {
    const d = new Date(shipment.date);
    const formatted = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `Shipment #${shipment.id} | $${shipment.cost.toFixed(2)} | ${formatted}`;
}
EOF

# Count initial duplications for verification
grep -rh "email.*includes.*@" /tmp/replay-test/src/ | wc -l > /tmp/replay-test/.dup-before-email
grep -rh "getFullYear.*getMonth.*getDate" /tmp/replay-test/src/ | wc -l > /tmp/replay-test/.dup-before-date
