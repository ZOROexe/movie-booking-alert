/**
 * Email notification service using Nodemailer
 * Sends notifications via Gmail with App Password and exponential backoff retry
 */

import nodemailer from 'nodemailer';

/**
 * Create and return a Nodemailer transporter
 * Uses Gmail SMTP with App Password authentication
 * @returns {Transporter} Nodemailer transporter instance
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Format booking notification as HTML
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {string} HTML formatted message
 */
function formatEmailHtml(watch) {
  const { movie, targetDate, theatre } = watch;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">🎬 Bookings Open!</h2>
      
      <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 8px 0;"><strong>Movie:</strong> ${movie}</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> ${targetDate}</p>
        <p style="margin: 8px 0;"><strong>Theatre:</strong> ${theatre}</p>
      </div>
      
      <p>
        <a href="https://in.bookmyshow.com" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Book Now on BookMyShow
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #bdc3c7; margin: 30px 0;" />
      <p style="color: #7f8c8d; font-size: 12px;">
        This is an automated notification from BookMyShow Booking Monitor.
      </p>
    </div>
  `;
}

/**
 * Format booking notification as plain text
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {string} Plain text formatted message
 */
function formatEmailText(watch) {
  const { movie, targetDate, theatre } = watch;
  return `🎬 Bookings Open!

Movie: ${movie}
Date: ${targetDate}
Theatre: ${theatre}

Book now on BookMyShow.
Visit: https://in.bookmyshow.com`;
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
          `   ⏳ Email retry ${attempt}/${maxRetries} - waiting ${delay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Send notification via Email (Gmail + App Password)
 * @param {Object} watch - Watch object {movie, targetDate, theatre}
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function sendEmailNotification(watch) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error(
      '   ❌ Email: EMAIL_USER or EMAIL_PASS not configured'
    );
    return { success: false, error: 'Missing email credentials' };
  }

  try {
    const transporter = createTransporter();

    await retryWithBackoff(async () => {
      await transporter.sendMail({
        from: emailUser,
        to: emailUser,
        subject: `🎬 BookMyShow Booking Alert: ${watch.movie}`,
        html: formatEmailHtml(watch),
        text: formatEmailText(watch),
      });
    });

    console.log(`   ✅ Email notification sent`);
    return { success: true, error: null };
  } catch (error) {
    console.error(
      `   ❌ Email notification failed: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}
