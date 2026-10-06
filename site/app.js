import {selectProblems,statusOf,collectSubmissions,ratingColor} from './core.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{$('accountStatus').textContent='浏览器无法保存本地记录；本次操作仍有效。'}};
let problems=[],category='all',page=1,descending=true,remote={},busy=false,currentHandle=read('dcf.handle','');
const manual={};
const size=50;
$('handle').value=currentHandle;
function loadCache(){const cached=read('dcf.cache.'+currentHandle.toLowerCase(),null);remote=cached?.statuses||{};if(cached)$('accountStatus').textContent=`${currentHandle} · 缓存于 ${new Date(cached.at).toLocaleString('zh-CN')}，可重新同步`;}
loadCache();
function render(){
 const filters=Object.fromEntries(['query','start','end','min','max','completion'].map(id=>[id,$(id).value]));filters.category=category;
 let matched=selectProblems(problems,filters,remote,manual).sort((a,b)=>(descending?-1:1)*a.date.localeCompare(b.date));
 const count=new Set(matched.map(p=>p.key)).size,solved=new Set(matched.filter(p=>statusOf(p,remote,manual)==='solved').map(p=>p.key)).size;
 const groups=new Map();
 for(const p of matched){if(!groups.has(p.date))groups.set(p.date,[]);groups.get(p.date).push(p);}
 const allDays=new Map();
 for(const p of problems){if(!allDays.has(p.date))allDays.set(p.date,[]);allDays.get(p.date).push(p);}
 const days=[...groups.entries()];
 const pages=Math.max(1,Math.ceil(days.length/size));page=Math.max(1,Math.min(page,pages));
 $('summary').textContent=`${days.length} 天 · ${matched.length} 条每日记录 · ${count} 道题 · 已完成 ${solved} 道`;
 if(filters.start&&filters.end&&filters.start>filters.end)$('summary').textContent='开始日期不能晚于结束日期';
 $('page').textContent=`${page} / ${pages}`;$('prev').disabled=page===1;$('next').disabled=page===pages;
 function cell(p){
 if(!p)return '<td class="problemcell emptycell">—</td>';
 const state=statusOf(p,remote,manual),color=ratingColor(p.rating);
 return `<td class="problemcell ${state==='solved'?'complete':''}"><div class="problem"><span class="dot" style="border-color:${color};${state==='solved'?'background:'+color:''}"></span><a style="color:${color}" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.id)}${p.name?' · '+esc(p.name):''}</a></div><div class="cellmeta">${p.divisions.map(d=>`<span class="badge" title="${esc(p.contestName||'')}">${{div1:'Div. 1',div2:'Div. 2',gym:'Gym',other:'其他 / 未分类'}[d]}</span>`).join('')}<span class="rating" style="color:${color}">${p.estimated?'*':''}${p.rating??'—'}</span></div>${$('hints').checked&&p.hint?`<div class="hint">${esc(p.hint)}</div>`:''}<div class="cellactions">${p.editorial?`<a href="${esc(p.editorial)}" target="_blank" rel="noopener">题解 ↗</a>`:`<a href="${esc(p.source)}" target="_blank" rel="noopener">原文 ↗</a>`}</div></td>`;
 }
 $('rows').innerHTML=days.slice((page-1)*size,page*size).map(([date,list])=>{
 list.sort((a,b)=>(a.rating??0)-(b.rating??0)||a.id.localeCompare(b.id));
 return `<tr><td class="datecell ${allDays.get(date).every(p=>statusOf(p,remote,manual)==='solved')?'complete':''}"><a href="${esc(list[0].source)}" target="_blank" rel="noopener">${date}</a></td>${cell(list[0])}${cell(list[1])}</tr>`;
 }).join('')||'<tr><td colspan="3" class="empty">没有匹配的题目。试试其他题号或筛选条件。</td></tr>';

}
for(const id of ['query','start','end','min','max','completion','hints'])$(id).addEventListener('input',()=>{page=1;render()});
document.querySelector('.tabs').addEventListener('click',e=>{if(!e.target.dataset.category)return;category=e.target.dataset.category;document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',b.dataset.category===category)});page=1;render()});
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};$('sort').onclick=()=>{descending=!descending;$('sort').textContent=`日期 ${descending?'↓':'↑'}`;render()};
$('reset').onclick=()=>{for(const id of ['query','start','end','min','max'])$(id).value='';$('completion').value='all';category='all';document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.category==='all');b.setAttribute('aria-pressed',b.dataset.category==='all')});page=1;render()};
$('clear').onclick=()=>{if(busy)return;currentHandle='';$('handle').value='';remote={};save('dcf.handle','');$('accountStatus').textContent='输入 ID，查看公开提交记录';render()};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchPage(handle,from){
 for(let attempt=0;attempt<3;attempt++){
 try{const response=await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=1000`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();if(data.status!=='OK')throw Error(data.comment||'API 返回失败');return data.result;}
 catch(e){if(attempt===2||/not found|invalid handle/i.test(e.message))throw e;await delay(2200*(attempt+1));}
 }
}
$('accountForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const handle=$('handle').value.trim();if(!/^[a-zA-Z0-9_.-]{1,40}$/.test(handle)){$('accountStatus').textContent='请输入有效的 Codeforces ID';return;}
 busy=true;$('sync').disabled=true;$('clear').disabled=true;$('handle').disabled=true;$('accountStatus').classList.remove('error');
 const statuses={};let from=1;
 try{
 while(true){$('accountStatus').textContent=`正在同步 ${handle} · 已读取 ${from-1} 条提交…`;const batch=await fetchPage(handle,from);collectSubmissions(batch,statuses);if(batch.length<1000)break;from+=batch.length;await delay(2200);}
 currentHandle=handle;remote=statuses;save('dcf.handle',handle);save('dcf.cache.'+handle.toLowerCase(),{statuses,at:Date.now()});$('accountStatus').textContent=`${handle} · 同步完成 · ${Object.values(statuses).filter(s=>s==='solved').length} 道公开 AC 题目`;render();
 }catch(e){$('accountStatus').textContent=`同步失败：${e.message}。现有状态已保留，可稍后重试。`;$('accountStatus').classList.add('error');}
 finally{busy=false;$('sync').disabled=false;$('clear').disabled=false;$('handle').disabled=false;}
});
try{const response=await fetch('./data/problems.json');if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();problems=data.problems;$('update').textContent=`题库更新 ${new Date(data.generatedAt).toLocaleString('zh-CN')} · ${data.days} 天`;render();}catch(e){$('summary').textContent=`题库加载失败：${e.message}，请刷新重试`;$('summary').classList.add('error');}
