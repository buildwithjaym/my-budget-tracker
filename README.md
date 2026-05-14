# MyBudget: Personal Expense Tracking and Budget Alert System

## BS Computer Science Thesis Project

MyBudget is a modern personal finance web application designed to help users manage income, expenses, monthly budgets, spending behavior, and financial monitoring through a connected budgeting workflow.

The system was developed using:
- Next.js
- TypeScript
- Supabase
- PostgreSQL
- Tailwind CSS
- Recharts
- Lucide React
- Sonner Toast Notifications

Unlike traditional expense trackers that only store financial records, MyBudget connects Transactions, Budgets, Dashboard Analytics, Reports, Alerts, and Expense History into one integrated financial management system.

The application focuses on:
- Practical budgeting
- Real-time financial monitoring
- Connected budget calculations
- Modern responsive UI/UX
- Financial awareness
- Expense transparency

---

# Project Information

| Category | Details |
|---|---|
| Project Title | MyBudget: Personal Expense Tracking and Budget Alert System |
| Project Type | BS Computer Science Thesis Project |
| System Type | Web Application |
| Deployment Platform | Vercel |
| Mobile Wrapper Support | Median.co |
| Frontend Framework | Next.js App Router |
| Backend Service | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Styling | Tailwind CSS |
| Charts & Analytics | Recharts |
| Notifications | Sonner |
| Icons | Lucide React |

---

# Project Overview

Many individuals struggle with managing finances because:
- Expenses are not monitored properly
- Budgets are manually computed
- Financial records are scattered
- Overspending is detected too late
- Spending history is difficult to analyze

Most simple expense trackers only allow users to save records without connecting expenses to actual budgets.

MyBudget solves this problem by providing:
- Connected budgeting logic
- Automatic budget calculations
- Expense tracking
- Financial analytics
- Smart alerts
- Spending history monitoring
- Downloadable financial reports

The system creates a centralized financial management platform where users can:
- Track income
- Record expenses
- Create monthly budgets
- Monitor spending progress
- Review expense history
- Receive alerts
- Analyze financial behavior
- Export reports

---

# Main Goal of the System

The goal of MyBudget is to provide users with a practical, responsive, and user-friendly budgeting system that improves financial awareness and spending management.

The project focuses on:
- Connected financial workflows
- Automated monitoring
- Responsive modern interface
- Financial summaries
- Budget history tracking
- Smart financial alerts

---

# Why This System Is Needed

Many existing budgeting methods are ineffective because:
- Expenses are not tracked consistently
- Spending records are scattered
- Budgets are manually monitored
- Users only realize overspending after it happens
- Expense history is difficult to review

MyBudget addresses these problems through:
- Real-time budget monitoring
- Automatic budget calculations
- Expense history viewing
- Budget-connected transactions
- Category synchronization
- Financial analytics
- Downloadable reports

The system encourages users to become more financially aware and organized.

---

# Core Features

## 1. Budget ↔ Transaction Connection

This is the strongest and most important feature of the system.

Transactions and Budgets are directly connected through:
- Category
- Month
- Year

Example:

```txt
Food expense for May 2026
→ automatically affects Food budget for May 2026
```

This allows:
- Real-time budget updates
- Automatic calculations
- Live budget progress
- Financial tracking
- Budget analytics
- Accurate reports

The system behaves like a real budgeting platform instead of isolated CRUD modules.

---

## 2. Real-Time Budget Monitoring

Budgets automatically update whenever:
- Expenses are added
- Expenses are edited
- Expenses are deleted

Users can instantly see:
- Used budget
- Remaining budget
- Budget percentage
- Warning levels
- Exceeded budgets

Formula:

```txt
budget usage = (expenses used / budget amount) × 100
```

Alert levels:

```txt
Below 80% = Safe
80% to 99% = Warning
100% and above = Exceeded
```

---

## 3. Expense History Monitoring

One of the most important improvements in the system is the Expense History functionality.

Users can:
- View connected expenses
- Review spending history
- Analyze category expenses
- Monitor spending behavior
- See which transactions affected a budget

Example workflow:

```txt
Food Budget
→ View connected Food expenses
→ View expense amounts
→ View expense dates
→ View remaining budget
→ Review overspending history
```

The Expense History modal provides:
- Connected transaction viewing
- Category expense transparency
- Real-time spending analysis

This feature makes the budgeting workflow more realistic and useful.

---

## 4. Smart Budget Alerts

The system automatically detects:
- Near-limit budgets
- Exceeded budgets
- Categories without budgets

Alerts appear in:
- Dashboard
- Budget cards
- Reports
- Expense History
- Transaction indicators

This helps users identify financial problems earlier.

---

## 5. Dashboard Analytics

The dashboard provides a complete financial overview.

Dashboard features include:
- Total Income KPI
- Total Expenses KPI
- Remaining Balance KPI
- Budget alerts
- Recent transactions
- Financial summaries
- Budget analytics
- Expense analytics
- Spending insights

Dashboard improvements:
- Removed unnecessary KPI cards
- Cleaner financial hierarchy
- Improved mobile responsiveness
- Better visual summaries
- Improved financial readability

---

## 6. Custom Categories

Users are not limited to predefined categories.

Features include:
- Custom category creation
- Category synchronization
- Reusable categories
- Budget-connected categories

Example:

```txt
Custom category created in Budgets
→ automatically appears in Transactions
```

This improves flexibility and personalization.

---

## 7. Reports and CSV Export

The Reports module generates downloadable financial summaries.

Reports include:
- Monthly summaries
- Category analytics
- Budget summaries
- Transaction summaries
- Financial insights
- Budget status monitoring

CSV export supports:
- Dynamic report generation
- Downloadable files
- User-based filenames
- Monthly report formatting

Example filename:

```txt
juan-dela-cruz-report-2026-05.csv
```

---

## 8. Responsive Modern UI/UX

The system was redesigned to provide a modern financial application experience.

Improvements include:
- Responsive layouts
- Mobile-friendly modals
- Improved dashboard cards
- Better action buttons
- Improved table responsiveness
- Better modal scrolling
- Smoother transitions
- Improved financial hierarchy
- Responsive charts

The design uses a dark emerald finance theme focused on:
- Readability
- Accessibility
- Professionalism
- Modern UI design

---

## 9. Toast Notifications

The system provides user feedback through toast notifications.

Examples include:
- Successful transaction creation
- Budget updates
- CSV downloads
- Delete confirmations
- Validation warnings
- Financial alerts

This improves usability and interaction feedback.

---

## 10. Financial Analytics

The system provides financial analytics and insights.

Analytics include:
- Total income
- Total expenses
- Remaining balance
- Highest expense category
- Highest income category
- Category summaries
- Budget percentages
- Spending trends

These analytics appear in:
- Dashboard
- Reports
- Budget summaries
- Expense History

---

# Main Modules

| Rank | Module | Main Purpose |
|---|---|---|
| 1 | Budget ↔ Transaction Connection | Real-time budget monitoring |
| 2 | Expense History System | View connected expenses |
| 3 | Dashboard Analytics | Financial overview |
| 4 | Budget Monitoring | Spending management |
| 5 | Smart Alerts | Overspending prevention |
| 6 | Reports & CSV Export | Monthly financial summaries |
| 7 | Custom Categories | Flexible budgeting |
| 8 | Responsive UI/UX | Better user experience |
| 9 | Authentication | Secure user access |
| 10 | Profile Management | User customization |

---

# System Architecture

## Frontend Layer

The frontend was developed using:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React

Responsibilities:
- Rendering UI
- Financial dashboards
- Charts and analytics
- Responsive layouts
- Modal handling
- Toast notifications
- Transaction management

---

## Backend Layer

The backend services are managed using Supabase.

Responsibilities:
- Authentication
- Database interaction
- Session management
- Row Level Security
- File storage
- API handling

---

## Database Layer

The system uses PostgreSQL through Supabase.

Main tables:
- profiles
- transactions
- budgets

Relationships:

```txt
users
  ↓
transactions
  ↓
budgets
```

Transactions affect Budgets using:
- Category
- Month
- Year matching

---

# Database Structure

## profiles

Stores profile information.

Fields:
- id
- full_name
- avatar_url
- created_at
- updated_at

---

## transactions

Stores income and expense records.

Fields:
- id
- user_id
- type
- amount
- category
- note
- transaction_date
- created_at

Allowed types:
- income
- expense

---

## budgets

Stores monthly category budgets.

Fields:
- id
- user_id
- category
- amount
- month
- year
- created_at

Important rule:

```txt
One budget per category, month, and year.
```

---

# Supabase Security Features

The system uses Supabase security mechanisms including:

## Row Level Security (RLS)

RLS ensures users can only access their own data.

Protected tables:
- profiles
- transactions
- budgets

---

## Authentication

Authentication uses Supabase Auth.

Supported features:
- Login
- Registration
- Protected routes
- Session management

---

## Storage Policies

Avatar uploads are protected using Supabase Storage policies.

Supported file types:
- image/jpeg
- image/png
- image/webp

Storage bucket:

```txt
avatars
```

---

# Transactions Module

Users can:
- Add income
- Add expenses
- Edit transactions
- Delete transactions
- Filter transactions
- Search records
- Add notes
- Create custom categories
- Connect expenses to budgets

Income sources:
- Monthly Salary
- Allowance
- Other Income

Expense categories include:
- Food
- Transportation
- School
- Bills
- Shopping
- Health
- Groceries
- Utilities
- Travel
- Entertainment
- Personal Care
- Custom categories

---

# Budget Module

Features include:
- Monthly budgets
- Budget progress tracking
- Remaining budget calculation
- Safe/Warning/Exceeded status
- Expense history viewing
- Connected transaction tracking
- Real-time monitoring

---

# Expense History Module

The Expense History modal allows users to:
- Review budget-connected expenses
- See transaction dates
- See expense amounts
- Monitor overspending
- Analyze category spending behavior

Expense History improves:
- Transparency
- Monitoring
- Financial awareness
- Spending analysis

This feature is one of the strongest parts of the system.

---

# Reports Module

Features:
- Monthly reports
- Category summaries
- Financial insights
- Budget summaries
- CSV export
- Downloadable reports
- Report filtering

Supports:
- Browser download
- Median.co download integration

---

# Dashboard Module

Dashboard features:
- Financial summaries
- Budget alerts
- Analytics
- Recent transactions
- Charts
- Expense monitoring
- Financial insights

The dashboard focuses on:
- Simplicity
- Readability
- Financial awareness

---

# Median.co Integration

The system supports deployment through:
- Vercel
- Median.co

Median.co support allows:
- Native-like mobile experience
- Webview compatibility
- Report downloads inside the app
- Improved mobile accessibility

CSV downloads support:
- Browser fallback download
- Median native file download

---

# Responsive Design

The application is fully responsive.

Supported devices:
- Mobile phones
- Tablets
- Desktop devices

Responsive improvements include:
- Responsive tables
- Mobile-friendly modals
- Better scrolling
- Responsive charts
- Responsive dashboards

---

# Tech Stack

| Area | Technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | Sonner |
| Hosting | Vercel |
| Mobile Wrapper | Median.co |

---

# Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

# Installation

Clone repository:

```bash
git clone your-repository-url
cd your-project-folder
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production version:

```bash
npm run build
```

---

# System Workflow

```txt
Register/Login
      ↓
Create or update profile
      ↓
Add income and expenses
      ↓
Create monthly budgets
      ↓
Track budget progress
      ↓
Review expense history
      ↓
View dashboard analytics
      ↓
Generate reports
      ↓
Download CSV reports
```

---

# Key Innovations

The strongest innovations of the system are:

1. Connected Budget ↔ Transaction workflow
2. Real-time budget monitoring
3. Expense History viewing
4. Smart financial alerts
5. Category synchronization
6. Financial analytics
7. Responsive dashboard
8. Integrated CSV reporting
9. Modern UI/UX
10. Median.co support

---

# Future Improvements

Possible future improvements:
- PDF report export
- Recurring transactions
- Savings goals
- Advanced analytics
- Offline support
- Push notifications
- Multi-device synchronization
- AI financial insights

---

# Final Summary

MyBudget: Personal Expense Tracking and Budget Alert System is a connected personal finance web application designed to help users monitor spending behavior, manage monthly budgets, and improve financial awareness.

The system combines:
- Transaction management
- Budget monitoring
- Dashboard analytics
- Smart alerts
- Expense history tracking
- Custom category synchronization
- CSV reporting
- Responsive UI/UX
- Secure authentication

into one connected financial workflow.

The project demonstrates:
- Practical financial monitoring
- Connected budgeting logic
- Modern full-stack web development
- Responsive UI/UX design
- Financial analytics
- Secure cloud-based architecture

MyBudget is designed to be practical, responsive, modern, and suitable for real-world personal budgeting needs.