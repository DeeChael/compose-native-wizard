package com.example.cmpn

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform