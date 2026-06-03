/**
 * Types for Uniform webhook payloads.
 * Based on the workflow.transition event structure.
 */

export interface WorkflowStage {
  workflowId: string;
  workflowName: string;
  stageId: string;
  stageName: string;
}

export interface WorkflowEntity {
  id: string;
  name: string;
  type: 'component' | 'entry' | string;
  releaseId?: string;
  url?: string;
}

export interface WorkflowProject {
  id: string;
  url?: string;
}

export interface WorkflowInitiator {
  name?: string;
  email?: string;
  is_api_key?: boolean;
}

export interface WorkflowTransitionPayload {
  entity: WorkflowEntity;
  project: WorkflowProject;
  previousStage?: WorkflowStage;
  newStage?: WorkflowStage;
  initiator?: WorkflowInitiator;
  timestamp: string;
}
