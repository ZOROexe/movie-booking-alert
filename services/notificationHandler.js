/**
 * Unified notification handler
 * Sends both Telegram and Email notifications (independent)
 * Records state only if at least one succeeds
 */

import { sendTelegramNotification } from './telegram.js';
import { sendEmailNotification } from './email.js';
import { recordNotificationSent } from './state.js';

/**
 * Send all notifications for a booking
 * Telegram and Email are sent independently; failure in one doesn't block the other
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function notifyBookingOpen(watch) {
  const { movie, targetDate, theatre } = watch;

  console.log(`\n📬 Sending notifications for: ${movie} - ${targetDate}`);

  try {
    // Send both notifications independently
    const [telegramResult, emailResult] = await Promise.all([
      sendTelegramNotification(watch),
      sendEmailNotification(watch),
    ]);

    // Check if at least one succeeded
    const atLeastOneSucceeded = telegramResult.success || emailResult.success;

    if (atLeastOneSucceeded) {
      // Record notification as sent
      await recordNotificationSent(movie, targetDate, theatre);
      console.log(`   ✅ Notification recorded in state`);
      return {
        success: true,
        results: { telegram: telegramResult, email: emailResult },
      };
    } else {
      // Both failed
      console.log(`   ⚠️  Both notifications failed`);
      return {
        success: false,
        results: { telegram: telegramResult, email: emailResult },
      };
    }
  } catch (error) {
    console.error(`   ❌ Notification error: ${error.message}`);
    return {
      success: false,
      results: { error: error.message },
    };
  }
}
