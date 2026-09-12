# TaskFlow - Next.js & TypeScript Todo App with SQLite & shadcn/ui

A modern, high-performance, responsive Todo application built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui component library**, and embedded **SQLite** for native persistent data storage.

![Node Version](https://img.shields.io/badge/Node.js-v22.23.2-brightgreen)
![Framework](https://img.shields.io/badge/Next.js-v16.3.4-black)
![UI Library](https://img.shields.io/badge/shadcn%2Fui-latest-black)
![Database](https://img.shields.io/badge/Database-SQLite3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-v5-blue)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4)

---

## 🚀 Features

- ⚡ **Next.js App Router & Server Actions**: Direct server-side data mutations with automatic cache revalidation.
- 🎨 **shadcn/ui Components**: Built with official `Card`, `Button`, `Input`, `Badge`, `Checkbox`, and `Tabs` components.
- 💾 **Embedded SQLite Storage**: Built-in, zero-config persistent storage using `better-sqlite3`.
- 🌌 **Modern Glassmorphic UI**: Gradient background effects, dark mode design system, priority color badges, micro-animations, and responsive layout.
- 🏷️ **Priority Tagging**: Assign tasks with `High`, `Medium`, or `Low` priority badges.
- 🔍 **Real-time Filter & Search**: Instantly filter tasks by status (*All*, *Pending*, *Done*) using `shadcn Tabs` and search title keywords.
- 📊 **Metrics Dashboard**: Track total tasks, pending count, completed count, and dynamic visual progress completion bar.
- 🧹 **Bulk Cleanup**: Easily clear all completed tasks in a single click.

---

## 📋 Prerequisites

- **Node.js**: `v22.23.2` or later (tested on Node v22.23.2).
- **npm**: `10.9.8` or later.

---

## 🛠️ Getting Started

### 1. Clone & Navigate to Directory
```bash
cd todo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start using the application.

### Phone push notifications

The app uses standards-based Web Push with VAPID keys; no Firebase account is required. Copy `.env.example` to `.env` and set the VAPID variables. The repository's local `.env` already has a generated key pair for development, but use a new pair for production:

```bash
npx web-push generate-vapid-keys
```

Set `VAPID_SUBJECT` to an email address you control, for example `mailto:you@example.com`. In your hosting provider, add all three VAPID variables as environment variables; keep `VAPID_PRIVATE_KEY` secret.

Deploy over HTTPS. Each user must log in on their phone and select **Enable alerts** once. On iPhone/iPad, they must first use Safari's **Add to Home Screen** option, then open the installed app and enable alerts. When either user adds or completes a task, the other user's subscribed phone receives a system notification.

---

## 📦 Project Structure

```text
todo/
├── src/
│   ├── app/
│   │   ├── actions.ts       # Next.js Server Actions for SQLite CRUD
│   │   ├── globals.css      # Design system, glassmorphic styles & animations
│   │   ├── layout.tsx       # Root layout configuration
│   │   └── page.tsx         # Main server component application page
│   ├── components/
│   │   ├── ui/              # shadcn/ui component library
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── input.tsx
│   │   │   └── tabs.tsx
│   │   ├── StatsCard.tsx    # Visual metrics header component (shadcn Card)
│   │   ├── TodoForm.tsx     # Form component (shadcn Card, Input, Button)
│   │   └── TodoList.tsx     # List view (shadcn Tabs, Checkbox, Badge, Button)
│   └── lib/
│       ├── db.ts            # SQLite database connection & schema initialization
│       └── utils.ts         # shadcn cn utility function
├── scripts/
│   └── test-db.js           # Automated script for verifying SQLite CRUD operations
├── components.json          # shadcn configuration file
├── todos.db                 # Embedded SQLite database file (created automatically)
├── next.config.ts           # Next.js configuration with serverExternalPackages
├── tsconfig.json            # TypeScript compiler configuration
├── README.md                # Project documentation
└── PROJECT.md               # Technical project specification & architecture guide
```

---

## 🧪 Testing

To verify database schema creation and CRUD operations manually, run:

```bash
node scripts/test-db.js
```

To run TypeScript verification and production build:

```bash
npm run build
```

---

## 📄 License

MIT License. Built for demonstration and productive task management.
