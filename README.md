# Nostr Authenticator
Maintained by **botrift.com**

Nostr Authenticator is a mobile application that enables user authentication using Nostr direct messages and proof of key ownership.

The application is designed to act as a companion authenticator for websites that rely on Nostr identities instead of traditional usernames and passwords.

---

## 1. Overview

Nostr Authenticator allows users to prove control over a Nostr identity by responding to authentication challenges sent via Nostr direct messages.

The authentication flow does not rely on passwords, centralized servers, or third-party identity providers.

---

## 2. How It Works

1. A protected website controls a trusted Nostr account (the source account).
2. When authentication is required, the website sends a unique challenge message via a Nostr direct message (DM) to the user.
3. Nostr Authenticator listens for incoming DMs from the configured source account.
4. When a challenge is received, the app replies via Nostr DM, sending back the exact received message using one of the user’s stored keys.
5. By receiving the correct response from the expected public key, the website can verify that the user controls the corresponding private key and authorize access.

No separate cryptographic signing step is performed.  
The proof of identity is the ability to send the correct reply from the declared Nostr public key.

---

## 3. Authentication Model

- Authentication is based on message control, not password exchange.
- Identity is verified by control of the Nostr private key and successful DM delivery from the expected public key.
- The website validates the response by matching the challenge message and the sender’s public key.

---

## 4. Key Storage

- Private keys are stored locally on the device.
- Keys can be stored in plain form or encrypted inside a local vault.
- No backend or centralized key storage is required.
- No private key material is transmitted over the network.

---

## 5. Features

- Nostr-based authentication via direct messages.
- Challenge–response authentication flow.
- Proof of key ownership without passwords.
- Support for multiple stored keys.
- Optional encrypted vault for private keys.
- Local-only key handling.
- Designed for mobile use (Android).

---

## 6. Tech Stack

- React
- TypeScript
- Vite
- Capacitor (Android)
- Nostr protocol

---

## 7. Development

Install dependencies:

```bash
npm install
npm run dev
```
---
---

## 8. Build Android APK

```bash
npm run build
npx cap sync android
npx cap open android
```
---

## 9. Security Notes

- The application does not transmit private keys to any external server.
- All key material remains on the local device.
- Authentication relies on correct source account configuration, secure local key storage, and device integrity.
- This project is provided as-is.
- Review and audit are recommended before use in high-security environments.

---

## 10. Maintainer

Nostr Authenticator is developed and maintained by **botrift.com**.

---

## 11. Origin

This project was originally generated using Lovable and is independently maintained.

---

## 12. License

MIT

---

## 📥 Download


You can download the latest version of the application ready to install:

[![Download Android APK](https://github.com/tzongocu/nostr-authenticator/blob/main/nostr-authenticator-v2.5-logo.apk)

> **Note:** After downloading, you will need to allow installation from "Unknown Sources" in your Android phone's settings to be able to install the APK file.
