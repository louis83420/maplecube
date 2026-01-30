// Additional Combination Cube (TMS) - mode2
// - You pick a single line to reroll; other lines are preserved.
// - Goal: get 3 lines that are the desired attribute.

// When current outer tier is legendary: internal line tier is legendary with 0.5%, unique with 99.5%.
const LINE_TIER = { pL: 0.005, pU: 0.995 };

const LEVEL_BRACKETS = {
  '91-150': { min: 91, max: 150, idx: 0 },
  '151-200': { min: 151, max: 200, idx: 1 },
  '201-250': { min: 201, max: 250, idx: 2 },
};

// Minimal value table for the 4 targets we care about (initial version).
// unique ~= 罕見(=epic bonus), legendary ~= 傳說.
const VALUE_TABLE = {
  // Attack% for weapon group
  'ATT%': {
    unique:   [9, 10, 10],
    legendary:[12, 13, 13],
    unit: '%',
    zh: '物理攻擊力 %',
  },
  // Main stat%
  'MAINSTAT%': {
    unique:   [6, 6, 7],
    legendary:[8, 8, 9],
    unit: '%',
    zh: '主屬性 %',
  },
  // Crit dmg for gloves
  'CritDmg_Glove': {
    unique:   [0, 0, 0],
    legendary:[3, 3, 3],
    unit: '%',
    zh: '爆擊傷害',
  },
  // Cooldown reduction for hats
  'CDR': {
    unique:   [0, 0, 0],
    legendary:[1, 1, 1],
    unit: 's',
    zh: '技能冷卻時間減少',
  },
};

const PRESETS = {
  weapon_phys_pct: {
    label: '武器/副武/徽章：三排物攻%（罕見/傳說都算）',
    pU: 0.0123,
    pL: 0.0126,
    hint: '目標：物理攻擊力%'
  },
  armor_mainstat_pct: {
    label: '防具：三排主屬%（依職業）',
    pU: 0.0190,
    pL: 0.0157,
    hint: '目標：STR/DEX/INT/LUK %'
  },
  glove_crit_dmg: {
    label: '手套：三排爆傷%（罕見/傳說都算；可自訂覆蓋）',
    pU: 0.0104,
    pL: 0.0104,
    hint: '目標：爆擊傷害%'
  },
  hat_cooldown: {
    label: '帽子：三排減CD（僅傳說）',
    pU: 0.0,
    pL: 0.0104,
    hint: '目標：減少所有技能冷卻時間'
  }
};

// Non-target line text pool (placeholder). This is for UI realism only.
// If you want 100% accurate pools/ranges, we can replace this with an official table.
const NON_TARGET_POOL = {
  weapon_phys_pct: [
    'STR +12', 'DEX +12', 'INT +12', 'LUK +12',
    '最大HP +300', '最大MP +300',
    '攻擊力 +12', '魔力 +12',
    '跳躍力 +10', '移動速度 +10',
    '防禦力 +200'
  ],
  armor_mainstat_pct: [
    'STR +12', 'DEX +12', 'INT +12', 'LUK +12',
    '最大HP +300', '最大MP +300',
    '防禦力 +200',
    '跳躍力 +10', '移動速度 +10',
    '全屬性 +5'
  ],
  glove_crit_dmg: [
    'STR +12', 'DEX +12', 'INT +12', 'LUK +12',
    '最大HP +300', '最大MP +300',
    '攻擊力 +12', '魔力 +12',
    '掉寶率 +10%', '楓幣獲得量 +10%'
  ],
  hat_cooldown: [
    'STR +12', 'DEX +12', 'INT +12', 'LUK +12',
    '最大HP +300', '最大MP +300',
    '掉寶率 +10%', '楓幣獲得量 +10%',
    '全屬性 +5'
  ]
};

const $ = (sel) => document.querySelector(sel);

function fmtPct(x){ return (x*100).toFixed(4)+'%'; }
function mixP(pU, pL){ return LINE_TIER.pU*pU + LINE_TIER.pL*pL; }

// Expected cubes under the correct rule:
// each cube randomly selects ONE line (1/3) to reroll; the rerolled line becomes hit with prob p else miss.
// This can decrease the number of hits if a good line is rerolled and turns bad.
// Expected cubes under the real UI rule (confirm/cancel):
// - Each cube randomly selects ONE line (1/3) to reroll.
// - You may CANCEL (do not apply), which preserves the current lines.
// - Rational strategy: only CONFIRM when the selected line becomes a hit (or at least improves towards your goal).
// For our simplified goal (hit vs non-hit), we confirm iff it hits.
// Then progress never decreases; sometimes a cube is wasted by selecting an already-hit line.
function expectedCubesToFinish(p, k0){
  if (k0 >= 3) return 0;
  if (p <= 0) return Infinity;
  // Let m = number of missing lines = 3-k.
  // Each cube selects a missing line with prob m/3, then hits with prob p.
  // So probability of reducing m by 1 on a given cube is (m/3)*p.
  // Expected cubes to reduce m by 1: 1 / ((m/3)*p) = 3/(m*p).
  // Total expected cubes: sum_{m=3-k0..1} 3/(m*p) = (3/p) * H_{3-k0}.
  let m = 3 - k0;
  let sum = 0;
  for (; m >= 1; m--) sum += 3 / (m * p);
  return sum;
}

function simulateCubesToFinish(p, k0, trials){
  const arr = new Array(trials);
  for (let t=0;t<trials;t++){
    let hits = k0;
    const line = [false,false,false];
    for (let i=0;i<k0;i++) line[i]=true;
    for (let i=2;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [line[i],line[j]]=[line[j],line[i]]; }

    let cubes = 0;
    const CAP = 2_000_000;
    while (hits < 3 && cubes < CAP){
      cubes++;
      const idx = Math.floor(Math.random()*3);
      if (line[idx]) {
        // selected an already-hit line -> cancel (waste a cube)
        continue;
      }
      // selected a missing line -> reroll; confirm only if hit
      const now = (Math.random() < p);
      if (now) { line[idx] = true; hits++; }
    }
    arr[t] = cubes;
  }
  arr.sort((a,b)=>a-b);
  const avg = arr.reduce((s,x)=>s+x,0)/trials;
  const q = (q)=>arr[Math.floor(trials*q)];
  return { avg, p50:q(0.5), p90:q(0.9), p99:q(0.99) };
}

function readProbInputs(preset){
  const pUin = $('#pU').value.trim();
  const pLin = $('#pL').value.trim();
  const pU = pUin ? (Number(pUin)/100) : preset.pU;
  const pL = pLin ? (Number(pLin)/100) : preset.pL;
  return { pU, pL };
}

function getTargetStatKey(st){
  if (st.presetKey === 'weapon_phys_pct') return 'ATT%';
  if (st.presetKey === 'armor_mainstat_pct') return 'MAINSTAT%';
  if (st.presetKey === 'glove_crit_dmg') return 'CritDmg_Glove';
  if (st.presetKey === 'hat_cooldown') return 'CDR';
  return 'ATT%';
}

function getState(){
  const presetKey = $('#preset').value;
  const preset = PRESETS[presetKey];
  const price = Number($('#price').value || 0);
  const trials = Math.max(500, Math.floor(Number($('#trials').value || 5000)));
  const mainStat = $('#mainStat').value;
  const levelBracket = $('#levelBracket')?.value || '151-200';
  const currentTier = $('#currentTier')?.value || 'unique';
  const { pU, pL } = readProbInputs(preset);
  const p = mixP(pU, pL);
  const targetStatKey = getTargetStatKey({ presetKey });

  return { presetKey, preset, price, trials, mainStat, levelBracket, currentTier, targetStatKey, pU, pL, p };
}

function formatTargetText(st, tier){
  const idx = LEVEL_BRACKETS[st.levelBracket]?.idx ?? 1;
  const key = st.targetStatKey;
  if (key === 'MAINSTAT%') {
    const base = VALUE_TABLE[key][tier][idx] ?? 0;
    return `${st.mainStat}% +${base}%`;
  }
  if (key === 'ATT%') {
    const base = VALUE_TABLE[key][tier][idx] ?? 0;
    return `物理攻擊力 % +${base}%`;
  }
  if (key === 'CritDmg_Glove') {
    const base = VALUE_TABLE[key][tier][idx] ?? 0;
    return `爆擊傷害 +${base}%`;
  }
  if (key === 'CDR') {
    const base = VALUE_TABLE[key][tier][idx] ?? 0;
    return `技能冷卻時間減少 -${base}秒`;
  }
  return '（命中）';
}

function extractValueNumber(text){
  // Pull the first integer in the string (covers +13%, -1秒, +300, etc.)
  const m = String(text).match(/([0-9]+)/);
  return m ? Number(m[1]) : 0;
}

function pickNonTarget(st){
  const pool = NON_TARGET_POOL[st.presetKey] || ['（非目標）'];
  return pool[Math.floor(Math.random()*pool.length)];
}

function sampleInternalTier(st){
  // If current outer tier is legendary: internal tier is legendary with 0.5%, else unique.
  if (st.currentTier === 'legendary') {
    return (Math.random() < LINE_TIER.pL) ? 'legendary' : 'unique';
  }
  // If current tier is unique (or lower): treat internal tier as unique for our simplified model.
  return 'unique';
}

function tierLabel(t){
  return t === 'legendary' ? '傳說' : '罕見';
}

const sim = {
  hits: [false,false,false],
  text: ['（尚未套用）','（尚未套用）','（尚未套用）'],
  tier: ['','',''],
  cubes: 0,
  lastPicked: null,
  pending: null, // { idx, hit, ... }
  pickCounts: [0,0,0],

  reset(){
    this.hits=[false,false,false];
    this.text=['（尚未套用）','（尚未套用）','（尚未套用）'];
    this.tier=['','',''];
    this.cubes=0;
    this.lastPicked=null;
    this.pending=null;
    this.pickCounts=[0,0,0];
  },
  hitCount(){ return this.hits.filter(Boolean).length; },

  useOnce(st){
    // Game rule: randomly pick ONE line (1/3) to reroll.
    const idx = Math.floor(Math.random()*3);
    this.lastPicked = idx;
    this.cubes++;
    this.pickCounts[idx] = (this.pickCounts[idx] ?? 0) + 1;

    const internalTier = sampleInternalTier(st);
    const isHit = (Math.random() < st.p);
    const newText = isHit ? formatTargetText(st, internalTier) : pickNonTarget(st);

    // extract numeric value for target checks
    const valueNumber = extractValueNumber(newText);

    // Do NOT apply immediately. Wait for confirm/cancel.
    this.pending = {
      idx,
      hit: isHit,
      statKey: st.targetStatKey,
      internalTier,
      valueNumber,
      text: newText,
      tier: `本次選中：第 ${idx+1} 排｜內部等級：${tierLabel(internalTier)}`
    };
    return idx;
  },

  confirm(){
    if (!this.pending) return;
    const { idx, hit, text, tier } = this.pending;
    this.hits[idx] = hit;
    this.text[idx] = text;
    this.tier[idx] = tier;
    this.pending = null;
  },

  cancel(){
    // Keep old lines; only discard pending.
    this.pending = null;
  },

  applyInit(st){
    for (let i=0;i<3;i++){
      const chk = $(`#initHit${i+1}`).checked;
      const sel = $(`#initSel${i+1}`);
      const val = sel ? String(sel.value || '').trim() : '';
      this.hits[i] = chk;
      this.text[i] = val || (chk ? formatTargetText(st, 'legendary') : pickNonTarget(st));
      this.tier[i] = '';
    }
    this.lastPicked = null;
    this.pending = null;
  }
};

let estimateDirty = true;

function render(doEstimate = false){
  const st = getState();

  $('#presetHint').textContent = st.preset.hint;
  $('#presetLabel').textContent = st.preset.label;

  // armor stat selector enable
  $('#mainStat').disabled = (st.presetKey !== 'armor_mainstat_pct');

  const hits = sim.hitCount();
  $('#counterCubes').textContent = sim.cubes.toLocaleString();
  $('#counterHits').textContent = `${hits}/3`;
  $('#counterCost').textContent = (sim.cubes * st.price).toLocaleString();
  $('#pick1') && ($('#pick1').textContent = String(sim.pickCounts?.[0] ?? 0));
  $('#pick2') && ($('#pick2').textContent = String(sim.pickCounts?.[1] ?? 0));
  $('#pick3') && ($('#pick3').textContent = String(sim.pickCounts?.[2] ?? 0));

  for (let i=0;i<3;i++){
    const el = $(`#line${i+1}`);
    const hit = sim.hits[i];
    el.classList.toggle('good', hit);
    el.classList.toggle('bad', !hit);

    // Show pending result only on the selected line until confirmed.
    if (sim.pending && sim.pending.idx === i) {
      el.querySelector('.val').textContent = `（新）${sim.pending.text}`;
      $(`#tier${i+1}`).textContent = sim.pending.tier;
    } else {
      el.querySelector('.val').textContent = sim.text[i];
      $(`#tier${i+1}`).textContent = sim.tier[i];
    }
  }

  // Picked line info + pending state
  const pickedInfo = $('#pickedInfo');
  if (pickedInfo) {
    if (sim.pending) {
      const i = sim.pending.idx;
      pickedInfo.textContent = `本次選中：第 ${i+1} 排（待確認）`;
    } else if (sim.lastPicked != null) {
      pickedInfo.textContent = `本次選中：第 ${sim.lastPicked + 1} 排`;
    } else {
      pickedInfo.textContent = '';
    }
  }

  const btnConfirm = $('#btnConfirm');
  const btnReselect = $('#btnReselect');
  const btnCancel = $('#btnCancel');
  if (btnConfirm) btnConfirm.disabled = !sim.pending;
  if (btnReselect) btnReselect.disabled = !sim.pending;
  if (btnCancel) btnCancel.disabled = !sim.pending;

  // Estimate section (correct rule: each cube randomly selects ONE line; hits can be lost)
  const out = [];
  out.push(`單顆：隨機選 1 排（1/3）重洗；可取消不套用（仍耗 1 顆）；也可「重新隨機選排」直到抽到你要的排。`);
  out.push(`重洗後命中率（混合）：p = ${fmtPct(st.p)}  （罕見=${fmtPct(st.pU)} / 傳說=${fmtPct(st.pL)}）`);
  out.push(`目前命中：${hits}/3`);

  const exp = expectedCubesToFinish(st.p, hits);
  out.push('');
  out.push(`解析期望顆數：${Number.isFinite(exp) ? exp.toFixed(2) : 'Infinity'} 顆（估花費：${Number.isFinite(exp) ? Math.round(exp*st.price).toLocaleString() : 'Infinity'}）`);

  if (doEstimate) {
    // Monte Carlo can be expensive under the 1/3-reroll rule. Keep it bounded to avoid freezing the page.
    const trials = Math.min(st.trials, 8000);
    const mc = simulateCubesToFinish(st.p, hits, trials);
    out.push(`Monte Carlo（${trials.toLocaleString()} 次）：平均 ${mc.avg.toFixed(2)} 顆 | P50=${mc.p50} | P90=${mc.p90} | P99=${mc.p99}`);
    estimateDirty = false;
  } else {
    out.push('（尚未跑 Monte Carlo）按「計算/更新估算」才會算分位數');
    estimateDirty = true;
  }

  $('#out').textContent = out.join('\n');

  $('#btnAuto').disabled = (hits===3 || st.p<=0);
  $('#btnUseOnce') && ($('#btnUseOnce').disabled = (hits===3 || st.p<=0 || autoRunning));
  const btnStop = $('#btnStopAuto');
  if (btnStop) btnStop.disabled = !autoRunning;
}

function meetsAutoTarget(st){
  const pending = sim.pending;
  if (!pending) return false;
  const targetIdx = (Number($('#targetLine')?.value || 3) - 1);
  const minValue = Number($('#minValue')?.value || 0);
  const requireL = !!$('#requireLegendary')?.checked;

  if (pending.idx !== targetIdx) return false;
  if (!pending.hit) return false;
  if (requireL && pending.internalTier !== 'legendary') return false;
  if (pending.statKey !== st.targetStatKey) return false;
  if (minValue > 0 && pending.valueNumber < minValue) return false;
  return true;
}

function autoUntilDone(){
  // Legacy: auto to 3/3 by confirming only hits.
  const st = getState();
  if (st.p <= 0) return;
  const max = Math.max(1, Math.floor(Number($('#autoMax').value || 200000)));
  let n = 0;
  while (sim.hitCount() < 3 && n < max){
    sim.useOnce(st);
    if (sim.pending && sim.pending.hit) sim.confirm();
    else sim.cancel();
    n++;
  }
  render(false);
}

let autoRunning = false;

function setAutoRunning(v){
  autoRunning = v;
  const btnStop = $('#btnStopAuto');
  if (btnStop) btnStop.disabled = !v;
  const btnStart = $('#btnAutoTarget');
  if (btnStart) btnStart.disabled = v;
}

function autoToTarget(){
  const st0 = getState();
  if (st0.p <= 0) return;
  const max = Math.max(1, Math.floor(Number($('#autoMax').value || 200000)));
  const targetIdx = (Number($('#targetLine')?.value || 3) - 1);

  if (autoRunning) return;
  setAutoRunning(true);

  let n = 0;
  const CHUNK = 200; // keep UI responsive

  const step = () => {
    if (!autoRunning) { render(false); return; }
    const st = getState();
    for (let i=0;i<CHUNK && n<max;i++){
      sim.useOnce(st);

      // Not target line -> reselect (waste cube)
      if (sim.pending && sim.pending.idx !== targetIdx) {
        sim.cancel();
        n++;
        continue;
      }

      // Target line -> confirm only if passes conditions
      if (meetsAutoTarget(st)) {
        sim.confirm();
        setAutoRunning(false);
        render(false);
        return;
      } else {
        sim.cancel();
        n++;
        continue;
      }
    }

    render(false);

    if (n >= max) {
      setAutoRunning(false);
      return;
    }
    setTimeout(step, 0);
  };

  step();
}

function buildInitSelects(){
  const st = getState();
  const opts = [];
  opts.push({ v: '', t: '（自動/不指定）' });
  const tgt = formatTargetText(st, 'legendary');
  opts.push({ v: tgt, t: `【目標】${tgt}` });
  // Add a handful of common non-target lines for quick selection.
  const pool = NON_TARGET_POOL[st.presetKey] || [];
  for (const s of pool) opts.push({ v: s, t: s });

  for (let i=1;i<=3;i++){
    const sel = $(`#initSel${i}`);
    if (!sel) continue;
    const current = sel.value;
    sel.innerHTML = '';
    for (const o of opts){
      const el = document.createElement('option');
      el.value = o.v;
      el.textContent = o.t;
      sel.appendChild(el);
    }
    if (current) sel.value = current;
  }
}

function bind(){
  $('#preset').addEventListener('change', ()=>{ sim.reset(); buildInitSelects(); render(false); });
  $('#mainStat').addEventListener('change', ()=>{ buildInitSelects(); render(false); });
  $('#levelBracket')?.addEventListener('change', ()=>{ buildInitSelects(); render(false); });
  $('#currentTier')?.addEventListener('change', ()=>{ buildInitSelects(); render(false); });
  ['price','trials','pU','pL','minValue'].forEach(id=>$('#'+id)?.addEventListener('input', ()=>render(false)));
  ['targetLine','requireLegendary'].forEach(id=>$('#'+id)?.addEventListener('change', ()=>render(false)));

  $('#btnApplyInit').addEventListener('click', ()=>{ sim.applyInit(getState()); render(false); });
  $('#btnReset').addEventListener('click', ()=>{ sim.reset(); render(false); });
  $('#btnReset2')?.addEventListener('click', ()=>{ sim.reset(); render(false); });

  $('#btnUseOnce')?.addEventListener('click', ()=>{
    sim.useOnce(getState());
    render(false);
  });

  $('#btnConfirm')?.addEventListener('click', ()=>{
    sim.confirm();
    render(false);
  });

  $('#btnReselect')?.addEventListener('click', ()=>{
    // Discard pending and spend one more cube to pick another line.
    sim.cancel();
    sim.useOnce(getState());
    render(false);
  });

  $('#btnCancel')?.addEventListener('click', ()=>{
    sim.cancel();
    render(false);
  });

  $('#btnAuto').addEventListener('click', ()=>autoUntilDone());
  $('#btnAutoTarget')?.addEventListener('click', ()=>autoToTarget());
  $('#btnStopAuto')?.addEventListener('click', ()=>{ setAutoRunning(false); });

  $('#btnEstimate')?.addEventListener('click', ()=>render(true));
}

bind();
buildInitSelects();
render(false);
