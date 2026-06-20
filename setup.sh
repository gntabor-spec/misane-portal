#!/usr/bin/env bash
# Misane Portal — first-time VPS setup. Run once on the VPS as root.
# Prereq: app.misaneproperties.com A-record points to this server.
set -e
APP=/var/www/misane-portal

# 1) clone (or pull) the repo
mkdir -p /var/www && cd /var/www
[ -d "$APP/.git" ] || git clone https://github.com/gntabor-spec/misane-portal.git
cd "$APP"

# 2) backend: python venv + deps
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cp -n .env.example .env   # then EDIT .env with real secrets (Stripe keys come in M4)

# 3) frontend: build
cd ../frontend
cp -n .env.example .env
npm install
npm run build

# 4) systemd service for the API (uvicorn on 127.0.0.1:8200)
cat > /etc/systemd/system/misane-portal.service <<'UNIT'
[Unit]
Description=Misane Portal API
After=network.target
[Service]
WorkingDirectory=/var/www/misane-portal/backend
EnvironmentFile=/var/www/misane-portal/backend/.env
ExecStart=/var/www/misane-portal/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8200
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now misane-portal

# 5) nginx: serve frontend/dist, proxy /api to the service
cat > /etc/nginx/sites-available/misane-portal <<'NGINX'
server {
    listen 80;
    server_name app.misaneproperties.com;
    root /var/www/misane-portal/frontend/dist;
    index index.html;
    location /api/ { proxy_pass http://127.0.0.1:8200; proxy_set_header Host $host; }
    location / { try_files $uri $uri/ /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/misane-portal /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d app.misaneproperties.com
echo "Done. Edit backend/.env with real secrets, then: systemctl restart misane-portal"
