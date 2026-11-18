# OpenJob Consumer

A message consumer service for the [OpenJob RESTful API](https://github.com/fath0ny/OpenJob-RESTful-API) job portal. It listens to a **RabbitMQ** queue, and whenever a candidate applies for a job, it fetches the application details from **PostgreSQL** and sends an email notification to the **job owner** using **Nodemailer**.

This repository is the **consumer** side of the OpenJob message broker setup. The producer (the RESTful API that publishes events when an application is created) lives in the [OpenJob-RESTful-API](https://github.com/fath0ny/OpenJob-RESTful-API) repository.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Message Flow](#message-flow)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Email Notification](#email-notification)
- [Available Scripts](#available-scripts)
- [License](#license)

---

## Features

### Message Broker
- **RabbitMQ consumer** using `amqplib`
- Consumes from the durable queue **`applications:new`**, published by the RESTful API when a new job application is created
- **Minimal payload contract** — the message only contains `{ "application_id": "<id>" }`, so the consumer always reads fresh data from the database
- **Asynchronous processing** — the consumer runs as a standalone worker process, decoupled from the HTTP request lifecycle
- **Flexible connection** — supports a single `AMQP_URL` connection string or individual `RABBITMQ_HOST` / `RABBITMQ_PORT` / `RABBITMQ_USER` / `RABBITMQ_PASSWORD` variables
- **Auto queue declaration** — the queue is asserted as `durable: true` on startup, so it can be created even before the producer publishes

### Email Notification
- **Nodemailer** integration with SMTP credentials loaded from environment variables
- Recipient email is **queried from the database** — never hardcoded
- The email is sent **only to the job owner** (the user who owns the company posting the job), not to the applicant
- Email body includes data pulled from the database:
  - Applicant name
  - Applicant email
  - Application date
  - Job title
- **Failure isolation** — a malformed message, missing application record, or SMTP error is logged and does not crash the consumer process

### Data Access
- **PostgreSQL** access via `pg` connection pool
- Single joined query resolves the applicant, job, company, and job owner in one round trip
- Skips processing gracefully when the referenced application no longer exists

### Developer Experience
- **ES Modules** (`"type": "module"`)
- **Environment configuration** with `dotenv`
- **ESLint** with the Dicoding Academy style config
- **Nodemon** for development auto-restart

---

## Tech Stack

| Category | Technology |
| --- | --- |
| Runtime | Node.js (ES Modules) |
| Message Broker | RabbitMQ (`amqplib`) |
| Email | SMTP via `nodemailer` |
| Database | PostgreSQL |
| DB Client | `pg` (connection pool) |
| Configuration | `dotenv` |
| Tooling | ESLint (`eslint-config-dicodingacademy`), Nodemon, Git |

---

## Architecture

```
.
├── src/
│   ├── consumer.js            # Entry point: connects to RabbitMQ, asserts queue, starts consuming
│   ├── listener.js            # Message handler: parses payload, orchestrates DB lookup + email
│   ├── ApplicationService.js  # PostgreSQL query for application notification data
│   └── MailSender.js          # Nodemailer transport and email composition
├── eslint.config.js
├── package.json
└── .env                       # Not committed
```

### Component Responsibilities

| File | Responsibility |
| --- | --- |
| `src/consumer.js` | Builds the AMQP URL, opens the connection and channel, asserts the `applications:new` queue, and registers `listener.listen` as the consumer callback |
| `src/listener.js` | Parses the message, calls `ApplicationService`, then `MailSender`; catches and logs all errors |
| `src/ApplicationService.js` | Runs the joined SQL query and returns the notification payload for one application |
| `src/MailSender.js` | Creates the Nodemailer SMTP transport and sends the notification email |

---

## Message Flow

```
┌──────────────────────┐        publish         ┌──────────────┐
│  OpenJob RESTful API │ ─────────────────────► │   RabbitMQ   │
│  (producer)          │  applications:new      │  (durable)   │
└──────────────────────┘  { application_id }    └──────┬───────┘
                                                       │ consume
                                                       ▼
                                              ┌──────────────────┐
                                              │ OpenJob Consumer │
                                              └────────┬─────────┘
                                                       │ SELECT joined data
                                                       ▼
                                              ┌──────────────────┐
                                              │    PostgreSQL    │
                                              └────────┬─────────┘
                                                       │ applicant + job + owner
                                                       ▼
                                              ┌──────────────────┐
                                              │  SMTP / Mailer   │
                                              │  → job owner     │
                                              └──────────────────┘
```

1. A candidate applies for a job via `POST /applications` on the RESTful API.
2. The API publishes `{ "application_id": "<id>" }` to the durable `applications:new` queue.
3. This consumer receives the message and queries PostgreSQL for the application, applicant, job, company, and owner data.
4. If the application exists, it composes and sends a notification email to the job owner.
5. Errors at any step are caught and logged without stopping the consumer.

---

## Getting Started

### Prerequisites

- Node.js 18+ (ES Modules support)
- RabbitMQ
- PostgreSQL with the OpenJob schema and data (run the migrations from the RESTful API repository)
- An SMTP server or account for sending email

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/fath0ny/OpenJob-Consumer.git
cd OpenJob-Consumer

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env   # or create .env manually
# then edit .env with your local credentials

# 4. Start the consumer
npm run start:dev
```

The consumer has no HTTP server; it is a long-running worker process. A successful start means it connected to RabbitMQ and is waiting for messages on `applications:new`.

### Testing the Flow

1. Start RabbitMQ and PostgreSQL.
2. Start this consumer.
3. Start the OpenJob RESTful API and create a job application (`POST /applications`) while authenticated.
4. The job owner should receive the notification email, and the consumer logs the Nodemailer result to the console.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL (read by pg's default environment handling)
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=openjob
PGHOST=localhost
PGPORT=5432

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# Optional: single AMQP connection string (takes precedence over RABBITMQ_*)
# AMQP_URL=amqp://guest:guest@localhost:5672

# Email / SMTP
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your-smtp-user
MAIL_PASSWORD=your-smtp-password
```

| Variable | Description | Required |
| --- | --- | --- |
| `PGUSER` | PostgreSQL username | Yes |
| `PGPASSWORD` | PostgreSQL password | Yes |
| `PGDATABASE` | PostgreSQL database name | Yes |
| `PGHOST` | PostgreSQL host | Yes |
| `PGPORT` | PostgreSQL port | Yes |
| `RABBITMQ_HOST` | RabbitMQ host | Yes |
| `RABBITMQ_PORT` | RabbitMQ port (default `5672`) | No |
| `RABBITMQ_USER` | RabbitMQ username | No |
| `RABBITMQ_PASSWORD` | RabbitMQ password | No |
| `AMQP_URL` | Full AMQP URL, overrides `RABBITMQ_*` | No |
| `MAIL_HOST` | SMTP host | Yes |
| `MAIL_PORT` | SMTP port | Yes |
| `MAIL_USER` | SMTP username | Yes |
| `MAIL_PASSWORD` | SMTP password | Yes |

If `RABBITMQ_USER` and `RABBITMQ_PASSWORD` are omitted, the consumer connects without credentials (`amqp://host:port`). When `AMQP_URL` is set, it is used as-is.

---

## Email Notification

The consumer sends one email per new application, addressed to the job owner:

| Field | Value |
| --- | --- |
| **From** | `OpenJob` |
| **To** | Job owner's email (from `users.email`, resolved through the company owner) |
| **Subject** | `Lamaran Baru untuk <job_title>` |

Example body:

```
Halo <owner_name>,

Ada kandidat baru yang melamar untuk posisi "<job_title>".

Nama Pelamar  : <applicant_name>
Email Pelamar : <applicant_email>
Tanggal Lamar : <application_date>

Silakan tinjau lamaran tersebut di dashboard OpenJob.
```

All values come from the following query in `src/ApplicationService.js`:

```sql
SELECT
  applications.created_at AS application_date,
  applicant.name           AS applicant_name,
  applicant.email          AS applicant_email,
  jobs.title               AS job_title,
  owner.email              AS owner_email,
  owner.name               AS owner_name
FROM applications
JOIN users applicant ON applicant.id = applications.user_id
JOIN jobs ON jobs.id = applications.job_id
JOIN companies ON companies.id = jobs.company_id
JOIN users owner ON owner.id = companies.owner
WHERE applications.id = $1
```

If no row is returned, the consumer logs `Data untuk application <id> tidak ditemukan` and skips the email.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the consumer from `src/consumer.js` |
| `npm run start:dev` | Start the consumer with Nodemon (auto-restart on changes) |
| `npm run lint` | Lint the `src` directory with ESLint |
| `npm test` | Placeholder; automated tests are not included yet |

> **Note:** the `npm run consumer` script points to `consumer.js` in the project root, while the actual entry point is `src/consumer.js`. Use `npm start` or `npm run start:dev` instead.

---

## Related Repositories

- **OpenJob RESTful API (producer):** [https://github.com/fath0ny/OpenJob-RESTful-API](https://github.com/fath0ny/OpenJob-RESTful-API)
- **OpenJob Consumer (this repository):** [https://github.com/fath0ny/OpenJob-Consumer](https://github.com/fath0ny/OpenJob-Consumer)

---

## License

This project is licensed under the **ISC License**.

---

## Author

**fath0ny**
GitHub: [https://github.com/fath0ny](https://github.com/fath0ny)
