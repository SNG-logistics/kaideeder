plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val posBaseUrl = providers.gradleProperty("POS_BASE_URL").getOrElse("https://kaideeder.com/pos")
val allowedHosts = providers.gradleProperty("ALLOWED_HOSTS").getOrElse("kaideeder.com")
val allowedAssetHosts = providers.gradleProperty("ALLOWED_ASSET_HOSTS").getOrElse("kaideeder.com")
val allowCleartext = providers.gradleProperty("ALLOW_CLEARTEXT").getOrElse("false").toBooleanStrictOrNull() ?: false
val cashDrawerEnabled = providers.gradleProperty("CASH_DRAWER_ENABLED").getOrElse("false").toBooleanStrictOrNull() ?: false
val releaseStoreFile = providers.gradleProperty("KAIDEEDER_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.gradleProperty("KAIDEEDER_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.gradleProperty("KAIDEEDER_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.gradleProperty("KAIDEEDER_RELEASE_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(
    releaseStoreFile,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { !it.isNullOrBlank() }

android {
    namespace = "com.kaideeder.pos"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.kaideeder.pos"
        minSdk = 23
        targetSdk = 34
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "POS_BASE_URL", "\"$posBaseUrl\"")
        buildConfigField("String", "ALLOWED_HOSTS", "\"$allowedHosts\"")
        buildConfigField("String", "ALLOWED_ASSET_HOSTS", "\"$allowedAssetHosts\"")
        buildConfigField("boolean", "ALLOW_CLEARTEXT", allowCleartext.toString())
        buildConfigField("boolean", "CASH_DRAWER_ENABLED", cashDrawerEnabled.toString())
        manifestPlaceholders["usesCleartextTraffic"] = allowCleartext.toString()
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(requireNotNull(releaseStoreFile))
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
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
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
