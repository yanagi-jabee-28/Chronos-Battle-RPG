'use client';

import { useCallback, useRef } from 'react';

export const useAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playSound = useCallback((type: 'attack' | 'heal' | 'buff' | 'debuff' | 'turn' | 'victory' | 'defeat' | 'click' | 'select' | 'cancel') => {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.5, now); // Increased volume from 0.2 to 0.5

    switch (type) {
      case 'click': {
        // High pitched short click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
      case 'select': {
        // Two-tone rising beep
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0, now + i * 0.05);
          gain.gain.linearRampToValueAtTime(0.3, now + i * 0.05 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.1);
        });
        break;
      }
      case 'cancel': {
        // Two-tone falling beep
        [1100, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0, now + i * 0.05);
          gain.gain.linearRampToValueAtTime(0.3, now + i * 0.05 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.1);
        });
        break;
      }
      case 'attack': {
        // Sharp noise + descending pitch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.2);

        // Add a bit of noise for impact
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        noise.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(now);
        noise.stop(now + 0.1);
        break;
      }
      case 'heal': {
        // Rising sine wave with shimmer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      }
      case 'buff': {
        // Bright rising arpeggio
        [440, 554.37, 659.25, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0, now + i * 0.1);
          gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        });
        break;
      }
      case 'debuff': {
        // Low dissonant descending tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(110, now);
        osc2.frequency.setValueAtTime(115, now);
        osc1.frequency.exponentialRampToValueAtTime(55, now + 0.5);
        osc2.frequency.exponentialRampToValueAtTime(57, now + 0.5);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(masterGain);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
        break;
      }
      case 'turn': {
        // Short clean click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'victory': {
        // Triumphant fanfare
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + i * 0.15);
          gain.gain.setValueAtTime(0, now + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.8);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.8);
        });
        break;
      }
      case 'defeat': {
        // Descending somber tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 1.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.5);
        break;
      }
    }
  }, []);

  return { playSound };
};
