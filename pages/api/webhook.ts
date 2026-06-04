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
  { id: 'bc4f1183-b2e4-456f-9ffa-8645fb321896', name: 'Draft' },
  { id: '1b2e95ee-4b6d-4e83-aa4f-34d8bd41db7f', name: 'Review' },
  { id: '1935fb5e-980b-4345-837a-fb18cd7f8fff', name: 'Manager Approval' },
  { id: '3352bf51-085f-461d-a385-b11a79904d3f', name: 'Published' },
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
  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
    log.log('--- INCOMING PAYLOAD (raw) ---');
    log.log(rawBody);
    log.log('--- END INCOMING PAYLOAD ---');
    payload = JSON.parse(rawBody) as WorkflowTransitionPayload;
    log.log('payload parsed (unverified)');
    log.log('--- PARSED PAYLOAD ---');
    log.log(JSON.stringify(payload, null, 2));
    log.log('--- END PARSED PAYLOAD ---');
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
  log.log('--- RENDERED EMAIL ---');
  log.log(`subject: ${rendered.subject}`);
  log.log(`html length: ${rendered.html.length} bytes`);
  log.log(`text length: ${rendered.text.length} bytes`);
  log.log('--- HTML PREVIEW (first 500 chars) ---');
  log.log(rendered.html.substring(0, 500));
  log.log('--- TEXT PREVIEW ---');
  log.log(rendered.text);
  log.log('--- END RENDERED EMAIL ---');

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
