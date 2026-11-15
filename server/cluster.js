/**
 * Multi-Worker Process Cluster & Load Balancer.
 * 
 * Scales Node.js horizontally across all available CPU cores.
 * The primary process binds to PORT (3001) and delegates incoming socket and HTTP connections
 * across isolated worker processes using OS-level kernel TCP load balancing.
 * 
 * Features:
 * - Automatic CPU core discovery
 * - Zero-downtime worker respawning on unexpected exits
 * - Graceful shutdown signal handling (SIGTERM, SIGINT)
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
require('dotenv').config();

const numCPUs = process.env.CLUSTER_WORKERS
  ? parseInt(process.env.CLUSTER_WORKERS, 10)
  : Math.min(os.cpus().length, 8); // default to min(cores, 8) for optimal thread pool

if (cluster.isPrimary || cluster.isMaster) {
  console.log('====================================================');
  console.log(`🚀 PulseQuiz Cluster Load Balancer Master [PID: ${process.pid}]`);
  console.log(`⚡ Detected ${os.cpus().length} CPU cores. Forking ${numCPUs} worker processes...`);
  console.log('====================================================');

  const workers = new Map();

  // Fork worker processes
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    workers.set(worker.id, worker);
  }

  cluster.on('online', (worker) => {
    console.log(`✓ Worker #${worker.id} (PID: ${worker.process.pid}) online & listening for connections.`);
  });

  // Zero-downtime worker respawn
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ Worker #${worker.id} (PID: ${worker.process.pid}) exited (code: ${code}, signal: ${signal}). Respawning...`);
    workers.delete(worker.id);
    const newWorker = cluster.fork();
    workers.set(newWorker.id, newWorker);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Master received shutdown signal. Terminating workers gracefully...');
    for (const [id, worker] of workers.entries()) {
      worker.kill('SIGTERM');
    }
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

} else {
  // Worker process runs the Express & Socket.IO server
  require('./index.js');
}
