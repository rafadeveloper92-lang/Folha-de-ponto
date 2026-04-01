import QRCode from 'qrcode';

export async function payloadToQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    color: { dark: '#0c1222', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}
