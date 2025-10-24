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

@ReactModule(name = PdfManagerModule.NAME)
public class PdfManagerModule extends ReactContextBaseJavaModule {
    public static final String NAME = "PdfManager";
    private final ReactApplicationContext reactContext;

    public PdfManagerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void loadFile(String path, String password, Promise promise) {
        try {
            ParcelFileDescriptor pfd = openFileDescriptor(path);
            int id = PdfDocumentRegistry.register(pfd);
            PdfRenderer renderer = PdfDocumentRegistry.getRenderer(id);
            if (renderer == null) throw new IOException("Failed to open PDF");
            int pageCount = renderer.getPageCount();
            int width;
            int height;
            PdfRenderer.Page page = null;
            try {
                page = renderer.openPage(0);
                width = page.getWidth();
                height = page.getHeight();
            } finally {
                if (page != null) page.close();
            }
            // Return [fileNo, numberOfPages, width, height] similar to iOS
            com.facebook.react.bridge.WritableArray result = com.facebook.react.bridge.Arguments.createArray();
            result.pushInt(id);
            result.pushInt(pageCount);
            result.pushDouble((double) width);
            result.pushDouble((double) height);
            promise.resolve(result);
        } catch (Throwable t) {
            // PdfRenderer cannot open PDF with password
            String message = t.getMessage() != null && t.getMessage().toLowerCase().contains("password")
                    ? "Password required or incorrect password."
                    : (t.getMessage() != null ? t.getMessage() : "Failed to open PDF");
            promise.reject("E_LOAD", message, t);
        }
    }

    @ReactMethod
    public void closeFile(int id, Promise promise) {
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
            ParcelFileDescriptor desc = resolver.openFileDescriptor(uri, "r");
            if (desc == null) throw new FileNotFoundException("Could not open content URI");
            return desc;
        }
        throw new FileNotFoundException("Unsupported URI scheme: " + uri.getScheme());
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        try {
            PdfDocumentRegistry.closeAll();
        } catch (Throwable ignored) {}
    }
}


