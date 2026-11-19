package com.juandy.milgoles;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;

/**
 * Contenedor Android del HTML original de 1.000 Goles, sin reemplazar su lógica.
 * La URL appassets mantiene un origen HTTPS estable para localStorage/IndexedDB.
 */
public class MainActivity extends Activity {
    private static final int REQUEST_IMPORT = 401;
    private static final int REQUEST_EXPORT = 402;
    private static final String HOME_URL = "https://appassets.androidplatform.net/assets/index.html";
    private WebView webView;
    private ValueCallback<Uri[]> pendingImport;
    private String pendingExportBase64;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff081d22);
        getWindow().setNavigationBarColor(0xff081d22);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xff081d22);
        webView.setFitsSystemWindows(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new GameBridge(), "GolesAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                // Wikidata y demás peticiones de fetch siguen cargando normalmente.
                if (request.isForMainFrame()) {
                    openExternal(uri.toString());
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (HOME_URL.equals(url)) view.evaluateJavascript(BRIDGE_JAVASCRIPT, null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingImport != null) pendingImport.onReceiveValue(null);
                pendingImport = callback;
                try {
                    startActivityForResult(params.createIntent(), REQUEST_IMPORT);
                    return true;
                } catch (ActivityNotFoundException exception) {
                    pendingImport = null;
                    Toast.makeText(MainActivity.this, "No hay selector de archivos disponible", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });
        webView.loadUrl(HOME_URL);
    }

    /**
     * El HTML genera ficheros JSON/CSV con Blob + enlace .click().
     * Android WebView no los descarga por sí solo: se deriva a Guardar como...
     * También envía al navegador los enlaces de documentación con target=_blank.
     */
    private static final String BRIDGE_JAVASCRIPT =
        "(function(){" +
        "if(window.__golesAndroidBridge)return;window.__golesAndroidBridge=true;" +
        "const nativeClick=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){" +
        "const el=this;if(el.download&&el.href&&el.href.startsWith('blob:')){" +
        "fetch(el.href).then(r=>r.blob()).then(blob=>{" +
        "const reader=new FileReader();reader.onload=function(){" +
        "const value=String(reader.result||'');" +
        "GolesAndroid.saveFile(el.download,blob.type||'application/octet-stream',value.substring(value.indexOf(',')+1));" +
        "};reader.readAsDataURL(blob);" +
        "}).catch(e=>console.error('Exportación Android',e));return;}" +
        "return nativeClick.apply(this,arguments);};" +
        "document.addEventListener('click',function(event){" +
        "const target=event.target&&event.target.closest?event.target.closest('a[target=\"_blank\"]'):null;" +
        "if(target&&/^https?:/i.test(target.href)){event.preventDefault();GolesAndroid.openLink(target.href);}" +
        "},true);" +
        "})();";

    private class GameBridge {
        @JavascriptInterface
        public void saveFile(String filename, String mime, String base64) {
            if (base64 == null || base64.length() > 30000000) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Exportación demasiado grande", Toast.LENGTH_LONG).show());
                return;
            }
            pendingExportBase64 = base64;
            String safeName = filename == null ? "1000-goles-datos.json"
                    : filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            String fileType = mime != null && mime.startsWith("text/csv") ? "text/csv" : "application/json";
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(fileType);
                intent.putExtra(Intent.EXTRA_TITLE, safeName);
                try {
                    startActivityForResult(intent, REQUEST_EXPORT);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No se pudo abrir Guardar como...", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void openLink(String url) {
            runOnUiThread(() -> openExternal(url));
        }
    }

    private void openExternal(String value) {
        if (value == null) return;
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No se encontró un navegador", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_IMPORT) {
            if (pendingImport == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            pendingImport.onReceiveValue(results);
            pendingImport = null;
        } else if (requestCode == REQUEST_EXPORT) {
            String base64 = pendingExportBase64;
            pendingExportBase64 = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || base64 == null) return;
            Uri destination = data.getData();
            try (OutputStream out = getContentResolver().openOutputStream(destination)) {
                if (out == null) throw new IllegalStateException("Sin acceso al archivo");
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                out.write(bytes);
                Toast.makeText(this, "Archivo guardado", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "No se pudo guardar el archivo", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "(function(){var m=document.querySelector('.modal:not(.hidden)');" +
                    "if(!m)return false;var b=m.querySelector('[data-close]');" +
                    "if(b){b.click();return true;}return false;})()",
                    value -> {
                        if (!"true".equals(value)) showExitDialog();
                    });
        } else {
            showExitDialog();
        }
    }

    private void showExitDialog() {
        new AlertDialog.Builder(this)
                .setTitle("1.000 Goles")
                .setMessage("¿Quieres salir del juego?")
                .setNegativeButton("Seguir jugando", null)
                .setPositiveButton("Salir", (dialog, which) -> finish())
                .show();
    }

    @Override
    protected void onDestroy() {
        if (pendingImport != null) pendingImport.onReceiveValue(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
