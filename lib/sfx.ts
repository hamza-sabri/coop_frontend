/* كوب — every sound is synthesised, so the app ships no audio files.
   Browsers block audio until a gesture, hence resume() on first pointerdown. */
/* Two sounds ship as files, because the irregularity of real liquid is exactly
   the part the ear checks and an oscillator cannot fake it: /koup/sfx/pour.mp3
   and /koup/sfx/sip.mp3. Either one missing simply falls through to the
   synthesised version below, so nothing is ever silent. */
const SFX_DIR = '/koup/sfx/'
const buffers: Record<string, AudioBuffer> = {}
const tried: Record<string, boolean> = {}

export const SFX = (() => {
  let ctx: any = null, noise: any = null, on = true, master: any = null;
  function boot(){
    if(ctx) return ctx;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if(!AC) return null;
    try{ ctx = new AC(); }catch { return null; }
    master = ctx.createGain(); master.gain.value = .85; master.connect(ctx.destination);
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    return ctx;
  }
  async function loadSample(ctx: any, name: string){
    if (tried[name]) return
    tried[name] = true
    try {
      const res = await fetch(`${SFX_DIR}${name}.mp3`)
      if (!res.ok) return                       // no file shipped — fine
      buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer())
    } catch { /* unplayable or missing; the synth covers it */ }
  }
  /* Returns false when the file has not arrived yet, which is the caller's cue
     to synthesise instead — the first play of a session is usually the synth. */
  function playSample(c: any, name: string, dur: number, peak = .9){
    const b = buffers[name]; if (!b) return false
    const t = c.currentTime
    const src = c.createBufferSource(); src.buffer = b
    const g = c.createGain()
    g.gain.setValueAtTime(.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + .06)
    g.gain.setValueAtTime(peak, t + Math.max(.12, dur - .18))
    g.gain.exponentialRampToValueAtTime(.0001, t + dur)
    src.connect(g); g.connect(master)
    src.start(t); src.stop(t + dur + .1)
    return true
  }

  function live(){ const c = boot(); if(!c || !on) return null;
    if(c.state === 'suspended') c.resume();
    /* Fetch the file on the first sound of the session, not on the first pour
       — otherwise the pour, which is the one that matters, gets the synth. */
    void loadSample(c, 'pour'); void loadSample(c, 'drop');
    return c.state === 'running' ? c : null; }
  function tone(f: number, t: number, dur: number, peak: number, type?: string){
    const c = live(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = (type as any) || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .04);
    return o;
  }
  function noiseBurst(t: number, dur: number, f0: number, f1: number, q: number, peak: number){
    const c = live(); if(!c) return;
    const src = c.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q || 1.1;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(.16, dur * .28));
    g.gain.setValueAtTime(peak, t + dur * .72);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + .05);
  }
  return {
    enabled: () => on,
    toggle(){ on = !on; if(on) live(); return on; },
    resume(){ live(); },
    tap(){ const c = live(); if(!c) return; tone(1180, c.currentTime, .05, .05, 'triangle'); },
    tick(){ const c = live(); if(!c) return; tone(1560, c.currentTime, .035, .022, 'sine'); },
    whoosh(){ const c = live(); if(!c) return; noiseBurst(c.currentTime, .55, 260, 1500, .8, .045); },
    settle(){ const c = live(); if(!c) return; const t = c.currentTime;
      const o = tone(120, t, .34, .16, 'sine'); if(o) o.frequency.exponentialRampToValueAtTime(52, t + .3);
      noiseBurst(t, .09, 1600, 500, 1.6, .05); },
    pour(dur: number){
      const c = live(); if(!c) return; const t = c.currentTime;
      void loadSample(c, 'pour');
      if (playSample(c, 'pour', dur)) return;
      // A pour is three things at once. The hiss of liquid is broadband noise.
      noiseBurst(t, dur, 700, 2100, .5, .038);
      // The part that actually says "a cup is filling": a resonance that RISES,
      // because the air column above the liquid gets shorter as it fills.
      const src = c.createBufferSource(); src.buffer = noise; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 11;
      // the air column shortens as the cup fills, so the pitch climbs
      bp.frequency.setValueAtTime(240, t);
      bp.frequency.exponentialRampToValueAtTime(920, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.085, t + .18);
      g.gain.setValueAtTime(.085, t + dur * .78);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t); src.stop(t + dur + .05);
      // And the burble — irregular droplets, or it reads as a tap running.
      for(let i = 0; i < 26; i++){
        const at = t + .1 + Math.random() * (dur - .2);
        const f  = 180 + Math.random() * 420;
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, at);
        o.frequency.exponentialRampToValueAtTime(f * 1.7, at + .05);
        og.gain.setValueAtTime(.0001, at);
        og.gain.exponentialRampToValueAtTime(.012 + Math.random() * .01, at + .006);
        og.gain.exponentialRampToValueAtTime(.0001, at + .06);
        o.connect(og); og.connect(master); o.start(at); o.stop(at + .09);
      }
    },
    /* The bead of coffee landing back in the cup. */
    drop(){
      const c = live(); if(!c) return; const t = c.currentTime;
      void loadSample(c, 'drop');
      if (playSample(c, 'drop', .24, .45)) return;
      /* Small, bright, short and dry. The same shape an octave lower with a
         tail on it is a toilet — which is what the first attempt sounded
         like. Everything under 400Hz was the problem, not the physics. */
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1600, t);
      o.frequency.exponentialRampToValueAtTime(3600, t + .05);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.040, t + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t + .10);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + .12);
      noiseBurst(t, .02, 3000, 1600, 1.6, .010);
    },
    /* Kept, but no longer part of the opening — the pour ends on its own.
       Call it from anywhere that wants a drink sound. */
    sip(){
      const c = live(); if(!c) return; const t = c.currentTime;
      void loadSample(c, 'sip');
      if (playSample(c, 'sip', .8, .85)) return;
      // Air drawn through liquid: a formant that climbs as the gap narrows,
      // a scatter of slurp bubbles, then the low settle of a swallow.
      noiseBurst(t, .42, 620, 1900, 7, .05);
      for(let i = 0; i < 9; i++){
        const at = t + .04 + Math.random() * .34;
        const f  = 240 + Math.random() * 520;
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, at);
        o.frequency.exponentialRampToValueAtTime(f * 2.1, at + .04);
        og.gain.setValueAtTime(.0001, at);
        og.gain.exponentialRampToValueAtTime(.02, at + .005);
        og.gain.exponentialRampToValueAtTime(.0001, at + .05);
        o.connect(og); og.connect(master); o.start(at); o.stop(at + .07);
      }
      noiseBurst(t + .44, .18, 420, 180, 1.2, .028);
    },
    /* Two rising blips — a confirmation, not an alert. Short enough to fire
       on every add without becoming the sound of the app. */
    added(){
      const c = live(); if(!c) return; const t = c.currentTime;
      tone(660, t, .09, .045, 'sine');
      tone(990, t + .055, .12, .038, 'sine');
      tone(1320, t + .10, .10, .020, 'triangle');
    },
    sweep(){ const c = live(); if(!c) return; const t = c.currentTime;
      const o = tone(520, t, .5, .05, 'sine'); if(o) o.frequency.exponentialRampToValueAtTime(1240, t + .42); },
    chime(){ const c = live(); if(!c) return; const t = c.currentTime;
      [[784,0],[1046.5,.08],[1318.5,.16]].forEach(([f,d]: number[]) => tone(f, t + d, .75, .07, 'sine')); },
    /* One tick per point landing in the cup. */
    point(i: number){ const c = live(); if(!c) return;
      tone(880 + (i % 4) * 110, c.currentTime, .12, .045, 'triangle'); }
  };
})();
/* Chrome refuses (and logs) a vibrate before the user has tapped the page, so
   the opening's haptics would fill the console on every load. Stay quiet until
   there has actually been a gesture. */
let gestured = false
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true }
  window.addEventListener('pointerdown', mark, { once: true, capture: true })
  window.addEventListener('keydown', mark, { once: true, capture: true })
}

export function haptic(p: number | number[]){
  if (!gestured) return
  try{ if (navigator.vibrate) navigator.vibrate(p as any) }catch{}
}
