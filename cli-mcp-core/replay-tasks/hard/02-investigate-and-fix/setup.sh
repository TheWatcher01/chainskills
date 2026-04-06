#!/bin/bash
rm -rf /tmp/replay-test
mkdir -p /tmp/replay-test
cat > /tmp/replay-test/server.ts << 'TSEOF'
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = '/tmp/replay-test/data';
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

interface User { id: string; name: string; email: string; createdAt: string; }

function loadUsers(): User[] {
    const path = join(DATA_DIR, 'users.json');
    if (!existsSync(path)) return [];
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveUsers(users: User[]): void {
    writeFileSync(join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
}

// PROBLEME 1: pas de validation d'input
// PROBLEME 2: pas de gestion d'erreur
// PROBLEME 3: id genere avec Math.random (pas unique)
// PROBLEME 4: pas de content-type dans les reponses
// PROBLEME 5: DELETE ne verifie pas si l'user existe
// PROBLEME 6: GET /users/:id n'existe pas

const server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost`);

    if (req.method === 'GET' && url.pathname === '/users') {
        const users = loadUsers();
        res.end(JSON.stringify(users));
    }
    else if (req.method === 'POST' && url.pathname === '/users') {
        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            const { name, email } = JSON.parse(body);
            const users = loadUsers();
            const user: User = {
                id: String(Math.random()),
                name,
                email,
                createdAt: new Date().toISOString(),
            };
            users.push(user);
            saveUsers(users);
            res.statusCode = 201;
            res.end(JSON.stringify(user));
        });
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/users/')) {
        const id = url.pathname.split('/')[2];
        const users = loadUsers();
        const filtered = users.filter(u => u.id !== id);
        saveUsers(filtered);
        res.statusCode = 204;
        res.end();
    }
    else {
        res.statusCode = 404;
        res.end('Not Found');
    }
});

server.listen(0); // random port for testing
TSEOF
