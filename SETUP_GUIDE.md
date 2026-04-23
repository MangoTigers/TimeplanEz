# SETUP_GUIDE.md

# TimeplanEz - Complete Setup Guide

This guide will walk you through setting up TimeplanEz completely from scratch.

## Step 1: Create Supabase Project (5 minutes)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up or log in
4. Click "New Project"
5. Fill in:
   - **Name:** TimeplanEz
   - **Database Password:** (save this somewhere safe!)
   - **Region:** Europe (Southeast) - Oslo, Norway (or closest to you)
6. Click "Create new project" and wait for it to initialize

## Step 2: Get Supabase Credentials (2 minutes)

1. Once project is created, go to **Settings → API** (bottom left menu)
2. Copy these values:
   - **Project URL** - looks like `https://xxxxxxxxxxxx.supabase.co`
   - **Anon Public Key** - long string starting with `eyJ...`
3. Keep these safe - you'll need them next

## Step 3: Setup Database (3 minutes)

1. In Supabase, go to **SQL Editor** (left menu)
2. Click **New Query**
3. Paste the entire contents of this file: `supabase/migrations/001_init.sql`
4. Click **Run** (blue button, top right)
5. Wait for success message

## Step 4: Clone & Configure Project (10 minutes)

### 4.1 Clone this repository

```bash
# Using Git
git clone https://github.com/yourusername/TimeplanEz.git
cd TimeplanEz

# OR download as ZIP and extract
```

### 4.2 Create environment file

1. In the project root, create a file called `.env.local`
2. Copy this content:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Replace:
   - `your-project-id.supabase.co` with your Project URL from Step 2
   - `your-anon-key-here` with your Anon Public Key from Step 2

Example:
```
VITE_SUPABASE_URL=https://xyzabc123def456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.3 Install dependencies

```bash
npm install
```

This will take 2-3 minutes. You'll see some warnings - these are normal.

## Step 5: Run Locally (2 minutes)

```bash
npm run dev
```

Your browser should open at `http://localhost:3000`

## Step 6: Test the App (5 minutes)

1. **Sign up:** Click "Don't have an account? Sign up"
   - Email: `test@example.com`
   - Password: `Test123456!` (min 8 chars)
   - Click "Sign Up"
   - **Check your email** for confirmation link (check spam folder)
   - Click the confirmation link in email
   - Go back to app and log in

2. **Log Hours:**
   - Click "Log Hours"
   - Select today's date
   - Enter `8` hours
   - Select "Auto" for paid status
   - Click "Log Hours"

3. **View Dashboard:**
   - Click "Dashboard" 
   - You should see your hours displayed

4. **Configure Settings:**
   - Click "Settings"
   - Change "School Hours Per Week" to `20`
   - Set hourly rate to `150`
   - Currency: `NOK`
   - Click "Save Settings"

5. **View Analytics:**
   - Click "Analytics"
   - Make sure your shift appears in the table

## Step 7: Deploy to GitHub Pages (10 minutes)

### 7.1 Create GitHub Repository

1. Go to https://github.com/new
2. Create new repository:
   - Name: `TimeplanEz`
   - Public (required for free pages)
   - Click "Create repository"

### 7.2 Push code to GitHub

```bash
# In your project folder:
git remote add origin https://github.com/yourusername/TimeplanEz.git
git branch -M main
git push -u origin main
```

### 7.3 Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Go to **Pages** (left sidebar)
4. Under "Build and deployment":
   - Source: Select "GitHub Actions"
   - This will automatically build & deploy
5. Wait 2-3 minutes
6. Your app will be live at: `https://yourusername.github.io/TimeplanEz`

## Step 8: (Optional) Setup AI Enhancement

If you want AI to enhance your reflections:

1. Get OpenAI API key:
   - Go to https://platform.openai.com/account/api-keys
   - Click "Create new secret key"
   - Copy the key (you won't see it again)

2. Add to your `.env.local`:
   ```
   VITE_OPENAI_API_KEY=sk-your-key-here
   ```

3. Deploy Edge Function to Supabase:
   - Install Supabase CLI: `npm install -g supabase`
   - Login: `supabase login`
   - Set project: `supabase projects list` (copy project ID)
   - Deploy: `supabase functions deploy enhance-reflection --project-id YOUR_PROJECT_ID`
   - Link OpenAI key in Supabase: Settings → Secrets → Add `OPENAI_API_KEY`

## ✅ You're All Set!

Your TimeplanEz app is now:
- ✅ Running locally at http://localhost:3000
- ✅ Deployed online at https://yourusername.github.io/TimeplanEz
- ✅ Connected to Supabase database
- ✅ Ready to track your hours!

## 🚀 Next Steps

1. **Install as PWA:**
   - Desktop: Click install icon in address bar
   - Mobile: Add to home screen from browser menu

2. **Customize:**
   - Change school hours per week in Settings
   - Set your hourly rate
   - Add recurring shift templates (coming soon)

3. **Share:**
   - Show friends your deployed app
   - Tell them about TimeplanEz!

## 🆘 Troubleshooting

### "Module not found" error
Run again:
```bash
npm install
```

### "Cannot connect to Supabase"
- Check `.env.local` has correct credentials
- Verify Supabase project is active
- Try logging out and back in

### GitHub Pages showing blank page
- Wait 2-3 minutes for GitHub Actions to complete
- Check Actions tab in repo for build errors
- Verify Settings → Pages shows "/dist" folder

### Localhost won't start
```bash
# Kill any process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Then try again:
npm run dev
```

### Email confirmation not arriving
- Check spam/junk folder
- Wait a few minutes
- Try a different email address

---

**Need help?** Open an issue on GitHub or check the README.md for more info!
