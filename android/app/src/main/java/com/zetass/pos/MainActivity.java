package com.zetass.pos;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidRuntimePermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        applyWebViewBackground(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyWebViewBackground(newConfig);
    }

    // The WebView background shows through for a frame whenever it resizes (keyboard, biometric
    // prompt). A fixed dark colour flashed over the light UI, so follow the system theme the app defaults to.
    private void applyWebViewBackground(Configuration config) {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        boolean night = (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        webView.setBackgroundColor(night ? Color.parseColor("#0f172a") : Color.parseColor("#f8fafc"));
    }
}
