/**
 * State management for notification tracking
 * Uses unique keys per watch: movie-date-theatre
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '../state.json');

/**
 * Generate unique key for a watch
 * @param {string} movie - Movie name
 * @param {string} date - Target date
 * @param {string} theatre - Theatre name
 * @returns {string} Unique key: movie-date-theatre
 */
function generateKey(movie, date, theatre) {
  return `${movie}-${date}-${theatre}`;
}

/**
 * Load current state from state.json
 * Initializes with empty sentNotifications if file doesn't exist
 * @returns {Promise<{sentNotifications: Array}>}
 */
export async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, initialize with empty state
      return { sentNotifications: [] };
    }
    throw error;
  }
}

/**
 * Save state to state.json
 * @param {Object} state - State object with sentNotifications array
 * @returns {Promise<void>}
 */
async function saveState(state) {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to save state: ${error.message}`);
    throw error;
  }
}

/**
 * Check if notification has already been sent for a watch
 * @param {string} movie - Movie name
 * @param {string} date - Target date
 * @param {string} theatre - Theatre name
 * @returns {Promise<boolean>}
 */
export async function hasNotificationBeenSent(movie, date, theatre) {
  try {
    const state = await loadState();
    const key = generateKey(movie, date, theatre);
    return state.sentNotifications.includes(key);
  } catch (error) {
    console.error(`Error checking notification state: ${error.message}`);
    return false;
  }
}

/**
 * Record that a notification has been sent for a watch
 * @param {string} movie - Movie name
 * @param {string} date - Target date
 * @param {string} theatre - Theatre name
 * @returns {Promise<void>}
 */
export async function recordNotificationSent(movie, date, theatre) {
  try {
    const state = await loadState();
    const key = generateKey(movie, date, theatre);

    // Avoid duplicates
    if (!state.sentNotifications.includes(key)) {
      state.sentNotifications.push(key);
      await saveState(state);
      console.log(`   📝 State updated: ${key} marked as notified`);
    }
  } catch (error) {
    console.error(`Error recording notification: ${error.message}`);
    throw error;
  }
}

/**
 * Reset state (useful for testing)
 * @returns {Promise<void>}
 */
export async function resetState() {
  try {
    await saveState({ sentNotifications: [] });
    console.log(`✅ State reset`);
  } catch (error) {
    console.error(`Error resetting state: ${error.message}`);
    throw error;
  }
}

/**
 * Get all sent notifications
 * @returns {Promise<Array>} Array of notification keys
 */
export async function getSentNotifications() {
  try {
    const state = await loadState();
    return state.sentNotifications;
  } catch (error) {
    console.error(`Error getting sent notifications: ${error.message}`);
    return [];
  }
}
