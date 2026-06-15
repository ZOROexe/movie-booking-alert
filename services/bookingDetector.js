/**
 * Playwright-based booking detection for BookMyShow
 * Focuses on resilience with Cloudflare bypass, multiple fallback selectors and explicit waits
 */

import { chromium } from 'playwright';

/**
 * Create browser with anti-detection headers to bypass Cloudflare
 * @returns {Promise<Browser>}
 */
const BROWSER_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
];

export async function launchBrowserWithBypass() {
  const baseOptions = {
    headless: true,
    args: BROWSER_LAUNCH_ARGS,
  };

  const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim();
  const attempts = channel
    ? [{ ...baseOptions, channel }]
    : [baseOptions, { ...baseOptions, channel: 'chrome' }];

  let lastError;

  for (const options of attempts) {
    const label = options.channel || 'bundled chromium';
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
      console.log(
        `   ⚠️  Browser launch failed (${label}): ${error.message.split('\n')[0]}`
      );
    }
  }

  throw lastError;
}

/**
 * Create a context with proper browser fingerprints to bypass Cloudflare
 * @param {Browser} browser
 * @returns {Promise<BrowserContext>}
 */
export async function createContextWithBypass(browser) {
  return browser.newContext({
    // Realistic viewport
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    
    // Browser fingerprint
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Timezone and locale to match India
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    
    // Headers to bypass Cloudflare
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    
    // Required for Cloudflare
    bypassCSP: true,
  });
}

/**
 * Navigate to movie page with Cloudflare bypass
 * @param {Page} page - Playwright page object
 * @param {string} movieName - Name of the movie
 * @param {string} city - City name (optional)
 */
export async function navigateAndSelectCity(page, movieName, city = null) {
  try {
    console.log(`   🌐 Navigating to BookMyShow...`);
    
    // Set additional headers to bypass Cloudflare
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.google.com/',
      'Origin': 'https://in.bookmyshow.com',
    });

    // Navigate to the movie page
    const response = await page.goto(process.env.MOVIE_URL || 'https://in.bookmyshow.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (!response) {
      throw new Error('Navigation failed: no response');
    }

    console.log(`   ✅ Page loaded (status: ${response.status()})`);

    // Wait for Cloudflare challenge to complete
    // Look for the main content, not the challenge page
    try {
      await page.waitForSelector('body:not(:has(iframe[src*="challenges"]))' , {
        timeout: 10000,
      }).catch(() => null);
    } catch {
      // Continue anyway
    }

    // Add explicit wait for main content to load
    try {
      await page.waitForFunction(() => document.body.innerText.length > 100, {
        timeout: 10000,
      });
    } catch {
      console.log(`   ⚠️  Page content verification timeout`);
    }

  } catch (error) {
    throw new Error(`Navigation failed: ${error.message}`);
  }
}

/**
 * Parse weekday and date from config
 * Supports formats: "23" or "THU23" or "THU" (extracts THU)
 * @param {string} targetDate - Date string from config
 * @returns {{weekday: string|null, date: string|null}}
 */
function parseWeekdayAndDate(targetDate) {
  const weekdayPattern = /^(MON|TUE|WED|THU|FRI|SAT|SUN)/i;
  const match = targetDate.match(weekdayPattern);
  
  if (match) {
    const weekday = match[1].toUpperCase();
    const dateStr = targetDate.replace(weekdayPattern, '').trim();
    return { weekday, date: dateStr || null };
  }
  
  // Check if input is just a date number (1-31)
  const dateMatch = targetDate.match(/^\d{1,2}$/);
  if (dateMatch) {
    return { weekday: null, date: dateMatch[0] };
  }
  
  return { weekday: null, date: null };
}

/**
 * Check if element is interactive (button, clickable element, etc)
 * @param {Locator} element - Element to validate
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
async function isInteractiveElement(element, page) {
  try {
    const isInteractive = await page.evaluate((el) => {
      if (!el) return false;
      
      // Check if element itself is interactive
      const tagName = (el.tagName || '').toLowerCase();
      const role = el.getAttribute('role') || '';
      
      // Accept buttons, links, and elements with button/tab roles
      return (
        tagName === 'button' ||
        tagName === 'a' ||
        role === 'button' ||
        role === 'tab' ||
        role === 'menuitem'
      );
    }, await element.elementHandle().catch(() => null)).catch(() => false);
    
    return isInteractive;
  } catch {
    return false;
  }
}

/**
 * Detect if target date button is available
 * Simple, reliable detection with minimal validation
 * @param {Page} page - Playwright page object
 * @param {string} targetDate - Target date string (e.g., "23", "THU23", "THU")
 * @returns {Promise<{found: boolean, element: Locator|null}>}
 */
export async function detectDateButton(page, targetDate) {
  try {
    console.log(`   🔍 Detecting date: ${targetDate}...`);

    const { weekday, date } = parseWeekdayAndDate(targetDate);

    // Try ID selector first (most reliable)
    if (date) {
      try {
        const idLocator = page.locator(`[id="${date}"]`);
        if (await idLocator.count() > 0) {
          const element = idLocator.first();
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log(`   ✅ Date found using ID selector`);
          return { found: true, element };
        }
      } catch (error) {
        console.log(`   ⚠️  ID selector failed: ${error.message}`);
      }
    }

    // Try button with text (common pattern)
    if (date) {
      try {
        const buttonLocator = page.locator(`button:has-text("${date}")`).first();
        await buttonLocator.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`   ✅ Date found using button selector`);
        return { found: true, element: buttonLocator };
      } catch (error) {
        console.log(`   ⚠️  Button selector failed: ${error.message}`);
      }
    }

    // Try text-based exact match (fallback)
    if (date) {
      try {
        const textLocator = page.getByText(date, { exact: true }).first();
        await textLocator.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`   ✅ Date found using text selector`);
        return { found: true, element: textLocator };
      } catch (error) {
        console.log(`   ⚠️  Text selector failed: ${error.message}`);
      }
    }

    console.log(`   ❌ Date not found`);
    return { found: false, element: null };
  } catch (error) {
    console.error(`   Date detection error: ${error.message}`);
    return { found: false, element: null };
  }
}

/**
 * Detect if target theatre is available on the page
 * @param {Page} page - Playwright page object
 * @param {string} theatreName - Target theatre name
 * @returns {Promise<{found: boolean, element: Locator|null}>}
 */
export async function detectTheatre(page, theatreName) {
  try {
    console.log(`   🎭 Detecting theatre: ${theatreName}...`);

    // Wait for body content to be available
    await page.waitForSelector('body', { timeout: 5000 });

    // Get full page text
    const pageText = await page.textContent('body');
    
    if (!pageText || pageText.trim().length === 0) {
      console.log(`   ❌ Page text empty`);
      return { found: false, element: null };
    }

    // Escape regex special characters and search (case-insensitive)
    const escapedName = theatreName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedName, 'i');

    if (regex.test(pageText)) {
      console.log(`   ✅ Theatre found: ${theatreName}`);
      return { found: true, element: null };
    }

    console.log(`   ❌ Theatre not found: ${theatreName}`);
    return { found: false, element: null };
  } catch (error) {
    console.error(`   Theatre detection error: ${error.message}`);
    return { found: false, element: null };
  }
}

/**
 * Detect if at least one showtime is available
 * Uses strict time pattern matching and DOM validation
 * @param {Page} page - Playwright page object
 * @returns {Promise<{found: boolean, count: number}>}
 */
export async function detectShowtime(page) {
  try {
    console.log(`   ⏰ Detecting showtimes...`);

    // Get visible text content only
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let text = '';
      let node;
      while (node = walker.nextNode()) {
        const element = node.parentElement;
        if (element && element.offsetHeight > 0 && element.offsetWidth > 0) {
          text += node.textContent + ' ';
        }
      }
      return text;
    });

    if (!visibleText || visibleText.trim().length < 50) {
      console.log(`   ❌ Insufficient page content`);
      return { found: false, count: 0 };
    }

    // Improved regex: matches times like "7:15PM", "7:15 PM", "10:30AM", "10:30 AM"
    const timePattern = /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/g;
    const matches = visibleText.match(timePattern) || [];

    if (matches.length === 0) {
      console.log(`   ❌ No valid showtimes found`);
      return { found: false, count: 0 };
    }

    // Validate: check for showtime-related keywords on page
    const showtimeKeywords = /(?:show|time|slot|booking|ticket|theatre|cinema|screen|timings)/i;
    
    if (!showtimeKeywords.test(visibleText)) {
      console.log(`   ❌ Showtimes format invalid (missing context keywords)`);
      return { found: false, count: 0 };
    }

    // Remove duplicates and count unique times
    const uniqueTimes = [...new Set(matches)];
    console.log(`   ✅ Showtimes found (count: ${uniqueTimes.length})`);
    return { found: true, count: uniqueTimes.length };
  } catch (error) {
    console.error(`   Showtime detection error: ${error.message}`);
    return { found: false, count: 0 };
  }
}

/**
 * Main orchestration: Process a single watch
 * Detection order: Date → Theatre → Showtime (fail fast if date unavailable)
 * @param {BrowserContext} context - Playwright browser context
 * @param {Object} watch - Watch configuration {movie, city, targetDate, theatre}
 * @returns {Promise<{bookingsOpen: boolean, watch: Object}>}
 */
export async function processWatch(context, watch) {
  const page = await context.newPage();
  
  try {
    console.log(`\n📽️  Checking ${watch.movie}...`);

    // Navigate to the movie page with Cloudflare bypass
    await navigateAndSelectCity(page, watch.movie, watch.city);

    // Step 1: Detect date first (fail fast if unavailable)
    const dateResult = await detectDateButton(page, watch.targetDate);
    if (!dateResult.found) {
      console.log(`   ❌ Date not available yet`);
      return { bookingsOpen: false, watch };
    }

    // Step 2: Detect theatre
    const theatreResult = await detectTheatre(page, watch.theatre);
    if (!theatreResult.found) {
      console.log(`   ❌ Theatre not found`);
      return { bookingsOpen: false, watch };
    }

    // Step 3: Detect showtime
    const showtimeResult = await detectShowtime(page);
    if (!showtimeResult.found) {
      console.log(`   ❌ No showtimes available`);
      return { bookingsOpen: false, watch };
    }

    console.log(`   🎉 Bookings open!`);
    return { bookingsOpen: true, watch };
  } catch (error) {
    console.error(`   ⚠️  Error processing watch: ${error.message}`);
    
    // Save error screenshot if enabled
    if (process.env.DEBUG === 'true') {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({
          path: `screenshots/error-${timestamp}.png`,
          fullPage: true,
        });
        console.log(`   📸 Error screenshot saved`);
      } catch (screenshotError) {
        console.error(`Failed to save screenshot: ${screenshotError.message}`);
      }
    }

    return { bookingsOpen: false, watch };
  } finally {
    await page.close();
  }
}

/**
 * Launch browser and process all watches
 * @param {Array} watches - Array of watch configurations
 * @returns {Promise<Array>} Array of results {bookingsOpen, watch}
 */
export async function processAllWatches(watches) {
  let browser = null;
  let context = null;

  try {
    console.log(`   🚀 Launching browser with Cloudflare bypass...`);
    
    // Launch browser with anti-detection measures
    browser = await launchBrowserWithBypass();
    
    // Create context with proper fingerprints
    context = await createContextWithBypass(browser);

    const results = [];

    for (const watch of watches) {
      const result = await processWatch(context, watch);
      results.push(result);
      
      // Wait between watches to appear more natural
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return results;
  } catch (error) {
    console.error(`   ❌ Browser launch error: ${error.message}`);
    throw error;
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}
