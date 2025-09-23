package org.wonday.pdf;

import androidx.annotation.NonNull;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

@ReactModule(name = PdfPageViewManager.REACT_CLASS)
public class PdfPageViewManager extends SimpleViewManager<PdfPageViewRenderer> {
    public static final String REACT_CLASS = "RNPDFPdfPageView";

    @Override
    @NonNull
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    public PdfPageViewRenderer createViewInstance(ThemedReactContext context) {
        return new PdfPageViewRenderer(context, null);
    }

    @ReactProp(name = "fileNo")
    public void setFileNo(PdfPageViewRenderer view, int fileNo) {
        view.setDocumentId(fileNo);
    }

    @ReactProp(name = "page")
    public void setPage(PdfPageViewRenderer view, int page) {
        // JS is 1-based; PdfRenderer is 0-based
        view.setPageIndex(Math.max(0, page - 1));
    }
}


