import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing comes ONLY from the environment (GitHub Secrets in CI) or an untracked
// android/key.properties on the owner's computer. Nothing secret is committed.
val keyProps = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(env: String, prop: String): String? = System.getenv(env) ?: keyProps.getProperty(prop)
val releaseStoreFile = signingValue("AGRIFLOW_KEYSTORE_PATH", "storeFile")
val hasReleaseSigning = releaseStoreFile != null && file(releaseStoreFile).exists()

android {
    namespace = "zm.agriflow.ai"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "zm.agriflow.ai"
        minSdk = maxOf(flutter.minSdkVersion, 24)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = signingValue("AGRIFLOW_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signingValue("AGRIFLOW_KEY_ALIAS", "keyAlias")
                keyPassword = signingValue("AGRIFLOW_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Signed with the owner's release key when configured; otherwise the build is
            // explicitly marked unsigned by CI (never silently signed with a debug key).
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release") else null
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
