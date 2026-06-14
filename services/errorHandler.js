/**
 * Error handling and debugging utilities
 * Captures screenshots and HTML snapshots for troubleshooting
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const HTML_SNAPSHOTS_DIR = path.join(__dirname, '../html-snapshots');

/**
 * Ensure directory exists, create if not
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
async function ensureDirExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Capture screenshot from page
 * Saves to screenshots/ folder with timestamp and context
 * @param {Page} page - Playwright page object
 * @param {string} type - Error type (e.g., 'navigation', 'detection', 'click')
 * @param {string} watchName - Watch identifier (movie name)
 * @returns {Promise<string|null>} Path to screenshot or null if failed
 */
export async function captureScreenshot(page, type, watchName) {
  try {
    await ensureDirExists(SCREENSHOTS_DIR);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${watchName}-${type}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`   📸 Screenshot saved: ${filename}`);

    return filepath;
  } catch (error) {
    console.error(`Failed to capture screenshot: ${error.message}`);
    return null;
  }
}

/**
 * Capture full page HTML snapshot
 * Saves to html-snapshots/ folder with timestamp
 * Useful for analyzing DOM structure and detecting selector issues
 * @param {Page} page - Playwright page object
 * @param {string} watchName - Watch identifier (movie name)
 * @returns {Promise<string|null>} Path to HTML snapshot or null if failed
 */
export async function captureHtmlSnapshot(page, watchName) {
  try {
    await ensureDirExists(HTML_SNAPSHOTS_DIR);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${watchName}.html`;
    const filepath = path.join(HTML_SNAPSHOTS_DIR, filename);

    const htmlContent = await page.content();
    await fs.writeFile(filepath, htmlContent, 'utf-8');
    console.log(`   📄 HTML snapshot saved: ${filename}`);

    return filepath;
  } catch (error) {
    console.error(`Failed to capture HTML snapshot: ${error.message}`);
    return null;
  }
}

/**
 * Capture error context (screenshot + HTML snapshot + page URL)
 * Called when an error occurs during booking detection
 * @param {Page} page - Playwright page object
 * @param {string} watchName - Watch identifier
 * @param {Error} error - Error object
 * @returns {Promise<Object>} Debug information captured
 */
export async function captureErrorContext(page, watchName, error) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    watch: watchName,
    error: error.message,
    url: page.url(),
    screenshot: null,
    htmlSnapshot: null,
  };

  // Capture screenshot
  debugInfo.screenshot = await captureScreenshot(page, 'error', watchName);

  // Capture HTML snapshot if debug mode enabled
  if (process.env.DEBUG === 'true') {
    debugInfo.htmlSnapshot = await captureHtmlSnapshot(page, watchName);
  }

  return debugInfo;
}
