package com.example.cmpn

class macosArm64Platform: Platform {
    override val name: String = "macOS"
}

actual fun getPlatform(): Platform = macosArm64Platform()