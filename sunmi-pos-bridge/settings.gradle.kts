pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Sunmi Printer Library
        maven { url = uri("https://jitpack.io") }
        maven { url = uri("https://raw.githubusercontent.com/sunmi-OS/sunmi-aidl-library/main/") }
    }
}

rootProject.name = "SunmiPosBridge"
include(":app")
