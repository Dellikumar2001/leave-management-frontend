This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PostgreSQL and Prisma Setup

Set `DATABASE_URL` in the root `.env` file to your PostgreSQL connection string. URL-encode reserved characters in the username or password (for example, `@` as `%40`). Create the database named `leave_management` or update the URL to use your database.

Install dependencies and create the Prisma client and database table:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The leave type table starts empty. Leave type list, create, edit, view, and delete actions use Prisma and PostgreSQL; no sample records are inserted.

See [LEAVE-ADMINISTRATION.md](./LEAVE-ADMINISTRATION.md) for Block Leave and Credit Leave database setup, APIs, migrations, balance behavior, blocked-date enforcement, and troubleshooting.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
