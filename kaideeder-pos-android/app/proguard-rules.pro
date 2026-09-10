# printerlibrary accesses Android system properties and its AIDL surface at runtime.
-keep class android.os.SystemProperties { *; }
-keep class com.sunmi.peripheral.printer.** { *; }
