/** Jingle curto de abertura (Web Audio). Funciona offline. */
let ctxRef: AudioContext | null = null;

function ctx(): AudioContext {
  if (!ctxRef) ctxRef = new AudioContext();
  return ctxRef;
}

/** Acorde ascendente breve + brilho final — típico de splash. */
export async function playIntroSound(): Promise<void> {
  try {
    const audio = ctx();
    if (audio.state === 'suspended') await audio.resume();

    const t0 = audio.currentTime;
    const freqs = [392, 493.88, 587.33];
    const dur = 0.14;

    freqs.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(audio.destination);
      const start = t0 + i * 0.11;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.11, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });

    const shine = audio.createOscillator();
    const g2 = audio.createGain();
    shine.type = 'sine';
    shine.frequency.setValueAtTime(880, t0 + 0.38);
    shine.connect(g2);
    g2.connect(audio.destination);
    g2.gain.setValueAtTime(0, t0 + 0.38);
    g2.gain.linearRampToValueAtTime(0.08, t0 + 0.4);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    shine.start(t0 + 0.38);
    shine.stop(t0 + 0.56);
  } catch {
    /* silencioso */
  }
}
