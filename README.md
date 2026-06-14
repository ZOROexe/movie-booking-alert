# BookMyShow Booking Monitor

A resilient Node.js application that monitors BookMyShow for movie bookings and sends notifications via Telegram and Email when bookings open for specified movies, dates, and theatres.

**Features:**
- ✅ Monitor multiple movies simultaneously with independent tracking
- ✅ Resilient Playwright-based detection with multiple fallback selectors
- ✅ Per-watch notification state management (no duplicate notifications)
- ✅ Telegram and Email notifications with automatic retry
- ✅ GitHub Actions scheduled execution (every 15 minutes)
- ✅ Error screenshots and HTML snapshots for debugging
- ✅ Production-grade code with ES Modules and async/await
- ✅ Reusable for any movie by changing only `config.json` and `.env`

---

## Installation

### Prerequisites
- Node.js 18+ and npm
- Gmail account with App Password (for email notifications)
- Telegram Bot (for Telegram notifications)

### Setup

1. **Clone/Download the project:**
   ```bash
   cd /path/to/book-alert
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

4. **Configure credentials (see sections below)**

---

## Configuration

### 1. Gmail Setup (Email Notifications)

#### Generate Gmail App Password

1. Enable 2-Step Verification on your Google Account:
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Select **Security** from the left menu
   - Enable **2-Step Verification**

2. Generate App Password:
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select **Mail** and **Windows Computer** (or your device)
   - Copy the 16-character password
   - Update `.env`:
     ```env
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASS=xxxx xxxx xxxx xxxx
     ```

### 2. Telegram Setup (Telegram Notifications)

#### Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/start`
3. Send `/newbot`
4. Follow prompts to name your bot
5. Copy the **Bot Token** (e.g., `123456789:ABCdef...`)

#### Get Chat ID

1. Search for **@userinfobot** in Telegram
2. Send `/start`
3. The bot will reply with your Chat ID (a number)

#### Update `.env`
```env
BOT_TOKEN=123456789:ABCdef...
CHAT_ID=987654321
```

### 3. BookMyShow Movie URL

Get the full URL of the movie you want to monitor:

1. Visit [BookMyShow](https://in.bookmyshow.com)
2. Search and click on the movie
3. Copy the URL from the address bar
4. Update `.env`:
   ```env
   MOVIE_URL=https://in.bookmyshow.com/movies/coimbatore/the-odyssey/buytickets/123333/12233
   ```

### 4. Configure Watches

Edit `config.json` to specify which movies/dates/theatres to monitor:

```json
[
  {
    "movie": "The Odyssey",
    "city": "Kochi",
    "targetDate": "SAT25",
    "theatre": "Broadway Cinemas"
  },
  {
    "movie": "Avatar 3",
    "city": "Kochi",
    "targetDate": "SUN26",
    "theatre": "PVR IMAX"
  }
]
```

**Fields:**
- **movie**: Movie name (must match search results on BookMyShow)
- **city**: City where you want to watch (optional; leave blank if movie available nationwide)
- **targetDate**: Date you want to watch - supports multiple formats:
  - **Date only**: `"23"` (detects any 23rd)
  - **Weekday + Date**: `"THU23"` or `"FRI25"` (specific weekday + date)
  - **Weekday only**: `"THU"` or `"FRI"` (any occurrence of that weekday)
  - **Full format**: `"23 Jul"` or `"FRI23JUL"` (fully qualified dates)
- **theatre**: Theatre name (e.g., "PVR IMAX", "INOX")

### Date Detection Strategies

The app uses multiple detection strategies to find dates on BookMyShow, making it resilient to UI changes:

**Priority Order:**

1. **Weekday + Date Detection** (Modern UI)
   - Parses weekday from targetDate (e.g., `"THU23"`)
   - Looks for date container with both weekday and date visible
   - Uses ID selectors: `[id="23"]`
   - Falls back to text-based matching within weekday containers

2. **Button Selectors**
   - Finds clickable date elements using Playwright button locators
   - Matches exact and partial text

3. **Text-based Fallback**
   - Generic text matching as ultimate fallback
   - Handles any date format that appears on the page

**Example Configurations:**

```json
{
  "targetDate": "23"        // Matches: "23 Jul", "23 August", any 23rd
}

{
  "targetDate": "THU23"     // Matches: Thursday the 23rd (if visible as THU 23)
}

{
  "targetDate": "FRI"       // Matches: Any Friday visible in date selector
}
```

---

## Running Locally

### Run Once
```bash
npm start
```

### Expected Output
```
🚀 BookMyShow Booking Monitor Started

📋 Loaded 2 watch(es)

📽️  Checking The Odyssey...
   ✅ Date found.
   ✅ Theatre found.
   ✅ Showtimes found. (count: 12)
   🎉 Bookings open!

📽️  Checking Avatar 3...
   ❌ Date not available yet

📊 1 booking(s) detected

   🔔 New booking detected: The Odyssey - 25 Jul - Broadway Cinemas IMAX
   📬 Sending notifications for: The Odyssey - 25 Jul

   ✅ Telegram notification sent
   ✅ Email notification sent
   📝 State updated: The Odyssey-25 Jul-Broadway Cinemas IMAX marked as notified

✅ BookMyShow Booking Monitor Completed
```

### Debugging

Enable debug mode in `.env`:
```env
DEBUG=true
```

This will:
- Save HTML snapshots to `html-snapshots/` for each run
- Provide detailed logs for troubleshooting selector issues
- Keep error screenshots for 7 days

View captured files:
```bash
ls -la screenshots/        # Error screenshots
ls -la html-snapshots/     # Full page HTML for debugging
```

---

## GitHub Actions Setup

### Add Repository Secrets

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:
   - `BOT_TOKEN`: Your Telegram Bot Token
   - `CHAT_ID`: Your Telegram Chat ID
   - `EMAIL_USER`: Your Gmail address
   - `EMAIL_PASS`: Your Gmail App Password (16-char)
   - `MOVIE_URL`: BookMyShow movie URL

### Monitor Scheduled Runs

1. Go to **Actions** tab in your GitHub repository
2. Look for **BookMyShow Booking Monitor** workflow
3. View run history and logs
4. Download artifacts (screenshots, state file) if needed

### Manual Trigger

To run immediately without waiting for the 15-minute schedule:
1. Go to **Actions** tab
2. Select **BookMyShow Booking Monitor**
3. Click **Run workflow** → **Run workflow**

---

## How It Works

### Detection Flow

For each watch in `config.json`:

1. **Navigate** to BookMyShow movie page
2. **Select city** (if specified)
3. **Detect date button** (multiple fallback selectors for resilience)
   - If not found: Skip to next watch
   - If found: Click and proceed
4. **Detect theatre** (exact match → substring match)
   - If not found: Skip to next watch
   - If found: Proceed
5. **Detect showtimes** (at least one time slot must exist)
   - If found: Bookings are **OPEN** ✅

### Notification Flow

If bookings are detected:

1. **Check state** (`state.json`): Has notification been sent for this watch?
2. **If already sent**: Skip (prevents duplicate notifications)
3. **If not sent**:
   - Send Telegram message
   - Send Email message (independent, continues if Telegram fails)
   - Record watch key in `state.json`

### State Management

State tracks per-watch using unique keys: `movie-date-theatre`

Example `state.json`:
```json
{
  "sentNotifications": [
    "The Odyssey-25 Jul-Broadway Cinemas IMAX",
    "Avatar 3-26 Jul-PVR IMAX"
  ]
}
```

This allows:
- Monitoring same movie on different dates (separate tracking)
- Monitoring different movies with same date (separate tracking)
- **No manual reset needed** — config changes automatically create new keys

---

## Troubleshooting

### Selectors Not Working

**Problem**: "Theatre not found" or "Showtimes not found" even though they're visible

**Solution**:
1. Enable `DEBUG=true` in `.env`
2. Run `npm start`
3. Check `html-snapshots/` folder
4. Open the HTML file in a browser and inspect the theatre/showtime elements
5. Look for `data-testid`, `role`, or `class` attributes
6. Update `services/bookingDetector.js` with new selectors if needed

### Notifications Not Sending

**Telegram:**
- Verify `BOT_TOKEN` and `CHAT_ID` are correct
- Check if bot is in your chat (send `/start` to bot)
- Test with: `curl -X POST https://api.telegram.org/botBOT_TOKEN/sendMessage -d "chat_id=CHAT_ID&text=test"`

**Email:**
- Verify `EMAIL_USER` and `EMAIL_PASS` are correct
- Ensure you've generated an App Password (not your regular Gmail password)
- Check Gmail's [Sign-in attempt blocked](https://accounts.google.com/signin/security-checkup) if emails aren't sending

### State Not Updating

Check `state.json` exists and is writable:
```bash
ls -la state.json
cat state.json
```

If missing, create it:
```bash
echo '{"sentNotifications": []}' > state.json
```

### Playwright Browser Issues

If seeing Playwright download issues on GitHub Actions:
- The workflow handles browser installation automatically
- For local issues: `npx playwright install`

---

## File Structure

```
book-alert/
├── index.js                          # Main entry point
├── config.json                       # Watch configuration (movies/dates/theatres)
├── config.json.example               # Configuration template
├── state.json                        # Runtime state (auto-generated, tracks sent notifications)
├── .env                              # Environment variables (secrets)
├── .env.example                      # Environment template
├── package.json                      # Dependencies
├── .gitignore                        # Git ignore rules
│
├── services/
│   ├── bookingDetector.js            # Playwright detection logic (resilient selectors)
│   ├── state.js                      # State file management (per-watch tracking)
│   ├── telegram.js                   # Telegram notifications with retry
│   ├── email.js                      # Email notifications with retry
│   ├── notificationHandler.js        # Unified notification orchestration
│   └── errorHandler.js               # Screenshot & HTML snapshot capture
│
├── screenshots/                      # Error screenshots (auto-created)
├── html-snapshots/                   # HTML page snapshots for debugging (auto-created)
│
├── .github/
│   └── workflows/
│       └── check-bookings.yml        # GitHub Actions scheduler (every 15 min)
│
└── README.md                         # This file
```

---

## How to Extend

### Add a New Movie Watch

Simply add to `config.json`:
```json
{
  "movie": "Inception",
  "city": "Mumbai",
  "targetDate": "30 Jul",
  "theatre": "IMAX Cinemas"
}
```

**No code changes needed** — the app dynamically processes all watches.

### Customize Notification Message

Edit `formatTelegramMessage()` in `services/telegram.js` or `formatEmailHtml()`/`formatEmailText()` in `services/email.js`

### Add a New Notification Channel (e.g., SMS)

1. Create `services/sms.js` with `sendSmsNotification(watch)` function
2. Import in `services/notificationHandler.js`
3. Add to the `Promise.all()` call

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "date not available yet" | Date might be in the past; update targetDate in config.json |
| "Theatre not found" | Theatre name might be slightly different; check BookMyShow for exact name |
| Notifications not sending | Verify BOT_TOKEN, CHAT_ID, EMAIL_USER, EMAIL_PASS in .env |
| GitHub Actions fails | Check secrets are set correctly in GitHub repository settings |
| Too many notifications | Delete state.json to reset, or update config.json to add new watches with new keys |

---

## License

MIT

---

## Support

For issues with:
- **Selector detection**: Enable `DEBUG=true` and check HTML snapshots
- **Telegram**: Test bot token at https://api.telegram.org/bot{TOKEN}/getMe
- **Gmail**: Ensure App Password is used (not regular Gmail password)
- **Playwright**: Run `npx playwright install` to ensure browsers are installed

---

## Privacy & Security

- ✅ All sensitive data stored in `.env` (excluded from git)
- ✅ State file (`state.json`) only tracks which notifications were sent, no personal data
- ✅ Screenshots/HTML snapshots stored locally or as temporary GitHub artifacts (7-day retention)
- ✅ Never logs credentials or secrets
