/**
 * Command Handlers for chainskills extension
 *
 * Registers all VS Code commands and implements their logic.
 */
import * as vscode from 'vscode';
import { WorkflowTreeProvider } from './tree-provider';
import { ExecutionController } from './execution-controller';
export declare function registerCommands(context: vscode.ExtensionContext, treeProvider: WorkflowTreeProvider, executionController: ExecutionController): void;
