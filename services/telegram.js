/**
 * Telegram Bot notification service
 * Sends notifications via Telegram Bot API with exponential backoff retry
 */

import axios from 'axios';

/**
 * Format booking notification message
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {string} Formatted message
 */
function formatTelegramMessage(watch) {
  const { movie, targetDate, theatre } = watch;
  return `🎬 Bookings Open!

Movie: ${movie}
Date: ${targetDate}
Theatre: ${theatre}

Book now on BookMyShow.`;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(
          `   ⏳ Telegram retry ${attempt}/${maxRetries} - waiting ${delay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Send notification via Telegram Bot API
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function sendTelegramNotification(watch) {
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!botToken || !chatId) {
    console.error('   ❌ Telegram: BOT_TOKEN or CHAT_ID not configured');
    return { success: false, error: 'Missing Telegram credentials' };
  }

  const message = formatTelegramMessage(watch);

  try {
    await retryWithBackoff(async () => {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        },
        { timeout: 10000 }
      );

      if (!response.data.ok) {
        throw new Error(
          `Telegram API error: ${response.data.description || 'Unknown error'}`
        );
      }

      return response.data;
    });

    console.log(`   ✅ Telegram notification sent`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`   ❌ Telegram notification failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}
