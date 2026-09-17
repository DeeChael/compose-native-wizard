package com.example.cmpn

class MingwX64Platform: Platform {
    override val name: String = "Windows"
}

actual fun getPlatform(): Platform = MingwX64Platform()