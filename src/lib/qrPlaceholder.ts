/** Gera imagem PNG do QR a partir do texto (rede). Útil no iPhone quando o PDF não é lido. */
export async function qrDataUrlFromPayload(payload: string): Promise<string> {
  const trimmed = payload.trim();
  if (!trimmed) throw new Error('payload vazio');
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QR HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
