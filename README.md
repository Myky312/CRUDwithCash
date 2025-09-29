# CRUD with Caching (NestJS, TypeORM, Postgres, Redis)

This project is a robust RESTful API built with **NestJS**, implementing CRUD operations for articles with user authentication (JWT) and a caching layer powered by **Redis**. Data persistence is handled by **PostgreSQL** via **TypeORM**.

---

## 🛠️ Tech Stack

- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL (via TypeORM)
- **Caching:** Redis (using `ioredis`)
- **Authentication:** Passport/JWT
- **Environment:** Docker (Recommended for easy setup)

---

## 🚀 Getting Started

Follow these steps to run the project locally.

### Prerequisites

You need the following installed:

- **Node.js** (v18+)
- **npm**
- **Docker** and **Docker Compose** (Highly recommended)

---

### 1. Environment Setup

Create a `.env` file in the root directory and copy the contents from `.env.sample`. Example:

```env
DB_HOST=localhost
DB_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=supersecret
POSTGRES_DB=hospitals

PGADMIN_DEFAULT_EMAIL=admin@hospitals.com
PGADMIN_DEFAULT_PASSWORD=supersecretadmin

JWT_SECRET=myjwtsecret
PORT=3000
```

---

### 2. Database and Redis Setup

Start PostgreSQL, Redis, and PgAdmin using Docker Compose.

1. Build and run containers in the background:

```bash
docker-compose up -d
```

2. Verify containers are running:

```bash
docker ps
```

- PostgreSQL → port `5433`
- Redis → port `6379`
- PgAdmin → port `8080`

3. (Optional) Access PgAdmin:

```
http://localhost:8080
Email: admin@hospitals.com
Password: supersecretadmin
```

---

### 3. Install Project Dependencies

```bash
npm install
```

---

### 4. Database Migrations

Apply database migrations:

```bash
npm run migration:run
```

Generate a new migration:

```bash
npm run migration:generate -- --name=MyNewMigration
```

Revert the last migration:

```bash
npm run migration:revert
```

---

### 5. Run the NestJS Application

#### Development Mode (hot reload)

```bash
npm run start:dev
```

API will be available at:

```
http://localhost:3000
```

#### Production Mode

1. Build the project:

```bash
npm run build
```

2. Start the compiled application:

```bash
npm run start:prod
```

---

## 💻 Available Scripts

| Command                                               | Description                                  |
| ----------------------------------------------------- | -------------------------------------------- |
| `npm run start`                                       | Starts the production-ready code.            |
| `npm run start:dev`                                   | Starts the app with hot-reload.              |
| `npm run start:prod`                                  | Builds and runs the app from `dist` folder.  |
| `npm run build`                                       | Compiles TypeScript to JavaScript in `dist`. |
| `npm run test`                                        | Runs all unit and integration tests.         |
| `npm run test:watch`                                  | Runs tests in watch mode.                    |
| `npm run test:cov`                                    | Runs tests with coverage report.             |
| `npm run format`                                      | Formats code using Prettier.                 |
| `npm run lint`                                        | Lints code with ESLint.                      |
| `npm run lint:fix`                                    | Lints and auto-fixes issues.                 |
| `npm run migration:generate -- --name=MyNewMigration` | Creates a new TypeORM migration file.        |
| `npm run migration:run`                               | Runs all pending migrations.                 |
| `npm run migration:revert`                            | Reverts last executed migration.             |

---

## 🧪 Testing

This project uses **Jest** for unit and integration tests. Repository mocking is used, so tests can run without a live database.

- Run all tests:

```bash
npm run test
```

- Run tests with coverage:

```bash
npm run test:cov
```

---

## 🗑️ Cleanup

To stop and remove all Docker containers:

```bash
docker-compose down
```
