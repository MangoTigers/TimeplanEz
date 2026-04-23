# TimeplanEz - Hours Tracking App

A sleek, fully-featured web application for tracking work hours with distinction between paid and unpaid (school) hours. Built with React, TypeScript, Tailwind CSS, and Supabase. 100% free hosting with GitHub Pages + Supabase.

## 🚀 Features

- ✅ **Dual-platform** - Web app + PWA (installable on mobile)
- ✅ **Smart paid/unpaid** - Auto-calculate based on configurable school hours per week
- ✅ **Manual overrides** - Tag individual shifts as paid/unpaid as needed
- ✅ **Earnings tracking** - Set hourly rate, track €/week/month (NOK/EUR/USD)
- ✅ **Dashboard** - Week overview with paid/unpaid split, daily breakdown
- ✅ **Analytics** - Charts, trends, category breakdown, monthly reports
- ✅ **Reflections + AI** - Write notes on shifts, AI can enhance grammar & expand (with OpenAI)
- ✅ **Export** - CSV/PDF reports with earnings breakdown
- ✅ **Dark mode** - Full dark/light theme support
- ✅ **Reminders** - Browser notifications + email digest (Sundays)
- ✅ **Recurring templates** - Create shift templates (e.g., Mon-Fri 2h → auto-generate)
- ✅ **Offline support** - Full PWA with service worker
- ✅ **Free hosting** - GitHub Pages + Supabase free tier

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Routing:** React Router v6
- **State:** Zustand + localStorage
- **Charts:** Recharts
- **Date handling:** date-fns
- **UUID:** uuid
- **PWA:** Service Worker + manifest.json

## 📋 Prerequisites

1. **Node.js** 16+ and npm/yarn
2. **Supabase account** (free tier: https://supabase.com)
3. **GitHub account** (for hosting)
4. **OpenAI API key** (optional, for AI reflection enhancement)

## 🔧 Setup Instructions

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to initialize
3. Go to **Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - Anon Public Key → `VITE_SUPABASE_ANON_KEY`

### 2. Initialize Database

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy contents of `supabase/migrations/001_init.sql` and paste
4. Click **Run**
5. Go to **Authentication → Settings** and enable Email authentication

### 3. Clone & Setup Project Locally

```bash
# Clone the repository
git clone https://github.com/yourusername/TimeplanEz.git
cd TimeplanEz

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Add your Supabase credentials to .env.local
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Locally

```bash
npm run dev
```

App will open at `http://localhost:3000`

### 5. (Optional) Setup OpenAI Integration

1. Get your OpenAI API key from https://platform.openai.com/account/api-keys
2. Add to `.env.local`:
   ```
   VITE_OPENAI_API_KEY=sk-your-key
   ```
3. Create Supabase Edge Function for AI enhancement (see `supabase/functions/enhance-reflection.ts`)

### 6. Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push code:
   ```bash
   git remote add origin https://github.com/yourusername/TimeplanEz.git
   git push -u origin main
   ```
3. Go to **Settings → Pages** and set source to `Deploy from a branch`, branch `main`, folder `/dist`
4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

5. Commit & push - GitHub Actions will automatically deploy
6. Your app will be live at `https://yourusername.github.io/TimeplanEz`

## 📱 Install as PWA

### On Desktop (Chrome/Edge)
1. Visit the app URL
2. Click the install icon in the address bar (or use menu)
3. Choose "Install app"

### On Mobile (iOS/Android)
1. Open in mobile browser
2. Tap menu (⋮) → "Add to Home Screen" or "Install"
3. Tap "Add" to confirm

## 🎯 Usage

### Logging Hours

1. Navigate to **Log Hours**
2. Select **date** and enter **hours worked**
3. Choose **category** (General, Tutoring, Event, etc.)
4. Select **paid status**:
   - **Auto** - calculated based on school hours per week setting
   - **Paid** - marked as paid work
   - **Unpaid** - marked as school hours (won't count towards earnings)
5. Add optional notes
6. Click **Log Hours**

### Understanding Paid vs Unpaid

- **School Hours:** First X hours per week (configurable, default 20) = unpaid
- **Paid Hours:** Any hours beyond school quota = paid (counted in earnings)
- **Manual Override:** You can manually mark any shift as paid/unpaid

Example: If your school quota is 20h/week and you log:
- Mon 8h (unpaid - total unpaid: 8h)
- Tue 8h (unpaid - total unpaid: 16h)
- Wed 8h (unpaid - total unpaid: 24h) → Since 24h > 20h, this is marked as **PAID** (4h paid)
- Wed 4h (paid - manually marked)

### Tracking Earnings

1. Go to **Settings** and set your **hourly rate** and **currency**
2. Paid hours × hourly rate = monthly earnings
3. View in **Dashboard** or **Analytics**

### Analytics & Reports

1. Go to **Analytics**
2. Select a month using navigation buttons
3. View:
   - Total hours, paid/unpaid split
   - Daily breakdown chart
   - Category breakdown (pie chart)
   - Earnings summary
   - Shift table
4. Click **Export Data** to download CSV

## 🎨 Customization

### Change Theme Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  primary: { ... }, // Change app colors
}
```

### Adjust School Hours Default

Edit `src/store/index.ts` - change default in `useSettingsStore`

### Add New Categories

Edit `src/pages/LogHoursPage.tsx` - add options to category `<select>`

## 🔒 Security & Privacy

- ✅ Supabase Row-Level Security (RLS) - users only see their own data
- ✅ All data encrypted in transit (HTTPS)
- ✅ No tracking, no ads, fully open-source
- ✅ Data stays in your Supabase project
- ✅ OAuth2 authentication via Supabase

## 📊 Database Schema

```
users
  ├─ id, email, school_hours_per_week, hourly_rate, currency
  ├─ theme, notifications_enabled, email_digest_enabled
  └─ created_at, updated_at

shifts
  ├─ id, user_id, date, hours_worked
  ├─ paid (boolean | null), category, notes
  ├─ reflection, enhanced_reflection
  └─ created_at, updated_at

weekly_config
  ├─ id, user_id, week_start
  ├─ school_hours (override for specific week)
  └─ created_at, updated_at

recurring_shifts (for templates)
  ├─ id, user_id, name, description
  ├─ days_of_week, hours_per_day, category, paid_status
  ├─ is_active
  └─ created_at, updated_at
```

## 🚀 Deployment Troubleshooting

### Issue: "Cannot find module"
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then reinstall

### Issue: Supabase not connecting
- Check `.env.local` has correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Verify Supabase project is active
- Check RLS policies are enabled

### Issue: GitHub Pages showing 404
- Verify repository is public
- Check Settings → Pages shows `/dist` folder
- Ensure build succeeded (check GitHub Actions)

## 📝 Planned Features (Phase 7+)

- [ ] Team/shared workspace support
- [ ] Advanced payroll integration
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Vacation/sick day tracking
- [ ] Performance improvements (offline-first sync)

## 📄 License

Open source - feel free to use, modify, and share!

## 🤝 Contributing

Found a bug or have a feature request? Open an issue or submit a pull request!

## 📧 Support

For questions, email timeplanez@example.com or open an issue on GitHub.

---

**Built with ❤️ to make time tracking sleek and easy**
