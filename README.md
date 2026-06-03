# Uniform Email Webhook

A Next.js webhook handler that listens for Uniform workflow transitions and sends email notifications via Resend.

## How It Works

1. Uniform sends a `workflow.transition` webhook when content moves between workflow stages
2. This handler checks if the transition matches your configured workflow and stage
3. If matched, it renders a beautiful HTML email and sends it via Resend

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | Sender email (must be verified in Resend) |
| `EMAIL_TO` | Comma-separated recipient list |
| `NOTIFY_WORKFLOW_ID` | Uniform workflow UUID to watch |
| `NOTIFY_STAGE_ID` | Stage UUID that triggers notification |

Optional variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_REPLY_TO` | Reply-to address | `EMAIL_FROM` |
| `UNIFORM_DASHBOARD_BASE_URL` | Dashboard URL | `https://uniform.app` |

### 3. Update Workflow Timeline (Optional)

Edit `pages/api/webhook.ts` to customize the `NOTIFY_WORKFLOW_TIMELINE` array with your workflow's stages:

```typescript
const NOTIFY_WORKFLOW_TIMELINE: WorkflowStageRef[] = [
  { id: 'your-editing-stage-id', name: 'Editing' },
  { id: 'your-approval-stage-id', name: 'Approval' },
  { id: 'your-approved-stage-id', name: 'Approved' },
];
```

### 4. Run Locally

```bash
npm run dev
```

The webhook endpoint will be available at `http://localhost:3000/api/webhook`.

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option 2: GitHub Integration

1. Push to GitHub
2. Import project in Vercel dashboard
3. Configure environment variables in Vercel project settings

### Configure Uniform Webhook

1. Go to your Uniform project settings
2. Navigate to Webhooks
3. Create a new webhook:
   - **URL**: `https://your-project.vercel.app/api/webhook`
   - **Event**: `workflow.transition`
4. Save the webhook

## API Response

### Success (notification sent)

```json
{
  "ok": true,
  "notified": true,
  "emailId": "resend-email-id",
  "recipients": 2
}
```

### Success (no match)

```json
{
  "ok": true,
  "notified": false,
  "reason": "workflow/stage mismatch"
}
```

### Error

```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

## Security Note

The current implementation skips Svix signature verification for simplicity. For production use, consider implementing webhook signature verification to ensure requests are authentic.
