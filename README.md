# Talent Inspirations

USA-only career intelligence platform.

## New architecture

- Career Agent scans every admin-added public career page every 5 minutes.
- Public job index keeps active USA jobs with 3/7/15/30 day windows.
- Public Greenhouse, Lever and Workday feeds are detected when exposed by a career page; JSON-LD JobPosting is also supported.
- Skill mapping extracts common engineering, data, cloud and security skills.
- User alerts support role, category, industry, location and skill filters.
- WhatsApp alerts are ready for Meta WhatsApp Cloud API.
- Stripe Checkout subscription foundation is included.
- Admin grants let selected users remain free for any period or indefinitely.
- Admin Agent Chat supports commands such as 'add all healthcare career links'.
- Every job keeps the original employer application URL.

## First 5 healthcare sources

1. CVS Health
2. The Cigna Group
3. UnitedHealth Group
4. Elevance Health
5. HCA Healthcare

## Important

The database schema intentionally drops the old Talent Inspirations tables so the new platform starts clean. Take a backup first if you need old data.

## Backend

    cd server
    cp .env.example .env
    npm install
    node src/createAdmin.js admin@example.com StrongPassword
    npm start

Set DB credentials and JWT_SECRET in .env.

### WhatsApp

Set WHATSAPP_API_VERSION, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN. The sender must be a WhatsApp Business/Cloud API number; a normal personal WhatsApp number cannot be used as the API sender.

### Stripe

Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET and PUBLIC_WEB_URL. The server creates subscription Checkout sessions and updates plans from webhook events.

## Client

    cd client
    npm install
    npm run build

Set VITE_API_URL to the deployed API base.

## VPS deployment

    cd /root/USA-Career-Site-
    git pull --ff-only origin main
    mysql -u root -p < database/schema.sql
    cd server
    npm install
    node --check src/server.js
    node --check src/careerAgent.js
    node --check src/whatsapp.js
    node --check src/billing.js
    pm2 restart talent-api --update-env
    cd ../client
    npm install
    npm run build
    rm -rf /var/www/talent-inspirations/*
    cp -r dist/* /var/www/talent-inspirations/
    chown -R www-data:www-data /var/www/talent-inspirations
    nginx -t
    systemctl reload nginx

After startup, watch: pm2 logs talent-api --lines 200

## Roadmap

The rebuild uses public HTTP/ATS sources and a deterministic admin command catalog. More ATS adapters, browser-rendered JavaScript pages, resume parsing and semantic skill matching can be added without changing the public job model.
