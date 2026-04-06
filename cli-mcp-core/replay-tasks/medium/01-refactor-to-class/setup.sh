#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
cat > "$WORKSPACE/todo.ts" << 'TSEOF'
// Procedural todo manager — refactor to class
interface Todo { id: number; title: string; done: boolean; }

let todos: Todo[] = [];
let nextId = 1;

function addTodo(title: string): Todo {
    const todo = { id: nextId++, title, done: false };
    todos.push(todo);
    return todo;
}

function toggleTodo(id: number): boolean {
    const todo = todos.find(t => t.id === id);
    if (!todo) return false;
    todo.done = !todo.done;
    return true;
}

function removeTodo(id: number): boolean {
    const idx = todos.findIndex(t => t.id === id);
    if (idx === -1) return false;
    todos.splice(idx, 1);
    return true;
}

function listTodos(filter?: 'done' | 'pending'): Todo[] {
    if (filter === 'done') return todos.filter(t => t.done);
    if (filter === 'pending') return todos.filter(t => !t.done);
    return [...todos];
}

function countTodos(): { total: number; done: number; pending: number } {
    return {
        total: todos.length,
        done: todos.filter(t => t.done).length,
        pending: todos.filter(t => !t.done).length,
    };
}
TSEOF
