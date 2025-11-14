# GM Design Portal

Internal web portal for GM Design, a cabinet and countertop company.  
The portal provides secure authentication and a dashboard shell where we can plug in business modules such as slab price lists and internal tools.

## 🚀 Tech Stack

- **Framework:** Next.js (App Router) + React
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom theme + Inter font)
- **Auth:** NextAuth (App Router)  
- **ORM:** Prisma
- **Database:** (configurable via Prisma, e.g. PostgreSQL)
- **Design System:** Atomic Design (atoms, molecules, organisms, templates)

---

## ✨ Features

- User registration, login, and logout
- Password reset & confirmation flows
- Protected dashboard area for authenticated users
- Shared dashboard layout with sidebar + top navbar
- Slab price list page (`/slabsPriceList`) as a starting business module
- Atomic Design-based component structure for scalable UI
- Centralized Prisma client and auth utilities

---

## 🗂 Project Structure

```txt
src/
  app/
    layout.tsx              # Root layout (global HTML/body)
    page.tsx                # Landing / root page

    api/
      auth/
        [...nextauth]/route.ts    # NextAuth handler
        register/route.ts         # Registration API
        reset/route.ts            # Password reset API
        reset/confirm/route.ts    # Reset confirmation API

    login/
      page.tsx
      ui/
        LoginForm.tsx

    register/
      page.tsx
      ui/
        RegisterForm.tsx

    reset/
      page.tsx
      ui/
        ResetPasswordForm.tsx
      confirm/
        page.tsx
        ResetConfirmForm.tsx

    dashboard/
      layout.tsx            # Dashboard layout shell
      page.tsx              # Dashboard main page

    slabsPriceList/
      page.tsx              # Slab price list page

  components/
    atoms/                  # Small, reusable building blocks
      index.ts
    molecules/              # Compositions of atoms
      index.ts
    organisms/
      index.ts              # Re-exports Navbar, Sidebar, etc.
      Navbar/
        Navbar.tsx
        NavbarClient.tsx
      Sidebar/
        Sidebar.tsx
      auth/
        index.tsx
    templates/
      AuthPageTemplate/
        AuthPageTemplate.tsx
      DashboardLayoutTemplate/
        DashboardLayoutTemplate.tsx
    pages/
      slabsPriceList/       # Page-level components for slabs

  context/
    SidebarContext.tsx      # Sidebar open/close state

  lib/
    auth.ts                 # Auth helpers / config
    prisma.ts               # Prisma client singleton

  prisma/
    schema.prisma           # Database schema

  styles/
    globals.css             # Tailwind + base styles

public/
  logo.svg                  # Brand logo

tailwind.config.ts          # Tailwind configuration
tsconfig.json               # TypeScript config (with path aliases)
