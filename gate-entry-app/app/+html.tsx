// app/+html.tsx - Web-only root HTML (expo-router). Same as expo-router's
// default template, plus the browser-tab title and theme colour for the
// 25 Nov 2026 Bisleri UI overhaul. Not used on iOS/Android.
import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#00A68B" />
        <title>Bisleri Ops Hub</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
