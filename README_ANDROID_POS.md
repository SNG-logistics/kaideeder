# KAIDEEDER Android POS for SUNMI D2s Plus

The Android project is in `kaideeder-pos-android/`. It loads the existing
`https://kaideeder.com/pos` application in a restricted WebView and exposes
`window.AndroidPOS` only to trusted, fully loaded POS pages.

The web application remains usable in a normal browser. Payment, order closing,
stock deduction, and sales records stay in the existing Next.js backend. Android
printing runs only after the close-order API succeeds.

## Requirements

- JDK 17
- Android SDK 34 and Build Tools 34.0.0
- Internet access for the first Gradle/dependency resolution
- SUNMI D2s Plus for printer, cutter, font, and drawer acceptance

This repository includes Gradle Wrapper 8.2.1 and uses Android Gradle Plugin 8.2.1,
Kotlin 1.9.24, and `com.sunmi:printerlibrary:1.0.18`.

## Configuration

Configuration is centralized in `kaideeder-pos-android/gradle.properties`.

| Property | Production default | Purpose |
| --- | --- | --- |
| `POS_BASE_URL` | `https://kaideeder.com/pos` | Initial WebView URL |
| `ALLOWED_HOSTS` | `kaideeder.com` | Exact WebView/native-command host allow-list |
| `ALLOWED_ASSET_HOSTS` | KAIDEEDER and approved image hosts | HTTPS logo download allow-list |
| `ALLOW_CLEARTEXT` | `false` | HTTP is accepted only in a debug build when explicitly enabled |
| `CASH_DRAWER_ENABLED` | `false` | Final native gate for drawer commands |

Release builds remain HTTPS-only even if `ALLOW_CLEARTEXT=true`. Enable the cash
drawer only after verifying the attached drawer and SUNMI configuration. Reprints
never open the drawer.

## Build and test

From the Android project directory:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
./gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease
```

Android/Java tools on Windows can fail when the checkout path contains non-ASCII
characters. Use a temporary ASCII drive mapping if necessary:

```powershell
subst K: (Resolve-Path .).Path
K:
./gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease
C:
subst K: /D
```

Artifacts:

- Debug, signed with the local Android debug certificate:
  `kaideeder-pos-android/app/build/outputs/apk/debug/app-debug.apk`
- Release, unsigned until release credentials are supplied:
  `kaideeder-pos-android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Release signing

Do not commit keystores or passwords. Put these values in the developer's
`%USERPROFILE%\.gradle\gradle.properties` or provide them as protected Gradle
properties in CI:

```properties
KAIDEEDER_RELEASE_STORE_FILE=C:/secure/kaideeder-release.jks
KAIDEEDER_RELEASE_STORE_PASSWORD=...
KAIDEEDER_RELEASE_KEY_ALIAS=...
KAIDEEDER_RELEASE_KEY_PASSWORD=...
```

Then run:

```powershell
./gradlew.bat assembleRelease
```

Verify the result before distribution:

```powershell
& "$env:ANDROID_HOME\build-tools\34.0.0\apksigner.bat" verify --verbose --print-certs `
  .\app\build\outputs\apk\release\app-release.apk
```

## Install and inspect with ADB

The debug application ID is `com.kaideeder.pos.debug`; release is
`com.kaideeder.pos`.

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r `
  .\app\build\outputs\apk\debug\app-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n `
  com.kaideeder.pos.debug/com.kaideeder.pos.MainActivity
```

For diagnostics, use a debug build and redact any environment-specific output before
sharing it:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" logcat -c
& "$env:ANDROID_HOME\platform-tools\adb.exe" logcat | Select-String `
  'AndroidRuntime|Sunmi|kaideeder'
```

Do not log receipt JSON, authentication cookies, tokens, or customer-sensitive data.

## JavaScript bridge

The trusted page receives these synchronous methods:

```text
window.AndroidPOS.printReceipt(payloadJson)
window.AndroidPOS.reprintReceipt(payloadJson)
window.AndroidPOS.testPrint()
window.AndroidPOS.getPrinterStatus()
window.AndroidPOS.openCashDrawer()
window.AndroidPOS.getDeviceInfo()
window.AndroidPOS.getAppVersion()
window.AndroidPOS.reload()
```

Every method returns JSON with `ok`, `code`, and `message`; device/version responses
also contain `data`. `PRINT_ACCEPTED` means the SUNMI service accepted the command. It
does not claim that paper physically printed. Status codes include `READY`,
`DISCONNECTED`, `OUT_OF_PAPER`, `OVERHEATED`, `COVER_OPEN`, and `CUTTER_ERROR`.

Receipt schema version 1 includes a request ID, `orderId`, receipt type, confirmed
order items/totals/payment, store data, options, and optional QR text. Native validation
limits the payload to 256 KB and 200 items. Original prints are persistently deduplicated
by `orderId:ORIGINAL`; reprints are explicit, labelled, and drawer-disabled.

## SUNMI D2s Plus acceptance

1. Connect the D2s Plus and confirm it appears as `device` in `adb devices -l`.
2. Install the debug APK and sign in to the production/staging POS.
3. Call `AndroidPOS.getPrinterStatus()` and require `READY`.
4. Call `AndroidPOS.testPrint()` and physically confirm Thai, Lao, and English glyphs.
5. Complete one cash payment and verify one backend payment, one stock deduction, one
   original receipt, cutter behavior, and the configured drawer behavior.
6. Confirm double-click/reload does not print another original.
7. Use the reprint button and confirm the receipt says `REPRINT / สำเนา / ສຳເນົາ`
   and does not open the drawer.
8. Repeat with transfer/non-cash payment, long names, discount, VAT/service charge,
   logo/no-logo, QR/no-QR, out-of-paper, offline, and reconnect cases.

Physical printer acceptance must be recorded in `TEST_RESULTS.md`; a successful Gradle
build is not a substitute.

## Rollback

Keep the previously accepted, release-signed APK. To roll back, install it with
`adb install -r` when it uses the same application ID and signing key. Never change the
release signing key between versions.
