# Task Management Application

A full-stack task management application with a Next.js frontend, Express backend, and PostgreSQL database.

## Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for the database)

## Setup

1. **Start the Database**
   ```bash
   docker-compose up -d
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev --name advanced_features
   npx prisma db seed
   npm run dev
   ```
   > **Note on Admin Role:** The `npx prisma db seed` command automatically generates a test administrator account. You can log in at any time using **Email:** `admin@admin.com` | **Password:** `password123` to review the Role-Based Admin UI!

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
