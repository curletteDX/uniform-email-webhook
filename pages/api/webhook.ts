import type { NextApiRequest, NextApiResponse } from 'next';
import type { WorkflowTransitionPayload } from '../../types/uniform';
import { loadEnv } from '../../lib/env';
import { readRawBody } from '../../lib/raw-body';
import { createLogger, logRequestDiagnostics } from '../../lib/diag';
import {
  renderWorkflowNotificationEmail,
  WorkflowStageRef,
} from '../../lib/email/workflow-notification';
import { sendEmail } from '../../lib/email/send';

// Hardcoded ordered list of stages in the notify workflow. Used to render the
// "Editing → Approval → Approved" timeline in the email with the active stage
// highlighted. If the workflow shape changes, update this list.
const NOTIFY_WORKFLOW_TIMELINE: WorkflowStageRef[] = [
  { id: '3af40460-327a-4843-b108-90d853910a20', name: 'Editing' },
  { id: '37aaefca-7673-4bfd-9899-23f13b0ab895', name: 'Approval' },
  { id: '0a7e5d3b-7aff-44ab-af26-a8355a4eca10', name: 'Approved' },
];

const log = createLogger('uniform-workflow-notification-webhook');

// We need the raw HTTP body to verify the Svix signature, so disable Next's
// built-in body parser. We'll JSON.parse the body ourselves after verification.
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 30,
};

const env = loadEnv(
  [
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'EMAIL_TO',
    'NOTIFY_WORKFLOW_ID',
    'NOTIFY_STAGE_ID',
  ] as const,
  [
    'EMAIL_REPLY_TO',
    'UNIFORM_DASHBOARD_BASE_URL',
  ] as const
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  log.log('received Uniform workflow.transition webhook - starting notification flow');
  logRequestDiagnostics(req, { tag: 'uniform-workflow-notification-webhook' });

  if (req.method !== 'POST') {
    log.warn(`rejecting non-POST request (got ${req.method})`);
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  log.log('step 1/5 - validating environment configuration');
  if (env.error) {
    log.error('env error:', env.error);
    res.status(503).json({ error: env.error });
    return;
  }

  const resendApiKey = env.values.RESEND_API_KEY!;
  const emailFrom = env.values.EMAIL_FROM!;
  const emailToRaw = env.values.EMAIL_TO!;
  const emailReplyTo = env.values.EMAIL_REPLY_TO || undefined;
  const notifyWorkflowId = env.values.NOTIFY_WORKFLOW_ID!;
  const notifyStageId = env.values.NOTIFY_STAGE_ID!;
  const dashboardBaseUrl = (env.values.UNIFORM_DASHBOARD_BASE_URL || 'https://uniform.app').replace(
    /\/$/,
    ''
  );

  const emailTo = emailToRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (emailTo.length === 0) {
    log.error('EMAIL_TO is set but contains no recipients');
    res.status(503).json({ error: 'EMAIL_TO has no recipients' });
    return;
  }
  log.log(`env ok - will notify ${emailTo.length} recipient(s) (${emailTo.join(', ')})`);

  log.warn(
    'step 2/5 - SKIPPING Svix signature verification (auth disabled on this endpoint - re-enable before production use)'
  );
  let payload: WorkflowTransitionPayload;
  try {
    const rawBody = await readRawBody(req);
    payload = JSON.parse(rawBody) as WorkflowTransitionPayload;
    log.log('payload parsed (unverified)');
  } catch (err) {
    log.error('failed to read/parse request body', err);
    res
      .status(400)
      .send(JSON.stringify({ reason: 'invalid request body', err: String(err) }));
    return;
  }

  log.log(
    `event details - entity ${payload.entity.type} "${payload.entity.name}" (${payload.entity.id}) in project ${payload.project.id}, transitioned to stage ${payload.newStage?.stageId ?? '<none>'}`
  );

  if (!payload.newStage) {
    log.warn('payload has no newStage - cannot decide whether to notify; aborting');
    res.status(400).json({ error: 'No newStage in payload' });
    return;
  }

  log.log(
    `step 3/5 - checking workflow + stage match (want workflow=${notifyWorkflowId}, stage=${notifyStageId})`
  );
  const workflowMatches = payload.newStage.workflowId === notifyWorkflowId;
  const stageMatches = payload.newStage.stageId === notifyStageId;
  if (!workflowMatches || !stageMatches) {
    log.log(
      `no match (workflow=${payload.newStage.workflowId} ${workflowMatches ? '✓' : '✗'}, stage=${payload.newStage.stageId} ${stageMatches ? '✓' : '✗'}) - nothing to do`
    );
    res.status(200).json({ ok: true, notified: false, reason: 'workflow/stage mismatch' });
    return;
  }
  log.log('workflow + stage matched - preparing email');

  const entityUrl =
    (payload.entity as { url?: string }).url ||
    buildDashboardUrl(dashboardBaseUrl, payload.project.id, payload.entity.id, payload.entity.releaseId);

  const initiator = payload.initiator ?? {};

  log.log('step 4/5 - rendering email (HTML + plaintext)');
  const rendered = renderWorkflowNotificationEmail({
    entityName: payload.entity.name,
    entityType: payload.entity.type,
    entityId: payload.entity.id,
    entityUrl,
    releaseId: payload.entity.releaseId,
    projectId: payload.project.id,
    projectUrl: (payload.project as { url?: string }).url,
    workflowName: payload.newStage.workflowName,
    newStageId: payload.newStage.stageId,
    newStageName: payload.newStage.stageName,
    previousStageName: payload.previousStage?.stageName,
    timeline: NOTIFY_WORKFLOW_TIMELINE,
    initiatorName: (initiator as { name?: string }).name,
    initiatorEmail: (initiator as { email?: string }).email,
    isApiKey: (initiator as { is_api_key?: boolean }).is_api_key,
    timestamp: payload.timestamp,
  });
  log.log(
    `email ready - subject="${rendered.subject}" (html=${rendered.html.length}B, text=${rendered.text.length}B)`
  );

  log.log(`step 5/5 - sending email via Resend to ${emailTo.length} recipient(s)`);
  try {
    const { id } = await sendEmail({
      apiKey: resendApiKey,
      from: emailFrom,
      to: emailTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: emailReplyTo,
    });
    log.log(`done - email sent ✓ (Resend id=${id})`);
    res.status(200).json({ ok: true, notified: true, emailId: id, recipients: emailTo.length });
  } catch (err) {
    log.error('Resend failed to send the email', err);
    res.status(502).json({ error: 'Failed to send email', details: String(err) });
  }
}

function buildDashboardUrl(
  baseUrl: string,
  projectId: string,
  entityId: string,
  releaseId?: string
): string {
  const url = new URL(
    `/projects/${projectId}/dashboards/canvas/entries/${entityId}`,
    baseUrl
  );
  if (releaseId) {
    url.searchParams.set('release', releaseId);
  }
  return url.toString();
}
