# KAIDEEDER.com — Deploy Guide (Plesk + MariaDB)

> Node.js 20 LTS | Next.js 15 | MariaDB 10.11.6 | PM2 | Plesk (Hostinger VPS)

---

## ✅ ค่า Plesk ที่ตั้งไว้แล้ว

| รายการ | ค่าจริง |
|--------|---------|
| Database Name | `snglogis_kaideeder_db` |
| DB Username | `snglogis_adminkaideeder` |
| DB Host | `localhost:3306` |
| DB Privileges | Full (Data + Structure) |
| Domain | `kaideeder.com` |

---

## ขั้นตอน Overview

```
1. แก้ DNS → 2. SSH เข้า server → 3. สร้าง .env → 4. Clone repo
→ 5. Install & Build → 6. PM2 Start → 7. SSL → 8. Nginx Proxy
```

---

## 1. แก้ DNS (ต้องทำก่อนทุกอย่าง!)

> ⚠️ DNS ใช้เวลา propagate 5 นาที – 48 ชั่วโมง ทำขั้นนี้ก่อนเสมอ

**ดู IP จริงของ server:**
- Plesk → Websites & Domains → `kaideeder.com` → IP Address อยู่มุมขวาบน

**แก้ที่ DNS Registrar (ที่ซื้อโดเมน):**
| Record | Name | Value |
|--------|------|-------|
| A | `@` (kaideeder.com) | IP จริงของ server |
| A | `www` | IP จริงของ server |

**ตรวจสอบ DNS propagate:**
```bash
# รันบนเครื่อง local ของคุณ
nslookup kaideeder.com
# หรือเช็คที่ https://dnschecker.org
```

---

## 2. SSH เข้า Server

```bash
# หา SSH credentials จาก Plesk → Websites & Domains → SSH
ssh root@YOUR_SERVER_IP
# หรือ SSH user ถ้าไม่ใช่ root:
ssh u123456789@YOUR_SERVER_IP
```

> Plesk path ปกติของ Hostinger: `/var/www/vhosts/kaideeder.com/httpdocs/`

```bash
# ไปที่ web root
cd /var/www/vhosts/kaideeder.com/httpdocs
```

---

## 3. ตั้งค่า Node.js ใน Plesk

> Plesk ต้องเปิด Node.js ให้กับ domain ก่อน

1. Plesk → Websites & Domains → `kaideeder.com`
2. คลิก **Node.js**
3. เลือก **Node.js 20.x** (LTS)
4. กด **Enable**

ถ้าไม่มีปุ่ม Node.js — ต้องติดตั้งผ่าน SSH:
```bash
# ติดตั้ง Node.js 20 LTS (บน server Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ตรวจสอบ
node -v   # ควรได้ v20.x.x
npm -v
```

---

## 4. Clone โค้ดจาก GitHub

```bash
cd /var/www/vhosts/kaideeder.com/httpdocs

# Clone repo (ใส่ . ท้ายเพื่อ clone เข้า folder นี้เลย)
git clone https://github.com/SNG-logistics/kaideeder.git .

# ตรวจสอบว่ามีไฟล์แล้ว
ls -la
```

> ถ้ามีไฟล์เก่าอยู่แล้วและต้อง pull ใหม่: ดูส่วน **Redeploy** ด้านล่าง

---

## 5. สร้างไฟล์ .env.production บน Server

> ⚠️ ไฟล์นี้ไม่อยู่ใน Git (เพื่อความปลอดภัย) ต้องสร้างมือบน server

```bash
nano /var/www/vhosts/kaideeder.com/httpdocs/.env.production
```

วางเนื้อหาทั้งหมดนี้ (แก้ค่าที่ขีดเส้นใต้):

```env
NODE_ENV="production"

# ─── Database ───────────────────────────────────────────────────
# ใส่ password จริงที่ตั้งใน Plesk Database section
DATABASE_URL="mysql://snglogis_adminkaideeder:YOUR_DB_PASSWORD@localhost:3306/snglogis_kaideeder_db"

# ─── App URL ────────────────────────────────────────────────────
NEXTAUTH_URL="https://kaideeder.com"
NEXT_PUBLIC_APP_URL="https://kaideeder.com"

# ─── Secrets (สร้างด้วยคำสั่งข้างล่าง!) ────────────────────────
JWT_SECRET="REPLACE_WITH_RANDOM_SECRET"
NEXTAUTH_SECRET="REPLACE_WITH_RANDOM_SECRET"
ADMIN_JWT_SECRET="REPLACE_WITH_ANOTHER_SECRET"
CRON_SECRET="REPLACE_WITH_SHORT_RANDOM"

# ─── AI (ถ้าใช้ CometAPI) ────────────────────────────────────────
COMET_API_KEY="sk-..."
COMET_API_URL="https://api.cometapi.com/v1"
COMET_MODEL="gpt-4o"
```

**สร้าง random secrets (รันบน server):**
```bash
# รันทีละบรรทัด แล้ว copy ผลลัพธ์ไปใส่ .env.production
node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"
```

บันทึกไฟล์: `Ctrl+X` → `Y` → `Enter`

---

## 6. Install, Migrate, Build

```bash
cd /var/www/vhosts/kaideeder.com/httpdocs

# Copy .env.production → .env (Next.js อ่าน .env เป็นหลัก)
cp .env.production .env

# ติดตั้ง packages เฉพาะ production (ไม่โหลด devDependencies)
npm install --omit=dev

# สร้าง Prisma client (จำเป็นทุกครั้งหลัง clone ใหม่)
npx prisma generate

# สร้าง/อัพเดท database tables (ครั้งแรกหรือหลัง schema เปลี่ยน)
npx prisma db push
# ↑ คำสั่งนี้จะสร้าง table ใน snglogis_kaideeder_db ให้อัตโนมัติ
# ถ้าได้ error "Access denied" = password ใน .env ผิด

# Build Next.js (ใช้เวลา 2-5 นาที)
npm run build

# Copy static assets เข้า standalone (จำเป็นสำหรับ standalone mode!)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
# ↑ ถ้าข้ามขั้นนี้ CSS/JS จะโหลดไม่ได้บนเว็บ
```

---

## 7. แก้ ecosystem.config.js

เปิดไฟล์:
```bash
nano /var/www/vhosts/kaideeder.com/httpdocs/ecosystem.config.js
```

แก้ `cwd` ให้ตรงกับ path จริง:
```js
cwd: '/var/www/vhosts/kaideeder.com/httpdocs',
```

---

## 8. รัน PM2

```bash
# ติดตั้ง PM2 แบบ global (ครั้งแรกครั้งเดียว)
npm install -g pm2

# สร้าง logs folder
mkdir -p /var/www/vhosts/kaideeder.com/httpdocs/logs

# Start app
pm2 start ecosystem.config.js --env production

# ตรวจสอบสถานะ
pm2 status
pm2 logs kaideeder --lines 50   # ดู log ล่าสุด

# ตั้งให้ PM2 start อัตโนมัติตอน server reboot
pm2 save
pm2 startup
# ↑ PM2 จะแสดงคำสั่งให้รัน copy-paste แล้วรันตามได้เลย
```

**PM2 commands ที่ใช้บ่อย:**
```bash
pm2 status              # ดูสถานะทุก app
pm2 logs kaideeder      # ดู log realtime
pm2 restart kaideeder   # restart app
pm2 stop kaideeder      # หยุด app
pm2 delete kaideeder    # ลบออกจาก PM2
```

---

## 9. ตั้ง SSL (Let's Encrypt ใน Plesk)

1. Plesk → Websites & Domains → `kaideeder.com`
2. คลิก **SSL/TLS Certificates**
3. คลิก **Get it free** ใต้ Let's Encrypt
4. ติ๊ก:
   - ✅ `kaideeder.com`
   - ✅ `*.kaideeder.com` (wildcard — ครอบ www และ subdomain อื่น)
   - ✅ Redirect HTTP → HTTPS
5. ใส่ email → กด **Get it free**

> ✅ ไม่ต้องใช้ Certbot — Plesk ต่ออายุ SSL ให้อัตโนมัติทุก 90 วัน

---

## 10. Nginx Reverse Proxy ใน Plesk

> Nginx ต้องส่ง request ทั้งหมดมาที่ Next.js port 3000

1. Plesk → Websites & Domains → `kaideeder.com`
2. คลิก **Apache & nginx Settings**
3. ตั้ง **nginx settings**:
   - ✅ เปิด **Proxy mode**
   - ✅ เปิด **Smart static files processing**
   - Max HTTP body size: **50 MB**
4. เลื่อนลงมาหา **Additional nginx directives** แล้วใส่:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeout สำหรับ request นานๆ (เช่น Excel import)
    proxy_read_timeout 120s;
    proxy_connect_timeout 60s;
}
```

5. กด **OK**

---

## Redeploy (ทุกครั้งที่ push โค้ดใหม่)

```bash
ssh user@YOUR_SERVER_IP
cd /var/www/vhosts/kaideeder.com/httpdocs

# 1. ดึงโค้ดใหม่
git pull origin main

# 2. ติดตั้ง package ที่เพิ่มมาใหม่ (ถ้ามี)
npm install --omit=dev

# 3. อัพเดท database schema (ถ้า prisma/schema.prisma เปลี่ยน)
npx prisma generate
npx prisma db push

# 4. Build ใหม่
npm run build

# 5. Copy static assets
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 6. Restart app
pm2 restart kaideeder

# 7. ตรวจสอบว่า start สำเร็จ
pm2 status
pm2 logs kaideeder --lines 30
```

---

## Troubleshooting

### ❌ `Cannot find module './xxx.js'`
```bash
# .next folder เสียหาย — ลบแล้ว build ใหม่
rm -rf .next
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
pm2 restart kaideeder
```

### ❌ `Access denied for user` (Database error)
- ตรวจสอบ password ใน `.env` ตรงกับที่ตั้งใน Plesk หรือไม่
- ทดสอบ: `mysql -u snglogis_adminkaideeder -p snglogis_kaideeder_db`

### ❌ หน้าเว็บขึ้น 502 Bad Gateway
```bash
pm2 status        # ดูว่า app status เป็น "online" ไหม
pm2 logs kaideeder --lines 50   # ดู error
```

### ❌ CSS/JS โหลดไม่ได้ (หน้าเว็บไม่มีสไตล์)
```bash
# ลืม copy static files
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
pm2 restart kaideeder
```

### ❌ `git pull` failed — no tracking branch
```bash
git pull origin main
```

---

## Security Checklist

- [ ] DNS ชี้ถูก IP แล้ว
- [ ] `.env` และ `.env.production` **ไม่อยู่ใน Git** (อยู่ใน .gitignore)
- [ ] `JWT_SECRET` และ `NEXTAUTH_SECRET` เป็น random 40+ chars
- [ ] SSL Let's Encrypt ติดตั้งแล้ว (https://)
- [ ] HTTP redirect → HTTPS เปิดอยู่ใน Plesk
- [ ] `npm install --omit=dev` (ไม่มี devDependencies บน server)
- [ ] PM2 startup ตั้งค่าแล้ว (auto-start หลัง reboot)
- [ ] Max body size nginx ≤ 50MB (ไม่ใช่ 3GB)
