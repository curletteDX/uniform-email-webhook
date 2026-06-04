/**
 * Renders the "ready for review" workflow notification email.
 *
 * Designed to look great in Gmail, Apple Mail, Outlook (web + desktop) and
 * iOS. Hard-won email rules used here:
 *
 *  - Table-based layout (Outlook ignores flex/grid).
 *  - Fully inline styles (Gmail strips most <style> rules).
 *  - System / web-safe font stack only (no Google Fonts: many clients block
 *    remote CSS, and the fallbacks look great).
 *  - No background images for critical content (Outlook drops them).
 *  - Plain-text fallback for clients that need it / accessibility.
 */

export interface WorkflowStageRef {
  id: string;
  name: string;
}

export interface WorkflowNotificationEmailInput {
  entityName: string;
  entityType: string;
  entityId: string;
  entityUrl: string;
  releaseId?: string;
  projectId: string;
  projectUrl?: string;
  workflowName: string;
  newStageId: string;
  newStageName: string;
  previousStageName?: string;
  timeline?: WorkflowStageRef[];
  initiatorName?: string;
  initiatorEmail?: string;
  isApiKey?: boolean;
  timestamp: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderWorkflowNotificationEmail(
  input: WorkflowNotificationEmailInput
): RenderedEmail {
  const friendlyEntityType = input.entityType === 'component' ? 'Composition' : 'Entry';
  const subject = `${input.newStageName} · ${friendlyEntityType} "${input.entityName}"`;
  const initiatorLabel =
    input.initiatorName ||
    input.initiatorEmail ||
    (input.isApiKey ? 'Automation (API key)' : 'Someone in Uniform');
  const initials = computeInitials(initiatorLabel);
  const formattedDate = formatTimestamp(input.timestamp);

  const c = {
    bg: '#F4F5F7',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
    text: '#0F172A',
    textMuted: '#475569',
    textSubtle: '#94A3B8',
    divider: '#E5E7EB',
    headerStart: '#1E1B4B',
    headerEnd: '#4338CA',
    accent: '#6366F1',
    accentText: '#FFFFFF',
    avatarBg: '#E0E7FF',
    avatarText: '#3730A3',
    doneBg: '#E2E8F0',
    doneText: '#334155',
    activeBg: '#4338CA',
    activeText: '#FFFFFF',
    pendingBg: '#FFFFFF',
    pendingBorder: '#E2E8F0',
    pendingText: '#94A3B8',
  };

  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const safeName = escapeHtml(input.entityName);
  const safeWorkflow = escapeHtml(input.workflowName);
  const safeNewStage = escapeHtml(input.newStageName);
  const safeInitiator = escapeHtml(initiatorLabel);
  const safeInitiatorEmail = input.initiatorEmail ? escapeHtml(input.initiatorEmail) : null;

  const computedTimeline: Array<{ name: string; state: 'done' | 'active' | 'pending' }> = (() => {
    if (input.timeline && input.timeline.length > 0) {
      const currentIdx = input.timeline.findIndex((s) => s.id === input.newStageId);
      return input.timeline.map((stage, idx) => {
        if (currentIdx === -1) {
          return { name: stage.name, state: 'pending' as const };
        }
        const state: 'done' | 'active' | 'pending' =
          idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending';
        return { name: stage.name, state };
      });
    }
    return input.previousStageName
      ? [
          { name: input.previousStageName, state: 'done' as const },
          { name: input.newStageName, state: 'active' as const },
        ]
      : [{ name: input.newStageName, state: 'active' as const }];
  })();

  if (
    input.timeline &&
    input.timeline.length > 0 &&
    !input.timeline.some((s) => s.id === input.newStageId)
  ) {
    computedTimeline.push({ name: input.newStageName, state: 'active' });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${c.bg};color:${c.text};font-family:${fontStack};">
    <!-- Preview text (hidden, shows in inbox preview) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${c.bg};">
      ${safeInitiator} moved "${safeName}" to ${safeNewStage}. Open in Uniform to review.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${c.cardBg};border:1px solid ${c.cardBorder};border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.06);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg, ${c.headerStart} 0%, ${c.headerEnd} 100%);background-color:${c.headerEnd};padding:32px 32px 28px 32px;color:#FFFFFF;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#C7D2FE;font-weight:600;">
                      Uniform · ${safeWorkflow}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:10px;font-size:22px;line-height:1.3;font-weight:700;color:#FFFFFF;">
                      ${friendlyEntityType} <span style="color:#E0E7FF;">"</span>${safeName}<span style="color:#E0E7FF;">"</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:6px;font-size:14px;line-height:1.5;color:#C7D2FE;">
                      is now in <strong style="color:#FFFFFF;font-weight:600;">${safeNewStage}</strong> and ready for your review.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Workflow timeline -->
            <tr>
              <td style="padding:24px 32px 4px 32px;">
                <div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${c.textSubtle};padding-bottom:12px;">
                  Workflow progress
                </div>
                ${renderTimeline(computedTimeline, c, fontStack)}
              </td>
            </tr>
            <!-- Details card -->
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.cardBorder};border-radius:12px;background-color:#FAFAFB;">
                  ${detailRow('Type', friendlyEntityType, c)}
                  ${detailRow('Entry', safeName, c)}
                  ${input.releaseId ? detailRow('Release', input.releaseId, c, true) : ''}
                  ${detailRow('Project', input.projectId, c, true)}
                  ${detailRow('Workflow', safeWorkflow, c)}
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td align="center" style="padding:28px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:${c.accent};">
                      <a href="${escapeHtmlAttr(input.entityUrl)}"
                         style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;font-family:${fontStack};color:${c.accentText};text-decoration:none;border-radius:10px;background-color:${c.accent};">
                        Open in Uniform &nbsp;→
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Fallback link -->
            <tr>
              <td align="center" style="padding:6px 32px 24px 32px;">
                <div style="font-size:12px;color:${c.textSubtle};line-height:1.5;">
                  Button not working? Paste this URL into your browser:<br />
                  <a href="${escapeHtmlAttr(input.entityUrl)}" style="color:${c.accent};text-decoration:none;word-break:break-all;">${escapeHtml(input.entityUrl)}</a>
                </div>
              </td>
            </tr>
            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background-color:${c.divider};line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>
            <!-- Initiator block -->
            <tr>
              <td style="padding:20px 32px 28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:14px;">
                      <div style="width:40px;height:40px;border-radius:50%;background-color:${c.avatarBg};color:${c.avatarText};font-size:14px;font-weight:700;text-align:center;line-height:40px;font-family:${fontStack};">
                        ${escapeHtml(initials)}
                      </div>
                    </td>
                    <td valign="middle">
                      <div style="font-size:14px;font-weight:600;color:${c.text};line-height:1.3;">
                        Triggered by ${safeInitiator}${input.isApiKey ? ' <span style="font-weight:500;color:' + c.textMuted + ';">· API key</span>' : ''}
                      </div>
                      <div style="font-size:12px;color:${c.textMuted};line-height:1.4;padding-top:2px;">
                        ${safeInitiatorEmail ? safeInitiatorEmail + ' · ' : ''}${escapeHtml(formattedDate)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!-- Footer -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:18px 16px 0 16px;font-size:11px;line-height:1.6;color:${c.textSubtle};">
                You're receiving this because someone moved a Uniform ${friendlyEntityType.toLowerCase()} into the<br />
                <strong style="color:${c.textMuted};font-weight:600;">${safeNewStage}</strong> stage of <strong style="color:${c.textMuted};font-weight:600;">${safeWorkflow}</strong>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const timelineText = computedTimeline
    .map((s) => {
      const marker = s.state === 'done' ? '[x]' : s.state === 'active' ? '[●]' : '[ ]';
      return `${marker} ${s.name}`;
    })
    .join('  →  ');

  const text = [
    `${friendlyEntityType} "${input.entityName}" is now in ${input.newStageName}.`,
    '',
    `Workflow: ${input.workflowName}`,
    `Progress: ${timelineText}`,
    `Type:     ${friendlyEntityType}`,
    `Entry:    ${input.entityName}`,
    input.releaseId ? `Release:  ${input.releaseId}` : null,
    `Project:  ${input.projectId}`,
    '',
    `Triggered by ${initiatorLabel}${input.isApiKey ? ' (API key)' : ''}${
      input.initiatorEmail ? ` <${input.initiatorEmail}>` : ''
    } at ${formattedDate}.`,
    '',
    `Open in Uniform: ${input.entityUrl}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject, html, text };
}

function renderTimeline(
  stages: Array<{ name: string; state: 'done' | 'active' | 'pending' }>,
  c: {
    doneBg: string;
    doneText: string;
    activeBg: string;
    activeText: string;
    pendingBg: string;
    pendingBorder: string;
    pendingText: string;
    textSubtle: string;
  },
  fontStack: string
): string {
  const cells: string[] = [];
  stages.forEach((stage, idx) => {
    const isLast = idx === stages.length - 1;
    cells.push(stagePill(stage, c, fontStack));
    if (!isLast) {
      cells.push(arrowCell(c.textSubtle, fontStack));
    }
  });
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr>${cells.join('')}</tr>
  </table>`;
}

function arrowCell(color: string, fontStack: string): string {
  return `<td valign="middle" style="padding:0 12px;color:${color};font-family:${fontStack};font-size:20px;line-height:1;">→</td>`;
}

function stagePill(
  stage: { name: string; state: 'done' | 'active' | 'pending' },
  c: {
    doneBg: string;
    doneText: string;
    activeBg: string;
    activeText: string;
    pendingBg: string;
    pendingBorder: string;
    pendingText: string;
  },
  fontStack: string
): string {
  const safeName = escapeHtml(stage.name);
  if (stage.state === 'done') {
    return `<td valign="middle" align="center" style="padding:0;white-space:nowrap;">
      <span style="display:inline-block;padding:8px 14px;border-radius:999px;background-color:${c.doneBg};color:${c.doneText};font-family:${fontStack};font-size:13px;font-weight:600;line-height:1;">
        <span style="display:inline-block;width:14px;height:14px;line-height:14px;border-radius:50%;background-color:${c.doneText};color:${c.doneBg};font-size:9px;font-weight:700;text-align:center;margin-right:6px;vertical-align:middle;">&#10003;</span>${safeName}
      </span>
    </td>`;
  }
  if (stage.state === 'active') {
    return `<td valign="middle" align="center" style="padding:0;white-space:nowrap;">
      <span style="display:inline-block;padding:10px 18px;border-radius:999px;background-color:${c.activeBg};color:${c.activeText};font-family:${fontStack};font-size:14px;font-weight:700;line-height:1;box-shadow:0 4px 12px rgba(67,56,202,0.35);">
        <span style="display:inline-block;width:8px;height:8px;line-height:8px;border-radius:50%;background-color:${c.activeText};margin-right:8px;vertical-align:middle;">&nbsp;</span>${safeName}
      </span>
    </td>`;
  }
  return `<td valign="middle" align="center" style="padding:0;white-space:nowrap;">
    <span style="display:inline-block;padding:7px 13px;border-radius:999px;background-color:${c.pendingBg};color:${c.pendingText};border:1px solid ${c.pendingBorder};font-family:${fontStack};font-size:13px;font-weight:600;line-height:1;">
      <span style="display:inline-block;width:8px;height:8px;line-height:8px;border-radius:50%;background-color:${c.pendingBorder};margin-right:8px;vertical-align:middle;">&nbsp;</span>${safeName}
    </span>
  </td>`;
}

function detailRow(
  label: string,
  value: string,
  c: { textMuted: string; text: string; divider: string },
  mono = false
): string {
  return `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid ${c.divider};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="110" style="font-size:12px;font-weight:600;color:${c.textMuted};text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;padding-right:12px;">${escapeHtml(label)}</td>
          <td style="font-size:14px;color:${c.text};${mono ? "font-family:'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;font-size:13px;" : ''}word-break:break-all;">${escapeHtml(value)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function computeInitials(label: string): string {
  const cleaned = label.replace(/<[^>]+>/g, '').trim();
  if (!cleaned) return '?';
  const base = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
  const parts = base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return base[0]!.toUpperCase();
  return parts.map((p) => p[0]!.toUpperCase()).join('');
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s);
}
