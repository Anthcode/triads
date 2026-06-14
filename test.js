/* === test.js — self-check silnika (node test.js) === */
const E = require('./engine.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✔ ' + msg); }
  else { fail++; console.log('  ✘ ' + msg); }
}
function section(t) { console.log('\n— ' + t); }

/* 1. Strój i offset struny B */
section('Strój standardowy');
assert(E.OPEN_MIDI[6] === 40 && E.OPEN_MIDI[1] === 64, 'MIDI strun otwartych E2..e4 = 40..64');
assert(E.OPEN_MIDI[2] - E.OPEN_MIDI[3] === 4, 'między G a B jest wielka tercja (4 półtony)');
assert(E.fretsForPc(2, 0, 0, 12).includes(1), 'C na strunie B = próg 1');

/* 2. Enharmonia */
section('Speller enharmoniczny');
assert(E.spellPc(6, 'F') === 'F♯' && E.spellPc(6, 'G') === 'G♭', 'pc 6 = F♯ albo G♭ zależnie od litery');
const eb = E.spellScale('Eb', 'major').map(n => n.name).join(' ');
assert(eb === 'E♭ F G A♭ B♭ C D', 'Eb-dur: E♭ F G A♭ B♭ C D (nie D♯/G♯/A♯), jest: ' + eb);
assert(E.parseNote('F#').pc === 6 && E.parseNote('Bb').pc === 10, 'parser nazw nut (F#, Bb)');

/* 3. C-dur root na 321 */
section('Triada C-dur, zestaw 3-2-1');
const C = E.buildChord('C', 'maj');
const v321 = E.voicingsForChord(C, '321', { minFret: 0, maxFret: 7, inversionFilter: 'root' });
assert(v321.length === 1, 'dokładnie jeden voicing root w progach 0–7');
assert(JSON.stringify(v321[0].frets) === '[5,5,3]', 'G:5 B:5 e:3, jest: ' + JSON.stringify(v321[0].frets));
assert(v321[0].noteNames.join(' ') === 'C E G', 'nuty bas→sopran: C E G');

/* 4. Przewroty — właściwa nuta w basie */
section('Przewroty');
for (const [inv, bass] of [['root', 'C'], ['inv1', 'E'], ['inv2', 'G']]) {
  const vs = E.voicingsForChord(C, '321', { maxFret: 15, inversionFilter: inv });
  assert(vs.length > 0 && vs.every(v => v.noteNames[0] === bass), `${inv}: w basie ${bass}`);
}

/* 5. Cztery zestawy strun, bas→sopran */
section('Zestawy strun');
for (const key of ['321', '432', '543', '654']) {
  const vs = E.voicingsForChord(C, key, { maxFret: 15 });
  assert(vs.length > 0, `zestaw ${key}: są voicingi (${vs.length})`);
  assert(vs.every(v => v.strings[0] > v.strings[2]), `zestaw ${key}: kolejność bas→sopran`);
}

/* 6–8. Diatonika */
section('Diatonika C-dur');
const dC = E.diatonicTriads('C', 'major');
assert(dC.map(c => c.quality).join(',') === 'maj,min,min,maj,maj,min,dim', 'jakości I..vii°');
assert(dC.map(c => c.roman).join(' ') === 'I ii iii IV V vi vii°', 'cyfry rzymskie');
assert(dC[6].name === 'B°', 'vii° w C-dur = B°');

section('Diatonika a-moll (naturalna)');
const dAm = E.diatonicTriads('A', 'minor');
assert(dAm.map(c => c.quality).join(',') === 'min,dim,maj,min,min,maj,maj', 'jakości i..bVII');
assert(dAm[0].name === 'Am' && dAm[4].name === 'Em', 'i = Am, v = Em (naturalna)');
assert(dAm[2].roman === 'bIII' && dAm[6].roman === 'bVII', 'alteracje względem bazy durowej (bIII, bVII)');

section('Diatonika Eb-dur (spelling)');
const dEb = E.diatonicTriads('Eb', 'major');
assert(dEb.map(c => c.rootName).join(' ') === 'E♭ F G A♭ B♭ C D', 'prymy bez fałszywych krzyżyków');
assert(dEb[1].names.join(' ') === 'F A♭ C', 'ii w Eb-dur = F A♭ C');

/* Warianty molowe (rozszerzenie) */
section('Molowa harmoniczna (A)');
const dAh = E.diatonicTriads('A', 'harmonic');
assert(dAh[4].quality === 'maj' && dAh[4].name === 'E', 'V = E-dur (dominanta)');
assert(dAh[2].quality === 'aug' && dAh[2].roman === 'bIII+', 'III zwiększony (bIII+)');
assert(dAh[6].quality === 'dim' && dAh[6].rootName === 'G♯', 'vii° na G♯ (poprawny spelling)');
assert(E.spellScale('A', 'harmonic').map(n => n.name).join(' ') === 'A B C D E F G♯', 'skala: A B C D E F G♯');

section('Molowa melodyczna wznosząca (A)');
const dAme = E.diatonicTriads('A', 'melodic');
assert(E.spellScale('A', 'melodic').map(n => n.name).join(' ') === 'A B C D E F♯ G♯', 'skala: A B C D E F♯ G♯');
assert(dAme[3].quality === 'maj' && dAme[4].quality === 'maj', 'IV i V durowe');
assert(dAme[5].quality === 'dim' && dAme[6].quality === 'dim', 'vi° i vii° zmniejszone');
assert(E.scaleLabel('harmonic') === 'molowa harmoniczna', 'scaleLabel() działa');

/* 9–10. Parser progresji */
section('Parser stopni (konwencja pop/rock)');
const and = E.parseProgression('i-bVII-bVI-V', 'A');
assert(and.ok && and.chords.map(c => c.name).join(' ') === 'Am G F E', 'kadencja andaluzyjska w a-moll → Am G F E');
const p2 = E.parseProgression('I V vi IV', 'C');
assert(p2.ok && p2.chords.map(c => c.name).join(' ') === 'C G Am F', 'I-V-vi-IV w C → C G Am F');
const p3 = E.parseProgression('ii° , III+ | #iv°', 'C');
assert(p3.ok && p3.chords.map(c => c.quality).join(',') === 'dim,aug,dim', 'sufiksy °/+ i separatory');
assert(p3.chords[2].rootName === 'F♯', '#iv° w C: pryma F♯ (alteracja nie zmienia litery)');
assert(!E.parseProgression('I-XL-V', 'C').ok, 'nieznany stopień → czytelny błąd');

section('Presety');
assert(E.PRESETS.length >= 5, 'jest ≥ 5 presetów');
assert(E.PRESETS.every(p => E.parseProgression(p.text, 'C').ok), 'każdy preset się parsuje');

/* NOWE — propozycje kolejnych akordów (suggestion engine) */
section('Propozycje: dur');
const sV = E.suggestNext(E.parseProgression('I-V', 'C').chords, 'C');
assert(sV.length === 3, 'limit domyślny = 3 propozycje');
const sVr = sV.map(s => s.roman);
assert(sVr.includes('vi') && sVr.includes('I'), 'po I-V w top3: vi oraz I (jest: ' + sVr.join(' ') + ')');
assert(!sVr.includes('V'), 'brak natychmiastowej repetycji ostatniego akordu');
const sII = E.suggestNext(E.parseProgression('ii', 'C').chords, 'C');
assert(sII[0].roman === 'V' && sII[0].chord.name === 'G', 'po ii najmocniejsza propozycja: V (G)');
const sCad = E.suggestNext(E.parseProgression('I-IV-V', 'C').chords, 'C');
assert(sCad[0].roman === 'I', 'po I-IV-V na szczycie: I (rozwiązanie kadencji)');

section('Propozycje: moll i wnioskowanie trybu');
const sAnd = E.suggestNext(E.parseProgression('i-bVII-bVI', 'A').chords, 'A');
assert(sAnd[0].roman === 'V' && sAnd[0].chord.name === 'E', 'i-bVII-bVI → V (E): kontynuacja andaluzyjskiej');
assert(sAnd[0].reasons.some(r => r.includes('i-bVII-bVI-V')), 'uzasadnienie wskazuje wzorzec z korpusu');
const sMin = E.suggestNext(E.parseProgression('i', 'A').chords, 'A');
assert(sMin.every(s => ['iv', 'bVII', 'bVI', 'V', 'v', 'bIII', 'ii°'].includes(s.roman)), 'po i tylko kandydaci molowi');
const sMaj = E.suggestNext(E.parseProgression('vi-ii', 'C').chords, 'C');
assert(sMaj.every(s => s.roman !== 'i') && sMaj[0].roman === 'V', 'progresja od vi: tryb durowy, po ii → V');

section('Propozycje: start, determinizm, integralność');
const sStart = E.suggestNext([], 'C');
assert(sStart[0].roman === 'I' && sStart[0].chord.name === 'C', 'pusta progresja → I na szczycie');
const sStartM = E.suggestNext([], 'A', { mode: 'minor' });
assert(sStartM[0].roman === 'i' && sStartM[0].chord.name === 'Am', 'pusta progresja w trybie moll → i (Am)');
assert(JSON.stringify(E.suggestNext(E.parseProgression('I-V', 'C').chords, 'C')) === JSON.stringify(sV),
  'deterministyczne wyniki (te same wejścia → ta sama lista)');
let sOk = true;
for (const ctx of ['I', 'I-V-vi', 'i-iv', 'IV-V']) {
  for (const s of E.suggestNext(E.parseProgression(ctx, 'C').chords, 'C')) {
    if (!E.parseDegree(s.roman, 'C')) sOk = false;
    if (!E.voicingsForChord(s.chord, '321', { minFret: 0, maxFret: 12 }).length) sOk = false;
    if (!s.reasons.length || s.score <= 0) sOk = false;
  }
}
assert(sOk, 'każda propozycja: parsowalna, ma voicingi w 0–12, score > 0 i uzasadnienie');
assert(E.canonicalRoman(E.parseDegree('bVII', 'A'), E.parseNote('A').pc) === 'bVII',
  'canonicalRoman: rundtrip dla bVII');

section('Propozycje: świadomość skali');
const and3 = E.parseProgression('i-bVII-bVI', 'A').chords;
const sNat = E.suggestNext(and3, 'A', { scale: 'minor' });
assert(sNat[0].roman === 'bVII', 'naturalna: po i-bVII-bVI diatoniczna oscylacja bVII na szczycie');
const sHar = E.suggestNext(and3, 'A', { scale: 'harmonic' });
assert(sHar[0].roman === 'V' && sHar[0].chord.name === 'E', 'harmoniczna: po i-bVII-bVI dominanta V (E) na szczycie');
assert(sHar[0].reasons.some(r => r.includes('diatoniczny')), 'V w harmonicznej oznaczone jako diatoniczne');
const sHi = E.suggestNext(E.parseProgression('i', 'A').chords, 'A', { scale: 'harmonic' });
assert(sHi.some(s => s.roman === 'V') && !sHi.some(s => s.roman === 'bVII'),
  'harmoniczna po i: V w top3, bVII (spoza skali) wypchnięte');
const sMM = E.suggestNext(E.parseProgression('i-iv', 'A').chords, 'A', { scale: 'major' });
assert(sMM[0].roman === 'V' && sMM.every(s => !s.reasons.some(r => r.includes('diatoniczny'))),
  'skala durowa + progresja molowa → fallback bez świadomości skali (czysta heurystyka)');
const sMel = E.suggestNext(E.parseProgression('i', 'A').chords, 'A', { scale: 'melodic', limit: 99 });
assert(sMel.some(s => s.roman === 'IV') && sMel.some(s => s.roman === 'vii°'),
  'melodyczna rozszerza kandydatów o IV i vii° (unia z diatoniką skali)');

section('Propozycje: progresje metalowe i frygijskie');
const sMet = E.suggestNext(E.parseProgression('i-bVI', 'A').chords, 'A');
assert(sMet[0].roman === 'bVII', 'i-bVI → bVII: metalowa wspinaczka (korpus i-bVI-bVII)');
const sPhr = E.suggestNext(E.parseProgression('i-bII', 'A').chords, 'A');
assert(sPhr[0].roman === 'i', 'i-bII → i: frygijskie rozwiązanie półtonu');
assert(sPhr[0].reasons.some(r => r.includes('i-bII')), 'uzasadnienie wskazuje vamp i-bII');
assert(E.PRESETS.some(p => p.text === 'i-bVI-bVII') && E.PRESETS.some(p => p.text === 'i-bvii-bVI-bII'),
  'presety Metal i Frygijska obecne');

/* 11. Voice leading */
section('Minimal voice leading');
const plan = E.planProgression(p2.chords, '432', { minFret: 0, maxFret: 12 });
assert(plan.ok, 'plan dla I-V-vi-IV na 432 istnieje');
let maxMove = 0;
for (let i = 1; i < plan.voicings.length; i++)
  for (let s = 0; s < 3; s++)
    maxMove = Math.max(maxMove, Math.abs(plan.voicings[i].frets[s] - plan.voicings[i - 1].frets[s]));
assert(maxMove <= 9, `maks. ruch pojedynczego głosu ≤ 9 progów (jest ${maxMove})`);
assert(plan.voicings.every(v => v.stringSet === '432'), 'cała progresja na jednym string secie');
const planA = E.planProgression(and.chords, '321', { minFret: 0, maxFret: 12 });
assert(planA.ok && planA.totalCost < 20, 'andaluzyjska na 321: koszt skończony i mały (' + planA.totalCost.toFixed(1) + ')');

/* 12. Poprawność voicingów */
section('Integralność voicingów');
let allOk = true, spanOk = true, ascOk = true;
for (const key of ['321', '432', '543', '654']) {
  for (const ch of [C, E.buildChord('F#', 'min'), E.buildChord('Bb', 'dim'), E.buildChord('E', 'aug')]) {
    for (const v of E.voicingsForChord(ch, key, { maxFret: 15 })) {
      if (!v.midis.every(m => ch.pcs.includes(E.mod12(m)))) allOk = false;
      if (v.midis[2] - v.midis[0] >= 12) spanOk = false;
      if (!(v.midis[0] < v.midis[1] && v.midis[1] < v.midis[2])) ascOk = false;
    }
  }
}
assert(allOk, 'brak fałszywych nut (każdy głos ∈ pcs akordu)');
assert(spanOk, 'rozpiętość < oktawy (pozycja zamknięta)');
assert(ascOk, 'głosy ściśle rosnące bas→sopran');

/* 13. Odporność na pusty zbiór */
section('Pusty zbiór kandydatów');
const bad = E.planProgression(p2.chords, '321', { minFret: 0, maxFret: 1 });
assert(bad.ok === false && typeof bad.failedIndex === 'number', 'zwraca {ok:false, failedIndex}, bez crasha');

/* 14. NOWE — strój Drop C */
section('Strój Drop C (C G C F A d)');
const DC = E.TUNINGS.dropC.open;
assert(DC[6] === 36 && DC[5] === 43 && DC[4] === 48, 'struny 6-5-4: C2 G2 C3 (36 43 48)');
assert(DC[3] === 53 && DC[2] === 57 && DC[1] === 62, 'struny 3-2-1: F3 A3 D4 (53 57 62)');
assert(DC[5] - DC[6] === 7 && DC[4] - DC[5] === 5, 'kwinta C→G na dole (drop), dalej kwarty');
assert(E.fretsForPc(6, 0, 0, 12, DC).join(',') === '0,12', 'C na strunie 6 w Drop C: progi 0 i 12');
assert(E.fretsForPc(1, 0, 0, 12, DC).includes(10), 'C na strunie 1 (d): próg 10');

const vDC = E.voicingsForChord(C, '654', { minFret: 0, maxFret: 12, inversionFilter: 'root', tuning: 'dropC' });
assert(vDC.length === 1 && JSON.stringify(vDC[0].frets) === '[12,9,7]',
  'C-dur root na 654 w Drop C = [12,9,7], jest: ' + JSON.stringify(vDC.map(v => v.frets)));
assert(vDC[0].midis.join(',') === '48,52,55' && vDC[0].tuning === 'dropC', 'MIDI 48 52 55 z otwartych strun Drop C');
const vStd = E.voicingsForChord(C, '654', { minFret: 0, maxFret: 12, inversionFilter: 'root' });
assert(vStd.every(v => v.tuning === 'standard') && JSON.stringify(vStd[0].frets) !== '[12,9,7]',
  'bez opts.tuning nadal strój standardowy (zgodność wstecz)');

const planDC = E.planProgression(p2.chords, '654', { minFret: 0, maxFret: 14, tuning: 'dropC' });
assert(planDC.ok && planDC.voicings.every(v => v.tuning === 'dropC'), 'voice leading działa w Drop C');
let dcOK = true;
for (const v of planDC.voicings)
  if (!v.midis.every((m, i) => m === DC[v.strings[i]] + v.frets[i])) dcOK = false;
assert(dcOK, 'MIDI każdego głosu liczone z otwartych strun Drop C');
assert(Math.abs(E.midiToFreq(36) - 65.406) < 0.01, 'C2 (struna 6 w Drop C) ≈ 65.41 Hz');

/* 15. NOWE — harmonogram audio (czyste funkcje) */
section('Audio: midiToFreq');
assert(E.midiToFreq(69) === 440, 'A4 (69) = 440 Hz');
assert(Math.abs(E.midiToFreq(60) - 261.626) < 0.01, 'C4 (60) ≈ 261.63 Hz');
assert(Math.abs(E.midiToFreq(40) - 82.407) < 0.01, 'E2 (40) ≈ 82.41 Hz (struna 6)');

section('Audio: strum');
const sv = v321[0]; // C-dur root na 321: midis 60,64,67
const ev = E.strumEvents(sv, { at: 1, strumGap: 0.05, duration: 1.0 });
assert(ev.length === 3 && ev.map(e => e.midi).join(',') === '60,64,67', 'zdarzenia = głosy bas→sopran');
assert(Math.abs(ev[1].time - 1.05) < 1e-9 && Math.abs(ev[2].time - 1.10) < 1e-9, 'opóźnienia strum co 0.05 s');
assert(ev.every(e => e.freq > 0 && e.dur === 1.0), 'częstotliwości i czasy trwania ustawione');

section('Audio: harmonogram progresji');
const sched = E.progressionSchedule(plan.voicings, { bpm: 120, beatsPerChord: 4 });
assert(Math.abs(sched.beat - 0.5) < 1e-9 && Math.abs(sched.chordDur - 2) < 1e-9, 'BPM 120 → ćwierćnuta 0.5 s, akord 2 s');
assert(sched.chordTimes.join(',') === '0,2,4,6', 'akordy startują co 2 s');
assert(Math.abs(sched.totalDuration - 8) < 1e-9, 'całość = 8 s dla 4 akordów');
assert(sched.events.length === 12 && sched.events.every((e, i, a) => i === 0 || a[i].time >= a[i - 1].time), '12 zdarzeń w porządku czasowym');

section('Audio: metronom');
const mev = E.metronomeEvents(8, { bpm: 60, beatsPerBar: 4 });
assert(mev.length === 8 && mev[0].accent && mev[4].accent && !mev[1].accent, 'akcent na „raz” co takt');
assert(Math.abs(mev[7].time - 7) < 1e-9, 'kliki co ćwierćnutę (60 BPM → co 1 s)');

/* 16. NOWE — geometria gryfu */
section('Gryf: menzura i pola progów');
assert(Math.abs(E.wireX(12, 1) - 0.5) < 1e-9, 'drut 12 w połowie menzury');
assert(Math.abs(E.wireX(24, 1) - 0.75) < 1e-9, 'drut 24 w 3/4 menzury');
let shrink = true;
for (let f = 1; f < 22; f++)
  if (!(E.wireX(f + 1) - E.wireX(f) < E.wireX(f) - E.wireX(f - 1))) shrink = false;
assert(shrink, 'odstępy progów ściśle malejące');

const g = E.fretboardGeometry({ lo: 0, hi: 12, width: 1000, height: 236 });
let between = true;
for (let f = 1; f <= 12; f++) {
  const x = g.dotX(f);
  if (!(x > g.wireXpx(f - 1) && x < g.wireXpx(f))) between = false;
}
assert(between, 'kropka progu f leży między drutami f−1 i f');
assert(g.dotX(0) < g.wireXpx(0) && g.hasNut, 'struna pusta przed siodełkiem; siodełko widoczne');
const g5 = E.fretboardGeometry({ lo: 5, hi: 12, width: 1000 });
assert(g5.leftWire === 4 && g5.dotX(5) > g5.wireXpx(4) && (g5.dotX(5) - g5.x0) / 1000 < 0.2,
  'okno od progu 5: pole 5 widoczne przy lewej krawędzi');
assert(g.stringY(1) < g.stringY(6), 'struna e (1) na górze — jak w tabulaturze');
assert(g.inlays.some(i => i.f === 12 && i.double) && g.inlays.some(i => i.f === 5 && !i.double),
  'inlaye: 5 pojedynczy, 12 podwójny');

/* 17. NOWE — oś czasu animacji (czyste funkcje) */
section('Animacja: ruchy głosów i easing');
const mv = E.voiceMoves(plan.voicings);
assert(mv.length === (plan.voicings.length - 1) * 3, '(n−1)·3 ruchów (jest ' + mv.length + ')');
assert(mv.every(m => m.string === plan.voicings[0].strings[m.voice]), 'każdy głos trzyma swoją strunę');
const sumDist = mv.reduce((a, m) => a + m.dist, 0);
assert(sumDist <= plan.totalCost + 1e-9, 'Σ|Δprogów| ≤ totalCost (kara pozycji nieujemna)');
assert(E.easeInOutCubic(0) === 0 && E.easeInOutCubic(1) === 1
  && Math.abs(E.easeInOutCubic(0.5) - 0.5) < 1e-9, 'easing: 0→0, ½→½, 1→1');
let mono = true, prevE = -1;
for (let u = 0; u <= 1.00001; u += 0.01) { const e = E.easeInOutCubic(u); if (e < prevE - 1e-12) mono = false; prevE = e; }
assert(mono, 'easing monotoniczny');

section('Animacja: animState');
const s120 = E.progressionSchedule(plan.voicings, { bpm: 120, beatsPerChord: 4 }); // akord = 2 s
let exact = true;
for (let i = 0; i < plan.voicings.length; i++) {
  const st = E.animState(s120.chordTimes[i], plan.voicings, s120, {});
  if (st.chordIndex !== i || st.inTransition) exact = false;
  st.dots.forEach((d, v) => { if (d.fret !== plan.voicings[i].frets[v]) exact = false; });
}
assert(exact, 'na starcie akordu i: dokładnie progi voicingu i (kropki dojeżdżają na uderzenie)');
const T = E.transitionTime(s120.chordDur);
const mid = E.animState(s120.chordTimes[1] - T / 2, plan.voicings, s120, {});
assert(mid.inTransition && mid.chordIndex === 0 && mid.nextIndex === 1, 'w połowie okna: przejście 0 → 1');
let frac = true;
mid.dots.forEach((d, v) => {
  const a = plan.voicings[0].frets[v], b = plan.voicings[1].frets[v];
  if (a !== b && !(d.fret > Math.min(a, b) && d.fret < Math.max(a, b))) frac = false;
  if (a === b && d.fret !== a) frac = false;
});
assert(frac, 'progi ułamkowe ściśle między from a to');
for (const bpm of [40, 180]) {
  const cd = 4 * 60 / bpm;
  const tT = E.transitionTime(cd);
  assert(tT >= 0.08 - 1e-9 && tT <= 0.35 + 1e-9 && tT <= cd,
    `T przy ${bpm} BPM w [0.08, 0.35] s i ≤ akordu (${tT.toFixed(2)} s)`);
}
const stA = E.animState(1.0, plan.voicings, s120, { loop: true });
const stB = E.animState(1.0 + s120.totalDuration, plan.voicings, s120, { loop: true });
assert(stA.chordIndex === stB.chordIndex
  && stA.dots.every((d, v) => Math.abs(d.fret - stB.dots[v].fret) < 1e-9), 'pętla: t i t+total dają ten sam stan');
const wrapSt = E.animState(s120.totalDuration - T / 2, plan.voicings, s120, { loop: true });
assert(wrapSt.inTransition && wrapSt.nextIndex === 0, 'zawinięcie pętli: przejście ostatni → pierwszy');
const cnt = E.animState(-0.5, plan.voicings, s120, {});
assert(cnt.chordIndex === 0 && !cnt.inTransition
  && cnt.dots.every((d, v) => d.fret === plan.voicings[0].frets[v]), 'count-in (t<0): kropki czekają na akordzie 0');
let allInt = true;
for (const t of [0.3, 1.9, 1.95, 3.7, 7.99]) {
  const st = E.animState(t, plan.voicings, s120, { instant: true });
  st.dots.forEach(d => { if (!Number.isInteger(d.fret)) allInt = false; });
}
assert(allInt, 'reduced motion (instant): zawsze progi całkowite, zero interpolacji');

/* NOWE — share-state: stan aplikacji ⇄ fragment URL */
section('Share-state: encode');
const shSt = { tuning: 'dropC', key: 'F#', scale: 'harmonic', set: '654', inv: 'inv1',
               fmin: 3, fmax: 9, prog: 'i-bVII-bVI-V', bpm: 96, stage: true };
const shEnc = E.encodeShareState(shSt);
assert(shEnc.indexOf('#') === -1, 'brak surowego # w zakodowanym stanie (percent-encoding)');
assert(shEnc === E.encodeShareState(shSt), 'encode deterministyczny (te same wejścia → ten sam string)');
assert(E.encodeShareState({ prog: 'I-#iv°-V' }) === 'p=' + encodeURIComponent('I-#iv°-V'),
  'encode częściowego stanu: tylko podane klucze');
assert(E.encodeShareState({ bpm: 999 }) === 'bpm=180' && E.encodeShareState({ bpm: 7 }) === 'bpm=40',
  'encode klamruje BPM do [40, 180]');
assert(E.encodeShareState({ fmin: 12, fmax: 3 }) === 'f=3-12', 'encode naprawia odwrócony zakres progów');

section('Share-state: decode i roundtrip');
const shDec = E.decodeShareState('#' + shEnc).state;
assert(shDec.tuning === 'dropC' && shDec.key === 'F#' && shDec.scale === 'harmonic'
  && shDec.set === '654' && shDec.inv === 'inv1', 'roundtrip: strój / tonacja / skala / zestaw / przewroty');
assert(shDec.fmin === 3 && shDec.fmax === 9 && shDec.bpm === 96 && shDec.stage === true,
  'roundtrip: progi, BPM, tryb sceny');
assert(shDec.prog === 'i-bVII-bVI-V' && E.parseProgression(shDec.prog, shDec.key).ok,
  'roundtrip: progresja wraca znak w znak i jest parsowalna');
assert(E.encodeShareState(E.decodeShareState(shEnc).state) === shEnc, 'idempotencja: encode∘decode = id');
const shJunk = E.decodeShareState('=x&&foo&s=lokrycka&k=Q#&ss=765&bpm=abc&f=99-1&%zz=1').state;
assert(shJunk.scale === undefined && shJunk.key === undefined
  && shJunk.set === undefined && shJunk.bpm === undefined,
  'śmieci: nieznana skala / tonacja / zestaw / BPM odrzucone bez crasha');
assert(shJunk.fmin === 1 && shJunk.fmax === 22, 'zakres progów: klamra do [0, 22] + naprawa kolejności');
assert(Object.keys(E.decodeShareState('').state).length === 0
  && Object.keys(E.decodeShareState('#').state).length === 0, 'pusty hash → pusty stan (zostają domyślne)');
const shProg = E.decodeShareState('p=' + encodeURIComponent('I-#IV-V') + '&st=0').state;
assert(shProg.prog === 'I-#IV-V' && shProg.stage === false,
  'dekodowanie progresji z # oraz jawnego st=0');

/* NOWE — wzorce rytmiczne i humanizacja */
section('Wzorce rytmiczne: whole = dawne zachowanie');
const v0 = plan.voicings[0];
for (const bpc of [4, 2]) {                            // 2 = podgląd propozycji
  const sw = E.progressionSchedule(plan.voicings, { bpm: 120, beatsPerChord: bpc });
  const legacyDur = Math.min(sw.chordDur * 0.95, 2.2);
  let same = sw.events.length === plan.voicings.length * 3;
  sw.events.forEach((e, k) => {
    const i = Math.floor(k / 3), v = k % 3;
    if (Math.abs(e.time - (sw.chordTimes[i] + v * 0.04)) > 1e-9) same = false;
    if (e.midi !== plan.voicings[i].midis[v]) same = false;
    if (Math.abs(e.dur - legacyDur) > 1e-9) same = false;
  });
  assert(same, `whole @ beatsPerChord=${bpc}: czasy, midi i długości identyczne z dawnym strumEvents`);
}

section('Wzorce rytmiczne: rock i ballada');
const rockEv = E.patternEvents(v0, { bpm: 80, pattern: 'rock' });
assert(rockEv.length === 6 * 3, 'rock: 6 kroków × 3 głosy = 18 zdarzeń na akord');
const upStep = rockEv.filter((e) => Math.abs(e.time - (1.5 * 0.75 + 0 * 0.04)) < 0.05 + 1e-9
  || (e.time >= 1.5 * 0.75 - 1e-9 && e.time <= 1.5 * 0.75 + 0.09));
assert(upStep.length === 3 && upStep[0].voice === 2 && upStep[2].voice === 0,
  'rock: strum „up" gra sopran→bas (kolejność głosów 2, 1, 0)');
assert(rockEv[0].vel === 1 && upStep.every((e) => e.vel < rockEv[0].vel),
  'rock: kostka w górę cichsza od mocnego „raz"');
const balEv = E.patternEvents(v0, { bpm: 80, pattern: 'ballad' });
assert(balEv.length === 8 && balEv.map((e) => e.voice).join('') === '01210121',
  'ballada: 8 pojedynczych głosów w kolejności bas-środek-sopran-środek…');
assert(balEv[0].vel > balEv[1].vel, 'ballada: bas akcentowany mocniej niż środek');

section('Wzorce rytmiczne: niezmienniki');
let inv = true;
for (const pat of Object.keys(E.PATTERNS).concat(['nieznany'])) {
  const evs = E.patternEvents(v0, { at: 10, bpm: 80, pattern: pat, chord: 7 });
  const chordDur = 4 * 60 / 80;
  for (const e of evs) {
    if (e.time < 10 - 1e-9 || e.time >= 10 + chordDur) inv = false;          // start w takcie
    if (!(e.vel > 0 && e.vel <= 1.000001)) inv = false;
    if (![0, 1, 2].includes(e.voice) || e.chord !== 7) inv = false;
    if (e.dur > chordDur * 0.95 + 1e-9 || e.dur > 2.2 + 1e-9) inv = false;   // klamra długości
  }
}
assert(inv, 'każdy wzorzec: starty w takcie, vel ∈ (0,1], voice/chord obecne, dur ≤ takt i ≤ 2.2 s');
assert(E.patternEvents(v0, { pattern: 'nieznany' }).length === 3, 'nieznany wzorzec → fallback whole');

section('Humanizacja');
const baseEv = E.progressionSchedule(plan.voicings, { bpm: 100, pattern: 'rock' }).events;
const h1 = E.humanizeEvents(baseEv, { seed: 42 });
const h2 = E.humanizeEvents(baseEv, { seed: 42 });
const h3 = E.humanizeEvents(baseEv, { seed: 43 });
assert(JSON.stringify(h1) === JSON.stringify(h2), 'ten sam seed → identyczny wynik (deterministyczna)');
assert(JSON.stringify(h1) !== JSON.stringify(h3), 'inny seed → inny wynik');
assert(h1.every((e, i) => Math.abs(e.time - baseEv[i].time) <= 0.008 + 1e-9 && e.time >= 0),
  'jitter czasu ograniczony do ±8 ms, czasy nieujemne');
assert(h1.every((e) => e.vel >= 0.2 && e.vel <= 1.25), 'vel po humanizacji w klamrach [0.2, 1.25]');
const sH = E.progressionSchedule(plan.voicings, { bpm: 100, pattern: 'rock', humanize: { seed: 7 } });
const sN = E.progressionSchedule(plan.voicings, { bpm: 100, pattern: 'rock' });
assert(JSON.stringify(sH.chordTimes) === JSON.stringify(sN.chordTimes)
  && sH.totalDuration === sN.totalDuration,
  'humanizacja nie rusza siatki akordów (chordTimes i totalDuration nietknięte)');

section('Share-state: wzorzec rytmiczny');
const ptRt = E.decodeShareState(E.encodeShareState({ pattern: 'ballad', bpm: 90 })).state;
assert(ptRt.pattern === 'ballad' && ptRt.bpm === 90, 'roundtrip wzorca w linku (pt=ballad)');
assert(E.decodeShareState('pt=dubstep').state.pattern === undefined
  && E.encodeShareState({ pattern: 'dubstep' }) === '', 'nieznany wzorzec odrzucany w obie strony');

/* NOWE — rozpoznawanie triad i klikalny gryf */
section('Rozpoznawanie triad');
const rC = E.recognizeTriad([48, 52, 55]);             // C E G
assert(rC.ok && rC.chord.name === 'C' && rC.inversion === 'root' && rC.roman === 'I' && rC.diatonic,
  'C E G → C, pozycja zasadnicza, I, diatoniczny w C-dur');
const rI1 = E.recognizeTriad([52, 55, 60]);            // E G C
assert(rI1.ok && rI1.inversion === 'inv1' && rI1.slashName === 'C/E', 'E G C → C/E (I przewrót)');
const rI2 = E.recognizeTriad([55, 60, 64]);            // G C E
assert(rI2.ok && rI2.inversion === 'inv2' && rI2.slashName === 'C/G', 'G C E → C/G (II przewrót)');
assert(E.recognizeTriad([45, 48, 52]).roman === 'vi', 'A C E w C-dur → vi');
const rDim = E.recognizeTriad([47, 50, 53]);           // B D F
assert(rDim.ok && rDim.quality === 'dim' && rDim.roman === 'vii°' && rDim.diatonic,
  'B D F → vii° (zmniejszony, diatoniczny)');
const rAug = E.recognizeTriad([48, 52, 56]);           // C E G#
assert(rAug.ok && rAug.quality === 'aug' && rAug.roman === 'I+' && !rAug.diatonic
  && rAug.inversion === 'root', 'C E G♯ → I+ (aug symetryczny: pryma = bas), zapożyczenie w C-dur');
const rBor = E.recognizeTriad([44, 48, 51]);           // Ab C Eb
assert(rBor.ok && rBor.roman === 'bVI' && !rBor.diatonic
  && rBor.noteNames.join(' ') === 'A♭ C E♭',
  'A♭ C E♭ w C-dur → bVI (zapożyczenie), pisownia bemolowa wynika ze stopnia');
assert(E.recognizeTriad([44, 48, 51], { key: 'C', scale: 'minor' }).diatonic,
  'ten sam akord w c-moll → diatoniczny (bVI naturalnej molowej)');
assert(!E.recognizeTriad([48, 50, 52]).ok && !E.recognizeTriad([48, 52, 60]).ok
  && !E.recognizeTriad([48, 52]).ok,
  'klaster sekund / zdublowana klasa / 2 dźwięki → grzeczna odmowa z powodem');
const rOct = E.recognizeTriad([76, 91, 60]);           // E5 G6 C4 — nieposortowane, szerokie
assert(rOct.ok && rOct.chord.name === 'C' && rOct.inversion === 'root',
  'oktawy i kolejność wejścia bez znaczenia (bas = najniższy dźwięk)');

// regresja utajonego błędu znalezionego przez masowy roundtrip: spellPc pisze
// podwójne alteracje glifami 𝄪/𝄫, których parseNote wcześniej nie czytał;
// dziedzina spellera: |alteracja| ≤ 2 (większe nie występują w 7-stopniowych skalach)
let spellRt = true;
for (let pc = 0; pc < 12; pc++) for (const L of E.LETTERS) {
  const name = E.spellPc(pc, L);
  if (/♯♯♯|♭♭♭/.test(name)) continue;                  // poza dziedziną (alt ±3+)
  const n = E.parseNote(name);
  if (!n || n.pc !== pc || n.letter !== L) spellRt = false;
}
assert(spellRt, 'roundtrip spellera: parseNote(spellPc(pc, litera)) = id dla |alteracji| ≤ 2 (w tym 𝄪/𝄫)');
assert(E.parseProgression('i-bVI-bVII', 'Db').ok, 'regresja: bVI w tonacji D♭ (pryma B𝄫) parsuje się');

// masowy roundtrip: każda diatoniczna triada × 12 tonacji × 4 warianty skali
let rtAll = true;
for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']) {
  for (const sc of Object.keys(E.SCALE_STEPS)) {
    for (const c of E.diatonicTriads(k, sc)) {
      const m0 = 48 + c.pcs[0];
      const m1 = m0 + E.mod12(c.pcs[1] - c.pcs[0]);
      const m2 = m1 + E.mod12(c.pcs[2] - c.pcs[1]);
      const r = E.recognizeTriad([m0, m1, m2], { key: k, scale: sc });
      if (!r.ok || !r.diatonic || r.roman !== c.roman || r.inversion !== 'root') rtAll = false;
      const back = E.parseDegree(r.roman, k);
      if (!back || back.rootPc !== c.rootPc || back.quality !== c.quality) rtAll = false;
    }
  }
}
assert(rtAll, 'masowy roundtrip: rozpoznanie = diatonika i parser odtwarza akord (12 tonacji × 4 skale × 7 stopni)');

section('Geometria: hitTest (klikalny gryf)');
const gN = E.fretboardGeometry({ lo: 0, hi: 12 });
let ht1 = true;
for (let s = 1; s <= 6; s++) for (let f = 0; f <= 12; f++) {
  const h = gN.hitTest(gN.dotX(f), gN.stringY(s));
  if (!h || h.string !== s || h.fret !== f) ht1 = false;
}
assert(ht1, 'okno 0–12: hitTest(dotX, stringY) = (struna, próg) dla wszystkich pól i strun pustych');
const gW = E.fretboardGeometry({ lo: 3, hi: 9 });
let ht2 = true;
for (let s = 1; s <= 6; s++) for (let f = 3; f <= 10; f++) {
  const h = gW.hitTest(gW.dotX(f), gW.stringY(s));
  if (!h || h.string !== s || h.fret !== f) ht2 = false;
}
assert(ht2, 'okno 3–9 (bez siodełka): roundtrip wszystkich pól, łącznie z polem marginesu');
assert(gW.hitTest(gW.x0 - 30, gW.stringY(3)) === null && gN.hitTest(gN.dotX(5), 4) === null
  && gN.hitTest(gN.x1 + 30, gN.stringY(2)) === null, 'klik poza gryfem / poza strunami → null');
assert(gN.hitTest(gN.wireXpx(5) - 0.01, gN.stringY(1)).fret === 5
  && gN.hitTest(gN.wireXpx(5) + 0.01, gN.stringY(1)).fret === 6,
  'granica pól dokładnie na drucie progu (5 | 6)');

console.log(`\n${'='.repeat(40)}\nWynik: ${pass} ✔ / ${fail} ✘  (razem ${pass + fail})`);
process.exit(fail ? 1 : 0);
