plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val posUrl = providers.gradleProperty("POS_URL").getOrElse("https://pos.example.com")
val allowedHosts = providers.gradleProperty("ALLOWED_HOSTS").getOrElse("pos.example.com")
val allowCleartext = providers.gradleProperty("ALLOW_CLEARTEXT").getOrElse("false").toBooleanStrictOrNull() ?: false

android {
    namespace = "com.garden43.sunmiposbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.garden43.sunmiposbridge"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "POS_URL", "\"$posUrl\"")
        buildConfigField("String", "ALLOWED_HOSTS", "\"$allowedHosts\"")
        buildConfigField("boolean", "ALLOW_CLEARTEXT", allowCleartext.toString())
        manifestPlaceholders["usesCleartextTraffic"] = allowCleartext.toString()
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.sunmi:printerlibrary:1.0.18")
}
