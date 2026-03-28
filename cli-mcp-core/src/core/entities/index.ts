/**
 * Barrel export for all core entities.
 * @module core/entities
 */

export type { Variable, InputDef, OutputDef } from './variable.js';
export type { DirectiveType, Directive } from './directive.js';
export { DIRECTIVE_TYPES, isDirectiveType } from './directive.js';
export type { Step } from './step.js';
export type { Workflow, WorkflowMetadata } from './workflow.js';
export type {
    DataProvenance,
    VerificationStatus,
    SourceTier,
    FreshnessStatus,
} from './data-provenance.js';
export { classifyFreshness } from './data-provenance.js';
