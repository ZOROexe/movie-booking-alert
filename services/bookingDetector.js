/**
 * Playwright-based booking detection for BookMyShow
 * Focuses on resilience with Cloudflare bypass, multiple fallback selectors and explicit waits
 */

import { chromium } from 'playwright';

/**
 * Create browser with anti-detection headers to bypass Cloudflare
 * @returns {Promise<Browser>}
 */
export async function launchBrowserWithBypass() {
  return chromium.launch({
    headless: true,
    channel: 'chrome',
    // Use specific args to appear more like a real browser
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
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

    // Add extra delay to let page fully render
    await page.waitForTimeout(3000);
    
    // Wait for main content to load (if possible)
    try {
      await page.waitForFunction(() => document.body.innerText.length > 100, {
        timeout: 10000,
      });
    } catch {
      console.log(`   ⚠️  Page content check timeout`);
    }

  } catch (error) {
    throw new Error(`Navigation failed: ${error.message}`);
  }
}

/**
 * Parse weekday and date from config
 * Supports formats: "23" or "THU23" or "THU" (extracts THU)
 * @param {string} targetDate - Date string from config
 * @returns {{weekday: string|null, date: string}}
 */
function parseWeekdayAndDate(targetDate) {
  const weekdayPattern = /^(MON|TUE|WED|THU|FRI|SAT|SUN)/i;
  const match = targetDate.match(weekdayPattern);
  
  if (match) {
    const weekday = match[1].toUpperCase();
    const date = targetDate.replace(weekdayPattern, '').trim();
    return { weekday, date };
  }
  
  return { weekday: null, date: targetDate };
}

/**
 * Detect if target date button is available with weekday + date support
 * Multiple fallback strategies for resilience
 * @param {Page} page - Playwright page object
 * @param {string} targetDate - Target date string (e.g., "23", "THU23", "THU", "25 Jul")
 * @returns {Promise<{found: boolean, element: Locator|null}>}
 */
export async function detectDateButton(page, targetDate) {
  try {
    console.log(`   🔍 Detecting date: ${targetDate}...`);

    const { weekday, date } = parseWeekdayAndDate(targetDate);

    // Strategy 1: Weekday + Date detection (new - for modern BookMyShow UI)
    if (weekday && date) {
      try {
        console.log(`   📅 Trying weekday+date strategy: ${weekday} ${date}`);
        
        // Try to find the date container and then weekday within it
        const dateContainer = page.locator('div').filter({ hasText: new RegExp(`${weekday}.*${date}`, 'i') });
        const dateContainerCount = await dateContainer.count();
        
        if (dateContainerCount > 0) {
          // Try to find the specific date button by ID or class
          const idSelector = page.locator(`[id="${date}"]`);
          const idCount = await idSelector.count();
          
          if (idCount > 0) {
            await idSelector.first().waitFor({ timeout: 3000, state: 'visible' });
            console.log(`   ✅ Date found using weekday+date ID strategy`);
            return { found: true, element: idSelector.first() };
          }

          // Fallback: Find by weekday then date text within container
          const weekdayLocator = page.getByText(weekday, { exact: true }).first();
          await weekdayLocator.waitFor({ timeout: 2000, state: 'visible' }).catch(() => null);
          
          const dateLocator = page.getByText(date, { exact: true }).first();
          await dateLocator.waitFor({ timeout: 2000, state: 'visible' });
          
          console.log(`   ✅ Date found using weekday+date text strategy`);
          return { found: true, element: dateLocator };
        }
      } catch (error) {
        console.log(`   ⚠️  Weekday+date strategy failed: ${error.message}`);
      }
    }

    // Strategy 2: Date selector with both short date and full date ID formats
    if (date) {
      try {
        console.log(`   📅 Trying date selector strategies for: ${date}`);
        
        // Try short format ID (just the date)
        let selector = page.locator(`[id="${date}"]`);
        let count = await selector.count();
        
        if (count > 0) {
          await selector.first().waitFor({ timeout: 3000, state: 'visible' });
          console.log(`   ✅ Date found using short ID strategy`);
          return { found: true, element: selector.first() };
        }

        // Try to click the date element directly via text if it has the right button structure
        const buttonSelector = page.locator(`button:has-text("${date}")`).first();
        const buttonCount = await buttonSelector.count();
        
        if (buttonCount > 0) {
          await buttonSelector.waitFor({ timeout: 3000, state: 'visible' });
          console.log(`   ✅ Date found using button strategy`);
          return { found: true, element: buttonSelector };
        }
      } catch (error) {
        console.log(`   ⚠️  Date selector strategy failed: ${error.message}`);
      }
    }

    // Strategy 3: Original date-only detection (legacy/fallback)
    const dateLocators = [
      page.locator(`text=${targetDate}`).first(),
      page.locator(`button:has-text("${targetDate}")`).first(),
      page.locator(`a:has-text("${targetDate}")`).first(),
      page.getByText(targetDate, { exact: true }).first(),
    ];

    if (date) {
      dateLocators.push(
        page.locator(`text=${date}`).first(),
        page.locator(`button:has-text("${date}")`).first(),
        page.locator(`a:has-text("${date}")`).first(),
        page.getByText(date, { exact: true }).first()
      );
    }

    for (let i = 0; i < dateLocators.length; i++) {
      try {
        // Check if element is visible
        await dateLocators[i].waitFor({ timeout: 3000, state: 'visible' });
        console.log(`   ✅ Date found using text strategy ${i + 1}`);
        return { found: true, element: dateLocators[i] };
      } catch {
        // Try next strategy
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
 * Detect if target theatre is available in the theatre list
 * Implements flexible matching: exact > case-insensitive > substring
 * @param {Page} page - Playwright page object
 * @param {string} theatreName - Target theatre name
 * @returns {Promise<{found: boolean, element: Locator|null}>}
 */
export async function detectTheatre(page, theatreName) {
  try {
    console.log(`   🎭 Detecting theatre: ${theatreName}...`);

    // Wait for body to be ready
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get full page text
    const pageText = await page.textContent('body');
    
    if (!pageText) {
      console.log(`   ❌ Page text empty`);
      return { found: false, element: null };
    }

    // Escape regex special characters
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
 * Detect if at least one showtime is available for the selected date/theatre
 * @param {Page} page - Playwright page object
 * @returns {Promise<{found: boolean, count: number}>}
 */
export async function detectShowtime(page) {
  try {
    console.log(`   ⏰ Detecting showtimes...`);

    // Get body text
    const bodyText = await page.textContent('body');

    if (!bodyText) {
      console.log(`   ❌ Page text empty`);
      return { found: false, count: 0 };
    }

    // Look for time patterns (HH:MM format)
    const timePattern = /\d{1,2}:\d{2}\s?(AM|PM|am|pm)?/g;
    const matches = bodyText.match(timePattern) || [];

    // Filter out common false positives (URLs, timestamps, etc.)
    const validMatches = matches.filter((m) => {
      // Must have AM/PM or be in a reasonable time range
      return m.includes('AM') || m.includes('PM') || m.includes('am') || m.includes('pm');
    });

    if (validMatches.length > 0) {
      console.log(`   ✅ Showtimes found (count: ${validMatches.length})`);
      return { found: true, count: validMatches.length };
    }

    console.log(`   ❌ No showtimes found`);
    return { found: false, count: 0 };
  } catch (error) {
    console.error(`   Showtime detection error: ${error.message}`);
    return { found: false, count: 0 };
  }
}

/**
 * Main orchestration: Process a single watch
 * Checks date > theatre > showtimes in sequence
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

    // Step 1: Detect theatre
    const theatreResult = await detectTheatre(page, watch.theatre);
    if (!theatreResult.found) {
      console.log(`   ❌ Theatre not found`);
      return { bookingsOpen: false, watch };
    }

    // Step 2: Detect date
    const dateResult = await detectDateButton(page, watch.targetDate);
    if (!dateResult.found) {
      console.log(`   ❌ Date not available yet`);
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
      
      // Add delay between watches to avoid detection
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
