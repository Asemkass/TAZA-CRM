const STATUS_META = {
  new_call: {label:'Новый звонок', color:'var(--status-new)'},
  pickup:   {label:'Забор ковров', color:'var(--status-pickup)'},
  wash:     {label:'Стирка',       color:'var(--status-wash)'},
  delivery: {label:'Доставка',     color:'var(--status-delivery)'},
  closed:   {label:'Закрыто',      color:'var(--status-closed)'}
};

async function api(path, opts={}) {
  const res = await fetch(path, {
    headers: {'Content-Type':'application/json'},
    ...opts
  });
  if (res.status === 401) {
    window.location.href = '/index.html';
    throw new Error('Не авторизован');
  }
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmtMoney(n){
  if(n===undefined||n===null||n==='') return '—';
  return Number(n).toLocaleString('ru-RU') + ' ₸';
}
function fmtDate(d){
  if(!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}
function showToast(msg){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}
async function logout(){
  await fetch('/api/auth/logout', {method:'POST'});
  window.location.href = '/index.html';
}
async function whoAmI(){
  try{ return await api('/api/auth/me'); }
  catch(e){ window.location.href = '/index.html'; return null; }
}
