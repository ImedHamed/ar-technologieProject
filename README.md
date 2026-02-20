# POI FTTH Management System

A comprehensive project management system for tracking POI (Point of Installation) FTTH (Fiber to the Home) study files across multiple clients and regions.

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Material-UI (MUI)** for professional UI components
- **React Router** for navigation
- **TanStack Query** for data fetching and caching
- **Zustand** for state management
- **React Hook Form + Zod** for form validation
- **Recharts** for data visualization

### Backend
- **Node.js 20** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** for data persistence
- **Redis** for caching (planned)
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Helmet** for security headers

## 📁 Project Structure

```
imed/
├── frontend/          # React frontend application
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node.js backend API
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── controllers/ # Route controllers
│   │   ├── middleware/  # Custom middleware
│   │   ├── models/      # Database models
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── utils/       # Utility functions
│   │   ├── types/       # TypeScript types
│   │   └── server.ts    # Entry point
│   ├── uploads/       # File uploads directory
│   ├── logs/          # Application logs
│   └── package.json
└── README.md
```

## 🛠️ Installation

### Prerequisites
- Node.js 20 or higher
- PostgreSQL 16
- Redis 7 (optional for caching)
- Git

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies (already done):
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
   - Database credentials
   - JWT secret
   - Redis connection (if using)

5. Start development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🎯 Features

### Phase 1 (Current - Foundation)
- ✅ Project structure setup
- ✅ TypeScript configuration
- ✅ Basic Express server

### Phase 2 (Planned)
- POI file management (CRUD)
- File listing with filters
- Stage progression tracking
- Assignment system

### Phase 3-8 (Roadmap)
See [Technical Proposal](../brain/372286d7-a7c7-413e-81b5-a3a05ae6dbff/technical_proposal.md) for complete roadmap

## 🔐 User Roles

1. **Administrator** - Full system access
2. **Manager** - High-level oversight
3. **Business Manager** - Client relationship management
4. **Study Manager** - Study execution oversight
5. **Technician** - Technical execution
6. **Read-Only** - View-only access

## 📊 Database Schema

The system uses PostgreSQL with the following main entities:
- Users & Roles
- Clients & Projects
- Regions
- POI Files
- File History & Audit Logs
- Attachments & Comments
- Alerts

## 🚀 Available Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build



**Project Start Date:** February 15, 2026  
**Estimated Completion:** August 2026 (6 months)
