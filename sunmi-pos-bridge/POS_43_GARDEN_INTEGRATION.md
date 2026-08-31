# 43 Garden POS integration

The Android application in this directory is deliberately independent of the Next.js
application. It gives the web page a narrowly scoped `window.SunmiPrinter` bridge only
when the page is running inside the signed 43 Garden POS APK on an allowed host.

## Add the web helper

Copy `web/sunmi-printer.ts` to `src/lib/sunmi-printer.ts` once the deleted POS source
files are restored to the working tree. Do not call it from a server component.

The existing `POST /api/pos/orders/[id]/close` endpoint already creates the payment,
closes the order, and deducts stock. In its client-side success path, build the receipt
from the server response and then queue the print job:

```ts
import { fetchSunmiReceiptLogo, isSunmiApp, printSunmiReceipt } from '@/lib/sunmi-printer'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// At the top of POSPage, after `const branding = useStoreBranding()`:
const currentUser = useCurrentUser()

// In `confirmPayment`, inside `if (json.success)`, before setCloseResult:
if (isSunmiApp()) {
  try {
    const order = json.data.order
    const logoPngBase64 = branding.logoUrl
      ? await fetchSunmiReceiptLogo(branding.logoUrl).catch(() => undefined)
      : undefined

    printSunmiReceipt({
      receiptNo: order.orderNumber,
      dateTime: new Date(order.closedAt ?? Date.now()).toLocaleString('th-TH'),
      cashier: currentUser?.name || currentUser?.username || 'POS',
      items: order.items.map((item: any) => ({
        name: item.product?.name ?? 'รายการ',
        quantity: item.quantity,
        unitPrice: Math.round(item.unitPrice),
        total: Math.round(item.quantity * item.unitPrice),
      })),
      subtotal: Math.round(order.subtotal),
      discount: Math.round(discountAmount),
      grandTotal: Math.round(order.totalAmount),
      paymentMethod,
      logoPngBase64,
      openCashDrawer: paymentMethod === 'CASH',
      cutPaper: true,
    })
  } catch (printError) {
    console.error('SUNMI receipt error:', printError)
    setToast({ message: 'บันทึกการชำระเงินแล้ว แต่พิมพ์ใบเสร็จไม่สำเร็จ', type: 'warning' })
  }
}
```

Use a UI label such as `ชำระเงินและพิมพ์ใบเสร็จ` only when `isSunmiApp()` is true;
otherwise retain the normal web payment label and browser receipt flow. The original
43 Garden close-order endpoint returns a committed order with its product lines, which
is the receipt source above; do not build a receipt from unsaved cart state.

## Important consistency boundary

The sale database transaction and the physical printer are separate systems. The browser
must **not** postpone the sale commit until the printer returns: it can lose power or run
out of paper after the order has been paid. `PRINT_QUEUED` only confirms that the Android
bridge accepted the job. Keep a reprint action keyed by the closed order ID/number.

## Configure and build the APK

Set the production URL and exact allowed host in `gradle.properties` before a release:

```properties
POS_URL=https://pos.43garden.example
ALLOWED_HOSTS=pos.43garden.example
ALLOW_CLEARTEXT=false
```

For an isolated LAN test only, pass `-PALLOW_CLEARTEXT=true` together with an HTTP URL
and its exact IP/host; never ship that configuration. Open `sunmi-pos-bridge` in Android
Studio using JDK 17, sync Gradle, then build `app` for the SUNMI D2s Plus.

## Acceptance test on a real SUNMI D2s Plus

1. Install the debug APK and verify it refuses an unlisted domain.
2. Open the configured HTTPS POS URL, sign in, and use the bridge test-print control.
3. Complete a cash order and confirm one payment, stock movement, closed order, receipt,
   paper cut, and drawer pulse.
4. Complete a QR order and confirm one payment, stock movement, QR print, and no drawer
   pulse.
5. Verify Thai and Lao glyphs, logo quality, QR scanability, paper-out behavior, and the
   reprint path without creating a second payment or deducting stock again.
