package com.example.cmpn

class LinuxArm64Platform: Platform {
    override val name: String = "Linux"
}

actual fun getPlatform(): Platform = LinuxArm64Platform()