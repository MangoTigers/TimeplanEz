-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  school_hours_per_week NUMERIC(5, 2) NOT NULL DEFAULT 20,
  hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 120.00,
  currency TEXT NOT NULL DEFAULT 'NOK',
  theme TEXT DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT true,
  email_digest_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Shifts table (work hours log)
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours_worked DECIMAL(5, 2) NOT NULL,
  paid BOOLEAN, -- NULL means auto-calculate based on rule
  category TEXT DEFAULT 'General',
  notes TEXT,
  reflection TEXT,
  enhanced_reflection TEXT, -- AI-enhanced reflection
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Weekly config (override school hours for specific weeks)
CREATE TABLE weekly_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  school_hours DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start)
);

-- Recurring shifts template
CREATE TABLE recurring_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  days_of_week TEXT NOT NULL, -- JSON array: [1,2,3,4,5] for Mon-Fri
  hours_per_day DECIMAL(5, 2) NOT NULL,
  category TEXT DEFAULT 'General',
  paid_status TEXT DEFAULT 'auto', -- 'auto', 'paid', 'unpaid'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_shifts_user_date ON shifts(user_id, date);
CREATE INDEX idx_shifts_paid ON shifts(paid);
CREATE INDEX idx_weekly_config_user_id ON weekly_config(user_id);
CREATE INDEX idx_recurring_shifts_user_id ON recurring_shifts(user_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_shifts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Shifts policies
CREATE POLICY "Users can read own shifts"
  ON shifts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create shifts"
  ON shifts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shifts"
  ON shifts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shifts"
  ON shifts FOR DELETE
  USING (auth.uid() = user_id);

-- Weekly config policies
CREATE POLICY "Users can read own weekly config"
  ON weekly_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create weekly config"
  ON weekly_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly config"
  ON weekly_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Recurring shifts policies
CREATE POLICY "Users can read own recurring shifts"
  ON recurring_shifts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create recurring shifts"
  ON recurring_shifts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring shifts"
  ON recurring_shifts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring shifts"
  ON recurring_shifts FOR DELETE
  USING (auth.uid() = user_id);
