package org.wonday.pdf;

import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

final class PdfDocumentRegistry {
    static final class Entry {
        final ParcelFileDescriptor parcelFileDescriptor;
        final PdfRenderer renderer;

        Entry(ParcelFileDescriptor parcelFileDescriptor, PdfRenderer renderer) {
            this.parcelFileDescriptor = parcelFileDescriptor;
            this.renderer = renderer;
        }
    }
    private static final AtomicInteger NEXT_ID = new AtomicInteger(1);

    private static final Map<Integer, Entry> ENTRIES = new ConcurrentHashMap<>();

    static int register(ParcelFileDescriptor pfd) throws IOException {
        PdfRenderer renderer = new PdfRenderer(pfd);
        int id = NEXT_ID.getAndIncrement();
        ENTRIES.put(id, new Entry(pfd, renderer));
        return id;
    }

    static PdfRenderer getRenderer(int id) {
        Entry e = ENTRIES.get(id);
        return e != null ? e.renderer : null;
    }

    static void close(int id) {
        Entry e = ENTRIES.remove(id);
        if (e != null) {
            try { e.renderer.close(); } catch (Throwable ignored) {}
            try { e.parcelFileDescriptor.close(); } catch (Throwable ignored) {}
        }
    }

    static void closeAll() {
        for (Integer id : ENTRIES.keySet()) {
            close(id);
        }
    }
}


