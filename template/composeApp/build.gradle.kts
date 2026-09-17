plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.composeDesktopNativeBridge)
}

kotlin {

    buildList {
        add(linuxArm64())
        add(linuxX64())
        add(macosArm64())
        add(mingwX64())
    }.forEach {
        it.binaries {
            executable {
                when {
                    target.name == "mingwX64" -> linkerOpts(
                        // crypt32: client-cert (mTLS) import into the Windows cert store.
                        "-lcrypt32",
                        "-Wl,--gc-sections", "-Wl,-s",
                        // GUI subsystem (no console window), keeping the C `main` entry.
                        "-Wl,--subsystem,windows", "-Wl,-e,mainCRTStartup",
                    )

                    target.name.startsWith("linux") -> linkerOpts(
                        "-L/usr/lib/x86_64-linux-gnu", "-L/usr/lib/aarch64-linux-gnu",
                        "-lfontconfig", "-lGL", "-lX11",
                    )
                }
            }
        }
    }


    sourceSets {
        commonMain.dependencies {
            implementation(kotlin("reflect"))
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.material3)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)
            implementation(libs.androidx.lifecycle.viewmodelCompose)
            implementation(libs.androidx.lifecycle.runtimeCompose)

            implementation(libs.compose.desktopNativeWindow)
            implementation(libs.compose.sdl)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
        nativeMain {}
    }

    compilerOptions {
        freeCompilerArgs.addAll(
            "-Xcollection-literals",
            "-Xexpect-actual-classes",
            "-opt-in=kotlinx.cinterop.ExperimentalForeignApi"
        )
    }
}

compose.desktop {
    native {
        entryPoint = "com.example.cmpn.main"
    }
}

compose.resources {
    packageOfResClass = "com.example.cmpn.generated.resources"
}