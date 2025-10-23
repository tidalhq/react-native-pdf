package org.wonday.pdf;

import android.content.ContentResolver;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

@ReactModule(name = PdfRendererModule.NAME)
public class PdfRendererModule extends ReactContextBaseJavaModule {
    public static final String NAME = "RNPDFRenderer";
    private final ReactApplicationContext reactContext;

    public PdfRendererModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    public void open(String pathOrUri, Promise promise) {
        try {
            ParcelFileDescriptor pfd = openFileDescriptor(pathOrUri);
            int id = PdfDocumentRegistry.register(pfd);
            PdfRenderer renderer = PdfDocumentRegistry.getRenderer(id);
            if (renderer == null) throw new IOException("Failed to open PDF");
            promise.resolve(id);
        } catch (Throwable t) {
            promise.reject("E_OPEN", t);
        }
    }

    public void getPageCount(int id, Promise promise) {
        try {
            PdfRenderer renderer = PdfDocumentRegistry.getRenderer(id);
            if (renderer == null) throw new IOException("Renderer not found");
            promise.resolve(renderer.getPageCount());
        } catch (Throwable t) {
            promise.reject("E_PAGE_COUNT", t);
        }
    }

    public void close(int id, Promise promise) {
        try {
            PdfDocumentRegistry.close(id);
            promise.resolve(null);
        } catch (Throwable t) {
            promise.reject("E_CLOSE", t);
        }
    }

    private ParcelFileDescriptor openFileDescriptor(String pathOrUri) throws IOException {
        if (pathOrUri == null) throw new FileNotFoundException("null path");
        Uri uri = Uri.parse(pathOrUri);
        if (uri.getScheme() == null || uri.getScheme().isEmpty() || "file".equals(uri.getScheme())) {
            File f = new File(uri.getScheme() == null ? pathOrUri : uri.getPath());
            return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
        }
        if ("content".equals(uri.getScheme())) {
            ContentResolver resolver = reactContext.getContentResolver();
            return resolver.openFileDescriptor(uri, "r");
        }
        // For http/https, the JS side should have cached to file first
        throw new FileNotFoundException("Unsupported URI scheme: " + uri.getScheme());
    }
}


