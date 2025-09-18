# Coop Food Distribution System

A comprehensive food distribution management system built with Next.js and Supabase for cooperative food distribution operations.

## Features

- **Member Management**: Handle member registrations, eligibility, and order tracking
- **Inventory Management**: Track stock levels, pricing, and item availability
- **Order Processing**: Complete order lifecycle from placement to delivery
- **Branch Operations**: Multi-branch support with branch-specific configurations
- **Admin Dashboard**: Comprehensive administrative tools and reporting
- **Representative Portal**: Tools for field representatives to manage deliveries

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Configure your Supabase credentials and other required variables

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/app` - Next.js app router pages and API routes
- `/components` - Reusable React components
- `/lib` - Utility functions and database connections
- `/migrations` - Database schema and migration files
- `/docs` - Project documentation

## Database

This project uses Supabase as the backend database. Run the migrations in the `/migrations` folder to set up the required database schema.

## Security

The system implements comprehensive security measures including rate limiting, authentication, and data validation. See `/docs/SECURITY_IMPLEMENTATION.md` for details.
