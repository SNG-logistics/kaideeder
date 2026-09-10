# เชื่อมต่อปริ้นเตอร์ในตัวของแท็บเล็ต Sunmi กับ KAIDEEDER POS

เอกสารนี้อธิบายว่าทำไมการพิมพ์จากแอป APK ถึงไม่ออก และต้องทำอะไรฝั่งแอป Android
เพื่อให้ POS พิมพ์ slip ครัว/บาร์ และใบเสร็จออกทางปริ้นเตอร์ในตัวของ Sunmi (D2s, D2s PLUS, T2, V2, V2s ฯลฯ)

> ฝั่งเว็บ (POS) รองรับแล้ว — โค้ดอยู่ที่ `src/lib/nativePrinter.ts`
> สิ่งที่ต้องทำเพิ่มคือ **ฝั่งแอป APK** ตามหัวข้อ 3

---

## 1. ทำไมพิมพ์จากแอป APK ไม่ออก

| วิธีพิมพ์เดิม | ใน Chrome บน PC | ใน WebView ของแอป APK |
|---|---|---|
| `window.open()` เปิดหน้าใบเสร็จ → `window.print()` | ✅ | ❌ WebView ไม่เปิดหน้าต่างใหม่ และไม่มีหน้าต่าง Print |
| TCP ESC/POS ไปที่ IP ของเครื่องพิมพ์ (`/api/print/raw`) | ✅ ถ้ามีเครื่องพิมพ์ LAN | ❌ ปริ้นเตอร์ในตัว Sunmi **ไม่มี IP** เป็นอุปกรณ์ภายในเครื่อง |

ปริ้นเตอร์ในตัวของ Sunmi เข้าถึงได้จาก **แอป Android เท่านั้น** ผ่าน Sunmi Printer Service
ดังนั้นแอป APK ต้องเป็นตัวกลาง: เว็บ → JS bridge → แอป → Sunmi Printer Service → กระดาษ

---

## 2. ทางเลือกทั้งหมด (เลือกอย่างใดอย่างหนึ่ง)

1. **(แนะนำ) แอป APK ที่ฝัง bridge `window.SunmiPrinter`** — พิมพ์ครัว/บาร์/ใบเสร็จได้ครบ รองรับภาษาลาว/ไทย
   เพราะเว็บจะ render เป็นรูปแล้วส่งไปพิมพ์ → ทำตามหัวข้อ 3
2. **เปิด POS ใน Chrome บนเครื่อง Sunmi แล้วกดพิมพ์** — Android จะเปิดหน้าต่าง Print ของระบบ
   ถ้าเฟิร์มแวร์ของเครื่องมี "Sunmi Printer" ในรายการ ก็เลือกพิมพ์ได้ (ขึ้นกับรุ่น/เฟิร์มแวร์ ไม่ทุกเครื่องมี)
   ต้องกดยืนยันทุกครั้ง ไม่ auto
3. **ซื้อเครื่องพิมพ์ความร้อนแบบ LAN/WiFi** (Xprinter / Epson / Star, port 9100) แล้วตั้ง IP ใน
   ตั้งค่า → "ตั้งค่าเครื่องพิมพ์ (Multi-Printer)" — ใช้ระบบ TCP ที่มีอยู่แล้ว ไม่ต้องแก้แอป

---

## 3. ฝั่งแอป Android — ฝัง bridge

### 3.1 สัญญา (contract) ของ `window.SunmiPrinter`

เว็บจะเรียก object ชื่อ `SunmiPrinter` ที่แอป inject เข้ามาด้วย `addJavascriptInterface`
ทุก method รับ/คืนได้แค่ string, number, boolean (ข้อจำกัดของ JS bridge)

| Method | จำเป็น | ทำอะไร |
|---|---|---|
| `isReady(): boolean` | แนะนำ | `true` เมื่อผูก Sunmi Printer Service สำเร็จแล้ว |
| `printText(text: string)` | **ต้องมี** | พิมพ์ข้อความ UTF-8 (ขึ้นบรรทัดด้วย `\n`) — ใช้เป็น fallback |
| `printImage(base64Png: string)` | **แนะนำมาก** | พิมพ์รูป PNG (base64 ไม่มี `data:` นำหน้า) กว้าง ≤ 576px (80mm) / ≤ 384px (58mm) — เว็บใช้ทางนี้เป็นหลักเพื่อให้ตัวอักษรลาว/ไทยออกถูกต้อง |
| `lineFeed(n: number)` | แนะนำ | เลื่อนกระดาษ n บรรทัด |
| `cutPaper()` | แนะนำ | ตัดกระดาษ (รุ่นที่มีที่ตัด) |
| `getPaperWidthMm(): number` | ไม่บังคับ | คืน `58` หรือ `80` — ถ้าไม่มี เว็บใช้ค่าจากหน้าตั้งค่า |

เว็บตรวจว่า `window.SunmiPrinter` มีอยู่และ `printText` เป็น function → ถือว่าอยู่ในแอป
และจะพิมพ์ผ่าน bridge ก่อนเสมอ (ปิดได้ที่ ตั้งค่า → "ปริ้นเตอร์ในตัวเครื่อง")

### 3.2 Dependencies (`app/build.gradle` หรือ `build.gradle.kts`)

```kotlin
android {
    defaultConfig { minSdk = 22 }   // Sunmi รุ่นเก่ายัง Android 5.1/7.1
}
dependencies {
    implementation("com.sunmi:printerlibrary:1.0.19")   // Sunmi Printer SDK (AIDL wrapper) — อยู่บน mavenCentral
    implementation("androidx.webkit:webkit:1.11.0")
}
```

`settings.gradle` ต้องมี `mavenCentral()` ใน `repositories`

### 3.3 `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />

<!-- Android 11+ ต้องประกาศ package ของ Sunmi printer service ถึงจะ bind ได้ -->
<queries>
    <package android:name="woyou.aidlservice.jiuiv5" />
</queries>

<application
    android:usesCleartextTraffic="true"   <!-- เฉพาะกรณีเซิร์ฟเวอร์เป็น http:// ถ้าเป็น https ลบออกได้ -->
    ...>
    <activity android:name=".MainActivity"
        android:configChanges="orientation|screenSize|keyboardHidden"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

### 3.4 `SunmiPrinterBridge.kt`

```kotlin
package com.kaideeder.pos

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService

/**
 * ตัวกลางระหว่างหน้าเว็บ KAIDEEDER กับปริ้นเตอร์ในตัวของ Sunmi
 * ทุก method ที่มี @JavascriptInterface จะถูกเรียกจาก JS บน background thread ของ WebView
 * (ไม่ใช่ UI thread) จึงเรียก Sunmi service ได้โดยตรง
 */
class SunmiPrinterBridge(context: Context) {
    private val appContext = context.applicationContext
    @Volatile private var printer: SunmiPrinterService? = null

    init { bind() }

    fun bind() {
        try {
            InnerPrinterManager.getInstance().bindService(appContext, object : InnerPrinterCallback() {
                override fun onConnected(service: SunmiPrinterService) {
                    printer = service
                    Log.i(TAG, "Sunmi printer service connected")
                }
                override fun onDisconnected() {
                    printer = null
                    Log.w(TAG, "Sunmi printer service disconnected")
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "bindService failed — เครื่องนี้อาจไม่มี Sunmi printer service", e)
        }
    }

    @JavascriptInterface
    fun isReady(): Boolean = printer != null

    /** ข้อความ UTF-8, ขึ้นบรรทัดด้วย \n — Sunmi รองรับไทย แต่ลาวอาจไม่ครบ จึงใช้ printImage เป็นหลัก */
    @JavascriptInterface
    fun printText(text: String) {
        val p = printer ?: return
        try {
            p.setAlignment(0, null)
            p.setFontSize(24f, null)
            p.printText(text, null)
        } catch (e: Exception) { Log.e(TAG, "printText failed", e) }
    }

    /** PNG base64 (ไม่มี data: นำหน้า) กว้างไม่เกิน 576px (80mm) / 384px (58mm) */
    @JavascriptInterface
    fun printImage(base64Png: String) {
        val p = printer ?: return
        try {
            val bytes = Base64.decode(base64Png, Base64.DEFAULT)
            var bmp: Bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return
            val maxWidth = if (getPaperWidthMm() == 58) 384 else 576
            if (bmp.width > maxWidth) {
                val h = bmp.height * maxWidth / bmp.width
                bmp = Bitmap.createScaledBitmap(bmp, maxWidth, h, true)
            }
            p.setAlignment(0, null)
            p.printBitmap(bmp, null)
        } catch (e: Exception) { Log.e(TAG, "printImage failed", e) }
    }

    @JavascriptInterface
    fun lineFeed(n: Int) {
        try { printer?.lineWrap(n, null) } catch (e: Exception) { Log.e(TAG, "lineWrap failed", e) }
    }

    @JavascriptInterface
    fun cutPaper() {
        try { printer?.cutPaper(null) } catch (e: Exception) { Log.e(TAG, "cutPaper failed", e) }
    }

    /** 58 หรือ 80 — SDK: getPrinterPaper() คืน 1 = 58mm, 2 = 80mm (ถ้า SDK เวอร์ชันที่ใช้ไม่มี method นี้ ให้ return ค่าคงที่ตามรุ่นเครื่อง) */
    @JavascriptInterface
    fun getPaperWidthMm(): Int = try {
        if (printer?.printerPaper == 1) 58 else 80
    } catch (e: Exception) { 80 }

    companion object { private const val TAG = "SunmiPrinterBridge" }
}
```

### 3.5 `MainActivity.kt`

```kotlin
package com.kaideeder.pos

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // จำเป็น: POS เก็บตั้งค่าเครื่องพิมพ์ใน localStorage
            databaseEnabled = true
            allowFileAccess = false
            mediaPlaybackRequiresUserGesture = false   // เสียงแจ้งเตือนออเดอร์ใหม่
            setSupportMultipleWindows(false)  // เว็บจะไม่เรียก window.open เมื่อเจอ bridge
            userAgentString = "$userAgentString KaideederApp/1.0"   // ให้เว็บรู้ว่ารันในแอป
        }
        webView.webViewClient = WebViewClient()   // เปิดลิงก์ทั้งหมดใน WebView เดิม
        webView.webChromeClient = WebChromeClient()

        // ชื่อ "SunmiPrinter" ต้องตรงกับที่เว็บเรียก (window.SunmiPrinter)
        webView.addJavascriptInterface(SunmiPrinterBridge(this), "SunmiPrinter")

        webView.loadUrl(POS_URL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        // เปลี่ยนเป็นโดเมนจริงของร้าน
        private const val POS_URL = "https://kaideeder.com/pos"
    }
}
```

หมายเหตุ

- ถ้าแอป APK เดิมสร้างจากเครื่องมือ "website to APK" ที่ไม่มีโค้ด จะ **ใส่ bridge ไม่ได้** — ต้องสร้างโปรเจกต์ Android Studio ใหม่ตามด้านบน (ใช้เวลาไม่นาน มีแค่ 2 ไฟล์)
- SDK `printerlibrary` ใช้ได้กับ Sunmi ทุกรุ่นที่มีปริ้นเตอร์ในตัว ถ้าเป็นแท็บเล็ตยี่ห้ออื่น ให้เปลี่ยนแค่ข้างใน `SunmiPrinterBridge` (เช่น ต่อ Bluetooth SPP แล้วส่ง ESC/POS) โดยคง method ชื่อเดิมไว้ เว็บไม่ต้องแก้
- ตั้ง "ปิดหน้าจออัตโนมัติ" ใน Android เป็น "ไม่เลย" และปักหมุดแอป (Screen pinning) ถ้าอยากให้เครื่องเป็น POS อย่างเดียว

---

## 4. ทดสอบ

1. เปิดแอป → ล็อกอิน → ไปที่ **ตั้งค่า** → การ์ด **"📱 ปริ้นเตอร์ในตัวเครื่อง (Sunmi / แอป APK)"**
   - สถานะต้องขึ้น `✅ พบ bridge ในแอป — พร้อมพิมพ์`
   - เลือกความกว้างกระดาษให้ตรงรุ่น (D2s / T2 = 80mm, V2 = 58mm)
   - กด **ทดสอบพิมพ์ปริ้นเตอร์ในตัว** → ต้องได้กระดาษออกมา 1 ใบ
2. ไปหน้า **POS** → เลือกโต๊ะ → เพิ่มเมนู → กด **สถานะ** (ส่งครัว) → slip ครัว/บาร์ต้องออก
3. **เช็คบิล** → ชำระเงิน → กด **พิมพ์บิล** → ใบเสร็จต้องออก
   - ถ้าเปิด "🧾 Auto-Print ใบเสร็จ" ในตั้งค่า ใบเสร็จจะออกเองทันทีหลังชำระ
4. ทดสอบจาก console ของ WebView (Chrome PC → `chrome://inspect` เสียบสาย USB):

   ```js
   window.SunmiPrinter.isReady()               // → true
   window.SunmiPrinter.printText("ทดสอบ\n\n\n")
   ```

---

## 5. ถ้ายังไม่ออก — เช็คตามนี้

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| สถานะ `⚠️ ไม่พบ bridge` | เปิดจาก Chrome ไม่ใช่จากแอป, หรือชื่อ interface ไม่ตรง (`addJavascriptInterface(..., "SunmiPrinter")`) |
| สถานะ `⏳ พบ bridge แต่ printer service ยังไม่พร้อม` | `bindService` ไม่สำเร็จ — ตรวจว่าเครื่องมีแอป Sunmi Printer Service (package `woyou.aidlservice.jiuiv5`), ใส่ `<queries>` ใน manifest แล้ว, ลอง reboot เครื่อง |
| กระดาษออกแต่ว่างเปล่า / ตัวอักษรเป็นสี่เหลี่ยม | แอปยังไม่ได้ทำ `printImage` เว็บจึงตก fallback เป็น `printText` แล้วฟอนต์ในเครื่องพิมพ์ไม่มีตัวลาว → เพิ่ม `printImage` ตามข้อ 3.4 |
| รูปตกขอบ / ตัวเล็กเกิน | ความกว้างกระดาษในตั้งค่าไม่ตรงรุ่น หรือ `getPaperWidthMm` คืนค่าผิด |
| พิมพ์ได้จากปุ่มทดสอบ แต่ตอนส่งครัวไม่ออก | ปิด toggle "ใช้ปริ้นเตอร์ในตัวก่อนเสมอ" อยู่, หรือรายการนั้นไม่มีสินค้าใหม่ (slip ออกเฉพาะรายการที่เพิ่งเพิ่ม) |
| ออกช้าหลายวินาที | ปกติสำหรับรูปใหญ่ — ใช้ 58mm หรือลดจำนวนบรรทัด; ถ้าช้ามากตรวจว่า `printBitmap` ไม่ได้ถูกเรียกบน UI thread |
