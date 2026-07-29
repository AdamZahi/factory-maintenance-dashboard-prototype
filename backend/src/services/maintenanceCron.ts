import cron from 'node-cron'
import { runDayReminderCheck } from './maintenance'

// Daily job for the calendar-based deadline (groupe électrogène's 365-day rule),
// which keeps ticking even when no inspection is submitted. The hour-based
// branch is handled on inspection submission, not here. The dayReminderSent
// flag makes this idempotent, so an extra run on startup is safe.
export function startMaintenanceCron() {
  const run = () => {
    runDayReminderCheck().catch((err) => console.error('[maintenance-cron] day reminder check failed', err))
  }

  // Every day at 08:00 (server time).
  cron.schedule('0 8 * * *', run)
  // Catch-up run shortly after boot in case the scheduled time was missed.
  setTimeout(run, 10_000)

  console.log('Maintenance cron scheduled (daily 08:00 + startup catch-up)')
}
