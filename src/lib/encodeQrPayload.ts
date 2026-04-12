import QRCode from 'qrcode';

/**
 * Gera PNG (data URL) com o **mesmo conteúdo** que o QR original (payload byte-a-byte).
 * Usado no iPhone quando o PDF não é lido — o encarregado lê o mesmo dado.
 */
export async function encodeQrToDataUrl(payload: string): Promise<string> {
  const text = payload.trim();
  if (!text) throw new Error('payload vazio');
  return QRCode.toDataURL(text, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {dark: '#000000', light: '#ffffff'},
  });
}
