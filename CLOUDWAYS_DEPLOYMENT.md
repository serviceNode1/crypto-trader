# Cloudways Deployment Guide

**Your Configuration:**
- Domain: Your IONOS domain
- Server: Cloudways (phpstack-1356899-5955840)
- URL: https://phpstack-1356899-5955840.cloudwaysapps.com/
- IP: 159.203.160.241
- DNS: A record pointing to IP ✓

---

## ⚠️ CRITICAL: Server Requirements Check

### **Issue: PHP Stack vs Node.js Application**

Your Cloudways server URL shows "phpstack" but this is a **Node.js application**. You have two options:

#### **Option A: Create New Node.js Application (Recommended)**

Cloudways supports Node.js applications. You need to:

1. **Log into Cloudways Dashboard**
2. **Go to Applications tab**
3. **Click "Add Application"**
4. **Select:** 
   - Application Type: **Node.js**
   - Name: `crypto-trader`
   - Node.js Version: **18.x or higher**
5. **Deploy**

This will give you a new URL like: `https://nodejs-123456-5955840.cloudwaysapps.com/`

#### **Option B: Use Custom Node.js on Existing Server**

Install Node.js manually on the PHP server (more complex, not officially supported by all Cloudways plans).

---

## Step-by-Step Deployment (Assuming Node.js App Created)

### **Step 1: Connect via SSH**

```bash
# Get SSH details from Cloudways Dashboard
# Application Management → Access Details

# Connect to your server
ssh username@159.203.160.241 -p 22
# Or use the SSH credentials from Cloudways dashboard
```

**Cloudways SSH Format:**
- Username: Your SFTP/SSH username
- Password: Your SFTP/SSH password
- Port: Usually 22 (check Cloudways dashboard)

### **Step 2: Verify Node.js Installation**

```bash
# Check Node.js version
node --version
# Should be 18.x or higher

# Check npm
npm --version
# Should be 9.x or higher

# If not installed or wrong version:
# Contact Cloudways support or use Option A above
```

### **Step 3: Navigate to Application Directory**

```bash
# Typical Cloudways directory structure
cd /home/master/applications/[your-app-name]/public_html

# Or find your app:
pwd
ls -la
```

### **Step 4: Upload Application Files**

**Option A: Git Clone (Recommended)**

```bash
# Install git if not present
git --version

# Clone your repository
git clone https://github.com/yourusername/crypto-trader.git .

# Or if already uploaded via SFTP, skip this step
```

**Option B: SFTP Upload**

Use FileZilla, WinSCP, or Cloudways SFTP:
- Host: 159.203.160.241
- Username: Your SFTP username
- Password: Your SFTP password
- Port: 22 (or check dashboard)

Upload all files EXCEPT:
- `node_modules/` (will install on server)
- `.env` (create on server)
- `logs/`
- `.git/` (optional)

### **Step 5: Install Dependencies**

```bash
# In your application directory
npm install --production

# This will take 3-5 minutes
# Wait for completion
```

### **Step 6: Set Up PostgreSQL Database**

**Cloudways provides managed databases:**

1. **Go to Cloudways Dashboard → Database Manager**
2. **Create new database:**
   - Name: `crypto_ai_production`
   - User: `crypto_user` (auto-created)
   - Password: (will be generated)

3. **Get database credentials:**
   - Host: `localhost` or `127.0.0.1` (internal)
   - Port: `5432`
   - Database: `crypto_ai_production`
   - Username: Check dashboard
   - Password: Check dashboard

**Or via SSH:**

```bash
# Access PostgreSQL
psql -U master -h localhost

# Create database
CREATE DATABASE crypto_ai_production;

# Create user
CREATE USER crypto_user WITH PASSWORD 'your_secure_password_here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE crypto_ai_production TO crypto_user;

\q
```

### **Step 7: Set Up Redis**

**Check if Redis is available:**

```bash
redis-cli ping
# Should return: PONG
```

**If Redis is not installed:**

Cloudways typically includes Redis. If not:

1. **Contact Cloudways Support** to enable Redis Add-On
2. Or install locally: `sudo apt-get install redis-server` (if you have sudo access)

**Get Redis connection details:**
- Host: `localhost` or `127.0.0.1`
- Port: `6379` (default)
- Password: Usually none for local, check dashboard

### **Step 8: Create Production .env File**

```bash
# In your application directory
nano .env
```

**Paste this configuration (update with your values):**

```bash
# Environment
NODE_ENV=production
PORT=3000

# Your domain
APP_URL=https://your-domain.com

# Security - CRITICAL: Change these!
JWT_SECRET=CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_IMMEDIATELY_12345

# Google OAuth (from your Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Database (from Cloudways Dashboard)
DATABASE_URL=postgresql://crypto_user:your_db_password@localhost:5432/crypto_ai_production

# Redis (typically local on Cloudways)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys - Data Sources
ALPHA_VANTAGE_API_KEY=your_key_here
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_secret
REDDIT_USER_AGENT=crypto-trader:v1.0.0:by /u/your_username
CRYPTOPANIC_API_KEY=your_cryptopanic_key
ETHERSCAN_API_KEY=your_etherscan_key
COINGECKO_API_KEY=

# AI APIs - Required
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

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

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

**Secure the file:**

```bash
chmod 600 .env
```

### **Step 9: Build Application**

```bash
# Compile TypeScript to JavaScript
npm run build

# Verify build succeeded
ls -la dist/
# Should see app.js and other compiled files
```

### **Step 10: Run Database Migrations**

```bash
# Run migrations to create tables
npm run migrate

# Verify tables created
psql -U crypto_user -d crypto_ai_production -h localhost
\dt
# Should list: users, holdings, trades, recommendations, etc.
\q
```

### **Step 11: Configure Process Manager (PM2)**

**Install PM2 globally:**

```bash
npm install -g pm2
```

**Create PM2 ecosystem file:**

```bash
nano ecosystem.config.js
```

**Paste this configuration:**

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
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Start application with PM2:**

```bash
# Start app
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Set up PM2 to start on boot (if you have access)
pm2 startup
# Follow the command it outputs

# Check status
pm2 status

# View logs
pm2 logs crypto-trader
```

### **Step 12: Configure Reverse Proxy (Nginx/Apache)**

**Cloudways uses Nginx/Apache. You need to proxy requests to your Node.js app.**

**For Nginx (Cloudways typically uses this):**

```bash
# Edit Nginx config
# Location varies, typically in: /etc/nginx/sites-available/

# OR use Cloudways Application Settings:
# Go to: Application Settings → Deployment Via Git → Advanced
```

**Add this configuration:**

```nginx
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
}
```

**⚠️ CLOUDWAYS SPECIFIC:**

Cloudways manages Nginx configs. You may need to:

1. **Contact Cloudways Support** to add custom Nginx rules
2. **Or use Application URL** with port forwarding (they may handle this automatically)

**Test configuration:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### **Step 13: Configure Domain & SSL**

**In Cloudways Dashboard:**

1. **Go to Application Management → Domain Management**
2. **Click "Add Domain"**
3. **Enter your IONOS domain:** `your-domain.com`
4. **Enable SSL:** Cloudways provides free Let's Encrypt SSL
5. **Click "Save"**

**Or manually configure SSL:**

```bash
# If you have access, use Certbot
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### **Step 14: Update Google OAuth Redirect URLs**

**Go to Google Cloud Console:**

1. **APIs & Services → Credentials**
2. **Edit your OAuth Client ID**
3. **Add Authorized JavaScript origins:**
   ```
   https://your-domain.com
   ```
4. **Add Authorized redirect URIs:**
   ```
   https://your-domain.com
   https://your-domain.com/
   ```
5. **Save**

### **Step 15: Test Deployment**

```bash
# Check if app is running
pm2 status

# Test locally on server
curl http://localhost:3000/api/health
# Should return: {"status":"healthy"}

# Test via public domain
curl https://your-domain.com/api/health
# Should return: {"status":"healthy"}
```

**Open in browser:**
```
https://your-domain.com
```

You should see the login page!

---

## Post-Deployment Tasks

### **1. Monitor Application**

```bash
# View logs
pm2 logs crypto-trader

# Monitor resources
pm2 monit

# Check for errors
tail -f logs/error.log
```

### **2. Set Up Automated Backups**

**Database Backup Script:**

```bash
# Create backup script
nano /home/master/scripts/backup-crypto-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/master/backups/crypto-trader"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="crypto_ai_production"
DB_USER="crypto_user"

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD="your_db_password" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_${TIMESTAMP}.sql.gz"
```

```bash
# Make executable
chmod +x /home/master/scripts/backup-crypto-db.sh

# Add to crontab
crontab -e
```

Add line:
```
0 2 * * * /home/master/scripts/backup-crypto-db.sh >> /home/master/backups/backup.log 2>&1
```

### **3. Set Up Monitoring**

**Health Check Endpoint:**

Create a simple monitoring script:

```bash
# Create monitor script
nano /home/master/scripts/health-check.sh
```

```bash
#!/bin/bash
HEALTH_URL="https://your-domain.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "$(date): Health check failed with status $RESPONSE" >> /home/master/logs/health-check.log
    # Restart app
    pm2 restart crypto-trader
fi
```

```bash
chmod +x /home/master/scripts/health-check.sh

# Add to crontab (check every 5 minutes)
crontab -e
```

Add line:
```
*/5 * * * * /home/master/scripts/health-check.sh
```

---

## Troubleshooting

### **Problem: Port 3000 already in use**

```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port in .env
PORT=3001
```

### **Problem: Cannot connect to database**

```bash
# Test PostgreSQL connection
psql -U crypto_user -d crypto_ai_production -h localhost

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check credentials in .env match database
```

### **Problem: Redis connection failed**

```bash
# Test Redis
redis-cli ping

# Start Redis if stopped
sudo systemctl start redis

# Check Redis is listening
netstat -tulpn | grep 6379
```

### **Problem: Permission denied**

```bash
# Fix ownership
chown -R master:master /home/master/applications/crypto-trader

# Fix permissions
chmod -R 755 /home/master/applications/crypto-trader
chmod 600 .env
```

### **Problem: Nginx configuration issues**

**Contact Cloudways support** - they manage Nginx and can add custom configs for you.

### **Problem: SSL certificate not working**

```bash
# Check SSL status in Cloudways Dashboard
# Application → SSL Certificate

# Force renew
sudo certbot renew --force-renewal

# Check certificate
sudo certbot certificates
```

### **Problem: Application crashes on start**

```bash
# Check PM2 logs
pm2 logs crypto-trader --lines 100

# Check error logs
cat logs/error.log

# Common issues:
# 1. Missing environment variables
# 2. Database connection failed
# 3. Redis connection failed
# 4. Port already in use
```

---

## Cloudways-Specific Notes

### **File Structure**

```
/home/master/
├── applications/
│   └── crypto-trader/
│       ├── public_html/          # Your app here
│       │   ├── dist/
│       │   ├── node_modules/
│       │   ├── package.json
│       │   ├── .env
│       │   └── ecosystem.config.js
│       └── logs/
├── backups/
└── scripts/
```

### **Important Cloudways Features**

1. **Managed Database**: PostgreSQL available, configure via dashboard
2. **Redis Add-On**: May need to enable (contact support)
3. **SSL Certificate**: Free Let's Encrypt via dashboard
4. **Git Deployment**: Can set up auto-deploy from GitHub
5. **Backup Service**: Cloudways offers automated backups (paid)
6. **Monitoring**: Built-in server monitoring
7. **Team Management**: Invite team members

### **Limitations**

- Limited SSH/sudo access (varies by plan)
- Nginx configuration requires support ticket
- Some system-level changes need support
- Root access not available on most plans

---

## Maintenance Commands

```bash
# Update application
cd /home/master/applications/crypto-trader/public_html
git pull origin main
npm install --production
npm run build
pm2 restart crypto-trader

# View logs
pm2 logs crypto-trader
tail -f logs/combined.log

# Restart application
pm2 restart crypto-trader

# Stop application
pm2 stop crypto-trader

# Check status
pm2 status
pm2 monit

# Database operations
psql -U crypto_user -d crypto_ai_production -h localhost

# Redis operations
redis-cli
> KEYS *
> INFO
> FLUSHDB  # Careful! Clears all Redis data
```

---

## Security Checklist

- [ ] Changed JWT_SECRET to strong random string
- [ ] Database user has strong password
- [ ] .env file has 600 permissions
- [ ] SSL certificate is active
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] SSH key-based authentication enabled
- [ ] Regular backups configured
- [ ] Monitoring/alerts set up
- [ ] PM2 logs rotate regularly
- [ ] Google OAuth URLs updated for production domain
- [ ] All API keys from development removed/changed

---

## Next Steps

1. **Test all functionality:**
   - User registration/login
   - Portfolio operations
   - Discovery system
   - AI recommendations
   - Trading execution

2. **Monitor for 24 hours:**
   - Check logs for errors
   - Verify job scheduler working
   - Test performance under load

3. **Set up analytics:**
   - Track user activity
   - Monitor API costs
   - System performance metrics

4. **Document your setup:**
   - Save all credentials securely
   - Document any custom configurations
   - Create runbook for common operations

---

## Support

**Cloudways Support:**
- Live Chat: Available in dashboard
- Ticket System: For non-urgent issues
- Knowledge Base: https://support.cloudways.com/

**Application Issues:**
- Check logs: `pm2 logs crypto-trader`
- Review error logs: `logs/error.log`
- Test API health: `curl https://your-domain.com/api/health`

---

**Deployment checklist complete! Your application should now be live at your domain.** 🚀
