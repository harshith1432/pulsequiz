# PulseQuiz

A full-stack, real-time multiplayer interactive quiz application featuring synchronized dual-screen presentation, mobile buzzer controllers, dynamic document question parsing, and live leaderboards.

## Features

- **Real-Time Multiplayer Arena**: Synchronized live gameplay powered by WebSockets (Socket.io).
- **Dual-Screen Architecture**:
  - **Host / Stage Display**: Room code, player counter, interactive question timer, response distribution charts, and animated leaderboards.
  - **Player Mobile Controller**: Lightweight mobile web interface with responsive 4-color choice buzzers and instant tactile feedback.
- **Dynamic Question Ingestion**:
  - Support for structured Excel spreadsheets (.xlsx, .csv).
  - Built-in heuristic parsing for PDF documents and optional AI-assisted question extraction using Google Gemini.
- **Decay Scoring Engine**: Server-side algorithm calculating points based on response speed and correctness.
- **Session Persistence**: Database schema designed for PostgreSQL to record quizzes, active rooms, player rosters, and answer logs.
- **Flexible Networking**: Built-in compatibility with local LAN IP discovery and external tunneling tools (such as Cloudflare Tunnel) for remote participants.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Socket.io-client, Lucide Icons, Canvas-Confetti
- **Backend**: Node.js, Express, Socket.io, Multer, xlsx, pdf-parse
- **Database**: PostgreSQL (pg)
- **AI Integration**: Google Gen AI SDK (optional)

## Project Architecture

```
pulsequiz/
├── client/          # Frontend application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── host/       # Host screens: Lobby, Question Arena, Leaderboard, Podium
│   │   │   └── player/     # Player screens: Join Room, Buzzer Controller, Results
│   │   ├── context/        # Socket provider and state
│   │   └── utils/          # Web Audio sound synthesis
│   └── package.json
├── server/          # Backend application (Node.js + Express + Socket.io)
│   ├── middleware/  # Rate limiting and security headers
│   ├── services/    # Excel and PDF parsing services
│   ├── db.js        # PostgreSQL database client and schema definitions
│   ├── index.js     # Server entry point and WebSocket handlers
│   ├── roomManager.js # In-memory room and player state manager
│   ├── scoring.js   # Score calculation formulas
│   └── test-all.js  # Automated test suite
├── .env.example     # Environment variable template
├── .gitignore       # Repository ignore rules
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm (v9+)
- PostgreSQL (optional, for persistent storage)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/harshith1432/pulsequiz.git
   cd pulsequiz
   ```

2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Configure environment variables:
   Copy the example environment configuration into `server/.env`:
   ```bash
   cp .env.example server/.env
   ```

   Update the parameters in `server/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/quzi
   PORT=3001
   PUBLIC_URL=https://your-tunnel.trycloudflare.com
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Run the development environment:
   ```bash
   npm run dev
   ```

   - Host dashboard: `http://localhost:5173`
   - Mobile player view: `http://localhost:5173/play`
   - Backend service: `http://localhost:3001`

### Running the Test Suite

Execute the integrated test suite to verify scoring, Excel parsing, database persistence, and room management:

```bash
cd server
node test-all.js
```

## Security & Secrets

This project adheres to zero-secret security standards:
- Environment variables and credentials are excluded from source control.
- Rate limiting is applied to prevent brute-force room PIN discovery.
- Cross-Origin Resource Sharing (CORS) is configured for safe local and tunnel-based connections.

## License

This project is licensed under the MIT License.
