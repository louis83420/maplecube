// Additional Combination Cube (TMS) - mode2
// - You pick a single line to reroll; other lines are preserved.
// - Goal: get 3 lines that are the desired attribute.

const LINE_TIER = { pL: 0.005, pU: 0.995 }; // internal line tier distribution

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

function analyticExpected(need, p){
  if (need <= 0) return 0;
  if (p <= 0) return Infinity;
  return need / p;
}

function monteCarlo(need, p, trials){
  const arr = new Array(trials);
  for (let t=0;t<trials;t++){
    let remaining = need;
    let cubes = 0;
    while (remaining > 0){
      cubes++;
      if (Math.random() < p) remaining--;
      if (cubes > 50_000_000) break;
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

function getState(){
  const presetKey = $('#preset').value;
  const preset = PRESETS[presetKey];
  const price = Number($('#price').value || 0);
  const trials = Math.max(1000, Math.floor(Number($('#trials').value || 50000)));
  const mainStat = $('#mainStat').value;
  const { pU, pL } = readProbInputs(preset);
  const p = mixP(pU, pL);

  return { presetKey, preset, price, trials, mainStat, pU, pL, p };
}

function targetText(st){
  if (st.presetKey === 'armor_mainstat_pct') return `${st.mainStat}%`;
  if (st.presetKey === 'weapon_phys_pct') return '物理攻擊力%';
  if (st.presetKey === 'glove_crit_dmg') return '爆擊傷害%';
  if (st.presetKey === 'hat_cooldown') return '減少所有技能冷卻時間';
  return '（命中）';
}

function pickNonTarget(st){
  const pool = NON_TARGET_POOL[st.presetKey] || ['（非目標）'];
  return pool[Math.floor(Math.random()*pool.length)];
}

function sampleTier(){
  return (Math.random() < LINE_TIER.pL) ? '傳說' : '罕見';
}

const sim = {
  hits: [false,false,false],
  text: ['（尚未套用）','（尚未套用）','（尚未套用）'],
  tier: ['','', ''],
  cubes: 0,
  reset(){
    this.hits=[false,false,false];
    this.text=['（尚未套用）','（尚未套用）','（尚未套用）'];
    this.tier=['','',''];
    this.cubes=0;
  },
  hitCount(){ return this.hits.filter(Boolean).length; },
  rollLine(i, st){
    this.cubes++;
    const tier = sampleTier();
    this.tier[i] = `本次該排內部等級：${tier}`;
    // Determine hit by mixed probability p
    const isHit = (Math.random() < st.p);
    this.hits[i] = isHit;
    this.text[i] = isHit ? targetText(st) : pickNonTarget(st);
  },
  applyInit(st){
    for (let i=0;i<3;i++){
      const chk = $(`#initHit${i+1}`).checked;
      const sel = $(`#initSel${i+1}`);
      const val = sel ? String(sel.value || '').trim() : '';
      this.hits[i] = chk;
      this.text[i] = val || (chk ? targetText(st) : pickNonTarget(st));
      this.tier[i] = '';
    }
  }
};

function render(){
  const st = getState();

  $('#presetHint').textContent = st.preset.hint;
  $('#presetLabel').textContent = st.preset.label;

  // armor stat selector enable
  $('#mainStat').disabled = (st.presetKey !== 'armor_mainstat_pct');

  const hits = sim.hitCount();
  $('#counterCubes').textContent = sim.cubes.toLocaleString();
  $('#counterHits').textContent = `${hits}/3`;
  $('#counterCost').textContent = (sim.cubes * st.price).toLocaleString();

  for (let i=0;i<3;i++){
    const el = $(`#line${i+1}`);
    const hit = sim.hits[i];
    el.classList.toggle('good', hit);
    el.classList.toggle('bad', !hit);
    el.querySelector('.val').textContent = sim.text[i];
    $(`#tier${i+1}`).textContent = sim.tier[i];
  }

  // Estimate section
  const need = 3 - hits;
  const exp = analyticExpected(need, st.p);
  const mc = (need===0) ? {avg:0,p50:0,p90:0,p99:0} : monteCarlo(need, st.p, st.trials);
  const out = [];
  out.push(`每洗一行命中率（混合）：p = ${fmtPct(st.p)}  （罕見=${fmtPct(st.pU)} / 傳說=${fmtPct(st.pL)}）`);
  out.push(`目前命中：${hits}/3 → 還差 ${need} 行`);
  out.push('');
  out.push(`解析期望顆數：${Number.isFinite(exp) ? exp.toFixed(2) : 'Infinity'} 顆（估花費：${Number.isFinite(exp) ? Math.round(exp*st.price).toLocaleString() : 'Infinity'}）`);
  out.push(`Monte Carlo（${st.trials.toLocaleString()} 次）：平均 ${mc.avg.toFixed(2)} 顆 | P50=${mc.p50} | P90=${mc.p90} | P99=${mc.p99}`);
  $('#out').textContent = out.join('\n');

  $('#btnAuto').disabled = (hits===3 || st.p<=0);
  $('#btnRoll1').disabled = (st.p<=0);
  $('#btnRoll2').disabled = (st.p<=0);
  $('#btnRoll3').disabled = (st.p<=0);
}

function onRoll(i){
  const st = getState();
  sim.rollLine(i, st);
  render();
}

function autoUntilDone(){
  const st = getState();
  if (st.p <= 0) return;
  const max = Math.max(1, Math.floor(Number($('#autoMax').value || 200000)));
  let n = 0;
  while (sim.hitCount() < 3 && n < max){
    const idx = sim.hits.findIndex(x=>!x);
    sim.rollLine(idx < 0 ? 0 : idx, st);
    n++;
  }
  render();
}

function buildInitSelects(){
  const st = getState();
  const opts = [];
  opts.push({ v: '', t: '（自動/不指定）' });
  opts.push({ v: targetText(st), t: `【目標】${targetText(st)}` });
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
  $('#preset').addEventListener('change', ()=>{ sim.reset(); buildInitSelects(); render(); });
  $('#mainStat').addEventListener('change', ()=>{ buildInitSelects(); render(); });
  ['price','trials','pU','pL'].forEach(id=>$('#'+id).addEventListener('input', render));

  $('#btnApplyInit').addEventListener('click', ()=>{ sim.applyInit(getState()); render(); });
  $('#btnReset').addEventListener('click', ()=>{ sim.reset(); render(); });

  $('#btnRoll1').addEventListener('click', ()=>onRoll(0));
  $('#btnRoll2').addEventListener('click', ()=>onRoll(1));
  $('#btnRoll3').addEventListener('click', ()=>onRoll(2));
  $('#btnAuto').addEventListener('click', autoUntilDone);
}

bind();
buildInitSelects();
render();
