// popup/sounds.js — Focusora ambient soundscape generator
// Uses the Web Audio API to synthesise focus soundscapes with no audio files.
// Supports: Rain, Forest, Café, White Noise, Deep Focus (binaural-style tone).

let audioCtx = null;
let masterGain = null;
let activeNodes = [];
let currentSoundId = null;

function getCtx() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function stopAll() {
  activeNodes.forEach(node => {
    try { node.stop(); } catch (_) {}
    try { node.disconnect(); } catch (_) {}
  });
  activeNodes = [];
  currentSoundId = null;
}

// ------ Noise generator -------------------------------------------------------

function createWhiteNoise(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createPinkNoise(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

// ------ Soundscape factories --------------------------------------------------

function playRain(ctx, gain) {
  // Rain = pink noise + high-pass filter
  const noise = createPinkNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 8000;

  const g = ctx.createGain();
  g.gain.value = 1.8;

  noise.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  g.connect(gain);
  noise.start();
  activeNodes.push(noise, hp, lp, g);
}

function playForest(ctx, gain) {
  // Forest = pink noise (very soft, low-pass) + occasional bird-like sine blips
  const noise = createPinkNoise(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;

  const g = ctx.createGain();
  g.gain.value = 0.9;

  noise.connect(lp);
  lp.connect(g);
  g.connect(gain);
  noise.start();
  activeNodes.push(noise, lp, g);

  // Occasional bird chirp — random sine bursts
  function chirp() {
    const osc = ctx.createOscillator();
    const bGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 2400 + Math.random() * 1600;
    bGain.gain.setValueAtTime(0, ctx.currentTime);
    bGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    bGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(bGain);
    bGain.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    // Schedule next chirp (3–12 seconds away)
    const delay = 3000 + Math.random() * 9000;
    setTimeout(chirp, delay);
  }
  setTimeout(chirp, 2000 + Math.random() * 4000);
}

function playCafe(ctx, gain) {
  // Café = layered low noise + soft hiss + occasional low-freq rumble
  const noise = createPinkNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 600;
  bp.Q.value = 0.6;

  const g = ctx.createGain();
  g.gain.value = 1.2;
  noise.connect(bp);
  bp.connect(g);
  g.connect(gain);
  noise.start();
  activeNodes.push(noise, bp, g);

  // Distant murmur LFO
  const osc = ctx.createOscillator();
  const murmur = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 3;
  murmur.gain.value = 0.04;
  osc.connect(murmur);
  murmur.connect(gain);
  osc.start();
  activeNodes.push(osc, murmur);
}

function playWhiteNoise(ctx, gain) {
  const noise = createWhiteNoise(ctx);
  const g = ctx.createGain();
  g.gain.value = 0.35;
  noise.connect(g);
  g.connect(gain);
  noise.start();
  activeNodes.push(noise, g);
}

function playDeepFocus(ctx, gain) {
  // Deep Focus = low binaural-style drone at 40Hz difference + sub-bass hum
  const baseFreq = 100;
  const beatFreq = 40; // gamma range (~40Hz binaural-ish) — relaxed focus

  const oscL = ctx.createOscillator();
  const oscR = ctx.createOscillator();
  const gainL = ctx.createGain();
  const gainR = ctx.createGain();
  const merger = ctx.createChannelMerger(2);

  oscL.type = "sine";
  oscL.frequency.value = baseFreq;
  oscR.type = "sine";
  oscR.frequency.value = baseFreq + beatFreq;

  gainL.gain.value = 0.18;
  gainR.gain.value = 0.18;

  oscL.connect(gainL);
  oscR.connect(gainR);
  gainL.connect(merger, 0, 0);
  gainR.connect(merger, 0, 1);
  merger.connect(gain);

  oscL.start();
  oscR.start();
  activeNodes.push(oscL, oscR, gainL, gainR, merger);

  // Soft noise bed
  const noise = createPinkNoise(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 300;
  const ng = ctx.createGain();
  ng.gain.value = 0.3;
  noise.connect(lp);
  lp.connect(ng);
  ng.connect(gain);
  noise.start();
  activeNodes.push(noise, lp, ng);
}

// ------ Public API -----------------------------------------------------------

/**
 * Play a soundscape by ID. If the same ID is already playing, does nothing.
 * @param {string} id — one of "rain", "forest", "cafe", "whitenoise", "deep", "off"
 * @param {number} volume — 0.0 to 1.0
 */
export function playSoundscape(id, volume = 0.5) {
  if (id === "off") {
    stopAll();
    return;
  }
  if (id === currentSoundId) return; // already playing

  stopAll();

  const ctx = getCtx();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2); // fade in

  currentSoundId = id;

  switch (id) {
    case "rain":       playRain(ctx, masterGain);       break;
    case "forest":     playForest(ctx, masterGain);     break;
    case "cafe":       playCafe(ctx, masterGain);       break;
    case "whitenoise": playWhiteNoise(ctx, masterGain); break;
    case "deep":       playDeepFocus(ctx, masterGain);  break;
  }
}

/**
 * Stop all soundscapes with a short fade-out.
 */
export function stopSoundscape() {
  if (!masterGain || !audioCtx) { stopAll(); return; }
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  setTimeout(stopAll, 900);
}

/**
 * Set volume (0–1) without changing the current soundscape.
 * @param {number} vol
 */
export function setVolume(vol) {
  if (!masterGain || !audioCtx) return;
  masterGain.gain.linearRampToValueAtTime(
    Math.max(0, Math.min(1, vol)),
    audioCtx.currentTime + 0.2
  );
}

/**
 * Returns the current soundscape ID or null.
 */
export function getCurrentSoundscape() {
  return currentSoundId;
}
