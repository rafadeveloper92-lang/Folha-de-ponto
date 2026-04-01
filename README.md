<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GSI Tracker — Ponto Digital

App web (Vite + React) pensado para uso **offline** no dispositivo (PWA / Capacitor).

## Rodar localmente

**Pré-requisito:** Node.js

1. `npm install`
2. `npm run dev`

Para gerar o APK Android após alterar o front-end: `npm run android:build` (requer Android SDK local) ou use o workflow no GitHub Actions.

## Dados no dispositivo

- **No APK Android**: os registros e o perfil são guardados em **SQLite** no armazenamento privado da app (plugin `@capacitor-community/sqlite`). Na primeira abertura após esta atualização, dados antigos no **IndexedDB (Dexie)** são migrados automaticamente para SQLite.
- **No navegador (PWA / `npm run dev`)**: continua a usar **IndexedDB** via Dexie — mesmo padrão de “só no teu dispositivo”, sem servidor.

Ícones da PWA estão em `public/icon-192.png` e `public/icon-512.png` (gerados por `python3 scripts/generate-icons.py` se precisar de os recriar).
