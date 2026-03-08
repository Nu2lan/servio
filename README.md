# Servio — Restaurant Ordering System

A production-ready restaurant ordering system with **4 role-based modules**: Waiter, Kitchen, Cashier, and Admin Panel. Features real-time order updates via Socket.IO, JWT authentication, and strict role-based access control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS 3, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.IO |
| Auth | JWT + bcrypt |
| Deploy | Docker + Docker Compose |

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB running locally (or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Backend

```bash
cd backend
cp .env.example .env    # Edit .env if needed
npm install
npm run dev
```

The backend starts on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` with API proxy to backend.

## Quick Start (Docker)

```bash
docker-compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- MongoDB: `localhost:27017`

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | Admin | Admin123! |
| Cashier | Cashier | Cashier1234 |

> **Waiter** and **Kitchen** users are created from the Admin Panel → Users section.

## Modules

### 🍽️ Waiter Module
- Login with assigned username
- View menu item **names only** (no prices)
- Select table number, add items with quantities
- Confirm orders → sent to Kitchen & Cashier in real-time
- View own confirmed orders (no prices)

### 👨‍🍳 Kitchen Module
- View confirmed orders in real-time
- See table number, items, quantities
- **No prices, totals, or inventory data**

### 💰 Cashier Module
- View all orders with prices and totals
- Mark orders as paid / unpaid
- Revenue and pending totals

### ⚙️ Admin Panel
- **Menu Management**: Add/edit/delete menu items (name, price, portion qty)
- **Inventory Management**: View/edit stock levels (auto-deducted on orders)
- **User Management**: Create/edit/delete staff users with role assignment
- **Reports**: Order history and inventory usage logs

## Business Rules

1. When a waiter confirms an order, inventory is automatically deducted based on portion quantities
2. Inventory data is **only visible** in the Admin Panel
3. Prices are **only visible** to Cashier and Admin roles
4. All API routes are protected by JWT + role-based middleware

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route handlers
│   │   ├── middleware/      # Auth & authorization
│   │   ├── socket.ts        # Socket.IO setup
│   │   ├── seed.ts          # Default user seeding
│   │   └── server.ts        # Entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── context/         # Auth context
│   │   ├── lib/             # API client, socket client
│   │   └── pages/           # Module pages
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | Backend server port |
| `MONGODB_URI` | `mongodb://localhost:27017/restaurant` | MongoDB connection string |
| `JWT_SECRET` | (see .env) | Secret key for JWT signing |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
