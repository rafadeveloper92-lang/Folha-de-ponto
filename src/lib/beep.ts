/** Bipe curto gerado no dispositivo — funciona offline (sem ficheiros nem rede). */
export function playShortBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 100);
  } catch {
    /* silencioso se o áudio não estiver disponível */
  }
}
