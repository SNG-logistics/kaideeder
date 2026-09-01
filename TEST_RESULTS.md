# KAIDEEDER SUNMI POS Test Results

Date: 2026-09-01
Repository: `SNG-logistics/kaideeder`, branch `main`

## Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npx tsc --noEmit`, exit 0 |
| Browser fallback smoke | PASS | Without `window.AndroidPOS`, adapter returns `BRIDGE_UNAVAILABLE` and does not access native APIs |
| Duplicate/reprint adapter smoke | PASS | Original accepted once; second original blocked; explicit reprint accepted; immediate duplicate reprint blocked |
| Next.js compile/type validation | PASS | Production build compiled successfully and completed Next type validation |
| Next.js complete build | BLOCKED BY ACTIVE DEV PROCESS | Existing `next dev` was using the same `.next`; page-data collection saw inconsistent generated modules. Source routes were present and the user process was not stopped |
| Android debug build | PASS | `assembleDebug`, 35 tasks, `BUILD SUCCESSFUL` |
| Android unit tests | PASS | `testDebugUnitTest` through an ASCII drive mapping |
| Android lint | PASS | `lintDebug`; API 23 compatibility error fixed rather than baselined |
| Android release build | PASS | `assembleRelease`; unsigned because no release keystore was supplied |
| Combined Android gate | PASS | `testDebugUnitTest lintDebug assembleDebug assembleRelease`, 89 tasks, `BUILD SUCCESSFUL` |

## APK evidence

| Artifact | Package/version | SHA-256 |
| --- | --- | --- |
| `app-debug.apk` | `com.kaideeder.pos.debug`, `2 / 1.1.0-debug` | `9AF0812713975B0AEFF200B113DE4B72C26F147B588ECDA335FEAB44947D1298` |
| `app-release-unsigned.apk` | `com.kaideeder.pos`, `2 / 1.1.0` | `61E02CEC935081FEB485298F55CFB77CE7F19A2F5D4F91D447C67E089FC9DB8D` |

Debug APK verification: APK Signature Scheme v1 and v2 passed; certificate is the
local Android debug certificate. The release artifact is deliberately unsigned and is
not ready for distribution until the KAIDEEDER release keystore is supplied.

## Physical-device results

`adb devices -l` returned no connected devices during this run.

| Test | Status |
| --- | --- |
| Install/launch on SUNMI D2s Plus | PENDING — device not connected |
| Printer service reports `READY` | PENDING — device not connected |
| Thai/Lao/English test print | PENDING — device not connected |
| 80 mm alignment and long item names | PENDING — device not connected |
| Logo and QR output | PENDING — device not connected |
| Original-print duplicate prevention | Automated PASS; physical PENDING |
| Reprint label and drawer suppression | Automated PASS; physical PENDING |
| Cash drawer and cutter | PENDING — device/attached drawer not connected |
| Out-of-paper/offline/reconnect behavior | PENDING — device not connected |

The implementation is build-verified, not yet device-accepted. Do not mark the SUNMI
printing work complete until the pending rows are executed on the target D2s Plus.
