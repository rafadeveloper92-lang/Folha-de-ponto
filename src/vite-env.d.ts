/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_MESSAGES_JSON_URL?: string;
  /** E.164 sem + para WhatsApp do responsável de materiais (opcional; padrão +34 641 672023) */
  readonly VITE_SUPPLIES_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
