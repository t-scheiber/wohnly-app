# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Wohnly, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email us at **security@wohnly.app** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

We will acknowledge your report within **48 hours** and aim to provide a fix or mitigation within **7 days** for critical issues.

## Scope

The following are in scope for security reports:

- **API** (api.wohnly.app) — authentication, authorization, data access
- **End-to-end encryption** — key management, device approval, cryptographic implementation
- **Mobile apps** (iOS, Android) — local data storage, session handling
- **Desktop app** (Windows, macOS) — OAuth flow, session token storage
- **Web app** (wohnly.app) — XSS, CSRF, injection vulnerabilities

## Out of Scope

- Denial of service attacks
- Social engineering
- Issues in third-party dependencies (report these upstream)
- Issues requiring physical access to a user's device

## Encryption

Wohnly uses end-to-end encryption (XChaCha20-Poly1305) for sensitive household data. Encryption keys are generated on-device and distributed through an approved device flow. The server never has access to plaintext encryption keys.

## Acknowledgements

We appreciate the security research community's efforts in helping keep Wohnly and its users safe. Responsible reporters will be credited (with permission) in release notes.
