import { Resend } from 'resend'

// Resend client is created lazily so the app boots fine without a key (email
// is simply skipped). The verified-domain FROM is configurable; until the
// domain is verified, RESEND_FROM defaults to Resend's sandbox sender, which
// only delivers to the Resend account owner's own address.
let resend: Resend | null = null
function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export interface CriticalEmailPayload {
  to: string
  equipmentName: string
  fields: { fieldId: string; label?: string; value: unknown; message?: string }[]
  date: string
  technicianName: string
  inspectionId: string
}

/**
 * Sends a critical-alert email. Throws on API failure so the caller can decide
 * how to record it (in-app notification is created regardless). Returns the
 * Resend message id on success.
 */
export async function sendCriticalAlertEmail(payload: CriticalEmailPayload): Promise<string> {
  const api = client()
  if (!api) throw new Error('RESEND_API_KEY not configured')

  const appUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  const link = `${appUrl}/?inspection=${encodeURIComponent(payload.inspectionId)}`

  const rows = payload.fields
    .map((f) => `  • ${f.label ?? f.fieldId}: ${f.value ?? '—'}${f.message ? ` (${f.message})` : ''}`)
    .join('\n')

  const text = [
    `ALERTE CRITIQUE — ${payload.equipmentName}`,
    ``,
    `Un équipement est passé en état CRITIQUE lors de l'inspection du ${payload.date}.`,
    `Technicien : ${payload.technicianName}`,
    ``,
    `Paramètres hors norme :`,
    rows || '  • (aucun détail)',
    ``,
    `Voir l'inspection : ${link}`,
    ``,
    `— Contrôle journalier des équipements, SBM Tunisie`,
  ].join('\n')

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#17202E">
      <div style="background:#D6423C;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Alerte critique</div>
        <div style="font-size:20px;font-weight:700;margin-top:2px">${escapeHtml(payload.equipmentName)}</div>
      </div>
      <div style="border:1px solid #EDF0F3;border-top:none;border-radius:0 0 12px 12px;padding:20px">
        <p style="margin:0 0 12px">Un équipement est passé en état <strong style="color:#D6423C">critique</strong> lors de l'inspection du <strong>${escapeHtml(payload.date)}</strong>.</p>
        <p style="margin:0 0 16px;color:#6B7A8F;font-size:14px">Technicien : ${escapeHtml(payload.technicianName)}</p>
        <div style="background:#FBE7E6;border-radius:10px;padding:12px 14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#D6423C;margin-bottom:6px">Paramètres hors norme</div>
          <ul style="margin:0;padding-left:18px;font-size:14px">
            ${payload.fields.map((f) => `<li>${escapeHtml(f.label ?? f.fieldId)}: <strong>${escapeHtml(String(f.value ?? '—'))}</strong>${f.message ? ` <span style="color:#6B7A8F">(${escapeHtml(f.message)})</span>` : ''}</li>`).join('') || '<li>(aucun détail)</li>'}
          </ul>
        </div>
        <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px">Voir l'inspection</a>
      </div>
    </div>`

  const { data, error } = await api.emails.send({
    from: FROM,
    to: payload.to,
    subject: `[Alerte critique] ${payload.equipmentName} — ${payload.date}`,
    text,
    html,
  })
  if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`)
  return data?.id ?? ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
