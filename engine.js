/* === engine.js — czysty, deterministyczny silnik (testowalny w Node i w przeglądarce) === */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* === notes.js === */
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NAT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const SCALE_STEPS = {
    major:    [0, 2, 4, 5, 7, 9, 11],
    minor:    [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    melodic:  [0, 2, 3, 5, 7, 9, 11],
  };
  const MAJOR_STEPS = SCALE_STEPS.major;

  const SCALE_LABEL = {
    major:    'durowa',
    minor:    'molowa naturalna',
    harmonic: 'molowa harmoniczna',
    melodic:  'molowa melodyczna (wznosząca)',
  };
  function scaleLabel(key) { return SCALE_LABEL[key] || key; }

  const QUALITY_INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] };
  const QUALITY_SUFFIX = { maj: '', min: 'm', dim: '°', aug: '+' };

  const mod12 = (n) => ((n % 12) + 12) % 12;

  // znormalizuj różnicę półtonów do zakresu -6..+5 (dla doboru znaku chromatycznego)
  function centerDiff(d) { return ((d % 12) + 18) % 12 - 6; }

  function accString(diff) {
    if (diff === 0) return '';
    if (diff === 1) return '♯';
    if (diff === 2) return '𝄪';
    if (diff === -1) return '♭';
    if (diff === -2) return '𝄫';
    return diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff);
  }

  // nazwij klasę wysokości `pc` literą `letter` (speller enharmoniczny)
  function spellPc(pc, letter) {
    const diff = centerDiff(pc - NAT_PC[letter]);
    return letter + accString(diff);
  }

  // "F#", "Bb", "E" → { pc, letter }
  function parseNote(name) {
    // 𝄪/𝄫 — glify podwójnych alteracji ze spellPc muszą się parsować z powrotem
    // (roundtrip parseNote∘spellPc = id; bez tego np. bVI w D♭ = B𝄫 wywraca parser)
    const m = /^([A-Ga-g])((𝄪|[#♯]{1,2})|(𝄫|[b♭]{1,2}))?$/.exec(name.trim());
    if (!m) return null;
    const letter = m[1].toUpperCase();
    let alt = 0;
    if (m[3]) alt = m[3].length;
    if (m[4]) alt = -m[4].length;
    return { pc: mod12(NAT_PC[letter] + alt), letter, alt };
  }

  // litery + nazwy nut skali (kolejne litery od toniki, znak dobrany do pc)
  function spellScale(tonicName, scaleKey) {
    const t = parseNote(tonicName);
    const steps = SCALE_STEPS[scaleKey];
    if (!t || !steps) return null;
    const li = LETTERS.indexOf(t.letter);
    return steps.map((st, i) => {
      const letter = LETTERS[(li + i) % 7];
      const pc = mod12(t.pc + st);
      return { pc, letter, name: spellPc(pc, letter) };
    });
  }

  function qualityFrom(third, fifth) {
    if (third === 4 && fifth === 7) return 'maj';
    if (third === 3 && fifth === 7) return 'min';
    if (third === 3 && fifth === 6) return 'dim';
    if (third === 4 && fifth === 8) return 'aug';
    return null;
  }

  // akord z prymy (nazwa literowa) i jakości — z poprawnym spellingiem tercji/kwinty
  function buildChord(rootName, quality) {
    const r = parseNote(rootName);
    const iv = QUALITY_INTERVALS[quality];
    if (!r || !iv) return null;
    const li = LETTERS.indexOf(r.letter);
    const letters = [r.letter, LETTERS[(li + 2) % 7], LETTERS[(li + 4) % 7]];
    const pcs = iv.map((s) => mod12(r.pc + s));
    const names = pcs.map((pc, i) => spellPc(pc, letters[i]));
    return {
      rootPc: r.pc, rootName: names[0], quality,
      pcs, names, name: names[0] + QUALITY_SUFFIX[quality],
    };
  }

  /* — diatonika: triada na stopniu d = co druga nuta skali; jakość z realnych interwałów — */
  const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function diatonicTriads(tonicName, scaleKey) {
    const sc = spellScale(tonicName, scaleKey);
    if (!sc) return null;
    const t = parseNote(tonicName);
    return sc.map((_, d) => {
      const tones = [sc[d], sc[(d + 2) % 7], sc[(d + 4) % 7]];
      const third = mod12(tones[1].pc - tones[0].pc);
      const fifth = mod12(tones[2].pc - tones[0].pc);
      const quality = qualityFrom(third, fifth);
      const pcs = tones.map((x) => x.pc);
      const names = tones.map((x) => x.name);
      const chord = {
        degree: d + 1, quality,
        rootPc: pcs[0], rootName: names[0],
        pcs, names, name: names[0] + QUALITY_SUFFIX[quality],
      };
      // zapis rzymski spójny z konwencją parsera (alteracja względem bazy durowej)
      chord.roman = canonicalRoman(chord, t.pc);
      return chord;
    });
  }

  /* — parser stopni (cyfry rzymskie), konwencja chromatyczna pop/rock:
       baza = skala DUROWA toniki; wielkość liter = jakość; °/+ = dim/aug;
       prefiks b/# = alteracja prymy (nie zmienia litery stopnia) — */
  const NUMERALS = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

  function parseDegree(token, tonicName) {
    const t = parseNote(tonicName);
    const m = /^([b♭]{1,2}|[#♯]{1,2})?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|o|dim|\+|aug)?$/.exec(token.trim());
    if (!m || !t) return null;
    const alt = m[1] ? (/[#♯]/.test(m[1]) ? m[1].length : -m[1].length) : 0;
    const numeral = m[2];
    const idx = NUMERALS[numeral.toLowerCase()];
    const isUpper = numeral === numeral.toUpperCase();
    let quality = isUpper ? 'maj' : 'min';
    if (m[3] === '°' || m[3] === 'o' || m[3] === 'dim') quality = 'dim';
    if (m[3] === '+' || m[3] === 'aug') quality = 'aug';
    const pc = mod12(t.pc + MAJOR_STEPS[idx] + alt);
    const letter = LETTERS[(LETTERS.indexOf(t.letter) + idx) % 7];
    const chord = buildChord(spellPc(pc, letter), quality);
    if (!chord) return null;
    chord.roman = token.trim();
    chord.degree = idx + 1;
    return chord;
  }

  function parseProgression(text, tonicName) {
    const tokens = String(text).split(/[\s,|–—-]+/).filter(Boolean);
    if (!tokens.length) return { ok: false, error: 'Pusta progresja.' };
    const chords = [];
    for (const tok of tokens) {
      const ch = parseDegree(tok, tonicName);
      if (!ch) return { ok: false, error: `Nie rozumiem stopnia: „${tok}”.` };
      chords.push(ch);
    }
    return { ok: true, chords };
  }

  /* === suggestion-engine.js — propozycje kolejnych akordów (czysta heurystyka) === */
  // kanoniczny zapis rzymski akordu względem toniki (ta sama konwencja co parser/diatonika)
  function canonicalRoman(chord, tonicPc) {
    const d = chord.degree - 1;
    const alt = centerDiff(chord.rootPc - mod12(tonicPc + MAJOR_STEPS[d]));
    const altStr = alt > 0 ? '#'.repeat(alt) : 'b'.repeat(-alt);
    let core = ROMAN_BASE[d];
    if (chord.quality === 'min' || chord.quality === 'dim') core = core.toLowerCase();
    return altStr + core + (chord.quality === 'dim' ? '°' : chord.quality === 'aug' ? '+' : '');
  }

  // tabele przejść funkcyjnych (wagi ręcznie skalibrowane, konwencja pop/rock)
  const NEXT_WEIGHTS = {
    major: {
      'I':    { 'IV': 5, 'V': 5, 'vi': 4, 'ii': 3, 'iii': 2, 'bVII': 2, 'vii°': 1 },
      'ii':   { 'V': 6, 'IV': 2, 'vii°': 2, 'iii': 1, 'I': 1 },
      'iii':  { 'vi': 4, 'IV': 4, 'ii': 2, 'I': 1 },
      'IV':   { 'V': 5, 'I': 4, 'ii': 2, 'vi': 2, 'iv': 1, 'bVII': 1 },
      'V':    { 'I': 6, 'vi': 4, 'IV': 2, 'ii': 1 },
      'vi':   { 'IV': 5, 'ii': 4, 'V': 3, 'iii': 2, 'I': 2 },
      'vii°': { 'I': 6, 'iii': 2 },
      'bVII': { 'I': 4, 'IV': 3, 'bVI': 2, 'V': 2 },
      'bVI':  { 'bVII': 4, 'V': 3, 'I': 2 },
      'bIII': { 'bVII': 3, 'bVI': 3, 'IV': 2 },
      'iv':   { 'I': 4, 'V': 2, 'bVII': 1 },
    },
    minor: {
      'i':    { 'iv': 5, 'bVII': 4, 'bVI': 4, 'V': 4, 'v': 3, 'bIII': 3, 'ii°': 2, 'bII': 2, 'vii°': 1 },
      'ii°':  { 'V': 6, 'i': 2 },
      'bII':  { 'i': 5, 'V': 3, 'bIII': 2 },
      'bIII': { 'bVII': 4, 'bVI': 3, 'iv': 2, 'i': 1 },
      'iv':   { 'V': 5, 'i': 4, 'bVII': 3, 'bVI': 2 },
      'v':    { 'i': 4, 'bVI': 3, 'iv': 2 },
      'V':    { 'i': 6, 'bVI': 3, 'iv': 1 },
      'bVI':  { 'V': 6, 'bVII': 4, 'iv': 2, 'i': 2 },
      'bVII': { 'i': 4, 'bVI': 3, 'bIII': 2, 'iv': 2 },
      'vii°': { 'i': 6, 'V': 2 },
    },
  };
  const SUGGEST_CANDIDATES = {
    major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'bVII', 'bVI', 'bIII', 'iv'],
    minor: ['i', 'ii°', 'bIII', 'iv', 'v', 'V', 'bVI', 'bVII', 'bII'],
  };
  const START_WEIGHTS = {
    major: { 'I': 6, 'vi': 3, 'IV': 2, 'ii': 2 },
    minor: { 'i': 6, 'iv': 2, 'bVI': 2 },
  };
  // korpus popularnych progresji (cykliczne n-gramy, zapis kanoniczny)
  const PROGRESSION_CORPUS = [
    'I-V-vi-IV', 'I-vi-IV-V', 'vi-IV-I-V', 'I-IV-V-I', 'ii-V-I',
    'I-vi-ii-V', 'I-bVII-IV-I', 'I-IV-vi-V', 'I-iii-IV-V', 'IV-V-iii-vi',
    'i-bVII-bVI-V', 'i-bVI-bIII-bVII', 'i-iv-v-i', 'i-iv-V-i', 'i-bVI-bVII-i',
    // mroczne / metalowe: wspinaczka bVI→bVII, oscylacja andaluzyjska, frygijskie bII
    'i-bVI-bVII-V', 'i-bVII-bVI-bVII', 'i-bII', 'i-bvii-bVI-bII',
  ];

  // tryb dur/moll wnioskowany z pierwszego akordu progresji (i → moll)
  function inferMode(chords) {
    if (chords.length && chords[0].degree === 1) {
      return chords[0].quality === 'min' ? 'minor' : 'major';
    }
    return 'major';
  }
  const scaleMode = (sc) => (sc === 'major' ? 'major' : 'minor');

  // bonus za kontynuację znanego wzorca: sufiks progresji (do 3 akordów)
  // dopasowany cyklicznie do korpusu; dłuższy kontekst → większy bonus
  function corpusBonus(romans, candidate) {
    let bonus = 0; const hits = [];
    const maxL = Math.min(3, romans.length);
    for (const pat of PROGRESSION_CORPUS) {
      const seq = pat.split('-');
      let best = 0;
      for (let L = maxL; L >= 1 && !best; L--) {
        const suf = romans.slice(-L);
        for (let p = 0; p < seq.length; p++) {
          let ok = true;
          for (let k = 0; k < L; k++) if (seq[(p + k) % seq.length] !== suf[k]) { ok = false; break; }
          if (ok && seq[(p + L) % seq.length] === candidate) { best = L; break; }
        }
      }
      if (best) { bonus += 1.2 * best; hits.push({ pattern: pat, len: best }); }
    }
    return { bonus, hits };
  }

  // propozycje kolejnego akordu: posortowana lista { roman, chord, score, reasons }
  // czysta i deterministyczna: te same wejścia → ta sama lista.
  // opts.scale (klucz SCALE_STEPS): ranking faworyzuje stopnie diatoniczne tej skali
  // (kandydaci rozszerzani o jej diatonikę); gdy skala kłóci się z trybem progresji
  // (np. skala durowa, a progresja od i), świadomość skali jest wyłączana zamiast
  // karać na ślepo — wtedy działa czysta heurystyka pop/rock.
  function suggestNext(chords, tonicName, opts = {}) {
    const { limit = 3, mode = 'auto', scale = null } = opts;
    const DIA_BONUS = 2, BORROW_PENALTY = 1;
    const t = parseNote(tonicName);
    if (!t || !Array.isArray(chords)) return [];
    let m;
    if (mode === 'minor' || mode === 'major') m = mode;
    else if (chords.length) m = inferMode(chords);
    else m = scale && SCALE_STEPS[scale] ? scaleMode(scale) : 'major';
    const sc = scale && SCALE_STEPS[scale] && scaleMode(scale) === m ? scale : null;
    const dia = sc ? new Set(diatonicTriads(tonicName, sc).map((c) => c.roman)) : null;
    const table = NEXT_WEIGHTS[m];
    const candidates = dia
      ? [...new Set([...SUGGEST_CANDIDATES[m], ...dia])]
      : SUGGEST_CANDIDATES[m];
    const romans = chords.map((c) => canonicalRoman(c, t.pc));
    const last = romans.length ? romans[romans.length - 1] : null;
    const prev2 = romans.length > 1 ? romans[romans.length - 2] : null;

    const scored = [];
    for (const tok of candidates) {
      if (tok === last) continue;                      // bez natychmiastowej repetycji
      let score = 0; const reasons = [];
      if (!last) {
        score = START_WEIGHTS[m][tok] || 0;
        if (score) reasons.push('typowy akord otwierający');
      } else {
        const w = (table[last] || {})[tok] || 0;
        score += w;
        if (w >= 5) reasons.push(`mocne przejście ${last}→${tok}`);
        else if (w >= 3) reasons.push(`częste przejście ${last}→${tok}`);
        const cb = corpusBonus(romans, tok);
        score += cb.bonus;
        if (cb.hits.length) {
          const top = cb.hits.reduce((a, h) => (h.len > a.len ? h : a), cb.hits[0]);
          reasons.push(`kontynuacja wzorca ${top.pattern}`);
        }
        if (prev2 && tok === prev2) score -= 1;        // lekka kara za ping-pong A–B–A
      }
      if (dia) {
        if (dia.has(tok)) { score += DIA_BONUS; reasons.push(`diatoniczny (skala ${SCALE_LABEL[sc]})`); }
        else { score -= BORROW_PENALTY; reasons.push('zapożyczenie spoza skali'); }
      }
      if (score <= 0) continue;
      const chord = parseDegree(tok, tonicName);
      if (!chord) continue;
      scored.push({ roman: tok, chord, score: Math.round(score * 100) / 100, reasons });
    }
    scored.sort((a, b) => b.score - a.score
      || candidates.indexOf(a.roman) - candidates.indexOf(b.roman));
    return scored.slice(0, limit);
  }

  /* === fretboard.js === */
  const TUNINGS = {
    standard: {
      label: 'standardowe (E A D G B e)',
      open:  { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 },
      names: { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' },
    },
    dropC: {
      label: 'Drop C (C G C F A d)',
      open:  { 1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 36 },
      names: { 1: 'd', 2: 'A', 3: 'F', 4: 'C', 5: 'G', 6: 'C' },
    },
  };
  const OPEN_MIDI = TUNINGS.standard.open;          // domyślny strój (zgodność wstecz)
  const STRING_SETS = { '321': [3, 2, 1], '432': [4, 3, 2], '543': [5, 4, 3], '654': [6, 5, 4] };
  const STRING_NAMES = TUNINGS.standard.names;

  function fretsForPc(stringNum, pc, minFret, maxFret, openMidi = OPEN_MIDI) {
    const open = openMidi[stringNum];
    const out = [];
    for (let f = Math.max(0, minFret); f <= maxFret; f++) {
      if (mod12(open + f) === pc) out.push(f);
    }
    return out;
  }

  /* === triad-generator.js === */
  const INVERSIONS = { root: [0, 1, 2], inv1: [1, 2, 0], inv2: [2, 0, 1] };
  const INVERSION_NAME = { root: 'pozycja zasadnicza', inv1: 'I przewrót', inv2: 'II przewrót' };

  function voicingsForChord(chord, setKey, opts = {}) {
    const { minFret = 0, maxFret = 15, inversionFilter = 'all', tuning = 'standard' } = opts;
    const set = STRING_SETS[setKey];
    const tun = TUNINGS[tuning];
    if (!set || !chord || !tun) return [];
    const open = tun.open;
    const invs = inversionFilter === 'all' ? Object.keys(INVERSIONS) : [inversionFilter];
    const out = [];
    for (const inv of invs) {
      const order = INVERSIONS[inv];
      const pcsOrd = order.map((i) => chord.pcs[i]);
      const namesOrd = order.map((i) => chord.names[i]);
      const perString = set.map((s, i) => fretsForPc(s, pcsOrd[i], minFret, maxFret, open));
      for (const f0 of perString[0]) for (const f1 of perString[1]) for (const f2 of perString[2]) {
        const midis = [open[set[0]] + f0, open[set[1]] + f1, open[set[2]] + f2];
        if (!(midis[0] < midis[1] && midis[1] < midis[2])) continue;       // głosy rosnące
        if (midis[2] - midis[0] >= 12) continue;                            // pozycja zamknięta
        const frets = [f0, f1, f2];
        out.push({
          inversion: inv, inversionName: INVERSION_NAME[inv],
          stringSet: setKey, strings: set.slice(), tuning,
          frets, midis, noteNames: namesOrd.slice(),
          position: (f0 + f1 + f2) / 3, minFret: Math.min(f0, f1, f2),
        });
      }
    }
    out.sort((a, b) => a.minFret - b.minFret || a.position - b.position);
    return out;
  }

  /* === progression-engine.js — minimal voice leading (DP/Viterbi) === */
  function transitionCost(a, b) {
    let c = 0;
    for (let i = 0; i < 3; i++) c += Math.abs(a.frets[i] - b.frets[i]);
    c += 0.5 * Math.max(0, Math.abs(a.position - b.position) - 3);
    return c;
  }

  function planProgression(chords, setKey, opts = {}) {
    const EPS = 1e-4;
    const layers = chords.map((ch) => voicingsForChord(ch, setKey, opts));
    for (let i = 0; i < layers.length; i++) {
      if (!layers[i].length) return { ok: false, failedIndex: i, chord: chords[i] };
    }
    let cost = layers[0].map((v) => EPS * v.position);
    let back = [layers[0].map(() => -1)];
    for (let i = 1; i < layers.length; i++) {
      const next = []; const bk = [];
      for (let j = 0; j < layers[i].length; j++) {
        let best = Infinity, arg = -1;
        for (let k = 0; k < layers[i - 1].length; k++) {
          const c = cost[k] + transitionCost(layers[i - 1][k], layers[i][j]);
          if (c < best) { best = c; arg = k; }
        }
        next.push(best + EPS * layers[i][j].position);
        bk.push(arg);
      }
      cost = next; back.push(bk);
    }
    let j = 0;
    for (let k = 1; k < cost.length; k++) if (cost[k] < cost[j]) j = k;
    const pick = [];
    for (let i = layers.length - 1; i >= 0; i--) { pick.unshift(layers[i][j]); j = back[i][j]; }
    let total = 0;
    for (let i = 1; i < pick.length; i++) total += transitionCost(pick[i - 1], pick[i]);
    return { ok: true, voicings: pick, totalCost: total };
  }

  /* === audio-schedule.js — czyste funkcje harmonogramu (testowalne bez AudioContext) === */
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // strum: głosy bas→sopran z małym opóźnieniem
  function strumEvents(voicing, opts = {}) {
    const { at = 0, strumGap = 0.04, duration = 1.6 } = opts;
    return voicing.midis.map((m, i) => ({
      time: at + i * strumGap, midi: m, freq: midiToFreq(m), dur: duration, voice: i,
    }));
  }

  // cała progresja: akord co `beatsPerChord` ćwierćnut przy danym BPM;
  // `pattern` wybiera wzorzec rytmiczny (rhythm-patterns.js, domyślnie 'whole'
  // = dawne zachowanie co do sekundy), `humanize` nakłada deterministyczny jitter
  function progressionSchedule(voicings, opts = {}) {
    const { bpm = 80, beatsPerChord = 4, strumGap = 0.04,
            pattern = 'whole', humanize = null } = opts;
    const beat = 60 / bpm;
    const chordDur = beatsPerChord * beat;
    let events = [];
    const chordTimes = [];
    voicings.forEach((v, i) => {
      const at = i * chordDur;
      chordTimes.push(at);
      events.push(...patternEvents(v, { at, bpm, beatsPerChord, strumGap, pattern, chord: i }));
    });
    if (humanize) events = humanizeEvents(events, humanize);
    return { events, chordTimes, beat, chordDur, totalDuration: voicings.length * chordDur };
  }

  // metronom: kliki ćwierćnutowe; akcent na „raz”
  function metronomeEvents(totalBeats, opts = {}) {
    const { bpm = 80, beatsPerBar = 4, at = 0 } = opts;
    const beat = 60 / bpm;
    const out = [];
    for (let i = 0; i < totalBeats; i++) {
      out.push({ time: at + i * beat, accent: i % beatsPerBar === 0 });
    }
    return out;
  }

  /* === rhythm-patterns.js — wzorce rytmiczne i humanizacja (czyste, testowalne) === */
  // Krok wzorca: { beat (ćwierćnuty od startu akordu), type: 'down'|'up'|'voice',
  //               len (długość w ćwierćnutach), vel (0..1), voice? (dla 'voice') }.
  // down = strum bas→sopran, up = sopran→bas (kostka w górę gra ciszej),
  // voice = pojedynczy głos (arpeggio). Wzorzec opisuje JEDEN akord (takt 4/4).
  const PATTERNS = {
    whole:  { label: 'Całe nuty', steps: [{ beat: 0, type: 'down', len: 4, vel: 1 }] },
    rock:   { label: 'Rock (D·DU·UDU)', steps: [
      { beat: 0,   type: 'down', len: 1,   vel: 1 },
      { beat: 1,   type: 'down', len: 0.5, vel: 0.9 },
      { beat: 1.5, type: 'up',   len: 1,   vel: 0.7 },
      { beat: 2.5, type: 'up',   len: 0.5, vel: 0.7 },
      { beat: 3,   type: 'down', len: 0.5, vel: 0.95 },
      { beat: 3.5, type: 'up',   len: 0.5, vel: 0.75 },
    ] },
    ballad: { label: 'Ballada (arpeggio)', steps: [0, 1, 2, 1, 0, 1, 2, 1].map((v, i) => ({
      beat: i * 0.5, type: 'voice', voice: v, len: v === 0 ? 2 : 1.5,
      vel: v === 0 ? 0.95 : (v === 2 ? 0.8 : 0.68),
    })) },
  };

  // Zdarzenia jednego akordu wg wzorca. Każde zdarzenie niesie `voice` (0..2)
  // i `chord` (indeks akordu) — gryf-scena mapuje z nich strunę do poświaty,
  // zamiast zakładać sztywne „3 zdarzenia na akord" (k % 3).
  function patternEvents(voicing, opts = {}) {
    const { at = 0, bpm = 80, beatsPerChord = 4, strumGap = 0.04,
            pattern = 'whole', chord = 0 } = opts;
    const beat = 60 / bpm;
    const chordDur = beatsPerChord * beat;
    const def = PATTERNS[pattern] || PATTERNS.whole;   // nieznany wzorzec → whole
    const ev = [];
    // klamra długości: nuta nie dłuższa niż takt (zgodność wstecz z whole) ani 2.2 s
    const noteDur = (len) => Math.min(len * beat * 0.95, chordDur * 0.95, 2.2);
    const push = (v, t, len, vel) => ev.push({
      time: t, midi: voicing.midis[v], freq: midiToFreq(voicing.midis[v]),
      dur: noteDur(len), vel, voice: v, chord,
    });
    for (const stp of def.steps) {
      if (stp.beat >= beatsPerChord) continue;         // wzorzec nie wystaje poza akord
      const t0 = at + stp.beat * beat;
      if (stp.type === 'voice') push(stp.voice, t0, stp.len, stp.vel);
      else {
        const order = stp.type === 'up' ? [2, 1, 0] : [0, 1, 2];
        order.forEach((v, i) => push(v, t0 + i * strumGap, stp.len, stp.vel));
      }
    }
    return ev;
  }

  // mulberry32 — mały seedowany PRNG: humanizacja jest deterministyczna
  // (ten sam seed → identyczny wynik), więc testowalna co do bajta.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Humanizacja: drobny jitter czasu (±timeJitter s) i głośności (±velJitter).
  // Rusza WYŁĄCZNIE zdarzenia nut — siatka akordów (chordTimes) zostaje nietknięta.
  function humanizeEvents(events, opts = {}) {
    const { seed = 1, timeJitter = 0.008, velJitter = 0.12 } = opts;
    const rnd = mulberry32(seed);
    return events.map((e) => {
      const dt = (rnd() * 2 - 1) * timeJitter;
      const dv = 1 + (rnd() * 2 - 1) * velJitter;
      return Object.assign({}, e, {
        time: Math.max(0, e.time + dt),
        vel: Math.max(0.2, Math.min(1.25, (e.vel === undefined ? 1 : e.vel) * dv)),
      });
    });
  }

  /* === fretboard-geometry.js — geometria gryfu (czysta, testowalna bez DOM) === */
  // pozycja drutu progowego f przy menzurze L (równomierna temperacja)
  function wireX(f, L = 1) { return L * (1 - Math.pow(2, -f / 12)); }

  // geometria okna progów [lo..hi] zmapowana na szerokość viewBoxa;
  // dotX przyjmuje też progi ułamkowe (pozycje kropek w trakcie animacji)
  function fretboardGeometry(opts = {}) {
    const {
      lo = 0, hi = 12, width = 1000, height = 236,
      padLeft = 56, padRight = 16, padTop = 30, padBottom = 36,
    } = opts;
    const leftWire = lo <= 1 ? 0 : lo - 1;            // pole progu lo musi być widoczne
    const rightWire = Math.max(hi + 1, leftWire + 5); // margines + minimalna liczba pól
    const x0 = padLeft, x1 = width - padRight;
    const w0 = wireX(leftWire), w1 = wireX(rightWire);
    const wireXpx = (f) => x0 + ((wireX(f) - w0) / (w1 - w0)) * (x1 - x0);
    const stringY = (s) => padTop + ((s - 1) * (height - padTop - padBottom)) / 5;
    const openX = x0 - 16;                            // marker struny pustej przed siodełkiem
    const dotX = (f) => {
      if (f <= 0) return openX;
      if (f < 1) return openX + ((wireXpx(0) + wireXpx(1)) / 2 - openX) * f;
      return (wireXpx(f - 1) + wireXpx(f)) / 2;       // środek pola, spójnie z kartami
    };
    const inlays = [];
    for (let f = Math.max(1, leftWire + 1); f <= rightWire; f++) {
      if (f === 12 || f === 24) inlays.push({ f, x: dotX(f), double: true });
      else if ([3, 5, 7, 9, 15, 17, 19, 21].includes(f)) inlays.push({ f, x: dotX(f), double: false });
    }
    // hitTest — odwrotność dotX/stringY: punkt viewBoxa → (struna, próg) lub null.
    // Czysta funkcja w czystym module: klikalny gryf testuje się bez DOM.
    const hasNut = leftWire === 0;
    const gap = (height - padTop - padBottom) / 5;
    const hitTest = (x, y) => {
      const s = Math.round((y - padTop) / gap) + 1;
      if (s < 1 || s > 6 || Math.abs(y - stringY(s)) > gap * 0.45) return null;
      if (x > x1 + 2) return null;
      if (hasNut && x < wireXpx(0)) {                  // strefa przed siodełkiem = struna pusta
        return x >= openX - 12 ? { string: s, fret: 0 } : null;
      }
      if (x < wireXpx(leftWire)) return null;
      for (let f = leftWire + 1; f <= rightWire; f++) {
        if (x <= wireXpx(f)) return { string: s, fret: f };
      }
      return null;
    };
    return { lo, hi, leftWire, rightWire, width, height, x0, x1, openX,
             hasNut, wireXpx, dotX, stringY, inlays, hitTest };
  }

  /* === anim-timeline.js — czysta oś czasu animacji prowadzenia głosów === */
  // lista ruchów per głos między sąsiednimi akordami planu
  function voiceMoves(voicings) {
    const out = [];
    for (let i = 1; i < voicings.length; i++) {
      for (let v = 0; v < 3; v++) {
        out.push({
          fromChord: i - 1, toChord: i, voice: v, string: voicings[i].strings[v],
          fromFret: voicings[i - 1].frets[v], toFret: voicings[i].frets[v],
          dist: Math.abs(voicings[i].frets[v] - voicings[i - 1].frets[v]),
        });
      }
    }
    return out;
  }

  function easeInOutCubic(u) {
    u = Math.min(1, Math.max(0, u));
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }

  // czas dojazdu kropek: skaluje się z BPM, z podłogą i sufitem czytelności
  function transitionTime(chordDur, opts = {}) {
    const { transFrac = 0.25, transMin = 0.08, transMax = 0.35 } = opts;
    return Math.min(Math.max(transFrac * chordDur, transMin), transMax, chordDur);
  }

  // stan animacji w chwili t (sekundy od startu przebiegu):
  // okno przejścia KOŃCZY się na starcie akordu (kropki dojeżdżają na uderzenie)
  function animState(t, voicings, sched, opts = {}) {
    const { loop = false, instant = false } = opts;
    const n = voicings.length;
    const { chordDur, totalDuration, chordTimes } = sched;
    const T = transitionTime(chordDur, opts);

    let tt = t;
    if (loop) tt = ((t % totalDuration) + totalDuration) % totalDuration;

    const mk = (a, b, inTrans, u) => ({
      chordIndex: a, nextIndex: b, inTransition: inTrans, u,
      dots: [0, 1, 2].map((v) => {
        const fa = voicings[a].frets[v], fb = voicings[b].frets[v];
        const f = inTrans ? fa + (fb - fa) * u : fa;
        return { voice: v, string: voicings[a].strings[v],
                 fromFret: fa, toFret: fb, fret: f, open: !inTrans && fa === 0 };
      }),
    });

    if (tt < 0) return mk(0, 0, false, 0);             // count-in: czekamy na akordzie 0
    const i = Math.min(n - 1, Math.floor(tt / chordDur + 1e-9));
    const hasNext = i + 1 < n || loop;
    const next = i + 1 < n ? i + 1 : 0;
    const nextStart = i + 1 < n ? chordTimes[i + 1] : totalDuration;
    if (hasNext && !instant && tt > nextStart - T && tt < nextStart) {
      return mk(i, next, true, easeInOutCubic((tt - (nextStart - T)) / T));
    }
    return mk(i, i, false, 0);
  }

  /* === triad-recognition.js — rozpoznawanie triad (czyste, testowalne) === */
  // Wejście: MIDI zaznaczonych dźwięków (dowolna oktawa i kolejność).
  // Wyjście: jakość, pryma, przewrót (z basu = najniższego dźwięku), zapis
  // rzymski w tonacji (konwencja parsera: baza durowa + alteracje) i flaga,
  // czy akord jest diatoniczny dla wybranego wariantu skali.
  // Konwencje: (1) triada zwiększona jest symetryczna — za prymę przyjmujemy
  // bas (przewrót zawsze „pozycja zasadnicza"); (2) wybór stopnia:
  // czysty > bemol > krzyżyk (interwał 6 półtonów → bV, spójnie z bemolową
  // konwencją korpusu); (3) litera nuty wynika ze stopnia (alteracja nie
  // zmienia litery) — stąd np. w C-dur zaznaczone A♭/G♯ pisze się A♭ (bVI).
  function recognizeTriad(midis, opts = {}) {
    const { key = 'C', scale = 'major' } = opts;
    if (!Array.isArray(midis) || midis.length !== 3) {
      return { ok: false, reason: 'Potrzebuję dokładnie trzech dźwięków.' };
    }
    const sorted = midis.slice().sort((a, b) => a - b);  // bas → sopran wg wysokości
    const pcs = sorted.map(mod12);
    const set = [...new Set(pcs)];
    if (set.length < 3) {
      return { ok: false, reason: 'Dźwięki się dublują — triada potrzebuje trzech różnych klas wysokości.' };
    }
    // pryma i jakość: dur/moll/dim mają jednoznaczną prymę, aug jest symetryczny
    const matches = [];
    for (const root of set) {
      for (const q of ['maj', 'min', 'dim', 'aug']) {
        const want = QUALITY_INTERVALS[q].map((i) => mod12(root + i));
        if (want.every((pc) => set.includes(pc))) matches.push({ root, q });
      }
    }
    if (!matches.length) {
      return { ok: false, reason: 'To nie jest triada dur / moll / zmniejszona / zwiększona.' };
    }
    const bassPc = pcs[0];
    const m = matches.length === 1 ? matches[0]
      : matches.find((x) => x.root === bassPc) || matches[0];   // aug: pryma = bas
    const t = parseNote(key);
    if (!t) return { ok: false, reason: 'Nieznana tonacja.' };
    // stopień względem toniki: minimalna alteracja, przy remisie bemol
    const ctr = (x) => { const r = mod12(x); return r > 6 ? r - 12 : r; };
    let best = null;
    for (let d = 0; d < 7; d++) {
      const alt = ctr(m.root - t.pc - MAJOR_STEPS[d]);
      const rank = Math.abs(alt) * 2 + (alt > 0 ? 1 : 0);
      if (!best || rank < best.rank) best = { d, rank };
    }
    const letter = LETTERS[(LETTERS.indexOf(t.letter) + best.d) % 7];
    const chord = buildChord(spellPc(m.root, letter), m.q);
    chord.degree = best.d + 1;
    chord.roman = canonicalRoman(chord, t.pc);
    // diatonika wybranego wariantu skali; jej zapis rzymski jest autorytatywny
    const dia = diatonicTriads(key, scale)
      .find((c) => c.rootPc === chord.rootPc && c.quality === chord.quality);
    if (dia) chord.roman = dia.roman;
    // przewrót z basu + pisownia dźwięków bas→sopran zgodna z akordem
    const memberIdx = chord.pcs.indexOf(bassPc);
    const inversion = memberIdx === 0 ? 'root' : memberIdx === 1 ? 'inv1' : 'inv2';
    const noteNames = pcs.map((pc) => chord.names[chord.pcs.indexOf(pc)]);
    return {
      ok: true, chord, quality: m.q, rootPc: chord.rootPc,
      bassPc, inversion, inversionName: INVERSION_NAME[inversion],
      slashName: inversion === 'root' ? chord.name : chord.name + '/' + noteNames[0],
      noteNames, roman: chord.roman, diatonic: !!dia, midis: sorted,
    };
  }

  /* === share-state.js — stan aplikacji ⇄ fragment URL (czyste funkcje) === */
  // Format jak query string, ale we fragmencie: `#k=C&s=major&p=I-V-vi-IV…`.
  // Wartości są percent-encodowane — alterowane stopnie z `#` (np. `#iv°`)
  // nie ucinają fragmentu (RFC 3986: `#` nie może wystąpić wewnątrz fragmentu).
  // Klucze: t strój · k tonacja · s skala · ss zestaw strun · inv przewroty ·
  // f zakres progów "min-max" · p progresja · bpm · st tryb sceny.
  // decode jest pobłażliwy: nieznane/zepsute pary pomija, liczby klamruje,
  // odwrócony zakres progów naprawia — śmieciowy hash nigdy nie wywraca UI.
  const SHARE_INV = ['all', 'root', 'inv1', 'inv2'];
  const clampInt = (x, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(x))));

  function encodeShareState(st = {}) {
    const kv = [];
    const put = (k, v) => {
      if (v === undefined || v === null || v === '') return;
      kv.push(k + '=' + encodeURIComponent(String(v)));
    };
    put('t', st.tuning); put('k', st.key); put('s', st.scale);
    put('ss', st.set); put('inv', st.inv);
    if (st.fmin !== undefined || st.fmax !== undefined) {
      const a = clampInt(st.fmin !== undefined ? st.fmin : 0, 0, 22);
      const b = clampInt(st.fmax !== undefined ? st.fmax : 12, 0, 22);
      put('f', Math.min(a, b) + '-' + Math.max(a, b));
    }
    put('p', st.prog);
    if (st.bpm !== undefined) put('bpm', clampInt(st.bpm, 40, 180));
    if (st.pattern !== undefined && PATTERNS[st.pattern]) put('pt', st.pattern);
    if (st.stage) put('st', 1);
    return kv.join('&');                               // stała kolejność = determinizm
  }

  function decodeShareState(str) {
    const out = {};
    if (typeof str !== 'string') return { ok: true, state: out };
    let s = str.trim();
    if (s.charAt(0) === '#') s = s.slice(1);
    if (!s) return { ok: true, state: out };
    for (const part of s.split('&')) {
      const eq = part.indexOf('=');
      if (eq <= 0 || eq === part.length - 1) continue;
      const k = part.slice(0, eq);
      let v;
      try { v = decodeURIComponent(part.slice(eq + 1)); } catch (e) { continue; }
      if (k === 't') { if (TUNINGS[v]) out.tuning = v; }
      else if (k === 'k') { if (parseNote(v)) out.key = v; }
      else if (k === 's') { if (SCALE_STEPS[v]) out.scale = v; }
      else if (k === 'ss') { if (STRING_SETS[v]) out.set = v; }
      else if (k === 'inv') { if (SHARE_INV.indexOf(v) >= 0) out.inv = v; }
      else if (k === 'f') {
        const m = /^(\d{1,2})-(\d{1,2})$/.exec(v);
        if (m) {
          const a = clampInt(m[1], 0, 22), b = clampInt(m[2], 0, 22);
          out.fmin = Math.min(a, b); out.fmax = Math.max(a, b);
        }
      }
      else if (k === 'p') { const t = v.trim().slice(0, 160); if (t) out.prog = t; }
      else if (k === 'bpm') { const n = Number(v); if (Number.isFinite(n)) out.bpm = clampInt(n, 40, 180); }
      else if (k === 'pt') { if (PATTERNS[v]) out.pattern = v; }
      else if (k === 'st') { out.stage = v === '1' || v === 'true'; }
    }
    return { ok: true, state: out };
  }

  /* === presety === */
  const PRESETS = [
    { name: 'Pop',           text: 'I-V-vi-IV' },
    { name: 'Andaluzyjska',  text: 'i-bVII-bVI-V' },
    { name: 'Jazz ii-V-I',   text: 'ii-V-I' },
    { name: 'Lata 50.',      text: 'I-vi-IV-V' },
    { name: 'Rock',          text: 'I-bVII-IV-I' },
    { name: 'Metal',         text: 'i-bVI-bVII' },
    { name: 'Frygijska',     text: 'i-bvii-bVI-bII' },
  ];

  return {
    LETTERS, NAT_PC, SCALE_STEPS, SCALE_LABEL, scaleLabel,
    QUALITY_INTERVALS, QUALITY_SUFFIX, OPEN_MIDI, STRING_SETS, STRING_NAMES, TUNINGS,
    INVERSIONS, INVERSION_NAME, PRESETS,
    mod12, spellPc, parseNote, spellScale, qualityFrom, buildChord,
    diatonicTriads, parseDegree, parseProgression, canonicalRoman, suggestNext,
    fretsForPc, voicingsForChord, transitionCost, planProgression, recognizeTriad,
    midiToFreq, strumEvents, progressionSchedule, metronomeEvents,
    PATTERNS, patternEvents, humanizeEvents,
    wireX, fretboardGeometry, voiceMoves, easeInOutCubic, transitionTime, animState,
    encodeShareState, decodeShareState,
  };
});
