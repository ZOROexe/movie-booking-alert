/**
 * Main entry point for BookMyShow booking monitor
 * Orchestrates: load config → detect bookings → check state → notify
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processAllWatches } from './services/bookingDetector.js';
import {
  hasNotificationBeenSent,
  recordNotificationSent,
} from './services/state.js';
import { notifyBookingOpen } from './services/notificationHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'config.json');

/**
 * Load configuration from config.json
 * @returns {Promise<Array>} Array of watch objects
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);

    if (!Array.isArray(config)) {
      throw new Error('config.json must be an array of watch objects');
    }

    // Validate each watch object
    config.forEach((watch, index) => {
      if (!watch.movie || !watch.targetDate || !watch.theatre) {
        throw new Error(
          `Watch ${index} missing required fields: movie, targetDate, theatre`
        );
      }
    });

    return config;
  } catch (error) {
    console.error(`❌ Failed to load config: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main execution flow
 */
async function main() {
  console.log('\n🚀 BookMyShow Booking Monitor Started\n');

  try {
    // Load watches configuration
    const watches = await loadConfig();
    console.log(`📋 Loaded ${watches.length} watch(es)\n`);

    // Process all watches and detect bookings
    const results = await processAllWatches(watches);

    // Filter watches with open bookings
    const openBookings = results.filter((r) => r.bookingsOpen);

    if (openBookings.length === 0) {
      console.log('\n✅ No bookings detected\n');
      process.exit(0);
    }

    console.log(`\n📊 ${openBookings.length} booking(s) detected\n`);

    // Check state and send notifications
    for (const { watch } of openBookings) {
      const { movie, targetDate, theatre } = watch;
      const alreadyNotified = await hasNotificationBeenSent(
        movie,
        targetDate,
        theatre
      );

      if (alreadyNotified) {
        console.log(
          `   ⏭️  Notification already sent for: ${movie} - ${targetDate} - ${theatre}`
        );
      } else {
        console.log(
          `   🔔 New booking detected: ${movie} - ${targetDate} - ${theatre}`
        );

        // Send notifications (Telegram + Email)
        await notifyBookingOpen(watch);
      }
    }

    console.log('\n✅ BookMyShow Booking Monitor Completed\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Critical error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run main function
main();
