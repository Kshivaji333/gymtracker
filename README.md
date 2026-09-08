# GymTracker — Personal Nutrition & Training Tracker

A mobile-first web app for tracking daily nutrition, micro-drills, and combat-sport mastery progress.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth)

---

## Setup — follow these steps in order

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning.

### 2. Run the database schema

1. In your Supabase dashboard, open the **SQL Editor**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Click **Run**. This creates all tables, indexes, RLS policies, and a trigger that auto-seeds default foods for every new user.
4. Safe to run again — every statement is idempotent.

### 3. Copy your project credentials

1. In the Supabase dashboard, go to **Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.

### 4. Set environment variables in Vercel

1. Go to your Vercel project → **Settings → Environment Variables**.
2. Add these two variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

### 5. Deploy

Push this repo to GitHub and connect it to Vercel. The build will run automatically.

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/gymtracker.git
git push -u origin main
```

That's it. The app is live.

---

## Local development

```bash
# Copy env vars
cp .env.example .env.local
# Fill in your Supabase URL and anon key in .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout (Inter font, dark mode)
│   ├── login/page.tsx       # Sign in
│   ├── signup/page.tsx      # Sign up
│   └── (app)/               # Authenticated routes
│       ├── layout.tsx       # Bottom nav wrapper
│       ├── page.tsx         # Today (home screen)
│       ├── foods/page.tsx   # Food library management
│       ├── history/page.tsx # 30-day history, charts, weigh-ins
│       ├── drills/page.tsx  # Daily micro-drills
│       ├── mastery/page.tsx # Permanent skill progress
│       └── settings/page.tsx # Targets, bodyweight, theme
├── components/
│   └── BottomNav.tsx        # Tab bar
├── lib/
│   ├── constants.ts         # Drills, weapons, slot config
│   ├── date.ts              # Local-timezone date utilities
│   ├── types.ts             # TypeScript types (zero `any`)
│   └── supabase/
│       ├── client.ts        # Browser client
│       ├── server.ts        # Server client
│       └── proxy.ts         # Session refresh helper
├── proxy.ts                 # Auth proxy (Next.js 16)
supabase/
└── schema.sql               # One-file DB setup
```

---

## Key design decisions

- **Entries are snapshots.** When you log a food, its name, kcal, and protein are copied into the entry. Past entries are never affected by editing a food.
- **Optimistic updates.** Tapping a stepper updates the UI instantly, then writes to Supabase with a 400 ms debounce.
- **Local-time dates.** A day rolls over at midnight in your timezone, not UTC.
- **Mobile-first.** All tap targets ≥ 44 px. Bottom tab navigation. Dark and light mode.
