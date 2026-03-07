# KAIDEEDER.com — Deploy Guide (Plesk + MariaDB)

> Node.js 18+ | Next.js 15 | MariaDB 10.11.6

---

## ✅ ตั้งค่าแล้ว (Plesk)

| รายการ | ค่าจริง |
|--------|---------|
| Database | `snglogis_kaideeder_db` |
| DB User | `snglogis_adminkaideeder` |
| DB Server | `localhost:3306` |
| Privileges | Full (Data + Structure) |

---

## 1. แก้ DNS (ต้องทำก่อน!)

> ⚠️ ขณะนี้ `kaideeder.com` ชี้ไปที่ IP ผิด

- เข้า **DNS Registrar** (ที่ซื้อโดเมน)
- แก้ **A Record** ของ `kaideeder.com` และ `www.kaideeder.com`
- ชี้ไปที่ **IP จริงของ Plesk server** (ดูได้จาก Plesk → Websites & Domains)

---

## 2. ตั้งค่า .env.production

สร้างไฟล์ `.env.production` บน server:

```env
NODE_ENV="production"

# ← ใส่ password จริงที่ตั้งใน Plesk
DATABASE_URL="mysql://snglogis_adminkaideeder:YOUR_DB_PASSWORD@localhost:3306/snglogis_kaideeder_db"

NEXT_PUBLIC_APP_URL="https://kaideeder.com"

# สร้างด้วย: node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
JWT_SECRET="RANDOM_40_CHAR_SECRET"
ADMIN_JWT_SECRET="ANOTHER_RANDOM_40_CHAR_SECRET"
```

---

## 3. Upload Code (SSH / SFTP)

```bash
ssh user@YOUR_SERVER_IP
cd /var/www/vhosts/kaideeder.com/httpdocs   # ← path จริงใน Plesk

# วิธี A: Git
git clone https://github.com/YOUR_REPO.git .

# วิธี B: SFTP (FileZilla)
# upload ทุกไฟล์ยกเว้น node_modules/ และ .next/
```

---

## 4. Build & Migrate

```bash
cp .env.production .env
npm install --omit=dev
npx prisma generate
npx prisma db push      # สร้าง tables ใน snglogis_kaideeder_db
npm run build

# Copy static (standalone mode)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

---

## 5. รัน PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup
```

> แก้ `cwd` ใน `ecosystem.config.js` ให้ตรงกับ path จริงบน server

---

## 6. ตั้ง SSL (Plesk)

Plesk มี **Let's Encrypt built-in**:
1. Plesk → Websites & Domains → `kaideeder.com`
2. คลิก **SSL/TLS Certificates**
3. เลือก **Let's Encrypt** → Install

> ไม่ต้องใช้ Certbot ด้วยตนเอง — Plesk จัดการให้

---

## 7. Nginx ใน Plesk

Plesk จัดการ Nginx ให้อัตโนมัติ แต่ต้องตั้ง **reverse proxy**:

1. Plesk → Websites & Domains → `kaideeder.com`
2. **Apache & nginx Settings**
3. เปิด **Proxy mode** หรือเพิ่ม Additional nginx directives:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Redeploy

```bash
git pull
npm install --omit=dev
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
pm2 restart kaideeder
```

---

## Security Checklist

- [ ] DNS ชี้ถูก IP แล้ว
- [ ] `.env.production` ไม่อยู่ใน Git
- [ ] JWT_SECRET random 40+ chars
- [ ] SSL ติดตั้งแล้ว (https://)
