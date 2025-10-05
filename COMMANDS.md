# 📝 Command Reference - Crypto AI Trading System

Quick reference for all common commands.

---

## 🚀 Installation & Setup

```bash
# Install dependencies
npm install

# Copy environment template
copy .env.example .env

# Edit configuration (add your API keys)
notepad .env
```

---

## 🐳 Docker Commands

```bash
# Start all services (PostgreSQL, Redis, App)
docker-compose up -d

# Start only databases (manual app start)
docker-compose up -d postgres redis

# View running containers
docker ps

# View logs
docker-compose logs -f
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Restart a service
docker-compose restart app
docker-compose restart postgres
docker-compose restart redis

# Check container status
docker-compose ps
```

---

## 🗄️ Database Commands

```bash
# Run migrations
npm run migrate

# Connect to PostgreSQL (from host)
psql postgresql://crypto_user:crypto_pass@localhost:5432/crypto_ai

# Connect via Docker
docker exec -it crypto-postgres psql -U crypto_user -d crypto_ai

# Common SQL queries
SELECT * FROM portfolio_balance ORDER BY id DESC LIMIT 1;
SELECT * FROM trades ORDER BY executed_at DESC LIMIT 10;
SELECT * FROM recommendations WHERE expires_at > NOW() ORDER BY created_at DESC;
SELECT * FROM price_data WHERE symbol = 'BTC' ORDER BY timestamp DESC LIMIT 20;

# Backup database
docker exec crypto-postgres pg_dump -U crypto_user crypto_ai > backup.sql

# Restore database
docker exec -i crypto-postgres psql -U crypto_user crypto_ai < backup.sql
```

---

## 🔧 Development Commands

```bash
# Start in development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Start production build
npm run start

# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode for tests
npm run test:watch
```

---

## 📊 Analysis Commands

```bash
# Analyze specific cryptocurrency
npm run analyze BTC
npm run analyze ETH
npm run analyze SOL

# Analyze all supported coins
npm run analyze ALL

# Run without arguments to see usage
npm run analyze
```

---

## 🔍 Log Commands

### View Logs (Windows PowerShell)

```powershell
# View live logs (all)
Get-Content logs\combined.log -Wait -Tail 50

# View only errors
Get-Content logs\error.log -Wait -Tail 50

# Search logs
Get-Content logs\combined.log | Select-String "error"
Get-Content logs\combined.log | Select-String "recommendation"
Get-Content logs\combined.log | Select-String "trade"

# View last 100 lines
Get-Content logs\combined.log -Tail 100
```

### View Logs (Linux/Mac/Git Bash)

```bash
# View live logs (all)
tail -f logs/combined.log

# View only errors
tail -f logs/error.log

# Search logs
grep "error" logs/combined.log
grep "recommendation" logs/combined.log
grep "trade" logs/combined.log

# View last 100 lines
tail -n 100 logs/combined.log
```

---

## 🌐 API Commands (curl)

### Health & Status

```bash
# Health check
curl http://localhost:3000/api/health

# Portfolio overview
curl http://localhost:3000/api/portfolio

# Portfolio performance
curl http://localhost:3000/api/portfolio/performance

# Risk exposure
curl http://localhost:3000/api/portfolio/risk

# Market context
curl http://localhost:3000/api/market-context
```

### Analysis & Recommendations

```bash
# Get analysis for a symbol
curl http://localhost:3000/api/analysis/BTC

# Generate new AI recommendation
curl -X POST http://localhost:3000/api/analyze/BTC

# Get all recommendations
curl http://localhost:3000/api/recommendations

# Get sentiment for a symbol
curl http://localhost:3000/api/sentiment/BTC
```

### Trading

```bash
# Get trade history
curl http://localhost:3000/api/trades

# Execute a trade (BUY)
curl -X POST http://localhost:3000/api/trades ^
  -H "Content-Type: application/json" ^
  -d "{\"symbol\": \"BTC\", \"side\": \"BUY\", \"quantity\": 0.01, \"stopLoss\": 43000, \"reasoning\": \"AI recommendation\"}"

# Execute a trade (SELL)
curl -X POST http://localhost:3000/api/trades ^
  -H "Content-Type: application/json" ^
  -d "{\"symbol\": \"BTC\", \"side\": \"SELL\", \"quantity\": 0.01, \"reasoning\": \"Take profit\"}"
```

---

## 🔄 Redis Commands

```bash
# Connect to Redis via Docker
docker exec -it crypto-redis redis-cli

# Once connected, useful commands:
KEYS *                    # List all keys
GET price:BTC             # Get cached price
TTL price:BTC             # Check time-to-live
FLUSHALL                  # Clear all cache (use with caution!)
INFO                      # Redis server info
DBSIZE                    # Number of keys
MEMORY USAGE price:BTC    # Memory used by key

# Clear specific cache pattern
KEYS price:* | xargs redis-cli DEL

# Monitor cache activity (real-time)
MONITOR
```

---

## 📦 Job Queue Commands

### Via Node.js (create a script)

```typescript
// src/scripts/queueStatus.ts
import { dataCollectionQueue, analysisQueue, recommendationQueue } from '../jobs';

async function checkQueues() {
  const waiting = await dataCollectionQueue.getWaitingCount();
  const active = await dataCollectionQueue.getActiveCount();
  const completed = await dataCollectionQueue.getCompletedCount();
  const failed = await dataCollectionQueue.getFailedCount();
  
  console.log('Data Collection Queue:');
  console.log(`  Waiting: ${waiting}`);
  console.log(`  Active: ${active}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed: ${failed}`);
}

checkQueues();
```

### Via Redis CLI

```bash
# Connect to Redis
docker exec -it crypto-redis redis-cli

# Check queue keys
KEYS bull:*

# Check waiting jobs count
LLEN bull:data-collection:wait

# View job data
HGETALL bull:data-collection:123
```

---

## 🧹 Cleanup Commands

```bash
# Remove node_modules (fresh install)
rm -rf node_modules
npm install

# Remove build artifacts
rm -rf dist

# Remove logs (be careful!)
rm -rf logs/*.log

# Remove Docker volumes (nuclear option)
docker-compose down -v

# Clean everything (fresh start)
docker-compose down -v
rm -rf node_modules dist logs/*.log
npm install
```

---

## 🔐 Environment Commands

```bash
# View current environment
echo $NODE_ENV

# Check if API keys are set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Set environment variable (PowerShell)
$env:NODE_ENV = "production"

# Set environment variable (Bash)
export NODE_ENV=production

# Load .env file (automatically done by dotenv)
# No manual command needed
```

---

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/analysis/technicalAnalysis.test.ts

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage

# View coverage report (after generating)
start coverage/lcov-report/index.html    # Windows
open coverage/lcov-report/index.html     # Mac
xdg-open coverage/lcov-report/index.html # Linux
```

---

## 📈 Monitoring Commands

```bash
# System resource usage
docker stats

# Disk usage by containers
docker system df

# Show container resource limits
docker inspect crypto-app | grep -A 10 Resources

# PostgreSQL connection count
docker exec crypto-postgres psql -U crypto_user -d crypto_ai -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory usage
docker exec crypto-redis redis-cli INFO memory

# Application memory usage (if running with PM2)
pm2 monit
```

---

## 🔧 Troubleshooting Commands

### Port Already in Use

```bash
# Find process using port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Find process using port 3000 (Linux/Mac)
lsof -i :3000
kill -9 <PID>
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec crypto-postgres pg_isready -U crypto_user

# Check PostgreSQL logs
docker logs crypto-postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Issues

```bash
# Test Redis connection
docker exec crypto-redis redis-cli PING

# Check Redis logs
docker logs crypto-redis

# Restart Redis
docker-compose restart redis
```

### Application Won't Start

```bash
# Check logs
Get-Content logs\error.log -Tail 50

# Verify environment variables
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

# Test database connection
npm run migrate

# Rebuild and restart
npm run build
npm start
```

---

## 📊 Performance Optimization

```bash
# Analyze bundle size
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/stats.json

# Check for outdated dependencies
npm outdated

# Update dependencies (be careful!)
npm update

# Audit for vulnerabilities
npm audit
npm audit fix
```

---

## 🚀 Production Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start

# Or use PM2 (process manager)
npm install -g pm2
pm2 start dist/app.js --name crypto-ai
pm2 save
pm2 startup

# PM2 commands
pm2 list
pm2 logs crypto-ai
pm2 restart crypto-ai
pm2 stop crypto-ai
pm2 delete crypto-ai
```

---

## 📝 Useful One-Liners

```bash
# Count total lines of code
find src -name "*.ts" | xargs wc -l

# Find TODO comments
grep -r "TODO" src/

# Find console.log statements (should use logger instead)
grep -r "console.log" src/

# Check TypeScript errors without building
npx tsc --noEmit

# Generate TypeScript declaration files
npx tsc --declaration --emitDeclarationOnly

# Pretty print JSON response
curl http://localhost:3000/api/portfolio | jq

# Monitor API response time
while true; do curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health; sleep 1; done
```

---

## 🎯 Quick Start Sequence

```bash
# 1. Setup
npm install
copy .env.example .env
# Edit .env with your API keys

# 2. Start infrastructure
docker-compose up -d postgres redis

# 3. Initialize database
npm run migrate

# 4. Start application
npm run dev

# 5. Verify
curl http://localhost:3000/api/health
start http://localhost:3000

# 6. Generate first analysis
npm run analyze BTC
```

---

## 🔍 Debugging Commands

```bash
# Run with debug output
DEBUG=* npm run dev

# Node.js inspect mode
node --inspect dist/app.js

# TypeScript debug
node --inspect -r ts-node/register src/app.ts

# Check for TypeScript errors
npx tsc --noEmit

# Validate JSON files
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')))"
```

---

## 📚 Help Commands

```bash
# NPM scripts
npm run

# Docker help
docker --help
docker-compose --help

# Node.js version
node --version

# NPM version
npm --version

# TypeScript version
npx tsc --version

# View package info
npm info <package-name>
npm view <package-name> versions
```

---

## 🎉 Common Workflows

### Daily Development

```bash
# 1. Start the day
docker-compose up -d
npm run dev

# 2. Make changes to code
# ... edit files ...

# 3. Check logs for errors
Get-Content logs\combined.log -Wait -Tail 20

# 4. Test changes
npm test

# 5. End the day
# Ctrl+C to stop dev server
docker-compose down
```

### Generate Reports

```bash
# 1. Generate analysis
npm run analyze ALL

# 2. Check recommendations
curl http://localhost:3000/api/recommendations | jq

# 3. View portfolio
curl http://localhost:3000/api/portfolio | jq

# 4. Check performance
curl http://localhost:3000/api/portfolio/performance | jq
```

### Database Maintenance

```bash
# 1. Backup
docker exec crypto-postgres pg_dump -U crypto_user crypto_ai > backup_$(date +%Y%m%d).sql

# 2. Clean old data (be careful!)
docker exec crypto-postgres psql -U crypto_user -d crypto_ai -c "DELETE FROM price_data WHERE timestamp < NOW() - INTERVAL '30 days';"

# 3. Vacuum database
docker exec crypto-postgres psql -U crypto_user -d crypto_ai -c "VACUUM ANALYZE;"

# 4. Check database size
docker exec crypto-postgres psql -U crypto_user -d crypto_ai -c "SELECT pg_size_pretty(pg_database_size('crypto_ai'));"
```

---

**Tip**: Bookmark this file for quick command reference!
