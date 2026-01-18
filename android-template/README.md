Android WebView Wrapper Template

This folder is used by `server/worker.ts` to generate an Android project and build a debug APK in Docker.

Placeholders (replaced by the generator):
- `__PACKAGE_NAME__`
- `__APP_NAME__`
- `__START_URL__`
- `__PRIMARY_COLOR__`
- `__VERSION_CODE__`

Build command inside the Docker builder:
- `gradle assembleDebug`

Output APK path:
- `app/build/outputs/apk/debug/app-debug.apk`
