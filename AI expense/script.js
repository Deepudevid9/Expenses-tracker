
/* ============================================================
   E-tracker — Full Functional App
   ============================================================ */
'use strict';

/* ─── Config ─── */
const CAT_META = {
  food:          {l:'Food & Dining',   ic:'🍔', col:'#00f5ff'},
  transport:     {l:'Transport',       ic:'🚗', col:'#7c3aed'},
  shopping:      {l:'Shopping',        ic:'🛍️', col:'#f59e0b'},
  utilities:     {l:'Utilities',       ic:'⚡', col:'#10b981'},
  entertainment: {l:'Entertainment',   ic:'🎭', col:'#ec4899'},
  health:        {l:'Health',          ic:'💊', col:'#2563eb'},
  education:     {l:'Education',       ic:'📚', col:'#c084fc'},
  other:         {l:'Other',           ic:'📦', col:'#6b7280'},
};
const DEFAULT_BUDGETS = {food:12000,transport:5000,shopping:10000,utilities:8000,entertainment:3000,health:5000,education:3000,other:2000};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ─── State ─── */
let currentUser = null;
let allExpenses = [];
let userBudgets = {};
let mainCh=null, donutCh=null, barCh=null;
let selCat='', aiIdx=0;

/* ─── Storage Helpers ─── */
const LS = {
  get: k => { try{return JSON.parse(localStorage.getItem(k))}catch{return null} },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k),
};
const userKey = k => `nexus_${currentUser.email}_${k}`;
const getExpenses = () => LS.get(userKey('expenses')) || [];
const setExpenses = v => LS.set(userKey('expenses'), v);
const getBudgets  = () => LS.get(userKey('budgets')) || {...DEFAULT_BUDGETS};
const setBudgets  = v => LS.set(userKey('budgets'), v);

/* ─── Utility ─── */
const $ = id => document.getElementById(id);
const fmt = (n,sym) => (sym||currentUser?.currency||'₹') + Math.abs(n).toLocaleString('en-IN');
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => new Date().toISOString().slice(0,7);
function goto(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); }
window.goto = goto;

function toast(msg, type='success'){
  const t=$('toast'), ico=$('toast-ico'), txt=$('toast-txt');
  ico.textContent = type==='error'?'❌':type==='warn'?'⚠️':'✅';
  t.style.borderColor = type==='error'?'rgba(239,68,68,.3)':type==='warn'?'rgba(245,158,11,.3)':'rgba(16,185,129,.3)';
  txt.textContent=msg; t.classList.add('on');
  setTimeout(()=>t.classList.remove('on'), 3500);
}

/* ─── Auth ─── */

function switchTab(tab){
  $('tab-login').classList.toggle('active', tab==='login');
  $('tab-signup').classList.toggle('active', tab==='signup');
  $('login-form').classList.toggle('hidden', tab!=='login');
  $('signup-form').classList.toggle('hidden', tab!=='signup');
  $('login-err').classList.remove('show');
  $('signup-err').classList.remove('show');
}
window.switchTab = switchTab;

function handleSignup(){
  const name=$('s-name').value.trim();
  const email=$('s-email').value.trim().toLowerCase();
  const pass=$('s-pass').value;
  const income=parseFloat($('s-income').value)||0;
  const currency=$('s-currency').value;
  const err=$('signup-err');
  if(!name||!email||!pass){ err.textContent='Please fill all required fields.'; err.classList.add('show'); return; }
  if(pass.length<6){ err.textContent='Password must be at least 6 characters.'; err.classList.add('show'); return; }
  if(!/\S+@\S+\.\S+/.test(email)){ err.textContent='Please enter a valid email.'; err.classList.add('show'); return; }
  const users = LS.get('nexus_users')||{};
  if(users[email]){ err.textContent='An account with this email already exists.'; err.classList.add('show'); return; }
  const user={name,email,pass,income,currency,created:today()};
  users[email]=user;
  LS.set('nexus_users',users);
  // default budgets
  LS.set(`nexus_${email}_budgets`, {...DEFAULT_BUDGETS});
  LS.set(`nexus_${email}_expenses`, []);
  loginUser(user);
}
window.handleSignup = handleSignup;

function handleLogin(){
  const email=$('l-email').value.trim().toLowerCase();
  const pass=$('l-pass').value;
  const users = LS.get('nexus_users')||{};
  const user = users[email];
  if(!user||user.pass!==pass){ $('login-err').classList.add('show'); return; }
  loginUser(user);
}
window.handleLogin = handleLogin;

function loginUser(user){
  currentUser=user;
  LS.set('nexus_session', user.email);
  $('auth-overlay').style.opacity='0';
  $('auth-overlay').style.pointerEvents='none';
  setTimeout(()=>$('auth-overlay').style.display='none', 400);
  initApp();
}

function handleLogout(){
  LS.del('nexus_session');
  currentUser=null; allExpenses=[];
  destroyCharts();
  $('auth-overlay').style.display='flex';
  setTimeout(()=>{ $('auth-overlay').style.opacity='1'; $('auth-overlay').style.pointerEvents='all'; },10);
  $('l-email').value=''; $('l-pass').value='';
  switchTab('login');
}
window.handleLogout = handleLogout;

function checkSession(){
  const email = LS.get('nexus_session');
  if(!email) return false;
  const users = LS.get('nexus_users')||{};
  if(!users[email]) return false;
  currentUser=users[email];
  $('auth-overlay').style.display='none';
  return true;
}

/* ─── App Init ─── */
function initApp(){
  allExpenses = getExpenses();
  userBudgets = getBudgets();
  // Nav user
  const initials = currentUser.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  $('nav-avatar').textContent=initials;
  $('currency-sym').textContent=currentUser.currency||'₹';
  // AI welcome
  $('ai-welcome').textContent=`👋 Hello ${currentUser.name.split(' ')[0]}! I've analyzed your ${allExpenses.length} transactions. ${allExpenses.length===0?'Add your first expense to get started!':'Here\'s what I found…'}`;
  renderAll();
  generateAIInsights();
}

function renderAll(){
  renderHeroStats();
  renderKPIs();
  renderBudgetBars();
  renderTransactions();
  renderSavings();
  renderCategories();
  renderAlerts();
  rebuildCharts();
  updateHeroPills();
  updateAIInsights();
}

/* ─── Hero Stats ─── */
function renderHeroStats(){
  const exps = allExpenses;
  const total = exps.reduce((s,e)=>s+e.amount,0);
  const monthExps = exps.filter(e=>e.date.startsWith(thisMonth()));
  const monthTotal = monthExps.reduce((s,e)=>s+e.amount,0);
  $('hc1').textContent = exps.length;
  $('hc2').textContent = fmt(total);
  $('hc3').textContent = fmt(monthTotal);
  // card balance = income - spent
  const income = currentUser.income||0;
  const balance = income - total;
  $('card-balance').textContent = fmt(balance);
}

function updateHeroPills(){
  const income=currentUser.income||0;
  $('pill-income-label').textContent='Monthly Income';
  $('pill-income-val').textContent=(income?`+${fmt(income)} · This month`:'Set income in profile');
  const lastExp = allExpenses[0];
  $('pill-last-exp').textContent = lastExp ? `−${fmt(lastExp.amount)} · ${lastExp.desc}` : 'No expenses yet';
  // AI insight pill
  const monthExps = allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const monthSpent = monthExps.reduce((s,e)=>s+e.amount,0);
  const pct = income>0?Math.round((monthSpent/income)*100):0;
  $('pill-insight').textContent = income>0 ? `${pct}% of income spent` : 'Add income in settings';
  // score
  const score = calcAIScore();
  $('pill-score').textContent=`Score: ${score}/100`;
  $('pill-score-label').textContent='AI Score';
}

/* ─── KPIs ─── */
function renderKPIs(){
  const income=currentUser.income||0;
  const exps=allExpenses;
  const monthExps=exps.filter(e=>e.date.startsWith(thisMonth()));
  const monthSpent=monthExps.reduce((s,e)=>s+e.amount,0);
  const savings=Math.max(0,income-monthSpent);
  const balance=income-exps.reduce((s,e)=>s+e.amount,0);
  const score=calcAIScore();

  animCounter($('kv1'), balance, currentUser.currency||'₹');
  animCounter($('kv2'), monthSpent, currentUser.currency||'₹');
  animCounter($('kv3'), savings, currentUser.currency||'₹');
  $('kv4').textContent=score;

  const savPct = income>0?Math.round((savings/income)*100):0;
  $('kv1-ch').textContent = `Net balance (income − spent)`;
  $('kv1-ch').className='kpi-ch '+(balance>=0?'up':'dn');
  $('kv2-ch').textContent = `${monthExps.length} transactions this month`;
  $('kv3-ch').textContent = `${savPct}% of monthly income saved`;
  $('kv3-ch').className='kpi-ch '+(savPct>=20?'up':'dn');
  $('kv4-ch').textContent = score>=80?'Excellent spender':score>=60?'Good spender':score>=40?'Needs attention':'Review spending';

  // Score bar
  const bar=$('score-bar');
  if(bar) setTimeout(()=>{ bar.style.transition='width 1.5s var(--ease)'; bar.setAttribute('width',score*1.3); },300);

  // Sparklines
  setTimeout(()=>{
    const m=last6MonthsSpend();
    spark('sp1', m.map((v,i)=>Math.max(0,(currentUser.income||50000)*(i+1)-v), '#00f5ff'));
    spark('sp2', m, '#ef4444');
    const sv=m.map(v=>Math.max(0,(currentUser.income||50000)-v));
    spark('sp3', sv, '#10b981');
  },100);
}

/* ─── Budget Bars ─── */
function renderBudgetBars(){
  const now = new Date();
  $('budget-month').textContent=`${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const el=$('budget-items');
  const cats=Object.keys(CAT_META);
  el.innerHTML=cats.map(k=>{
    const meta=CAT_META[k];
    const spent=monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0);
    const budget=userBudgets[k]||DEFAULT_BUDGETS[k]||5000;
    const pct=Math.min((spent/budget)*100,100).toFixed(1);
    const over=spent>budget;
    return `<div class="bitem">
      <div class="bitem-row">
        <span class="bitem-name"><span class="bdot" style="background:${meta.col}"></span>${meta.l}</span>
        <span class="bitem-val">${fmt(spent)} / ${fmt(budget)}</span>
      </div>
      <div class="pbar"><div class="pfill" style="background:${meta.col}" data-w="${pct}"></div></div>
      ${over?`<span class="over">⚠️ Over budget by ${fmt(spent-budget)}</span>`:''}
    </div>`;
  }).join('');
  // animate fills
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('.pfill').forEach(f=>{ f.style.width=f.dataset.w+'%'; });
  }));
}

/* ─── Transactions ─── */
function renderTransactions(filter='', catFilter='', sortMode='date-desc'){
  const el=$('tx-list');
  if(!el) return;
  let exps=[...allExpenses];
  if(filter) exps=exps.filter(e=>e.desc.toLowerCase().includes(filter.toLowerCase())||e.category.includes(filter));
  if(catFilter) exps=exps.filter(e=>e.category===catFilter);
  // Sort
  if(sortMode==='date-desc') exps.sort((a,b)=>b.date.localeCompare(a.date));
  else if(sortMode==='date-asc') exps.sort((a,b)=>a.date.localeCompare(b.date));
  else if(sortMode==='amount-desc') exps.sort((a,b)=>b.amount-a.amount);
  else if(sortMode==='amount-asc') exps.sort((a,b)=>a.amount-b.amount);

  if(exps.length===0){
    el.innerHTML=`<div style="text-align:center;padding:2rem;color:var(--dimmed);font-size:.88rem">${filter||catFilter?'No matching transactions.':'No expenses yet. Add your first one!'}</div>`;
    return;
  }
  el.innerHTML=exps.slice(0,20).map(tx=>{
    const meta=CAT_META[tx.category]||CAT_META.other;
    return `<div class="tx" style="animation:fadeUp .3s var(--ease) both">
      <div class="tx-ic" style="background:${meta.col}1a;border:1px solid ${meta.col}33">${meta.ic}</div>
      <div class="tx-info">
        <div class="tx-nm">${tx.desc}</div>
        <div class="tx-dt">${meta.l} · ${tx.payMethod||'upi'} · ${tx.date}</div>
      </div>
      <div class="tx-am db">−${fmt(tx.amount)}</div>
      <div class="tx-actions">
        <button class="btn-tx" onclick="openEdit('${tx.id}')" title="Edit">✏️</button>
        <button class="btn-tx" onclick="deleteExpense('${tx.id}')" title="Delete">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function deleteExpense(id){
  if(!confirm('Delete this expense?')) return;
  allExpenses=allExpenses.filter(e=>e.id!==id);
  setExpenses(allExpenses);
  renderAll();
  toast('Expense deleted');
}
window.deleteExpense=deleteExpense;

function openEdit(id){
  const exp=allExpenses.find(e=>e.id===id);
  if(!exp) return;
  $('edit-id').value=id;
  $('edit-desc').value=exp.desc;
  $('edit-amt').value=exp.amount;
  $('edit-date').value=exp.date;
  $('edit-cat').value=exp.category;
  $('edit-modal').classList.add('show');
}
window.openEdit=openEdit;

function closeModal(){ $('edit-modal').classList.remove('show'); }
window.closeModal=closeModal;

function saveEdit(){
  const id=$('edit-id').value;
  const idx=allExpenses.findIndex(e=>e.id===id);
  if(idx===-1) return;
  allExpenses[idx]={...allExpenses[idx], desc:$('edit-desc').value.trim(), amount:parseFloat($('edit-amt').value)||allExpenses[idx].amount, date:$('edit-date').value, category:$('edit-cat').value };
  setExpenses(allExpenses);
  closeModal(); renderAll();
  toast('Expense updated!');
}
window.saveEdit=saveEdit;

/* ─── Savings ─── */
function renderSavings(){
  const el=$('sv-grid'); if(!el) return;
  const income=currentUser.income||0;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const monthSpent=monthExps.reduce((s,e)=>s+e.amount,0);
  const saved=Math.max(0,income-monthSpent);
  const totalSpent=allExpenses.reduce((s,e)=>s+e.amount,0);

  const goals=[
    {ic:'💰',nm:'Monthly Savings',cur:saved,tot:Math.max(income,saved+1),col:'linear-gradient(90deg,#00f5ff,#7c3aed)'},
    {ic:'📉',nm:'Budget Remaining',cur:Math.max(0,Object.values(userBudgets).reduce((s,v)=>s+v,0)-monthSpent),tot:Object.values(userBudgets).reduce((s,v)=>s+v,0),col:'linear-gradient(90deg,#7c3aed,#ec4899)'},
    {ic:'📊',nm:'Income Utilization',cur:monthSpent,tot:Math.max(income,monthSpent+1),col:'linear-gradient(90deg,#10b981,#00f5ff)'},
  ];
  el.innerHTML=goals.map(g=>{
    const pct=Math.min(100,Math.round((g.cur/g.tot)*100));
    return `<div class="sv-c">
      <div class="sv-icon">${g.ic}</div>
      <div class="sv-info">
        <div class="sv-nm">${g.nm}</div>
        <div class="sv-bar"><div class="sv-fill" style="background:${g.col}" data-w="${pct}"></div></div>
        <div class="sv-nums"><span>${fmt(g.cur)}</span><span>${fmt(g.tot)}</span></div>
      </div>
      <div class="sv-pct">${pct}%</div>
    </div>`;
  }).join('');
  // animate
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('.sv-fill').forEach(f=>{ f.style.width=f.dataset.w+'%'; });
  }));
}

/* ─── Categories ─── */
function renderCategories(){
  const el=$('cats-grid'); if(!el) return;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const maxSpend=Math.max(1,...Object.keys(CAT_META).map(k=>monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0)));
  el.innerHTML=Object.entries(CAT_META).map(([k,meta])=>{
    const spent=monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0);
    const pct=Math.round((spent/maxSpend)*100);
    const budget=userBudgets[k]||DEFAULT_BUDGETS[k];
    const budgetPct=Math.min(100,Math.round((spent/budget)*100));
    return `<div class="cat-c" style="--cc:${meta.col}22" onclick="filterByCategory('${k}')">
      <div class="cat-icon">${meta.ic}</div>
      <div class="cat-nm">${meta.l}</div>
      <div class="cat-am" style="color:${meta.col}">${fmt(spent)}</div>
      <div class="cat-pbar"><div class="cat-pfill" style="background:${meta.col}" data-w="${budgetPct}"></div></div>
      <div class="cat-pct">${budgetPct}% of budget</div>
    </div>`;
  }).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('.cat-pfill').forEach(f=>{ f.style.width=f.dataset.w+'%'; });
  }));
  // tilt
  el.querySelectorAll('.cat-c').forEach(c=>{
    c.addEventListener('mousemove',e=>{
      const r=c.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)/r.width*14;
      const y=(e.clientY-r.top-r.height/2)/r.height*14;
      c.style.transform=`perspective(600px) rotateY(${x}deg) rotateX(${-y}deg) translateY(-7px) scale(1.02)`;
    });
    c.addEventListener('mouseleave',()=>{ c.style.transform=''; });
  });
}

function filterByCategory(cat){
  goto('dashboard');
  setTimeout(()=>{
    $('tx-filter-cat').value=cat;
    renderTransactions($('tx-search').value, cat, $('tx-sort').value);
  },400);
}
window.filterByCategory=filterByCategory;

/* ─── Alerts ─── */
function renderAlerts(){
  const el=$('alerts-container'); if(!el) return;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const alerts=[];
  Object.entries(CAT_META).forEach(([k,meta])=>{
    const spent=monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0);
    const budget=userBudgets[k]||DEFAULT_BUDGETS[k];
    if(spent>budget) alerts.push({type:'danger',msg:`⚠️ ${meta.l} is over budget by ${fmt(spent-budget)}`});
    else if(spent/budget>0.85) alerts.push({type:'warn',msg:`⚡ ${meta.l} is at ${Math.round((spent/budget)*100)}% of budget`});
  });
  el.innerHTML=alerts.slice(0,3).map(a=>`<div class="notif-alert ${a.type}" style="margin-bottom:.75rem">${a.msg}</div>`).join('');
}

/* ─── Budget Save ─── */
function saveBudget(){
  const cat=$('budget-cat').value;
  const amt=parseFloat($('budget-amount').value);
  if(!amt||amt<=0){ toast('Please enter a valid budget amount','error'); return; }
  userBudgets[cat]=amt;
  setBudgets(userBudgets);
  $('budget-amount').value='';
  renderAll();
  toast(`Budget for ${CAT_META[cat].l} set to ${fmt(amt)}`);
}
window.saveBudget=saveBudget;

/* ─── Charts ─── */
Chart.defaults.color='#8899bb';
Chart.defaults.font.family="'DM Sans',sans-serif";

function destroyCharts(){
  [mainCh,donutCh,barCh].forEach(c=>{ try{c&&c.destroy()}catch{} });
  mainCh=donutCh=barCh=null;
}

function rebuildCharts(){
  destroyCharts();
  setTimeout(()=>{
    buildMainChart(); buildDonutChart(); buildBarChart();
    initChartTabs();
  },150);
}

function last6MonthsSpend(){
  const res=[];
  for(let i=5;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const key=d.toISOString().slice(0,7);
    res.push(allExpenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+e.amount,0));
  }
  return res;
}
function last12MonthsSpend(){
  const res=[];
  for(let i=11;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const key=d.toISOString().slice(0,7);
    res.push(allExpenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+e.amount,0));
  }
  return res;
}
function last12Labels(){
  const res=[];
  for(let i=11;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    res.push(MONTHS[d.getMonth()]);
  }
  return res;
}
function last7DaysSpend(){
  const res=[];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=d.toISOString().split('T')[0];
    res.push(allExpenses.filter(e=>e.date===key).reduce((s,e)=>s+e.amount,0));
  }
  return res;
}
function last7DaysLabels(){
  const res=[];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    res.push(DAYS[d.getDay()]);
  }
  return res;
}

function buildMainChart(){
  const mc=$('mainChart'); if(!mc) return;
  const ctx=mc.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,240);
  g.addColorStop(0,'rgba(0,245,255,0.28)'); g.addColorStop(1,'rgba(0,245,255,0)');
  mainCh=new Chart(mc,{
    type:'line',
    data:{labels:last12Labels(),datasets:[{data:last12MonthsSpend(),borderColor:'#00f5ff',borderWidth:2.5,backgroundColor:g,fill:true,tension:.44,pointRadius:0,pointHoverRadius:6,pointHoverBackgroundColor:'#00f5ff',pointHoverBorderColor:'#fff',pointHoverBorderWidth:2}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(8,12,26,.95)',borderColor:'rgba(0,245,255,.3)',borderWidth:1,padding:12,callbacks:{label:c=>(currentUser?.currency||'₹')+c.raw.toLocaleString('en-IN')}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false},ticks:{callback:v=>(v/1000).toFixed(0)+'K'}}}}
  });
}

function buildDonutChart(){
  const dc=$('donutChart'); if(!dc) return;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const cats=Object.keys(CAT_META);
  const data=cats.map(k=>monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0));
  const colors=cats.map(k=>CAT_META[k].col);
  donutCh=new Chart(dc,{
    type:'doughnut',
    data:{labels:cats.map(k=>CAT_META[k].l),datasets:[{data,backgroundColor:colors.map(c=>c+'bb'),borderColor:colors,borderWidth:1.5,hoverOffset:8}]},
    options:{responsive:true,cutout:'68%',plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(8,12,26,.95)',borderColor:'rgba(0,245,255,.3)',borderWidth:1,padding:10,callbacks:{label:c=>(currentUser?.currency||'₹')+c.raw.toLocaleString('en-IN')}}}}
  });
  const lg=$('dlegend');
  if(lg) lg.innerHTML=cats.map(k=>`<div class="dl-item"><div class="dl-dot" style="background:${CAT_META[k].col}"></div><span>${CAT_META[k].l.split(' ')[0]}</span></div>`).join('');
}

function buildBarChart(){
  const bc=$('barChart'); if(!bc) return;
  const ctx=bc.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,190);
  bg.addColorStop(0,'rgba(124,58,237,.8)'); bg.addColorStop(1,'rgba(0,245,255,.3)');
  barCh=new Chart(bc,{
    type:'bar',
    data:{labels:last7DaysLabels(),datasets:[{data:last7DaysSpend(),backgroundColor:bg,borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(8,12,26,.95)',borderColor:'rgba(124,58,237,.3)',borderWidth:1,padding:10,callbacks:{label:c=>(currentUser?.currency||'₹')+c.raw.toLocaleString('en-IN')}}},
      scales:{x:{grid:{display:false},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false},ticks:{callback:v=>(v/1000).toFixed(1)+'K'}}}}
  });
}

function initChartTabs(){
  document.querySelectorAll('.ctab').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.ctab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if(!mainCh) return;
      const p=btn.dataset.p;
      if(p==='weekly'){mainCh.data.labels=last7DaysLabels();mainCh.data.datasets[0].data=last7DaysSpend();}
      else{mainCh.data.labels=last12Labels();mainCh.data.datasets[0].data=last12MonthsSpend();}
      mainCh.update('active');
    };
  });
}

/* ─── AI Score ─── */
function calcAIScore(){
  const income=currentUser?.income||0;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const monthSpent=monthExps.reduce((s,e)=>s+e.amount,0);
  let score=70;
  if(income>0){
    const ratio=monthSpent/income;
    if(ratio<0.5) score=95; else if(ratio<0.7) score=80; else if(ratio<0.9) score=65; else score=45;
  }
  // penalise over-budget cats
  let overCount=0;
  Object.keys(CAT_META).forEach(k=>{
    const spent=monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0);
    if(spent>(userBudgets[k]||DEFAULT_BUDGETS[k])) overCount++;
  });
  score=Math.max(20, score - overCount*6);
  return Math.min(100,score);
}

/* ─── AI Insights ─── */
function generateAIInsights(){
  const income=currentUser?.income||0;
  const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
  const monthSpent=monthExps.reduce((s,e)=>s+e.amount,0);
  const savingsRate=income>0?Math.round(((income-monthSpent)/income)*100):0;
  // top cat
  let topCat='', topAmt=0;
  Object.keys(CAT_META).forEach(k=>{ const s=monthExps.filter(e=>e.category===k).reduce((a,e)=>a+e.amount,0); if(s>topAmt){topAmt=s;topCat=k;} });
  // over-budget cats
  const overBudget=Object.keys(CAT_META).filter(k=>monthExps.filter(e=>e.category===k).reduce((s,e)=>s+e.amount,0)>(userBudgets[k]||DEFAULT_BUDGETS[k]));

  // Analytics insights
  const ins1=income>0?`You've spent ${fmt(monthSpent)} this month — ${Math.round((monthSpent/income)*100)}% of your income. ${monthSpent<income*0.7?'Great control!':'Consider cutting back.'}`:monthExps.length?`${monthExps.length} expenses this month totalling ${fmt(monthSpent)}.`:'No expenses yet. Start tracking to see insights!';
  const ins2=topCat?`${CAT_META[topCat].l} is your top category at ${fmt(topAmt)} this month — ${Math.round((topAmt/Math.max(monthSpent,1))*100)}% of total spending.`:'Add expenses to see your top spending category.';
  const ins3=overBudget.length?`${overBudget.map(k=>CAT_META[k].l).join(', ')} ${overBudget.length===1?'is':'are'} over budget this month.`:'All categories within budget! Great discipline 🎯';

  $('ai-ins1').textContent=ins1;
  $('ai-ins2').textContent=ins2;
  $('ai-ins3').textContent=ins3;
  $('ai-ins3').style.color=overBudget.length?'var(--amber)':'var(--green)';

  // AI panel
  $('ins-tip').textContent=topCat?`Your top spend is ${CAT_META[topCat].l} at ${fmt(topAmt)}. Try setting a stricter budget to reduce it by 20%.`:`Add expenses to get personalized saving tips.`;
  $('ins-predict').textContent=income>0?`Based on current pace, you'll spend ${fmt(monthSpent*30/new Date().getDate())} this month.`:`Set your monthly income for spending predictions.`;
  $('ins-quick').textContent=overBudget.length?`${overBudget.map(k=>CAT_META[k].l).join(' & ')} exceeded budget. Review these categories immediately.`:`No budget overruns detected. Well done!`;
  $('ins-savings').textContent=income>0?`Savings rate: ${savingsRate}%. ${savingsRate>=20?'Excellent! You\'re on track for financial health.':savingsRate>=10?'Good start. Try to reach 20% savings rate.':'Below recommended 20% savings rate. Cut discretionary spend.'}`:`Set your monthly income to track savings rate.`;
}

function updateAIInsights(){ generateAIInsights(); }

/* ─── AI Chat ─── */
function initAIChat(){
  const input=$('ai-in'), send=$('ai-send'), msgs=$('msgs');

  const smartReplies = () => {
    const income=currentUser?.income||0;
    const monthExps=allExpenses.filter(e=>e.date.startsWith(thisMonth()));
    const monthSpent=monthExps.reduce((s,e)=>s+e.amount,0);
    const savings=Math.max(0,income-monthSpent);
    const score=calcAIScore();
    let topCat=''; let topAmt=0;
    Object.keys(CAT_META).forEach(k=>{ const s=monthExps.filter(e=>e.category===k).reduce((a,e)=>a+e.amount,0); if(s>topAmt){topAmt=s;topCat=k;} });
    return [
      `Your AI score is ${score}/100. ${score>=80?'You\'re an excellent spender!':score>=60?'You\'re doing well. Small cuts will improve your score.':'There are significant improvement opportunities.'}`,
      `This month you've spent ${fmt(monthSpent)} out of ${income?fmt(income):'your income'}. Savings so far: ${fmt(savings)}.`,
      topCat?`Your top spending category is ${CAT_META[topCat].l} at ${fmt(topAmt)}. ${topAmt>(userBudgets[topCat]||DEFAULT_BUDGETS[topCat])?'This is over budget!':'Within budget — good job!'}`:
      `You have no expenses this month yet. Add your first expense to get detailed insights!`,
      `Based on your spending pattern, I recommend allocating at least 20% of income to savings. ${income>0?`That's ${fmt(income*0.2)} for you.`:'Set your income to see the target.'}`,
      `You have ${allExpenses.length} total expenses tracked. ${allExpenses.length>10?'Great tracking habit!':'Keep adding expenses for better insights!'}`,
      `For ${new Date().toLocaleString('default',{month:'long'})}: Budget remaining across all categories: ${fmt(Math.max(0,Object.values(userBudgets).reduce((s,v)=>s+v,0)-monthSpent))}.`,
      `Tip: The 50/30/20 rule suggests 50% for needs, 30% for wants, 20% for savings. How does your spending compare?`,
    ];
  };

  function addMsg(txt,isUser){
    const div=document.createElement('div');
    div.className='msg '+(isUser?'usr':'bot');
    div.innerHTML=`<div class="bubble">${txt}</div><div class="msg-tm">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>`;
    div.style.opacity='0'; div.style.transform='translateY(10px)';
    msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
    requestAnimationFrame(()=>{ div.style.transition='all .35s var(--ease)'; div.style.opacity='1'; div.style.transform='none'; });
  }

  function sendMsg(){
    const v=input.value.trim(); if(!v) return;
    addMsg(v,true); input.value='';
    const t=document.createElement('div');
    t.className='msg bot'; t.id='typing';
    t.innerHTML='<div class="bubble" style="color:var(--muted)">NEXUS AI is thinking<span id="tdots">…</span></div>';
    msgs.appendChild(t); msgs.scrollTop=msgs.scrollHeight;
    let di=0;
    const iv=setInterval(()=>{ const el=$('tdots'); if(el) el.textContent=['.  ','.. ','...'][di%3]; di++; },400);
    setTimeout(()=>{
      clearInterval(iv); t.remove();
      const replies=smartReplies();
      addMsg(replies[aiIdx%replies.length],false); aiIdx++;
    },1000+Math.random()*600);
  }
  send.addEventListener('click',sendMsg);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') sendMsg(); });
}

/* ─── Add Expense Form ─── */
function initForm(){
  $('ed').value=today();
  const disp=$('csel-disp'), drop=$('csel-drop'), val=$('csel-val');
  disp.addEventListener('click',()=>{ disp.classList.toggle('open'); drop.classList.toggle('show'); });
  document.querySelectorAll('.csel-opt').forEach(o=>{
    o.addEventListener('click',()=>{
      selCat=o.dataset.v; val.textContent=o.textContent.trim(); val.style.color='var(--white)';
      drop.classList.remove('show'); disp.classList.remove('open');
      document.querySelectorAll('.csel-opt').forEach(x=>x.classList.remove('sel')); o.classList.add('sel');
      updatePV();
    });
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('#csel')){ drop.classList.remove('show'); disp.classList.remove('open'); } });

  ['ea','edesc','ed'].forEach(id=>{ $(id)?.addEventListener('input',updatePV); });

  function updatePV(){
    const a=$('ea').value, d=$('edesc').value, dt=$('ed').value;
    const sym=currentUser?.currency||'₹';
    $('pv-amt').textContent=a?`${sym}${parseFloat(a).toLocaleString('en-IN')}`:'— —';
    $('pv-cat').textContent=selCat?`Category: ${CAT_META[selCat]?.l||selCat}`:'Category: —';
    $('pv-desc').textContent=d||'Description: —';
    $('pv-date').textContent=dt?`Date: ${dt}`:'Date: —';
  }
  window.updatePV=updatePV;

  $('submit-btn').addEventListener('click',()=>{
    const a=parseFloat($('ea').value);
    const d=$('edesc').value.trim();
    if(!a||a<=0||!selCat||!d){
      const fc=document.querySelector('.ae-grid .gc');
      fc.classList.add('shaking'); setTimeout(()=>fc.classList.remove('shaking'),500);
      toast('Please fill amount, category and description','error'); return;
    }
    const btn=$('submit-btn'), sp=$('sub-spin'), tx=$('sub-txt');
    btn.disabled=true; sp.style.display='block'; tx.style.display='none';
    setTimeout(()=>{
      const newExp={
        id:'exp_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
        desc:d, amount:a, category:selCat,
        date:$('ed').value||today(),
        payMethod:document.querySelector('input[name="pm"]:checked')?.value||'upi',
        notes:$('enotes').value.trim(),
        createdAt:new Date().toISOString(),
      };
      allExpenses.unshift(newExp);
      setExpenses(allExpenses);
      btn.disabled=false; sp.style.display='none'; tx.style.display='block';
      $('ea').value=''; $('edesc').value=''; $('enotes').value='';
      selCat=''; val.textContent='Select Category'; val.style.color='';
      document.querySelectorAll('.csel-opt').forEach(x=>x.classList.remove('sel'));
      updatePV();
      renderAll();
      toast(`✅ ${d} — ${(a)} added!`);
    },900);
  });

  $('chal-btn').addEventListener('click',function(){
    this.textContent='✅ Challenge Accepted!';
    this.style.background='rgba(16,185,129,.15)';
    this.style.borderColor='rgba(16,185,129,.3)';
    this.style.color='#10b981';
    toast('🏆 No-Spend Friday challenge accepted!');
  });
}

/* ─── Particles ─── */
function initParticles(){
  const c=$('particles'); const ctx=c.getContext('2d');
  let W,H;
  const resize=()=>{ W=c.width=innerWidth; H=c.height=innerHeight; };
  resize(); addEventListener('resize',resize);
  const pts=Array.from({length:55},()=>({
    x:Math.random()*1920,y:Math.random()*1080,
    dx:(Math.random()-.5)*.22,dy:(Math.random()-.5)*.22,
    r:Math.random()*1.4+.3,
    col:['rgba(0,245,255,','rgba(124,58,237,','rgba(236,72,153,'][Math.floor(Math.random()*3)],
    op:Math.random()*.3+.08,
  }));
  let frame=0;
  function draw(){
    ctx.clearRect(0,0,W,H);
    if(frame%3===0){
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<130){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(0,245,255,${(1-d/130)*.06})`;ctx.lineWidth=.5;ctx.stroke();}
      }
    }
    frame++;
    pts.forEach(p=>{ p.x+=p.dx;p.y+=p.dy; if(p.x<0||p.x>W)p.dx*=-1; if(p.y<0||p.y>H)p.dy*=-1; ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col+p.op+')';ctx.fill(); });
    requestAnimationFrame(draw);
  }
  draw();
}

/* ─── Cursor ─── */
function initCursor(){
  const cur=$('cursor'), trail=$('cursor-trail');
  if(!cur||innerWidth<600) return;
  let tx=0,ty=0,cx=0,cy=0;
  document.addEventListener('mousemove',e=>{ tx=e.clientX;ty=e.clientY; cur.style.left=tx+'px';cur.style.top=ty+'px'; });
  (function animT(){ cx+=(tx-cx)*.12;cy+=(ty-cy)*.12; trail.style.left=cx+'px';trail.style.top=cy+'px'; requestAnimationFrame(animT); })();
  document.querySelectorAll('button,a,.gc,.cat-c,.kpi').forEach(el=>{
    el.addEventListener('mouseenter',()=>{ cur.style.width='20px';cur.style.height='20px'; trail.style.width='60px';trail.style.height='60px'; });
    el.addEventListener('mouseleave',()=>{ cur.style.width='12px';cur.style.height='12px'; trail.style.width='36px';trail.style.height='36px'; });
  });
}

/* ─── Navbar ─── */
function initNav(){
  const nav=$('nav'), burger=$('burger'), links=$('nav-links');
  addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>30));
  burger.addEventListener('click',()=>{ burger.classList.toggle('open'); links.classList.toggle('on'); });
  links.querySelectorAll('.nav-a').forEach(a=>a.addEventListener('click',()=>{ links.classList.remove('on'); burger.classList.remove('open'); }));
  const secs=['hero','dashboard','categories','analytics','add','ai'];
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){
      document.querySelectorAll('.nav-a').forEach(a=>a.classList.remove('active'));
      document.querySelector(`.nav-a[href="#${e.target.id}"]`)?.classList.add('active');
      document.querySelectorAll('.mn-item').forEach(i=>i.classList.remove('active'));
      document.querySelector(`.mn-item[data-s="${e.target.id}"]`)?.classList.add('active');
    }
  }),{threshold:.35});
  secs.forEach(id=>{ const el=document.getElementById(id); el&&io.observe(el); });
}

/* ─── Reveal ─── */
function initReveal(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting)e.target.classList.add('in'); }),{threshold:.1});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
}

/* ─── Hero Parallax ─── */
function initHeroParallax(){
  const card=$('card3d'), scene=$('hero-scene');
  if(!card||!scene) return;
  scene.addEventListener('mousemove',e=>{
    const r=scene.getBoundingClientRect();
    const dx=(e.clientX-r.left-r.width/2)/r.width*18;
    const dy=(e.clientY-r.top-r.height/2)/r.height*18;
    card.style.transform=`translate(-50%,-50%) rotateY(${dx}deg) rotateX(${-dy}deg)`;
  });
  scene.addEventListener('mouseleave',()=>{ card.style.transform=''; });
}

/* ─── Sparkline ─── */
function spark(id,data,col){
  const c=$(id); if(!c) return;
  const ctx=c.getContext('2d'),W=c.width,H=c.height;
  const mn=Math.min(...data),mx=Math.max(...data,1);
  const step=W/(data.length-1);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,col.replace('rgb','rgba').replace(')',',0.28)'));
  g.addColorStop(1,col.replace('rgb','rgba').replace(')',',0)'));
  ctx.clearRect(0,0,W,H);
  ctx.beginPath();
  data.forEach((d,i)=>{ const x=i*step,y=H-((d-mn)/(mx-mn||1))*(H-6)-3; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=g;ctx.fill();
}

/* ─── Counter ─── */
function animCounter(el,target,pre=''){
  if(!el) return;
  const s=Date.now(),dur=1200;
  function tick(){ const p=Math.min((Date.now()-s)/dur,1),e=1-Math.pow(1-p,3); el.textContent=pre+Math.floor(e*target).toLocaleString('en-IN'); if(p<1)requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
}

/* ─── Dashboard greeting ─── */
function updateGreeting(){
  const hour=new Date().getHours();
  const greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const name=currentUser?.name.split(' ')[0]||'';
  $('dash-greeting').textContent=`${greet}, ${name}! Here's your financial overview.`;
}

/* ─── Search & Filter ─── */
function initSearchFilter(){
  const search=$('tx-search'), cat=$('tx-filter-cat'), sort=$('tx-sort');
  function go(){ renderTransactions(search.value, cat.value, sort.value); }
  search?.addEventListener('input',go);
  cat?.addEventListener('change',go);
  sort?.addEventListener('change',go);
}

/* ─── Mobile nav ─── */
function initMobNav(){
  document.querySelectorAll('.mn-item').forEach(i=>{
    i.addEventListener('click',e=>{ e.preventDefault(); goto(i.dataset.s); });
  });
}

/* ─── Boot ─── */
function boot(){
  initParticles();
  initCursor();
  initNav();
  initReveal();
  initHeroParallax();
  initForm();
  initAIChat();
  initMobNav();
  initSearchFilter();

  if(checkSession()){
    initApp();
  }
}

document.addEventListener('DOMContentLoaded',boot);

// Close modal on backdrop click
$('edit-modal')?.addEventListener('click',e=>{ if(e.target===$('edit-modal')) closeModal(); });

// Keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeModal();
  if(e.altKey&&e.key==='a') goto('add');
  if(e.altKey&&e.key==='d') goto('dashboard');
});
