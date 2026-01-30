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

// Expected cubes under the correct rule:
// each cube randomly selects ONE line (1/3) to reroll; the rerolled line becomes hit with prob p else miss.
// This can decrease the number of hits if a good line is rerolled and turns bad.
function expectedCubesToFinish(p, k0){
  if (k0 >= 3) return 0;
  if (p <= 0) return Infinity;
  // Markov chain on k=0..3 (hits count), with 3 absorbing.
  // From k:
  // - pick bad line: prob (3-k)/3 -> k+1 with prob p, else k.
  // - pick good line: prob k/3 -> k-1 with prob (1-p), else k.
  // Solve linear equations for E0..E2.
  const E = [0,0,0,0];
  // We'll solve using simple algebra elimination (3 unknowns E0,E1,E2).
  // Write equations: E_k = 1 + a_k*(p*E_{k+1}+(1-p)*E_k) + b_k*(p*E_k+(1-p)*E_{k-1})
  // where a_k=(3-k)/3, b_k=k/3.
  const a0 = 1, b0 = 0; // k=0 => a=1, b=0
  const a1 = 2/3, b1 = 1/3;
  const a2 = 1/3, b2 = 2/3;

  // Convert to linear form: A*E = c
  // k=0: E0 = 1 + 1*(p*E1 + (1-p)*E0)
  // => E0 - (1-p)*E0 - p*E1 = 1 => p*E0 - p*E1 = 1
  // => E0 - E1 = 1/p
  // k=1: E1 = 1 + a1*(p*E2+(1-p)*E1) + b1*(p*E1 + (1-p)*E0)
  // k=2: E2 = 1 + a2*(p*E3+(1-p)*E2) + b2*(p*E2 + (1-p)*E1), with E3=0

  // We'll build matrix for [E0,E1,E2]
  const M = [
    [ 1, -1, 0 ],
    [ 0,  0, 0 ],
    [ 0,  0, 0 ],
  ];
  const C = [ 1/p, 0, 0 ];

  // k=1 expand:
  // E1 = 1 + a1*p*E2 + a1*(1-p)*E1 + b1*p*E1 + b1*(1-p)*E0
  // Bring to left:
  // E1 - a1*(1-p)*E1 - b1*p*E1 - a1*p*E2 - b1*(1-p)*E0 = 1
  // => [ -b1*(1-p) ]E0 + [ 1 - a1*(1-p) - b1*p ]E1 + [ -a1*p ]E2 = 1
  M[1][0] = -b1*(1-p);
  M[1][1] =  1 - a1*(1-p) - b1*p;
  M[1][2] = -a1*p;
  C[1] = 1;

  // k=2 expand:
  // E2 = 1 + a2*p*E3 + a2*(1-p)*E2 + b2*p*E2 + b2*(1-p)*E1
  // E3=0, so:
  // E2 - a2*(1-p)*E2 - b2*p*E2 - b2*(1-p)*E1 = 1
  // => 0*E0 + [ -b2*(1-p) ]E1 + [ 1 - a2*(1-p) - b2*p ]E2 = 1
  M[2][0] = 0;
  M[2][1] = -b2*(1-p);
  M[2][2] =  1 - a2*(1-p) - b2*p;
  C[2] = 1;

  // Solve 3x3 via Gaussian elimination
  const A = M.map(r=>r.slice());
  const b = C.slice();
  for (let i=0;i<3;i++){
    // pivot
    let piv=i;
    for (let r=i+1;r<3;r++) if (Math.abs(A[r][i])>Math.abs(A[piv][i])) piv=r;
    if (Math.abs(A[piv][i])<1e-12) return Infinity;
    if (piv!==i){ [A[i],A[piv]]=[A[piv],A[i]]; [b[i],b[piv]]=[b[piv],b[i]]; }
    const div=A[i][i];
    for (let c=i;c<3;c++) A[i][c]/=div;
    b[i]/=div;
    for (let r=0;r<3;r++){
      if (r===i) continue;
      const f=A[r][i];
      for (let c=i;c<3;c++) A[r][c]-=f*A[i][c];
      b[r]-=f*b[i];
    }
  }
  const [E0,E1,E2] = b;
  E[0]=E0;E[1]=E1;E[2]=E2;E[3]=0;
  return E[k0];
}

function simulateCubesToFinish(p, k0, trials){
  const arr = new Array(trials);
  for (let t=0;t<trials;t++){
    let hits=k0;
    const line = [false,false,false];
    // initialize with k0 hits (random positions)
    for (let i=0;i<k0;i++) line[i]=true;
    // shuffle
    for (let i=2;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [line[i],line[j]]=[line[j],line[i]]; }

    let cubes=0;
    // Safety cap to prevent pathological hangs
    const CAP = 2_000_000;
    while (hits<3 && cubes < CAP){
      cubes++;
      const idx=Math.floor(Math.random()*3);
      const was=line[idx];
      const now=(Math.random()<p);
      line[idx]=now;
      if (was && !now) hits--;
      else if (!was && now) hits++;
    }
    arr[t]=cubes;
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
  tier: ['','',''],
  cubes: 0,
  lastPicked: null,
  reset(){
    this.hits=[false,false,false];
    this.text=['（尚未套用）','（尚未套用）','（尚未套用）'];
    this.tier=['','',''];
    this.cubes=0;
    this.lastPicked=null;
  },
  hitCount(){ return this.hits.filter(Boolean).length; },
  useOnce(st){
    // Game rule: randomly pick ONE line (1/3) to reroll.
    const i = Math.floor(Math.random()*3);
    this.lastPicked = i;
    this.cubes++;
    const tier = sampleTier();
    this.tier[i] = `本次選中：第 ${i+1} 排｜內部等級：${tier}`;

    const isHit = (Math.random() < st.p);
    this.hits[i] = isHit;
    this.text[i] = isHit ? targetText(st) : pickNonTarget(st);
    return i;
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
    this.lastPicked = null;
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

  // Picked line info
  const pickedInfo = $('#pickedInfo');
  if (pickedInfo) {
    pickedInfo.textContent = (sim.lastPicked == null) ? '' : `本次選中：第 ${sim.lastPicked + 1} 排`;
  }

  // Estimate section (correct rule: each cube randomly selects ONE line; hits can be lost)
  const out = [];
  out.push(`單顆：隨機選 1 排（1/3）重洗；命中的排數可能因為被選中而掉回去。`);
  out.push(`重洗後命中率（混合）：p = ${fmtPct(st.p)}  （罕見=${fmtPct(st.pU)} / 傳說=${fmtPct(st.pL)}）`);
  out.push(`目前命中：${hits}/3`);

  const exp = expectedCubesToFinish(st.p, hits);
  // Monte Carlo can be expensive under the 1/3-reroll rule. Keep it bounded to avoid freezing the page.
  const trials = Math.min(st.trials, 8000);
  const mc = simulateCubesToFinish(st.p, hits, trials);
  out.push('');
  out.push(`解析期望顆數：${Number.isFinite(exp) ? exp.toFixed(2) : 'Infinity'} 顆（估花費：${Number.isFinite(exp) ? Math.round(exp*st.price).toLocaleString() : 'Infinity'}）`);
  out.push(`Monte Carlo（${trials.toLocaleString()} 次）：平均 ${mc.avg.toFixed(2)} 顆 | P50=${mc.p50} | P90=${mc.p90} | P99=${mc.p99}`);
  $('#out').textContent = out.join('\n');

  $('#btnAuto').disabled = (hits===3 || st.p<=0);
  $('#btnUseOnce') && ($('#btnUseOnce').disabled = (hits===3 || st.p<=0));
}

function autoUntilDone(){
  const st = getState();
  if (st.p <= 0) return;
  const max = Math.max(1, Math.floor(Number($('#autoMax').value || 200000)));
  let n = 0;
  while (sim.hitCount() < 3 && n < max){
    sim.useOnce(st);
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
  $('#btnReset2')?.addEventListener('click', ()=>{ sim.reset(); render(); });

  $('#btnUseOnce')?.addEventListener('click', ()=>{ sim.useOnce(getState()); render(); });
  $('#btnAuto').addEventListener('click', autoUntilDone);
}

bind();
buildInitSelects();
render();
