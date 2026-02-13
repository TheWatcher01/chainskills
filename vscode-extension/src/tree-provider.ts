/**
 * Workflow Tree Provider for VS Code Explorer
 * 
 * Discovers and displays .workflow.md files in the workspace.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkflowItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkflowItem): Promise<WorkflowItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        if (element) {
            // No nested children for now
            return [];
        }

        // Find all .workflow.md files in workspace
        const workflowFiles = await vscode.workspace.findFiles(
            '**/*.workflow.md',
            '**/node_modules/**'
        );

        const items = await Promise.all(
            workflowFiles.map(async (uri) => {
                const metadata = await this.getWorkflowMetadata(uri);
                return new WorkflowItem(
                    metadata.name || path.basename(uri.fsPath, '.workflow.md'),
                    uri,
                    metadata.description,
                    metadata.version
                );
            })
        );

        return items.sort((a, b) => a.label.localeCompare(b.label));
    }

    private async getWorkflowMetadata(uri: vscode.Uri): Promise<WorkflowMetadata> {
        try {
            const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (frontmatterMatch) {
                const yaml = frontmatterMatch[1];
                const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim();
                const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim();
                const version = yaml.match(/^version:\s*(.+)$/m)?.[1]?.trim();
                
                return { name, description, version };
            }
        } catch (error) {
            console.error('Failed to parse workflow metadata:', error);
        }
        
        return {};
    }
}

interface WorkflowMetadata {
    name?: string;
    description?: string;
    version?: string;
}

class WorkflowItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly description?: string,
        public readonly version?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = this.createTooltip();
        this.contextValue = 'workflow';
        this.iconPath = new vscode.ThemeIcon('symbol-misc');
        this.command = {
            command: 'vscode.open',
            title: 'Open Workflow',
            arguments: [resourceUri]
        };
    }

    private createTooltip(): string {
        const parts = [this.label];
        if (this.version) {
            parts.push(`v${this.version}`);
        }
        if (this.description) {
            parts.push(this.description);
        }
        parts.push(this.resourceUri.fsPath);
        return parts.join('\n');
    }
}
