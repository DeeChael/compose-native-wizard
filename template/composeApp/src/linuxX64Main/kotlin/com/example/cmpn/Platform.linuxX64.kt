package com.example.cmpn

class LinuxX64Platform: Platform {
    override val name: String = "Linux"
}

actual fun getPlatform(): Platform = LinuxX64Platform()