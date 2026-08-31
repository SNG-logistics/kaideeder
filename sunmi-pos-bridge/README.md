# SUNMI D2s Plus POS Printer Bridge

Android WebView wrapper for 43 Garden POS. A normal Chrome tab cannot access SUNMI's
internal printer; this APK hosts the POS in a WebView and offers a controlled JavaScript
bridge to the SUNMI printer service.

Features included:

- Thai/Lao receipt text, 80 mm layout, logo, QR code, cash-drawer pulse, and paper cut
- exact hostname allow-list for POS navigation and print commands
- HTTPS-only release configuration (HTTP requires an explicit development override)
- validated receipt payload limits and printer-ready status

See [POS_43_GARDEN_INTEGRATION.md](POS_43_GARDEN_INTEGRATION.md) for the Next.js hand-off,
configuration, and real-device acceptance checks.
