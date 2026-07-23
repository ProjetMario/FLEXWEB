# FlexWeb SaaS Platform

Multi-tenant platform built with Next.js 16, TypeScript, Prisma 7, Auth.js, Supabase and Tailwind CSS.

## Features

- Multi-tenant architecture (subdomain / custom domain)
- Role-based access control (Super Admin, Admin, Editor)
- Organization management
- Website page builder with reusable blocks
- Public site rendering per tenant
- Authentication via credentials + OAuth (Google, Microsoft)

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Generate the Prisma client:
   ```bash
   npm run db:generate
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. (Optional) Seed the database with demo data:
   ```bash
   npx prisma db seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Demo accounts (seed)

- Super admin: `super@flexweb.local` / `Password123!`
- Demo admin: `admin@demo.local` / `Password123!`

## Useful commands

- `npm run dev` – start the dev server
- `npm run build` – build the application
- `npm run lint` – run ESLint
- `npm run db:generate` – generate Prisma client
- `npm run db:migrate` – apply database migrations
- `npm run db:studio` – open Prisma Studio

## Project structure

```
app/
  (auth)/         Login / register pages
  (dashboard)/    Admin dashboard
  (public)/       Public site rendering
  api/auth/       Auth.js API route
components/
  forms/          React Hook Form + Zod forms
  public/blocks/  Public page block renderers
  ui/             shadcn/ui components
lib/
  actions/        Server Actions
  prisma.ts       Prisma client with pg adapter
  tenant.ts       Tenant resolution helpers
  zod/            Validation schemas
prisma/
  schema.prisma   Database schema
  seed.ts         Seed script
auth.ts           Auth.js configuration
proxy.ts          Request proxy / tenant routing
```

## Notes

- Prisma 7 no longer stores the database URL in `schema.prisma`. Connection settings are configured via the `PrismaPg` driver adapter in `lib/prisma.ts` and `prisma.config.ts`.
- The proxy file (formerly `middleware.ts`) is now `proxy.ts` in Next.js 16.
