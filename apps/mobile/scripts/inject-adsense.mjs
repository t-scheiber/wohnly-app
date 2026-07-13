/**
 * Post-export script: injects SEO meta tags and structured data into dist/index.html.
 * Run after `npx expo export --platform web`.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "../dist/index.html");

let html = readFileSync(htmlPath, "utf8");

// ── Mobile viewport + safe-area behavior ──
html = html.replace(
  /<meta name="viewport" content="[^"]*" \/>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content" />',
);

// ── Replace the generic <title> ──
html = html.replace(
  "<title>Wohnly</title>",
  "<title>Wohnly \u2014 Household Management for Roommates &amp; Families</title>"
);

// ── SEO meta tags ──
const seoTags = `
    <!-- Mobile viewport sizing and iOS safe-area support -->
    <style id="wohnly-responsive-root">
      html, body, #root {
        width: 100%;
        height: 100%;
        min-height: 100%;
        margin: 0;
      }
      @supports (height: 100dvh) {
        html, body, #root { height: 100dvh; }
      }
    </style>

    <!-- SEO -->
    <meta name="description" content="Wohnly helps roommates and families manage shared expenses, chores, events, shopping lists, and more \u2014 all in one app. Available on iOS, Android, Web, and Desktop." />
    <meta name="keywords" content="household management, roommate app, shared expenses, chore tracker, family organizer, household chores, expense splitting, shopping list, shared calendar" />
    <meta name="author" content="Wohnly" />
    <link rel="canonical" href="https://wohnly.app" />
    <meta name="theme-color" content="#6db5a8" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://wohnly.app" />
    <meta property="og:title" content="Wohnly \u2014 Household Management for Roommates &amp; Families" />
    <meta property="og:description" content="Manage shared expenses, chores, events, and shopping lists together. One app for your entire household." />
    <meta property="og:image" content="https://wohnly.app/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Wohnly" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Wohnly \u2014 Household Management for Roommates &amp; Families" />
    <meta name="twitter:description" content="Manage shared expenses, chores, events, and shopping lists together. One app for your entire household." />
    <meta name="twitter:image" content="https://wohnly.app/og-image.png" />

    <!-- PWA -->
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/assets/images/icon.823129a840f6625d43c4f94965b0b468.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Wohnly" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Wohnly" />

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
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
      }
    }
    </script>
`;

// Inject everything before </head>
const injection = `${seoTags}\n  `;

if (!html.includes('og:title')) {
  html = html.replace("</head>", `${injection}</head>`);
}

writeFileSync(htmlPath, html);
console.log("Applied viewport and metadata to dist/index.html");
