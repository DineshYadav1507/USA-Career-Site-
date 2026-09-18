# Deployment Runbook — Talent Inspirations

## Safety rule

This runbook applies only to Talent Inspirations.

Do not delete the entire VPS. Do not stop unrelated PM2 applications.

Known unrelated PM2 apps:
- gym-whatsapp
- karmabhoomi

Talent Inspirations:
- project: /root/USA-Career-Site-
- PM2: talent-api
- frontend: /var/www/talent-inspirations
- API: 127.0.0.1:4000

## Fresh deployment

```bash
cd /root
pm2 stop talent-api || true
rm -rf /root/USA-Career-Site-
git clone https://github.com/DineshYadav1507/USA-Career-Site-.git
cd /root/USA-Career-Site-
git checkout main
```

## Database

The schema is destructive.

Backup first if old Talent Inspirations data matters.

```bash
mysql -u root -p < database/schema.sql
```

Verify:

```bash
mysql -u root -p -e "USE talent_inspirations; SHOW TABLES;"
```

## Environment

```bash
cd /root/USA-Career-Site-/server
cp .env.example .env
nano .env
```

Set real values for:
- DB credentials
- JWT secret
- public web URL
- WhatsApp Web settings if defaults need changing
- Stripe settings if billing is enabled

Never commit `.env`.

## Backend

```bash
npm install
node --check src/server.js
node --check src/careerAgent.js
node --check src/whatsappWeb.js
node --check src/billing.js
pm2 delete talent-api || true
pm2 start src/server.js --name talent-api
pm2 save
```

## Frontend

```bash
cd /root/USA-Career-Site-/client
npm install
npm run build
rm -rf /var/www/talent-inspirations/*
cp -r dist/* /var/www/talent-inspirations/
chown -R www-data:www-data /var/www/talent-inspirations
```

## Nginx

```bash
nginx -t
systemctl reload nginx
```

## Verify

```curl http://127.0.0.1:4000/api/health```

Then:

```
pm2 status
pm2 logs talent-api --lines 200
```

## WhatsApp first login

When the backend starts without an authenticated LocalAuth session, a QR is printed to the PM2 log/terminal.

Watch:

```bash
pm2 logs talent-api --lines 200
```

Scan the QR from WhatsApp on the intended account.

Do not copy `server/.wwebjs_auth` into Git.

## Post-deployment smoke tests

1. Health endpoint returns database connected.
2. Five healthcare sources exist when DB was empty.
3. Career Agent creates scan runs.
4. USA jobs appear.
5. Non-USA jobs are excluded.
6. Apply URL opens the employer source.
7. Website assistant answers product questions.
8. User can register/login.
9. Alert can be created.
10. WhatsApp opt-in validates international format.
11. Admin can add/scan/remove a source.
12. Admin grant/revoke works.
13. Stripe is only tested when production/test keys are configured.

## Rollback

Do not blindly restore old architecture.

If a deployment fails:
- inspect PM2 logs
- inspect Nginx logs
- inspect DB error
- compare Git commit
- fix forward or explicitly revert the relevant commit

Keep unrelated services untouched.
