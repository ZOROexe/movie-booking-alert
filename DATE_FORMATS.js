/**
 * Date Detection Examples
 * This file demonstrates the different date formats supported by the booking monitor
 */

// Format 1: Date only
// Matches any occurrence of that date in the month
// Usage: When the exact weekday doesn't matter
const dateOnly = {
  movie: "The Odyssey",
  city: "Coimbatore",
  targetDate: "23",  // Matches: "23 Jul", "23rd", any "23"
  theatre: "Broadway Cinemas: Coimbatore"
};

// Format 2: Weekday + Date
// Matches a specific weekday on a specific date
// Usage: When you need the exact day and date
const weekdayAndDate = {
  movie: "Avatar 3",
  city: "Kochi",
  targetDate: "THU26",  // Matches: "THU 26", "Thursday 26", etc.
  theatre: "PVR IMAX"
};

// Format 3: Weekday only
// Matches any occurrence of that weekday
// Usage: Flexible - any Friday this week, any Thursday, etc.
const weekdayOnly = {
  movie: "Inception",
  city: "Mumbai",
  targetDate: "FRI",  // Matches: "FRI 25", "FRI 01", any Friday
  theatre: "IMAX Cinemas"
};

// Format 4: Full date format
// Matches complete date with month
// Usage: When you have the full date string
const fullDate = {
  movie: "Interstellar",
  city: "Delhi",
  targetDate: "FRI30JUL",  // Matches: "FRI 30 JUL", "30 JUL", etc.
  theatre: "PVR Cinemas"
};

/**
 * Supported Weekday Codes
 * Use these three-letter codes in targetDate
 */
const WEEKDAY_CODES = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday"
};

/**
 * Detection Strategy Flow
 * 
 * When detecting dates, the app tries strategies in this order:
 * 
 * 1. Weekday + Date (if both provided in targetDate)
 *    - Parses "THU23" -> weekday: "THU", date: "23"
 *    - Looks for date container with both visible
 *    - Uses ID selectors: [id="23"]
 *    - Falls back to text matching
 * 
 * 2. Button selectors
 *    - Finds clickable date elements
 *    - Matches exact and partial text
 * 
 * 3. Text-based fallback
 *    - Generic text matching
 *    - Handles any visible date format
 * 
 * If any strategy finds the date, detection succeeds and stops.
 * If all strategies fail, the date is considered "not available yet".
 */

/**
 * Example: Real-world testing scenarios
 */

// Scenario 1: You know the exact date you want (23rd, any weekday)
const scenario1 = {
  targetDate: "23",
  reason: "Simple date - works with any weekday layout"
};

// Scenario 2: You want a specific weekday+date combination
const scenario2 = {
  targetDate: "THU23",
  reason: "Specific day - ensures Thursday specifically, not just any 23rd"
};

// Scenario 3: You're flexible on the date but need a specific weekday
const scenario3 = {
  targetDate: "FRI",
  reason: "Flexible - any Friday works for your schedule"
};

// Scenario 4: BookMyShow shows dates as "FRI 23 JUL"
const scenario4 = {
  targetDate: "FRI23JUL",
  reason: "Full format - matches exactly as displayed"
};

console.log(`
✅ Date Detection Examples

This file demonstrates all supported date formats for the BookMyShow monitor.

Update config.json with any of the formats above:

[
  {
    "movie": "The Odyssey",
    "city": "Coimbatore",
    "targetDate": "23",
    "theatre": "Broadway Cinemas: Coimbatore"
  },
  {
    "movie": "Avatar 3",
    "city": "Kochi",
    "targetDate": "THU26",
    "theatre": "PVR IMAX"
  }
]

The detection will automatically choose the right strategy for your format.
`);

export { dateOnly, weekdayAndDate, weekdayOnly, fullDate, WEEKDAY_CODES };
