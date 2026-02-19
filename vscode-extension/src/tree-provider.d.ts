/**
 * Workflow Tree Provider for VS Code Explorer
 *
 * Discovers and displays .workflow.md files in the workspace.
 */
import * as vscode from 'vscode';
export declare class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | WorkflowItem | undefined>;
    constructor();
    refresh(): void;
    getTreeItem(element: WorkflowItem): vscode.TreeItem;
    getChildren(element?: WorkflowItem): Promise<WorkflowItem[]>;
    private getWorkflowMetadata;
}
declare class WorkflowItem extends vscode.TreeItem {
    readonly label: string;
    readonly resourceUri: vscode.Uri;
    readonly description?: string | undefined;
    readonly version?: string | undefined;
    constructor(label: string, resourceUri: vscode.Uri, description?: string | undefined, version?: string | undefined);
    private createTooltip;
}
export {};
