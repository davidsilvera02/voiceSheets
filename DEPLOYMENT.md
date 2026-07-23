# Deploying VoiceSheets (Vercel + Supabase + Clerk)

Recommended stack for a phone-viewable deployment:

- **Hosting:** Vercel (best for Next.js, free Hobby tier, HTTPS URL)
- **Database:** Supabase (Postgres, free tier)
- **Auth:** Clerk (already integrated in the app)
- **AI / speech:** your Anthropic + OpenAI keys

---

## 1. Create the database (Supabase)

1. Sign up at <https://supabase.com> → **New Project** (pick a region and set a database password).
2. Open **Project Settings → Database → Connection string**. You'll use **two** forms of it:
   - **Session pooler** — host `aws-<n>-<region>.pooler.supabase.com`, port `5432` → used to create the schema.
   - **Transaction pooler** — same host, port `6543` → used by the deployed app (serverless-friendly).

> ⚠️ **Don't use the "Direct connection" string.** `db.<ref>.supabase.co` resolves to **IPv6 only**, and most home/office networks can't reach Postgres over IPv6 — you'll get `P1001: Can't reach database server`. Both pooler hostnames are IPv4-friendly, so use those.

> Both strings contain your DB password — treat them as secrets.

## 2. Create the schema in Supabase (one-time, from your machine)

Use the **Session pooler** string (port 5432 — session mode supports the DDL Prisma needs):

```bash
DATABASE_URL="<supabase-session-pooler-string>" npx prisma db push
```

This creates every table. You **don't** need to seed sample data — new accounts automatically get two starter templates on first sign-in.

## 3. Create the auth app (Clerk)

1. Sign up at <https://clerk.com> → **Create application**.
2. Choose sign-in methods (Email + Google is a good start).
3. From **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_…`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_…`)

> The **development** instance keys work on any domain (incl. your Vercel URL) with a small dev badge — perfect for now. Create a **production** instance later if you attach a custom domain.

## 4. Push the code to GitHub

```bash
# In the project folder (already git-initialized):
gh repo create voicesheets --private --source=. --push
# …or create an empty repo on github.com and:
git remote add origin https://github.com/<you>/voicesheets.git
git push -u origin main
```

## 5. Deploy on Vercel

1. Go to <https://vercel.com> → **Add New → Project** → import the GitHub repo.
2. Framework preset **Next.js** is auto-detected. Leave build settings default.
3. Add **Environment Variables** (Production) — see the table below.
4. **Deploy**. You'll get a URL like `https://voicesheets-xxx.vercel.app`.
5. Open that URL on your phone → sign up → you're in. 🎉

### Environment variables to set in Vercel

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** string (port 6543) with `?pgbouncer=true&connection_limit=1` appended |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL (e.g. `https://voicesheets-xxx.vercel.app`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` from Clerk |
| `CLERK_SECRET_KEY` | `sk_test_…` from Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` |
| `OPENAI_API_KEY` | your OpenAI key (for Whisper) |
| `WHISPER_MODEL` | `whisper-1` |
| `VOICESHEETS_FORCE_DEV_AUTH` | `false` |

> After the first deploy, set `NEXT_PUBLIC_APP_URL` to the real URL and redeploy if it wasn't known upfront.

---

## Notes

- **Voice on phone:** microphone capture requires HTTPS — Vercel provides it, so it works on your phone.
- **Redeploys:** every `git push` to `main` auto-deploys.
- **Schema changes later:** re-run `DATABASE_URL="<supabase-session-pooler>" npx prisma db push` (the 5432 pooler string).
- **Why two connection strings?** `db push` needs *session* mode (5432) for DDL; serverless functions on Vercel should use the *transaction* pooler (6543, `pgbouncer=true`) to avoid exhausting Postgres connections.
- **Secrets:** `.env` is gitignored; only `.env.example` (empty placeholders) is committed. Never put real keys in `.env.example`.
