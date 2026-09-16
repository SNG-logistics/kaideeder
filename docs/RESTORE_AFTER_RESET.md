# กู้ข้อมูลหลังกด "รีเซ็ตข้อมูลทดสอบ" ผิด

ปุ่ม **ตั้งค่า → รีเซ็ตข้อมูลทดสอบ** (`POST /api/system/reset-test`) ลบข้อมูลธุรกรรมทั้งหมดของร้าน
และตั้งยอดสต็อกเป็น 0 ทันทีในฐานข้อมูลจริง เอกสารนี้อธิบายว่ากู้กลับได้อย่างไร

## สิ่งที่การรีเซ็ตทำ

| ถูกลบทั้งตาราง (เฉพาะ tenant ที่กด) | ถูกตั้งค่าใหม่ (แถวยังอยู่) |
|---|---|
| `orders`, `order_items`, `payments`, `delivery_info`, `sales_events`, `consume_fail_logs` | `inventory` → `quantity`, `reservedQty`, `avgCost` = 0 |
| `stock_movements` | `dining_tables` → `status` = `AVAILABLE` |
| `purchase_orders`, `purchase_items` | |
| `stock_transfers`, `transfer_items` | |
| `stock_adjustments`, `adjustment_items` | |
| `stock_counts`, `stock_count_items` | |
| `prep_productions` | |
| `sales_imports`, `sales_import_items` | |
| `sku_suggestions`, `ai_item_classifications`, `validation_issues`, `ai_recommendations`, `entity_usage_summary` | |

ไม่แตะ: สินค้า, หมวดหมู่, ผู้ใช้, สูตร (BOM / Prep), คลัง, Supplier, โต๊ะ, การตั้งค่าร้าน

## วิธีที่ 1 — กู้จาก snapshot ที่ระบบสร้างให้ (รีเซ็ตที่ทำหลังอัปเดตนี้)

ตั้งแต่เวอร์ชันนี้ ก่อนลบระบบจะเขียนทุกแถวที่กำลังจะลบลงไฟล์
`backups/reset-test/<tenantCode>_<YYYYMMDD-HHmmss>.json` ในโฟลเดอร์แอป
(บนเซิร์ฟเวอร์คือ `/var/www/vhosts/kaideeder.com/httpdocs/backups/reset-test/`)
และหน้าจอหลังรีเซ็ตเสร็จจะบอกชื่อไฟล์ ถ้าเขียนไฟล์ไม่สำเร็จ ระบบจะไม่ลบอะไรเลย

```bash
ssh <user>@<server>
cd /var/www/vhosts/kaideeder.com/httpdocs
ls -lt backups/reset-test/                 # หาไฟล์ล่าสุด

# ดูก่อนว่าจะกู้อะไรบ้าง (ไม่แก้ DB)
npx tsx scripts/restore-reset-snapshot.ts backups/reset-test/<file>.json --dry-run

# กู้จริง
npx tsx scripts/restore-reset-snapshot.ts backups/reset-test/<file>.json
```

- แถวถูกใส่กลับด้วย id เดิม (`createMany` + `skipDuplicates`) รันซ้ำได้ ไม่ทับข้อมูลที่สร้างหลังรีเซ็ต
- ถ้ามีการเคลื่อนไหวสต็อกใหม่หลังเวลารีเซ็ต สคริปต์จะ **ไม่** เขียนทับยอดคงเหลือ
  ใส่ `--force` ถ้าต้องการให้ทับด้วยค่าตอนรีเซ็ต หรือ `--skip-inventory` ถ้าไม่ต้องการแตะยอดเลย
- สคริปต์อ่าน `DATABASE_URL` จาก environment → `.env.production` → `.env`

## วิธีที่ 2 — กู้จาก backup ของ Plesk (รีเซ็ตที่ทำก่อนอัปเดตนี้ ไม่มี snapshot)

ห้าม restore ทับฐานข้อมูลจริงทั้งก้อน เพราะจะย้อนข้อมูลอื่นทั้งหมดกลับไปด้วย
ให้ restore ลง DB ชั่วคราวแล้วคัดลอกเฉพาะตารางที่หายไปกลับมา

1. **หา backup ล่าสุดก่อนเวลาที่กดรีเซ็ต**
   Plesk → Websites & Domains → `kaideeder.com` → **Backup & Restore** (Backup Manager)
   ถ้าไม่มีให้ดู Hostinger hPanel → VPS → Snapshots & Backups
2. **ดาวน์โหลด dump ของ DB** จาก backup นั้น (ใน Backup Manager เลือก restore เฉพาะ database
   แล้วเลือกปลายทางเป็น DB ใหม่ หรือดาวน์โหลดไฟล์ backup แล้วแตกเอา `.sql` ของ `snglogis_kaideeder_db`)
3. **โหลดลง DB ชั่วคราว**
   ```bash
   mysql -u root -p -e "CREATE DATABASE snglogis_kaideeder_restore"
   mysql -u root -p snglogis_kaideeder_restore < snglogis_kaideeder_db.sql
   ```
4. **คัดลอกกลับเฉพาะ tenant ของร้าน** (แทน `<TENANT_ID>` ด้วยค่าจาก
   `SELECT id FROM snglogis_kaideeder_db.tenants WHERE code = 'kaideeder';`)
   ```sql
   SET @t = '<TENANT_ID>';
   USE snglogis_kaideeder_db;

   -- ตารางแม่ก่อน ตารางลูกทีหลัง
   INSERT IGNORE INTO orders                 SELECT * FROM snglogis_kaideeder_restore.orders                 WHERE tenantId = @t;
   INSERT IGNORE INTO order_items            SELECT * FROM snglogis_kaideeder_restore.order_items            WHERE tenantId = @t;
   INSERT IGNORE INTO payments               SELECT * FROM snglogis_kaideeder_restore.payments               WHERE tenantId = @t;
   INSERT IGNORE INTO delivery_info          SELECT * FROM snglogis_kaideeder_restore.delivery_info          WHERE tenantId = @t;
   INSERT IGNORE INTO sales_events           SELECT * FROM snglogis_kaideeder_restore.sales_events           WHERE tenantId = @t;
   INSERT IGNORE INTO consume_fail_logs      SELECT * FROM snglogis_kaideeder_restore.consume_fail_logs      WHERE tenantId = @t;
   INSERT IGNORE INTO stock_movements        SELECT * FROM snglogis_kaideeder_restore.stock_movements        WHERE tenantId = @t;
   INSERT IGNORE INTO purchase_orders        SELECT * FROM snglogis_kaideeder_restore.purchase_orders        WHERE tenantId = @t;
   INSERT IGNORE INTO purchase_items         SELECT * FROM snglogis_kaideeder_restore.purchase_items         WHERE tenantId = @t;
   INSERT IGNORE INTO stock_transfers        SELECT * FROM snglogis_kaideeder_restore.stock_transfers        WHERE tenantId = @t;
   INSERT IGNORE INTO transfer_items         SELECT * FROM snglogis_kaideeder_restore.transfer_items         WHERE tenantId = @t;
   INSERT IGNORE INTO stock_adjustments      SELECT * FROM snglogis_kaideeder_restore.stock_adjustments      WHERE tenantId = @t;
   INSERT IGNORE INTO adjustment_items       SELECT * FROM snglogis_kaideeder_restore.adjustment_items       WHERE tenantId = @t;
   INSERT IGNORE INTO stock_counts           SELECT * FROM snglogis_kaideeder_restore.stock_counts           WHERE tenantId = @t;
   INSERT IGNORE INTO stock_count_items      SELECT * FROM snglogis_kaideeder_restore.stock_count_items      WHERE tenantId = @t;
   INSERT IGNORE INTO prep_productions       SELECT * FROM snglogis_kaideeder_restore.prep_productions       WHERE tenantId = @t;
   INSERT IGNORE INTO sales_imports          SELECT * FROM snglogis_kaideeder_restore.sales_imports          WHERE tenantId = @t;
   INSERT IGNORE INTO sales_import_items     SELECT * FROM snglogis_kaideeder_restore.sales_import_items     WHERE tenantId = @t;
   INSERT IGNORE INTO sku_suggestions        SELECT * FROM snglogis_kaideeder_restore.sku_suggestions        WHERE tenantId = @t;
   INSERT IGNORE INTO ai_item_classifications SELECT * FROM snglogis_kaideeder_restore.ai_item_classifications WHERE tenantId = @t;
   INSERT IGNORE INTO validation_issues      SELECT * FROM snglogis_kaideeder_restore.validation_issues      WHERE tenantId = @t;
   INSERT IGNORE INTO ai_recommendations     SELECT * FROM snglogis_kaideeder_restore.ai_recommendations     WHERE tenantId = @t;
   INSERT IGNORE INTO entity_usage_summary   SELECT * FROM snglogis_kaideeder_restore.entity_usage_summary   WHERE tenantId = @t;

   -- ยอดคงเหลือ (แถวยังอยู่ แค่ถูกตั้งเป็น 0)
   UPDATE inventory i
     JOIN snglogis_kaideeder_restore.inventory r ON r.id = i.id
     SET i.quantity = r.quantity, i.reservedQty = r.reservedQty, i.avgCost = r.avgCost
   WHERE i.tenantId = @t;

   -- สถานะโต๊ะ
   UPDATE dining_tables d
     JOIN snglogis_kaideeder_restore.dining_tables r ON r.id = d.id
     SET d.status = r.status
   WHERE d.tenantId = @t;
   ```
   `INSERT IGNORE` ข้ามแถวที่มี id ซ้ำอยู่แล้ว จึงไม่ทับออเดอร์ที่สร้างหลังรีเซ็ต
   ถ้าโครงสร้างตารางใน backup กับปัจจุบันไม่เท่ากัน (มีคอลัมน์เพิ่ม/ลด) ต้องระบุชื่อคอลัมน์ใน `INSERT`
5. **ตรวจสอบ** เปิดหน้าสต็อก / ประวัติออเดอร์ / รายงานว่ากลับมาครบ แล้วค่อยลบ DB ชั่วคราว
   ```sql
   DROP DATABASE snglogis_kaideeder_restore;
   ```

ข้อมูลที่เกิดขึ้น **ระหว่างเวลา backup กับเวลาที่กดรีเซ็ต** จะไม่มีใน backup ต้องคีย์ซ้ำ

## วิธีที่ 3 — MariaDB binary log (ถ้าไม่มี backup)

```sql
SHOW VARIABLES LIKE 'log_bin';       -- ต้องเป็น ON
SHOW BINARY LOGS;
```
ถ้าเปิด binlog แบบ ROW อยู่ ให้ใช้ `mysqlbinlog --base64-output=DECODE-ROWS -v` หาช่วงเวลาที่มี
`DELETE FROM ... orders/stock_movements` แล้วสร้าง `INSERT` กลับจากค่าที่ log ไว้
(งานนี้ทำมือค่อนข้างมาก ถ้าไม่ถนัดให้ติดต่อ Hostinger support พร้อมเวลาที่กดรีเซ็ต)
ถ้า `log_bin = OFF` และไม่มี backup ข้อมูลที่ลบไปแล้วกู้คืนไม่ได้ ต้องตั้งยอดสต็อกเริ่มต้นใหม่
ผ่านหน้า **นับสต็อก** หรือ **ปรับปรุงสต็อก** (สร้าง `StockMovement` แบบ `OPENING`)

## ป้องกันครั้งต่อไป

- ตั้ง Plesk Backup Manager ให้ backup ฐานข้อมูลอัตโนมัติทุกวัน (Scheduled backup)
- อย่าใช้ `reset-for-test.js` / `reset-data.js` / `reset-all-for-production.js` ในโฟลเดอร์รากกับ DB จริง
  สคริปต์พวกนี้ **ไม่กรอง tenant** จะล้างทุกร้านในระบบ และไม่มี snapshot
