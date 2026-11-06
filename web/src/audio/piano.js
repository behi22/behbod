import { pianoVoice, sampleVoice } from './synths.js';
import { makeKeyMap } from './pure/notes.js';
import { SONGS, buildSong } from './pure/songs.js';
import { stats, ahead } from './core.js';

const MAX_VOICES = 40;
// The recorded grand: one file every third semitone from A0 (21) to C8 (108), in web/assets/piano.
const NOTE = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const SAMPLED = Array.from({ length: 30 }, (_, i) => 21 + i * 3);
const fileFor = m => `assets/piano/${NOTE[m % 12]}${Math.floor(m / 12) - 1}.mp3`;

export function makePiano(env) {
  const keymap = makeKeyMap(60);
  const down = new Map(), live = new Set();
  let sustain = false, song = null, bank = null, loading = null, lastNote = -1e9;
  // The recordings load the first time the sound engine is up; until they arrive the piano plays its synth voice.
  function load(e) {
    if (loading || typeof fetch === 'undefined') return;
    loading = Promise.all(SAMPLED.map(m => fetch(fileFor(m)).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then(b => e.ctx.decodeAudioData(b)).then(buf => [m, buf])))
      .then(list => { bank = new Map(list); })
      .catch(() => { bank = null; });
  }
  const voice = (e, t, midi, v) => { lastNote = performance.now(); return bank ? sampleVoice(e, e.pianoIn, t, midi, v, bank) : pianoVoice(e, e.pianoIn, t, midi, v); };

  const track = v => {
    live.add(v);
    v.S.onDone = () => live.delete(v);
    if (live.size > MAX_VOICES) {
      const oldest = live.values().next().value;
      oldest.release(env.eng().ctx.currentTime, 0.015);
      live.delete(oldest);
    }
    return v;
  };

  function noteOn(midi, vel = 0.7) {
    const e = env.eng();
    if (!e || !env.sound.on) return;
    midi = Math.round(+midi);
    if (!(midi >= 21 && midi <= 108)) return;
    let v = +vel;
    if (!(v >= 0)) v = 0.7;
    if (v > 1) v /= 127;
    load(e);
    const now = e.ctx.currentTime, old = down.get(midi);
    if (old) old.voice.release(now, 0.04);
    down.set(midi, { voice: track(voice(e, now, midi, v)), key: true });
  }

  function noteOff(midi) {
    const e = env.eng(), n = down.get(Math.round(+midi));
    if (!e || !n) return;
    n.key = false;
    if (!sustain) { n.voice.release(e.ctx.currentTime); down.delete(Math.round(+midi)); }
  }

  function setSustain(on) {
    sustain = !!on;
    const e = env.eng();
    if (sustain || !e) return;
    const now = e.ctx.currentTime;
    for (const [m, n] of down) if (!n.key) { n.voice.release(now); down.delete(m); }
  }

  function stopSong() {
    if (!song) return;
    const s = song;
    song = null;
    s.finish(false);
  }

  function playSong(id, opts = {}) {
    stopSong();
    const e = env.eng(), data = e && buildSong(id, { duet: !!opts.duet });
    if (!data) return 0;
    load(e);
    const ctx = e.ctx, start = ctx.currentTime + 0.15, notes = data.notes;
    const cues = notes.flatMap(n => [{ at: n.t, on: true, n }, { at: n.t + n.dur, on: false, n }]).sort((a, b) => a.at - b.at || a.on - b.on);
    const lit = new Set(), voices = new Set();
    let ni = 0, ci = 0, done = false;
    const tell = (n, on) => {
      if (on) lit.add(n); else lit.delete(n);
      if (opts.onNote) try { opts.onNote({ midi: n.midi, on, vel: n.vel, part: n.part, who: n.who }); } catch (err) { console.error(err); }
    };
    stats.songs++;
    const job = {
      finish(natural) {
        if (done) return;
        done = true;
        stats.songs--;
        env.clock.remove(job);
        const now = ctx.currentTime;
        for (const v of voices) v.release(now);
        for (const n of [...lit]) tell(n, false);
        if (song === job) song = null;
        if (opts.onEnd) try { opts.onEnd({ id, completed: natural }); } catch (err) { console.error(err); }
      },
      kill() { job.finish(false); },
      pump() {
        if (done) return false;
        const now = ctx.currentTime, horizon = now + ahead();
        while (ni < notes.length && start + notes[ni].t <= horizon) {
          const n = notes[ni++], t = start + n.t;
          if (t < now - 0.05 || !env.sound.on) continue;
          const v = track(voice(e, Math.max(t, now), n.midi, n.vel));
          v.release(t + n.dur);
          voices.add(v);
          v.S.onDone = () => { live.delete(v); voices.delete(v); };
        }
        while (ci < cues.length && start + cues[ci].at <= now) { const c = cues[ci++]; tell(c.n, c.on); }
        if (ci >= cues.length) { job.finish(true); return false; }
        return true;
      },
    };
    song = job;
    env.clock.add(job);
    return data.duration;
  }

  return {
    noteOn, noteOff, setSustain, playSong, stopSong,
    keyToMidi: (code, type, repeat) => keymap.keyToMidi(code, type, repeat),
    get octave() { return keymap.octave; },
    get playing() { return !!song; },
    // Seconds since a key last sounded (played or from a song).
    get idle() { return (performance.now() - lastNote) / 1000; },
    get sampled() { return !!bank; },
    preload() { const e = env.eng(); if (e) load(e); },
    setOctave: o => keymap.setOctave(o),
    // A song's melody notes, for learning it.
    lead: id => (buildSong(id, { duet: false })?.notes || []).filter(n => n.part === 'lead').sort((a, b) => a.t - b.t),
    // Where the piano stands (three's axes), so its sound comes from there.
    setPosition(p) {
      const e = env.eng();
      if (!e || !e.pianoPan) return;
      const P = e.pianoPan;
      if (P.positionX) { P.positionX.value = p.x; P.positionY.value = p.y; P.positionZ.value = p.z; } else P.setPosition(p.x, p.y, p.z);
    },
    songs: SONGS.map(({ id, title }) => ({ id, title })),
  };
}
