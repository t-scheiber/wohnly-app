import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content"
        />

        {/* SEO */}
        <title>Wohnly — Household Management for Roommates &amp; Families</title>
        <meta name="description" content="Wohnly helps roommates and families manage shared expenses, chores, events, shopping lists, and more — all in one app. Available on iOS, Android, Web, and Desktop." />
        <meta name="keywords" content="household management, roommate app, shared expenses, chore tracker, family organizer, household chores, expense splitting, shopping list, shared calendar" />
        <meta name="author" content="Wohnly" />
        <link rel="canonical" href="https://wohnly.app" />
        <meta name="theme-color" content="#6db5a8" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wohnly.app" />
        <meta property="og:title" content="Wohnly — Household Management for Roommates & Families" />
        <meta property="og:description" content="Manage shared expenses, chores, events, and shopping lists together. One app for your entire household." />
        <meta property="og:image" content="https://wohnly.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Wohnly" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Wohnly — Household Management for Roommates & Families" />
        <meta name="twitter:description" content="Manage shared expenses, chores, events, and shopping lists together. One app for your entire household." />
        <meta name="twitter:image" content="https://wohnly.app/og-image.png" />

        {/* PWA / App Links */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Wohnly" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Wohnly" />

        {/* Structured Data (JSON-LD) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Wohnly",
          "description": "Household management app for roommates and families. Track shared expenses, chores, events, and shopping lists.",
          "url": "https://wohnly.app",
          "applicationCategory": "LifestyleApplication",
          "operatingSystem": "iOS, Android, Windows, macOS, Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "100"
          }
        }) }} />

        <ScrollViewStyleReset />

        {/* Accessibility: visible keyboard focus indicators (WCAG 2.4.7)
            and reduced-motion support for CSS-driven animations */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
:focus-visible {
  outline: 2px solid #2e7d6e !important;
  outline-offset: 2px !important;
}
html, body, #root {
  width: 100%;
  height: 100%;
  min-height: 100%;
  margin: 0;
}
@supports (height: 100dvh) {
  html, body, #root {
    height: 100dvh;
  }
}
@media (prefers-color-scheme: dark) {
  :focus-visible {
    outline-color: #7bc4b6 !important;
  }
}
@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid Highlight !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
