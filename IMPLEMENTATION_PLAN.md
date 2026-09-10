# KAIDEEDER POS for SUNMI D2s Plus — Implementation Plan

## Objective and non-negotiable boundaries

Add a production Android WebView shell for the existing KAIDEEDER POS that can call
the SUNMI D2s Plus internal thermal printer.  The existing Next.js POS must continue
to work unchanged in a normal browser, including its browser receipt flow.

- The payment, order-close, inventory-deduction, authentication, and existing API
  contracts remain authoritative and are not moved into Android.
- Native printing is attempted only after a successful `POST /api/pos/orders/:id/close`.
- A print failure cannot turn a successful payment into a failed payment or trigger
  another close-order request.
- Receipt data is built from the confirmed order response (not the mutable cart).
- The native bridge is exposed only to an exact HTTPS allow-list and validates every
  JSON payload before it reaches the printer service.

## Architecture found in this repository

```text
Next.js /pos (src/app/pos/page.tsx)
  -> POST /api/pos/orders/:id/close
      -> validates payment and performs existing stock/order/payment updates
      -> returns confirmed order and change/stock warnings
  -> current browser receipt: /receipt/:orderId -> window.print()

KAIDEEDER Android APK (new native shell)
  -> WebView loads https://kaideeder.com/pos
  -> window.AndroidPOS (only while in the trusted APK)
  -> Kotlin receipt formatter/printer manager
  -> SUNMI Printer Interface Library / internal printer service
```

The close endpoint is the correct integration boundary: it owns the existing payment,
close-order, stock deduction, table release, and sales-event sequence.  The client
currently opens `/receipt/:orderId` after closing; the Android path will be added next
to that success path, while browser use retains this route and `window.print()`.

## Current implementation assessment

There is a committed prototype in `sunmi-pos-bridge/`, but it is not yet the requested
production integration:

| Area | Current state | Required outcome |
| --- | --- | --- |
| Android identity | `SunmiPosBridge` / `com.garden43.sunmiposbridge` | `kaideeder-pos-android` / `com.kaideeder.pos` |
| JavaScript API | `window.SunmiPrinter` with three operations | versioned `window.AndroidPOS` contract with print, reprint, status, drawer, device, version, and reload operations |
| Web POS integration | helper exists but is not imported by the POS | one browser-safe client adapter called only after close success |
| Native UI/resilience | direct WebView with no dedicated offline/retry surface | landscape full-screen WebView, safe offline/retry state, controlled navigation |
| Printer feedback | service binding only, generic queued response | structured printer status/result codes and a test-print flow |
| Build readiness | source needs a clean Android build check; `MainActivity` currently passes the activity where the bridge constructor expects a `WebView` | compile, lint, debug APK, release signing procedure, and on-device proof |

The present prototype contains useful starting points (HTTPS host restriction, disabled
file/content access, JSON size validation, text/QR/logo/cut calls), but it must be
refactored rather than treated as release-ready.  No physical D2s Plus print has been
verified in this repository.

## Target JavaScript contract

The web layer will use a small typed adapter rather than calling Android directly.
It will detect `window.AndroidPOS`; when absent it returns a browser-safe fallback so
normal browsers continue to use the existing receipt page.

```ts
window.AndroidPOS = {
  printReceipt(payloadJson),
  reprintReceipt(payloadJson),
  testPrint(),
  getPrinterStatus(),
  openCashDrawer(),
  getDeviceInfo(),
  getAppVersion(),
  reload(),
}
```

The receipt payload will be versioned and include the confirmed `orderId`, receipt
type (`ORIGINAL` or `REPRINT`), order number, timestamp, store identity, cashier,
items, totals, confirmed payment method, optional QR text, and optional constrained
logo data.  It will not include credentials, tokens, or raw browser/session data.

For duplicate prevention, the web adapter will keep a per-session print state keyed by
`orderId + receiptType`; a successful close submits one `ORIGINAL` request only.
Explicit reprint uses `REPRINT`, is user initiated, and is visibly labelled.  Native
return values will describe *accepted/failed* work, not falsely claim physical paper
completion; paper/out-of-paper/error conditions remain visible to the cashier.

## Phased delivery

### Phase 1 — Baseline and contract

1. Keep this document as the implementation baseline and confirm the production POS
   origin/host allow-list.
2. Add a TypeScript `android-pos` adapter and payload builder near the existing POS
   client code.  It has no server-side import and no effect when `AndroidPOS` is absent.
3. Integrate it into `confirmPayment` only after the close API returns `success`.
   Preserve the existing browser receipt modal/window flow as fallback.
4. Add a clearly labelled reprint action that never calls the close endpoint.
5. Test browser fallback, one original request, blocked duplicate original request,
   explicit reprint, and native status/error UX.

### Phase 2 — Android project normalization

1. Rename the prototype directory to `kaideeder-pos-android` and change namespace,
   application ID, package paths, display name, and Gradle root project name to
   `com.kaideeder.pos` / `KAIDEEDER POS`.
2. Split responsibilities into `PosWebViewManager`, `PosJavascriptBridge`,
   `SunmiPrinterManager`, `ReceiptFormatter`, `CashDrawerManager`, `PrinterStatus`,
   and `PosSettings`.
3. Centralize `POS_BASE_URL`, exact trusted hosts, debug-only cleartext support, and
   app version in build configuration.  Release builds remain HTTPS-only.
4. Add full-screen landscape operation, non-generic offline/retry UI, safe reload,
   external-link policy, and lifecycle-safe bind/unbind.

### Phase 3 — Printer integration and receipt formatting

1. Verify the selected SUNMI Printer Interface Library APIs against the device's
   installed service and compile them in the Android project; do not substitute mocks.
2. Map connection, ready, paper, busy, error, and unsupported states to stable JSON
   result codes.  Capture diagnostic codes only; never log receipt payloads or tokens.
3. Format a true 80 mm receipt: Thai/Lao/English-safe text, width-aware columns,
   logo sizing, QR, totals, payment/change, cut policy, and drawer gating.
4. Permit the drawer only when the store setting allows it and the confirmed method is
   `CASH`; a manual drawer command requires an explicit cashier action.
5. Use buffered/transaction printing with callbacks where the verified SUNMI API and
   device service support it; distinguish accepted job from completed output.

### Phase 4 — Settings, build, and evidence

1. Add a native settings/debug surface for POS URL (debug guarded), printer status,
   test print, app/device information, log export/redaction, and safe reload.
2. Add `README_ANDROID_POS.md`: Android Studio/JDK/SDK prerequisites, debug/release
   build commands, signing inputs (without secrets), APK location, ADB install/logcat,
   configuration, rollback, and troubleshooting.
3. Produce `TEST_RESULTS.md` with command evidence and device test results.  A build
   alone is not acceptance; physical D2s Plus output is a separate required result.

## Validation gates and acceptance tests

1. `npm run build` and TypeScript validation pass without changing the browser POS
   flow.
2. Android debug and release builds complete from a clean checkout using the selected
   JDK/SDK.  Release signing is performed only with supplied signing credentials.
3. Normal desktop/mobile browser: payment closes once and uses the existing browser
   receipt.  There is no `AndroidPOS` error in the console.
4. Android WebView: successful payment causes exactly one `ORIGINAL` print request;
   reload/double-tap does not duplicate it; reprint produces a labelled `REPRINT`.
5. D2s Plus: Thai, Lao, English, long item names, discounts, VAT/service charge,
   cash change, QR, logo/no-logo, cut enabled/disabled, and cash/non-cash drawer rules
   are physically checked.
6. Negative tests: no paper, disconnected service, invalid JSON, untrusted navigation,
   offline/reconnect, failed print after successful payment, and no printer service.

## Risks requiring real-device confirmation

- Firmware/service versions determine the exact SUNMI status and callback behavior.
- Font glyph coverage and column width must be tested on the installed D2s Plus printer
  rather than inferred from emulator output.
- `cutPaper` and `openDrawer` capability must be validated against the actual device
  and attached drawer.  The app will report unsupported/failure states rather than
  claiming that a physical action occurred.

## Files expected to change in implementation phases

- `src/app/pos/page.tsx` — post-payment native-print trigger and reprint UX only.
- New small TypeScript Android-bridge adapter/payload modules under `src/lib/` or the
  POS feature folder.
- `kaideeder-pos-android/**` — Android shell and printer implementation after the
  controlled rename/refactor.
- `README_ANDROID_POS.md` and `TEST_RESULTS.md` — build/device evidence.

No database migration or payment/stock business-rule change is planned for this work.

## Execution status — 2026-09-01

- Phase 1 web bridge and post-payment integration: implemented and TypeScript-checked.
- Phase 2 Android identity, trusted WebView, offline/retry, and `AndroidPOS` bridge:
  implemented.
- Phase 3 SUNMI manager, status mapping, Thai/Lao bitmap receipt, logo, QR, cutter,
  drawer gate, and native original-print registry: implemented and compiled against
  `com.sunmi:printerlibrary:1.0.18`.
- Phase 4 Gradle wrapper, unit tests, lint, debug APK, unsigned release APK,
  documentation, and ADB instructions: implemented and build-verified.
- Physical D2s Plus acceptance and release signing: pending external device/keystore.
