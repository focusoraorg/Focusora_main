// Web Audio API generator for ambient focus soundscapes & chimes

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private oscNodes: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private currentMode: string = 'none';

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playChime(type: 'complete' | 'click' | 'break') {
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'complete') {
        // High celebratory chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.6); // C6

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.start(now);
        osc.stop(now + 1.2);
      } else if (type === 'break') {
        // Soft mellow chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else {
        // Subtle tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  public startSoundscape(mode: 'rain' | 'lofi' | 'whitenoise') {
    try {
      this.stopSoundscape();
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.15, now);
      this.gainNode.connect(this.ctx.destination);
      this.currentMode = mode;
      this.isPlaying = true;

      if (mode === 'rain' || mode === 'whitenoise') {
        // Pink / White noise generator
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (mode === 'rain') {
            // Pink noise simulation for natural rainfall
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
          } else {
            output[i] = white * 0.1;
          }
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Filter to make rainfall soothing
        const filter = this.ctx.createBiquadFilter();
        filter.type = mode === 'rain' ? 'lowpass' : 'bandpass';
        filter.frequency.setValueAtTime(mode === 'rain' ? 800 : 1000, now);

        whiteNoise.connect(filter);
        filter.connect(this.gainNode);
        whiteNoise.start(now);
        this.noiseNode = whiteNoise;
      } else if (mode === 'lofi') {
        // Binaural / gentle chord drone generator (432Hz ambient tuning)
        const frequencies = [216, 270, 324, 432];
        frequencies.forEach(freq => {
          if (!this.ctx || !this.gainNode) return;
          const osc = this.ctx.createOscillator();
          const oscGain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          oscGain.gain.setValueAtTime(0.04, now);
          osc.connect(oscGain);
          oscGain.connect(this.gainNode);
          osc.start(now);
          this.oscNodes.push(osc);
        });
      }
    } catch (e) {
      console.warn('Soundscape startup warning:', e);
    }
  }

  public stopSoundscape() {
    try {
      if (this.noiseNode && 'stop' in this.noiseNode) {
        (this.noiseNode as AudioScheduledSourceNode).stop();
      }
      this.oscNodes.forEach(osc => osc.stop());
      this.oscNodes = [];
      this.noiseNode = null;
      this.isPlaying = false;
      this.currentMode = 'none';
    } catch {
      // Ignored
    }
  }

  public getStatus() {
    return { isPlaying: this.isPlaying, currentMode: this.currentMode };
  }
}

export const soundEngine = new SoundscapeEngine();
