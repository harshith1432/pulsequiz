# PulseQuiz ⚡

A high-concurrency, real-time multiplayer interactive quiz platform featuring synchronized dual-screen presentation, mobile tactile buzzer controllers, intelligent document parsing, host authentication with quiz isolation, and automated cluster scalability.

## 🌟 Key Features

### 1. Dual-Screen Real-Time Experience
- **Host / Stage Display**: Designed for projectors, monitors, and auditorium TVs. Displays live 6-digit room PINs, animated countdown timers, live response charts, question answer distributions, round-by-round cumulative scoreboards, and the grand Olympic podium.
- **Mobile Player Controller**: Lightweight mobile web interface with zero app install required. Features responsive 4-color choice buzzers (▲ Red, ◆ Blue, ● Yellow, ■ Green) with native haptic vibration feedback.

### 2. Host Authentication & Quiz Isolation
- **Host Accounts**: Secure host registration and login powered by cryptographic password hashing and token-based authentication.
- **Tenant Isolation**: Hosts manage their own personal quiz library with strict ownership authorization. Quizzes, rooms, and session records are securely isolated per host.

### 3. Smart Question Pooling & Shuffling
- **Question Pool Sampling**: Store large question banks (e.g., 50–100+ questions) and automatically sample a random subset (e.g., 10, 20 questions) for each game session.
- **Repetition Prevention**: Built-in tracking of previously used questions to ensure participants do not see repeated questions across consecutive game runs until the pool is exhausted or manually reset.

### 4. Interactive Host Controls & Live Game Flow
- **Adjustable Timers**: Dynamically update question duration before launching a game.
- **Automatic Instant Reveal**: When all joined participants have submitted their answers, the round instantly concludes and displays answer statistics without waiting for the remaining countdown.
- **Manual Early Reveal**: Host can manually end questions at any time.
- **Mid-Game Final Podium**: Host can cleanly conclude an active game at any point and transition directly to the Top 10 celebration podium.

### 5. Document Ingestion Pipeline
- **Excel Spreadsheet Support**: Downloadable Excel template (`PulseQuiz_Questions_Template.xlsx`) with automated format validation and bulk import.
- **PDF Question Extraction**:
  - Offline heuristic regex parser for standard numbered exam papers and worksheets.
  - Multimodal Google Gemini integration for extracting structured MCQs and answer keys directly from test documents.

### 6. Past Winners & Hall of Fame
- **Session History**: All completed game sessions, participant counts, and top 10 finisher rankings are recorded in PostgreSQL (`quiz_sessions`).
- **Past Winners Modal**: Hosts can inspect the leaderboard history and top performers for any quiz in their library.

### 7. High-Concurrency & Cluster Architecture
- **Multi-Core Clustering**: Node.js cluster orchestration (`cluster.js`) utilizing worker processes across CPU cores.
- **Asynchronous DB Queue**: Non-blocking in-memory queue (`dbQueue.js`) buffering high-velocity player submissions to prevent database connection spikes.
- **Horizontal Scaling with Nginx & Redis**: Docker Compose configuration (`docker-compose.cluster.yml`) with Nginx reverse proxy load balancing and Redis adapter for distributed WebSocket broadcasting.

---

## 🏗️ Architecture Overview

```
pulsequiz/
├── client/                     # Frontend Application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── host/          # Host Dashboard, Lobby, Arena, Leaderboard, Podium, Modals
│   │   │   ├── player/        # Player Join, Mobile Lobby, Answer Pad, Feedback
│   │   │   └── common/        # ThemeSelector and shared UI elements
│   │   ├── context/           # SocketContext for WebSocket connectivity
│   │   └── utils/             # Web Audio sound engine & question shuffling helpers
│   └── package.json
├── server/                     # Backend Application (Node.js + Express + Socket.io)
│   ├── middleware/            # Security headers (Helmet) & rate limiters
│   ├── services/
│   │   ├── dbQueue.js         # Asynchronous batching queue for PostgreSQL writes
│   │   ├── excelService.js    # Excel template generation and parser
│   │   └── pdfService.js      # Heuristic and AI-driven PDF document parser
│   ├── utils/
│   │   └── questionShuffle.js # Smart question pool sampling and tracking
│   ├── cluster.js             # Multi-core cluster entry point
│   ├── db.js                  # PostgreSQL schema, user auth, and query layer
│   ├── index.js               # Express application, REST endpoints, Socket.io handlers
│   ├── roomManager.js         # Room state machine, PIN manager, and score calculations
│   └── scoring.js             # Speed-weighted time-decay scoring algorithm
├── docker-compose.cluster.yml  # Multi-node container configuration with Nginx & Redis
├── nginx/                     # Reverse proxy configuration for sticky WebSockets
├── .env.example               # Environment variables template
├── .gitignore                 # Repository ignore rules
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: (Recommended for persistence, default port 5432)
- **Redis & Docker**: (Optional, for running multi-instance cluster)

### 1. Installation

Clone the repository and install all dependencies:

```bash
git clone https://github.com/harshith1432/pulsequiz.git
cd pulsequiz
npm run install:all
```

### 2. Environment Configuration

Copy `.env.example` to `server/.env`:

```bash
cp .env.example server/.env
```

Configure the environment parameters:

```env
# PostgreSQL Database Connection URI
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/quzi

# Backend HTTP/WebSocket Port
PORT=3001

# Public URL for Mobile Players (Leave blank for local IP, or set Cloudflare tunnel URL)
PUBLIC_URL=https://your-tunnel.trycloudflare.com

# Optional: Google Gemini API Key for AI PDF MCQ extraction
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Running in Development

Start both the backend server and client frontend concurrently:

```bash
npm run dev
```

- **Host Dashboard**: `http://localhost:5173`
- **Mobile Player View**: `http://localhost:5173/play`
- **Backend Health Check**: `http://localhost:3001/api/health`

### 4. Running in Multi-Core Cluster Mode

To launch the multi-process cluster utilizing available CPU cores:

```bash
cd server
npm run start:cluster
```

Or deploy with Docker Compose (includes Nginx load balancer and Redis):

```bash
docker-compose -f docker-compose.cluster.yml up --build
```

---

## 🧪 Verification & Automated Testing

PulseQuiz includes automated test suites covering all core workflows:

```bash
cd server

# Run core verification suite (scoring, Excel parsing, DB schema, room concurrency)
node test-all.js

# Run new features verification (timer adjustment, early reveal, mid-game quit)
node test-new-features.js

# Run authentication and data isolation suite
node test-auth-and-isolation.js

# Run past winners verification
node test-past-winners.js
```

---

## 🔒 Security & Privacy

- **Zero-Secret Standard**: No passwords, API keys, or database credentials are committed to version control.
- **Password Security**: Passwords are cryptographically salted and hashed.
- **Rate Limiting**: Protected against room PIN brute-force attempts and denial-of-service traffic.
- **Input Sanitization**: Multi-layer validation on all user submissions, document uploads, and socket events.

---

## 📄 License

This project is licensed under the MIT License.
