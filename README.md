# 1.000 Goles Sin Pasarse — Android

Proyecto Android preparado para compilar **un APK de prueba desde GitHub Actions**, sin PC.

## ¿Qué incluye?

- El **HTML completo y sin cambios de contenido**, recuperado de Work el 19/11/2026, en `app/src/main/assets/index.html`.
- 70 clubes y 5.016 fichas de jugador–club; tres niveles: **Aficionado (20), Medio (37), Experto (70)**.
- Android Java con WebViewAssetLoader, almacenamiento del juego en WebView (localStorage e IndexedDB) y consultas externas HTTPS de Wikidata que precisan Internet.
- Importación de JSON, exportación de JSON/CSV usando el selector de archivos Android y enlaces a fuentes en el navegador.
- GitHub Actions en `.github/workflows/generar-apk.yml` que genera `app-debug.apk` y lo adjunta como artefacto descargable.

**La exactitud de los goles se mantiene tal como estaba en Work:** hay cifras contrastadas y otras no auditadas; la conversión a Android no las verifica ni altera.

## Subirlo a GitHub desde un móvil (sin ordenador)

1. En el navegador del móvil abre https://github.com/new y crea un repositorio llamado, por ejemplo, `1000-goles-android`. Marca **Add a README file** para crear la primera rama `main`. Para el primer intento puede ser **privado**.
2. Abre ese repositorio en GitHub y usa la opción **Code > Codespaces > Create codespace on main**. Si GitHub pide habilitar Codespaces o no hay cuota, puedes usar cualquier editor de repositorios compatible con ZIP desde móvil; no es necesario Android Studio.
3. En el explorador de archivos de Codespaces (VS Code web), sube **el ZIP completo** `1000_Goles_Android_GitHub.zip` y descomprímelo en la raíz del repositorio. Si el terminal web está disponible, la forma más sencilla es subir el ZIP a la raíz y ejecutar:

   ```sh
   unzip -oq 1000_Goles_Android_GitHub.zip
   rm 1000_Goles_Android_GitHub.zip
   git add .
   git commit -m "Añadir proyecto Android de 1000 Goles"
   git push
   ```

   El ZIP contiene los archivos directamente en su raíz, sin una carpeta padre.
4. En GitHub abre **Actions > Generar APK de 1.000 Goles > Run workflow**. El `push` a `main` también inicia la compilación.
5. En la ejecución terminada entra en **Artifacts > Mil-Goles-APK-Prueba**. Descarga el artefacto, descomprímelo y pulsa `app-debug.apk` para instalarlo en tu móvil. Puede ser necesario autorizar la instalación desde el navegador/gestor de archivos.

   > GitHub almacena el APK en un ZIP de artefacto; **no basta con subir el ZIP del proyecto como un archivo suelto al repositorio**. El contenido debe quedar descomprimido y confirmado (commit).

## Estructura

```text
.github/workflows/generar-apk.yml       Compilación automática y descarga del APK
app/build.gradle                         Configuración Android
app/src/main/AndroidManifest.xml         Permisos y pantalla principal
app/src/main/java/com/juandy/milgoles/MainActivity.java
app/src/main/res/                        Icono y estilo
app/src/main/assets/index.html           Juego original completo
build.gradle, settings.gradle            Gradle
```

## Detalles importantes

- Los **APK debug** sirven para probar la app y no están destinados a publicarse directamente en Play Store. Para Google Play hará falta preparar iconos finales, firma de publicación, versión release, AAB y la ficha de la aplicación.
- `applicationId`: `com.juandy.milgoles`; no incluye cuenta de usuario ni pagos.
- Las partidas y las importaciones en el almacenamiento web se conservan entre aperturas/actualizaciones normales de la misma app, pero se pierden al borrar sus datos o desinstalarla. Exporta copias de seguridad.
- El juego empaquetado funciona offline; las consultas online requieren conexión.
- `androidx.webkit:webkit:1.14.0`, Android Gradle Plugin 8.10.1, Gradle 8.11.1, Java 17, SDK 35.
- **El proyecto está preparado, pero no se garantiza una compilación validada** hasta ejecutar el workflow en GitHub. No se ha generado todavía ningún APK en esta entrega.
