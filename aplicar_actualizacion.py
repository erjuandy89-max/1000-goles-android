#!/usr/bin/env python3
"""Instala el lector de actualizaciones en el proyecto Android ya existente.
Ejecutar desde la raíz de 1000-goles-android después de descomprimir el ZIP.
No edita index.html ni las partidas guardadas.
"""
from pathlib import Path

root = Path.cwd()
java = root / 'app/src/main/java/com/juandy/milgoles/MainActivity.java'
gradle = root / 'app/build.gradle'
asset = root / 'app/src/main/assets/actualizaciones.js'
catalog = root / 'catalogo/actualizaciones.json'
for f in (java, gradle, asset, catalog):
    if not f.is_file():
        raise SystemExit(f'ERROR: no encuentro {f}. Ejecuta desde la raíz del proyecto y descomprime el ZIP primero.')

source = java.read_text(encoding='utf-8')
needle = 'if (HOME_URL.equals(url)) view.evaluateJavascript(BRIDGE_JAVASCRIPT, null);'
replacement = '''if (HOME_URL.equals(url)) {
                    view.evaluateJavascript(BRIDGE_JAVASCRIPT, null);
                    // Carga el actualizador de datos incluido en el APK. No modifica el juego principal.
                    view.evaluateJavascript(
                            "(function(){var s=document.createElement('script');" +
                            "s.src='/assets/actualizaciones.js';document.body.appendChild(s);})();", null);
                }'''
if 's.src=\'/assets/actualizaciones.js\'' in source:
    print('El cargador Android ya estaba incorporado.')
elif source.count(needle) == 1:
    java.write_text(source.replace(needle, replacement), encoding='utf-8')
    print('Actualizado MainActivity.java.')
else:
    raise SystemExit('ERROR: MainActivity.java es distinto al esperado. No he tocado el archivo.')

build = gradle.read_text(encoding='utf-8')
if "versionName '1.1-catalogo-online'" in build:
    print('Versión Android ya actualizada.')
else:
    if "versionCode 1" not in build or "versionName '1.0-prueba'" not in build:
        raise SystemExit('ERROR: versión Gradle inesperada. Revisa app/build.gradle manualmente.')
    build = build.replace('versionCode 1', 'versionCode 2', 1)
    build = build.replace("versionName '1.0-prueba'", "versionName '1.1-catalogo-online'", 1)
    gradle.write_text(build, encoding='utf-8')
    print('Actualizado app/build.gradle a 1.1 (versión 2).')
print('Correcto. Revisa git diff y haz commit / push para generar el APK.')
