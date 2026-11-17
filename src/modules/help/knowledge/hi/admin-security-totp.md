---
id: admin-security-totp
title: TOTP से admin लॉगिन सुरक्षित करें
roles: [admin, super_admin]
keywords: [TOTP, 2FA, ऑथेंटिकेटर, टू फैक्टर, login verification, backup code, security, admin login]
---
1. Admin users खोलें, फिर Login verification वाला हिस्सा (Security बटन)।
2. Enable TOTP दबाएं।
3. ऑथेंटिकेटर ऐप से QR स्कैन करें, या Manual secret कॉपी करें।
4. Confirm code में छह अंकों का कोड डालें।
अगली बार साइन-इन पर admin लॉगिन "Enter your authenticator code" पूछेगा। फोन खो जाए तो Use a backup code चुनें। Login verification में दिखता है कि किसके लिए चालू है। Disable TOTP तभी करें जब नया विकल्प तैयार हो।
