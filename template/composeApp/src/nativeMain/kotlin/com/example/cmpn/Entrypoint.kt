package com.example.cmpn

import com.compose.sdl.Window
import com.compose.sdl.nativeComposeApp

fun main() = nativeComposeApp {
    Window(
        onCloseRequest = ::exitApplication,
        title = "Compose Multiplatform Native"
    ) {
        App()
    }
}