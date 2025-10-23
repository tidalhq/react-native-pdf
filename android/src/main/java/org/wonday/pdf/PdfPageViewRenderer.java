package org.wonday.pdf;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.pdf.PdfRenderer;
import android.util.AttributeSet;
import android.view.View;

import androidx.annotation.Nullable;

public class PdfPageViewRenderer extends View {
    private int documentId = -1;
    private int pageIndex = 0;
    private float pageWidthPt = 0f;
    private float pageHeightPt = 0f;
    private Bitmap renderedBitmap;
    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);

    public PdfPageViewRenderer(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        setWillNotDraw(false);
    }

    public void setDocumentId(int id) {
        if (this.documentId != id) {
            this.documentId = id;
            recycleBitmap();
            invalidate();
        }
    }

    public void setPageIndex(int index) {
        if (this.pageIndex != index) {
            this.pageIndex = index;
            recycleBitmap();
            invalidate();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        recycleBitmap();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.drawColor(Color.TRANSPARENT);

        if (documentId <= 0) return;
        PdfRenderer renderer = PdfDocumentRegistry.getRenderer(documentId);
        if (renderer == null) return;
        if (pageIndex < 0 || pageIndex >= renderer.getPageCount()) return;

        int viewW = getWidth();
        int viewH = getHeight();
        if (viewW <= 0 || viewH <= 0) return;

        PdfRenderer.Page page = null;
        try {
            page = renderer.openPage(pageIndex);
            int pageW = page.getWidth();
            int pageH = page.getHeight();

            float scale = Math.min((float) viewW / pageW, (float) viewH / pageH);
            int bmpW = Math.max(1, Math.round(pageW * scale));
            int bmpH = Math.max(1, Math.round(pageH * scale));

            if (renderedBitmap == null || renderedBitmap.getWidth() != bmpW || renderedBitmap.getHeight() != bmpH) {
                recycleBitmap();
                renderedBitmap = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888);
            }

            Rect dest = new Rect(0, 0, renderedBitmap.getWidth(), renderedBitmap.getHeight());
            page.render(renderedBitmap, dest, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

            float dx = (viewW - renderedBitmap.getWidth()) * 0.5f;
            float dy = (viewH - renderedBitmap.getHeight()) * 0.5f;
            canvas.save();
            canvas.translate(dx, dy);
            canvas.drawBitmap(renderedBitmap, 0, 0, bitmapPaint);
            canvas.restore();
        } finally {
            if (page != null) page.close();
        }
    }

    private void recycleBitmap() {
        if (renderedBitmap != null) {
            renderedBitmap.recycle();
            renderedBitmap = null;
        }
    }
}


