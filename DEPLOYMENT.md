# Deployment Guide

**Crypto AI Trading Intelligence System**  
**Last Updated:** October 27, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Server Requirements](#production-server-requirements)
4. [Build Process](#build-process)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Reverse Proxy (Nginx)](#reverse-proxy-nginx)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Process Management](#process-management)
10. [Monitoring & Logging](#monitoring--logging)
11. [Backup Strategy](#backup-strategy)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum (Development):**
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB SSD
- OS: Windows 10+, Ubuntu 20.04+, macOS 11+

**Recommended (Production):**
- CPU: 4 cores
- RAM: 8GB
- Disk: 50GB SSD
- OS: Ubuntu 22.04 LTS

### Software Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **PostgreSQL**: 14+ (with TimescaleDB optional)
- **Redis**: 7+
- **Nginx**: 1.18+ (production only)
- **Git**: Any recent version

### External Services

- **API Keys**: See [Environment Configuration](#environment-configuration)
- **Domain Name**: Required for production
- **SSL Certificate**: Let's Encrypt (free) or purchased

---

## Local Development Setup

### Quick Start (10 minutes)

```bash
# 1. Install dependencies
cd crypto_trader
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
notepad .env  # Windows
nano .env     # Linux/Mac

# 4. Start Docker containers (PostgreSQL + Redis)
docker-compose up -d postgres redis

# 5. Wait for databases to initialize
timeout /t 10  # Windows
sleep 10       # Linux/Mac

# 6. Run migrations
npm run migrate

# 7. Start development server
npm run dev
```

### Access Application

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3000/api/health
- **Logs**: `logs/combined.log`

---

## Production Server Requirements

### Server Specs

**Recommended VPS Providers:**
- DigitalOcean: $24/month (4GB RAM, 2 vCPU)
- Linode: $24/month (4GB RAM, 2 vCPU)
- AWS Lightsail: $20/month (4GB RAM, 2 vCPU)
- Vultr: $24/month (4GB RAM, 2 vCPU)

### Network Requirements

**Ports:**
- `22`: SSH (firewall: your IP only)
- `80`: HTTP (redirect to HTTPS)
- `443`: HTTPS (public)
- `3000`: Node.js (localhost only, proxied by Nginx)
- `5432`: PostgreSQL (localhost only)
- `6379`: Redis (localhost only)

**Firewall Rules:**
```bash
# Ubuntu UFW example
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## Build Process

### Step 1: Clone Repository

```bash
# SSH into your server
ssh user@your-server.com

# Clone repository
cd /var/www
sudo git clone https://github.com/yourusername/crypto-trader.git
cd crypto-trader

# Set ownership
sudo chown -R $USER:$USER /var/www/crypto-trader
```

### Step 2: Install Dependencies

```bash
# Install Node.js (if not present)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify versions
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Install project dependencies
npm install --production
```

### Step 3: Build Application

```bash
# Compile TypeScript to JavaScript
npm run build

# Verify build output
ls -la dist/
# Should contain: app.js, api/, services/, etc.
```

**Build Output Location:** `/var/www/crypto-trader/dist/`

**Entry Point:** `dist/app.js`

---

## Environment Configuration

### Production .env File

```bash
# Create production environment file
nano .env
```

**Critical Production Settings:**

```bash
# Application
NODE_ENV=production
PORT=3000

# Security - CHANGE THESE!
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-this-immediately

# Google OAuth (Get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Database
DATABASE_URL=postgresql://crypto_user:STRONG_PASSWORD_HERE@localhost:5432/crypto_ai
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys - Data Sources (Free Tier)
ALPHA_VANTAGE_API_KEY=your_key_here
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USER_AGENT=crypto-trader:v1.0.0:by /u/your_username
CRYPTOPANIC_API_KEY=your_key_here
ETHERSCAN_API_KEY=your_key_here
COINGECKO_API_KEY=  # Optional, leave empty for free tier

# AI APIs - Required
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Trading Configuration
STARTING_CAPITAL=10000
MAX_POSITION_SIZE=0.05
MAX_DAILY_LOSS=0.03
MAX_OPEN_POSITIONS=5

# Job Scheduling
ENABLE_JOB_SCHEDULER=true
CRON_COLLECT_PRICES=*/5 * * * *
CRON_RECOMMENDATIONS=0 */2 * * *

# Logging
LOG_LEVEL=info
```

**⚠️ Security Checklist:**
- [ ] Change `JWT_SECRET` to random 32+ character string
- [ ] Use strong database password
- [ ] Never commit .env to version control
- [ ] Restrict file permissions: `chmod 600 .env`

---

## Database Setup

### Install PostgreSQL

```bash
# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE USER crypto_user WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE crypto_ai OWNER crypto_user;
GRANT ALL PRIVILEGES ON DATABASE crypto_ai TO crypto_user;
\q
```

### Optional: Install TimescaleDB

```bash
# Add TimescaleDB repo
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -

# Install
sudo apt update
sudo apt install timescaledb-2-postgresql-14

# Enable extension
sudo -u postgres psql -d crypto_ai
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

### Install Redis

```bash
# Ubuntu
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: supervised systemd
# Set: bind 127.0.0.1 ::1 (localhost only)

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Test connection
redis-cli ping
# Should return: PONG
```

### Run Migrations

```bash
cd /var/www/crypto-trader
npm run migrate

# Verify tables created
sudo -u postgres psql -d crypto_ai -c "\dt"
# Should list: users, sessions, settings, portfolio_balance, holdings, trades, recommendations, etc.
```

---

## Reverse Proxy (Nginx)

### Install Nginx

```bash
sudo apt update
sudo apt install nginx

# Start and enable
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx

```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/crypto-trader
```

**Configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files (optional optimization)
    location /css/ {
        alias /var/www/crypto-trader/public/css/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location /js/ {
        alias /var/www/crypto-trader/public/js/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Enable Site:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/crypto-trader /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Using Let's Encrypt (Free, Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (interactive)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# - Enter email address
# - Agree to Terms of Service
# - Choose: Redirect HTTP to HTTPS (recommended)

# Certbot automatically:
# 1. Obtains SSL certificate
# 2. Updates Nginx configuration
# 3. Reloads Nginx
# 4. Sets up auto-renewal

# Verify auto-renewal
sudo certbot renew --dry-run
```

**After SSL Setup, Nginx Config Updates Automatically:**

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # ... rest of configuration
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### Test SSL Configuration

- Visit: https://www.ssllabs.com/ssltest/
- Enter your domain
- Target grade: A or A+

---

## Process Management

### Option 1: PM2 (Recommended)

**Install PM2:**

```bash
sudo npm install -g pm2
```

**Start Application:**

```bash
cd /var/www/crypto-trader

# Start with PM2
pm2 start dist/app.js --name crypto-trader

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup systemd
# Run the command it outputs (starts with 'sudo')
```

**PM2 Management Commands:**

```bash
# View status
pm2 status

# View logs
pm2 logs crypto-trader

# Restart
pm2 restart crypto-trader

# Stop
pm2 stop crypto-trader

# Monitor
pm2 monit

# View detailed info
pm2 show crypto-trader
```

**PM2 Configuration File (Optional):**

```bash
# Create ecosystem.config.js
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'crypto-trader',
    script: './dist/app.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};
```

```bash
# Start with config
pm2 start ecosystem.config.js
```

### Option 2: systemd Service

**Create Service File:**

```bash
sudo nano /etc/systemd/system/crypto-trader.service
```

```ini
[Unit]
Description=Crypto AI Trading System
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/var/www/crypto-trader
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/app.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=crypto-trader

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable crypto-trader

# Start service
sudo systemctl start crypto-trader

# Check status
sudo systemctl status crypto-trader

# View logs
sudo journalctl -u crypto-trader -f
```

---

## Monitoring & Logging

### Application Logs

**Location:** `/var/www/crypto-trader/logs/`

- `combined.log`: All logs
- `error.log`: Errors only
- `exceptions.log`: Uncaught exceptions

**View Logs:**

```bash
# Tail combined log
tail -f logs/combined.log

# Filter for errors
grep -i error logs/combined.log

# Last 100 lines
tail -n 100 logs/combined.log
```

### Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/crypto-trader
```

```
/var/www/crypto-trader/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 your-username your-username
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### System Monitoring

**Install htop:**

```bash
sudo apt install htop
htop
```

**Monitor Redis:**

```bash
redis-cli INFO
redis-cli MONITOR
```

**Monitor PostgreSQL:**

```bash
sudo -u postgres psql -d crypto_ai

-- Active connections
SELECT * FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size('crypto_ai'));
```

**Disk Usage:**

```bash
df -h
du -sh /var/www/crypto-trader/*
```

---

## Backup Strategy

### Database Backup

**Automated Daily Backup:**

```bash
# Create backup script
nano /usr/local/bin/backup-crypto-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/crypto-trader"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="crypto_ai_${TIMESTAMP}.sql.gz"

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump crypto_ai | gzip > "$BACKUP_DIR/$FILENAME"

# Keep only last 7 days
find $BACKUP_DIR -name "crypto_ai_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME"
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-crypto-db.sh

# Add to crontab
crontab -e
```

```cron
# Backup database daily at 2 AM
0 2 * * * /usr/local/bin/backup-crypto-db.sh >> /var/log/crypto-backup.log 2>&1
```

**Manual Backup:**

```bash
# Backup
sudo -u postgres pg_dump crypto_ai > backup.sql

# Restore
sudo -u postgres psql crypto_ai < backup.sql
```

### Redis Backup

**Configuration:**

```bash
sudo nano /etc/redis/redis.conf
```

```
# Enable RDB snapshots
save 900 1      # Save if 1 key changed in 900 seconds
save 300 10     # Save if 10 keys changed in 300 seconds
save 60 10000   # Save if 10000 keys changed in 60 seconds

# Snapshot file location
dir /var/lib/redis
dbfilename dump.rdb
```

**Manual Snapshot:**

```bash
redis-cli SAVE
# Or for non-blocking:
redis-cli BGSAVE
```

### Application Files Backup

```bash
# Backup .env and logs
tar -czf crypto-trader-config-$(date +%Y%m%d).tar.gz .env logs/

# Transfer to remote storage (example: rsync)
rsync -avz crypto-trader-config-*.tar.gz user@backup-server:/backups/
```

---

## Troubleshooting

### Application Won't Start

**Check logs:**

```bash
pm2 logs crypto-trader --lines 100
# Or
sudo journalctl -u crypto-trader -n 100
```

**Common Issues:**

1. **Port already in use:**
```bash
# Check what's using port 3000
sudo lsof -i :3000
# Kill process
sudo kill -9 PID
```

2. **Database connection failed:**
```bash
# Test connection
sudo -u postgres psql -d crypto_ai
# Check credentials in .env
```

3. **Redis connection failed:**
```bash
# Test Redis
redis-cli ping
# Restart Redis
sudo systemctl restart redis
```

### High Memory Usage

```bash
# Check memory
free -h

# Check Node.js memory
pm2 monit

# Restart if needed
pm2 restart crypto-trader
```

### Slow API Responses

**Check:**
1. Redis cache working: `redis-cli INFO stats`
2. Database query performance: Check `pg_stat_statements`
3. External API rate limits: Review logs for 429 errors
4. Network latency: `ping api.coingecko.com`

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Test renewal
sudo certbot renew --dry-run
```

### Jobs Not Running

```bash
# Check scheduler enabled
grep ENABLE_JOB_SCHEDULER .env

# Check Redis queue
redis-cli KEYS "*bull*"

# View job logs
grep "Job" logs/combined.log
```

---

## Post-Deployment Checklist

- [ ] Application accessible at https://your-domain.com
- [ ] SSL certificate valid (A rating on SSL Labs)
- [ ] Database migrations completed
- [ ] PM2 running and saved
- [ ] PM2 startup script configured
- [ ] Nginx serving application
- [ ] Firewall configured (ports 80, 443, 22 only)
- [ ] .env file secured (`chmod 600`)
- [ ] Database backup cron job configured
- [ ] Log rotation configured
- [ ] Monitoring set up
- [ ] Test user registration and login
- [ ] Test API endpoints
- [ ] Verify job scheduler running
- [ ] Check logs for errors
- [ ] Document any custom configurations

---

## Maintenance

### Regular Tasks

**Daily:**
- Review error logs: `grep ERROR logs/combined.log`
- Check disk space: `df -h`
- Monitor API costs: Review AI usage

**Weekly:**
- Review application performance
- Check for npm security updates: `npm audit`
- Test backup restoration

**Monthly:**
- Update dependencies: `npm update`
- Review and optimize database queries
- Analyze trading performance
- SSL certificate auto-renewal (automated)

### Update Procedure

```bash
# 1. Backup database
/usr/local/bin/backup-crypto-db.sh

# 2. Pull latest code
cd /var/www/crypto-trader
git pull origin main

# 3. Install dependencies
npm install --production

# 4. Run migrations (if any)
npm run migrate

# 5. Rebuild
npm run build

# 6. Restart application
pm2 restart crypto-trader

# 7. Verify
curl https://your-domain.com/api/health
```

---

## Security Best Practices

1. **Keep software updated**: OS, Node.js, PostgreSQL, Redis, Nginx
2. **Use strong passwords**: Database, JWT secret, user accounts
3. **Restrict SSH**: Key-based auth only, disable root login
4. **Enable firewall**: Only necessary ports open
5. **Regular backups**: Automated daily, tested monthly
6. **Monitor logs**: Set up alerts for critical errors
7. **API key rotation**: Rotate secrets every 3-6 months
8. **HTTPS only**: Redirect all HTTP to HTTPS
9. **Security headers**: CSP, HSTS, X-Frame-Options
10. **Rate limiting**: Enabled (100 req/15min default)

---

**Document Status**: Complete  
**Maintained By**: Development Team  
**Review Frequency**: Before each deployment
