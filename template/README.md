# compose-native-template

This is a template project for compose multiplatform but all targets are compiled in native code (without JVM).

This template has only one module `composeApp`, you can create more modules by your own. All the code should be carefully arranged in correct source set directory for targetted platform.

There are some multiplatform libraries pre-imported in gradle catalog file.

### Running the apps

You can only test one platform which is the same with your developing platform, running gradle task `run/runReleaseExecutable{target platform}` to run.

