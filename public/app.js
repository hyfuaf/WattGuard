const app=document.querySelector('#app');
const modal=document.querySelector('#modal');
const toastEl=document.querySelector('#toast');
const state={user:null,data:null,reports:[],history:[],detail:null,categories:[],filter:'all',search:'',authMode:'login',stream:null,report:null,days:7};
let toastTimer,refreshTimer,refreshBusy=false;
const e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=(value,digits=3)=>value===null||value===undefined?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:digits});
const date=(value,full=false)=>new Intl.DateTimeFormat('zh-CN',{timeZone:state.user?.timezone||'Asia/Hong_Kong',month:'2-digit',day:'2-digit',...(full?{year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}:{})}).format(new Date(value));
const key=time=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:state.user?.timezone||'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const route=()=>location.hash.slice(1)||'overview';
const navigate=target=>{if(route()===target)render();else location.hash=target;};
const link=(target,label,primary=false)=>`<a class="button${primary?' primary':''}" href="#${target}">${e(label)}</a>`;
const badge=(text,warn=false)=>`<span class="badge${warn?' warn':''}">${e(text)}</span>`;
const btn=(action,label,attrs='',primary=false)=>`<button class="button${primary?' primary':''}" type="button" data-action="${action}" ${attrs}>${e(label)}</button>`;
const section=(title,body,extra='')=>`<section class="section"><div class="section-head"><h2>${e(title)}</h2>${extra}</div>${body}</section>`;
const metric=(label,value,unit,note)=>`<div class="metric"><span>${e(label)}</span><strong>${e(value)}<small>${e(unit)}</small></strong><p>${e(note)}</p></div>`;
const field=(label,input,hint='')=>`<label class="field"><span>${e(label)}</span>${input}${hint?`<small>${e(hint)}</small>`:''}</label>`;
const table=(heads,rows)=>`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const empty=(title,text,action='')=>`<div class="empty"><span class="empty-symbol">ϟ</span><h2>${e(title)}</h2><p>${e(text)}</p>${action}</div>`;
const formError='<p class="form-error" role="alert" hidden></p>';
const typeSelect=(selected='暂不确定')=>`<select name="type">${state.categories.map(t=>`<option${t===selected?' selected':''}>${e(t)}</option>`).join('')}</select>`;
const input=(name,value='',placeholder='',extra='')=>`<input name="${name}" value="${e(value)}" placeholder="${e(placeholder)}" ${extra}>`;

async function api(path,options={}) {
  const response=await fetch(path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined});
  const result=await response.json();
  if(!response.ok){const err=new Error(result.error||'请求失败');err.status=response.status;throw err;}
  return result;
}
function toast(message){clearTimeout(toastTimer);toastEl.textContent=message;toastEl.hidden=false;toastTimer=setTimeout(()=>toastEl.hidden=true,5000);}
function closeModal(){modal.close();modal.replaceChildren();}
function showModal(html){modal.innerHTML=`<div class="modal-head"><h2>家庭用电</h2>${btn('close','关闭')}</div>${html}`;modal.showModal();}
function setError(form,message){const el=form.querySelector('.form-error');el.textContent=message;el.hidden=false;}
async function load(){const [data,reports,history]=await Promise.all([api(`/api/dashboard?days=${state.days}`),api('/api/reports'),api('/api/devices/history')]);state.data=data;state.reports=reports.reports;state.history=history.devices;}
async function refresh(renderNow=true){
  if(refreshBusy||!state.user)return;
  refreshBusy=true;
  try{await load();if(renderNow)render();}
  catch(err){if(err.status===401){state.user=null;state.stream?.close();render();}else toast(err.message);}
  finally{refreshBusy=false;}
}
function connectEvents(){
  state.stream?.close();
  if(location.hostname.endsWith('.workers.dev')) return;
  const stream=new EventSource('/api/events');state.stream=stream;
  stream.addEventListener('connected',()=>{document.querySelector('#connection')?.replaceChildren(document.createTextNode('服务已连接'));});
  stream.onerror=()=>{document.querySelector('#connection')?.replaceChildren(document.createTextNode('连接恢复中'));};
  stream.addEventListener('update',()=>{
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>refresh(!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)&&!modal.open&&!['add','settings'].includes(route())),200);
  });
}

function authView(){
  const register=state.authMode==='register';
  app.innerHTML=`<main class="auth-page"><a class="brand" href="#overview"><span class="brand-icon">ϟ</span><strong>家庭用电</strong></a><div class="auth-layout"><div><span class="eyebrow">HOME ENERGY</span><h1>看见每一台家电的用电</h1><p class="muted">智能插座连接你的家庭。</p><img class="auth-plug" src="/plug-concept.svg" alt="卡扣式智能插座结构概念"></div><form class="form-panel" data-form="auth"><h2>${register?'创建家庭账户':'登录家庭用电'}</h2>${register?field('家庭名称',input('name','','例如：我的家庭','required maxlength="40" autocomplete="organization"')):''}${field('邮箱',input('email','','name@example.com','type="email" required maxlength="160" autocomplete="username"'))}${field('密码',input('password','','至少 8 个字符',`type="password" required minlength="8" maxlength="128" autocomplete="${register?'new-password':'current-password'}"`))}${formError}<div class="form-actions"><button class="button primary" type="submit">${register?'创建账户':'登录'}</button>${btn('auth-mode',register?'已有账户，登录':'创建新账户')}</div><p class="footnote">账户和用电记录保存在服务端数据库中。</p></form></div></main>`;
}
const nav=[['overview','用电总览'],['devices','插座与家电'],['reports','用电报告'],['advice','节电建议'],['alerts','设备状态'],['integration','设备接入'],['settings','家庭与设置']];
function shell(title,subtitle,content){
  const current=route().split('/')[0];
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="#overview"><span class="brand-icon">ϟ</span><div><strong>家庭用电</strong><small>HOME ENERGY</small></div></a><div class="home-label"><small>当前家庭</small><strong>${e(state.user.name)}</strong></div><nav aria-label="主导航">${nav.map(([id,label],i)=>`<a href="#${id}" class="${(current===id||current==='device'&&id==='devices'||current==='add'&&id==='devices'||current==='report'&&id==='reports'||current==='comparison'&&id==='reports')?'active':''}"><span>0${i+1}</span>${label}</a>`).join('')}</nav><div class="sidebar-footer"><span id="connection">${location.hostname.endsWith('.workers.dev')?'每30秒同步':'服务已连接'}</span>${btn('logout','退出登录')}</div></aside><div class="workspace"><header class="topbar"><span>${e(state.user.name)} / ${e(title)}</span>${btn('logout','退出登录')}<a href="#settings"><span class="avatar">家</span>${e(state.user.name)}</a></header><main><div class="page-head"><h1>${e(title)}</h1><p>${e(subtitle)}</p></div>${content}<footer class="page-footer"><span>仅统计已接入的家电 · 费用按家庭电价估算</span><span>最近刷新 ${date(Date.now(),true)}</span></footer></main></div></div>`;
}
function dailyChart(data){
  const keys=[];
  for(let t=data.from;t<=data.to;t+=86400000)keys.push(key(t));
  if(keys.at(-1)!==key(data.to))keys.push(key(data.to));
  const max=Math.max(.001,...Object.values(data.daily));
  return `<div class="bar-chart">${keys.map(k=>`<div class="bar-col"><span>${data.daily[k]===undefined?'—':number(data.daily[k])}</span><div class="bar-track"><div class="bar" style="height:${(data.daily[k]||0)/max*100}%"></div></div><small>${k.slice(5).replace('-','/')}</small></div>`).join('')}</div>`;
}
function rankings(data){
  const list=[...data.devices].sort((a,b)=>(b.energy||0)-(a.energy||0));
  const max=Math.max(.001,...list.map(d=>d.energy||0));
  return list.map(d=>`<div class="rank"><a href="#device/${d.id}">${e(d.alias)}</a><div class="rank-track"><i style="width:${(d.energy||0)/max*100}%"></i></div><strong>${number(d.energy)} <small>kWh</small></strong></div>`).join('');
}
function status(d){return d.ended?badge('历史绑定'):!d.last?badge('等待上传',true):d.online?badge(d.last.power<=40?'在线 · 低功率':'在线'):badge('离线',true);}
function deviceTable(list){return table(['家电 / 房间','插座 ID','连接状态','当前功率','周期用电','数据更新时间'],list.map(d=>[`<a href="#device/${d.id}">${e(d.alias)}</a><small class="subtext">${e(d.type)} · ${e(d.room)}</small>`,`<code>${e(d.plug_id)}</code>`,status(d),d.online?`${number(d.last.power,1)} W`:'—',`${number(d.energy)} kWh`,d.last?date(d.last.timestamp,true):'尚无数据']));}
function overview(){
  const s=state.data;
  if(!s.activeCount && !s.devices.length)return empty('从第一台家电开始','绑定智能插座，设置电器类型和别名。',link('add','添加智能插座',true));
  return `<div class="toolbar"><div class="tabs">${[1,7,30].map(d=>`<a href="#overview" data-period="${d}" class="${d===state.days?'selected':''}">近 ${d} 天</a>`).join('')}</div><span class="muted">${date(s.from)} — ${date(s.to)}</span>${link('add','添加插座',true)}</div><div class="metrics">${metric('当前总功率',number(s.power,1),'W',`${s.online} / ${s.activeCount} 个插座在线`)}${metric('今日已记录',number(s.today),'kWh','按家庭时区统计')}${metric('周期已记录',number(s.energy),'kWh',`采样覆盖率 ${number(s.coverage*100,1)}%`)}${metric('周期费用估算',s.energy===null?'—':number(s.energy*state.user.price,2),'元',`电价 ${state.user.price} 元 / kWh`)}</div>${s.energy===null?`<div class="notice"><div><strong>等待连续读数</strong><p>暂无可计算的电量，已有功率读数会实时显示。</p></div>${link('integration','设备接入')}</div>`:''}<div class="split">${section('每日已记录用电',dailyChart(s),badge('kWh'))}${section('家电用电分布',rankings(s))}</div>${section('家电实时状态',deviceTable(s.devices))}<p class="footnote">“—”表示数据不足。功率积分跳过超过 5 分钟的采样空档；硬件累计电量可用于补齐断线期间电量。</p>`;
}
function devicesView(){
  const active=state.data.devices.filter(d=>!d.ended);
  const rooms=[...new Set(active.map(d=>d.room))];
  const filtered=active.filter(d=>(state.filter==='all'||d.room===state.filter)&&[d.alias,d.plug_id,d.type].join(' ').toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="toolbar"><input class="search" id="device-search" type="search" aria-label="搜索家电" placeholder="搜索别名、ID 或类型" value="${e(state.search)}"><label class="compact-field">房间 <select id="room-filter"><option value="all">全部房间</option>${rooms.map(r=>`<option${r===state.filter?' selected':''}>${e(r)}</option>`).join('')}</select></label>${link('add','添加插座',true)}</div><div id="device-results">${filtered.length?deviceTable(filtered):empty(active.length?'没有匹配的家电':'还没有绑定家电',active.length?'调整搜索或房间条件。':'添加第一个插座开始记录。',link('add','添加插座',true))}</div>${state.history.length?section('历史绑定',table(['家电','插座 ID','解绑时间','记录'],state.history.map(d=>[`<a href="#device/${d.id}">${e(d.alias)}</a>`,e(d.plug_id),date(d.ended,true),`<a href="/api/devices/${d.id}/export">下载全部读数 CSV</a>`]))):''}`;
}
function addView(){
  return `<div class="binding-layout"><form class="form-panel" data-form="bind"><h2>绑定插座与家电</h2>${field('插座 ID',input('deviceId','','例如：SP-00134','required pattern="[A-Za-z0-9_-]{3,48}" maxlength="48"'),'与硬件机身的唯一 ID 一致。')}${field('电器类型',typeSelect())}${field('电器别名',input('alias','','例如：客厅空调','required maxlength="40"'))}${field('所在房间',input('room','','例如：客厅','required maxlength="40"'))}${field('规格 / 型号（可选）',input('spec','','例如：1.5 匹 / 型号','maxlength="120"'),'同类基准按类型与规格匹配。')}${formError}<div class="form-actions">${link('devices','取消')}<button class="button primary" type="submit">绑定并生成上传密钥</button></div></form><aside class="binding-aside"><img src="/plug-concept.svg" alt="智能插座卡扣结构概念"><h3>设备独立认证</h3><p>绑定完成后取得该插座的上传密钥。密钥只展示一次，后续可重新生成并撤销旧密钥。</p><p class="muted">没有功率记录时，无法自动推测类型。先由你选择，积累读数后可在详情页请求 AI 识别。</p></aside></div>`;
}
function curve(d){
  if(!d.samples.length)return empty('尚无功率记录','设备上传后，功率曲线会自动更新。',link('integration','查看设备接入'));
  const samples=d.samples,max=Math.max(1,...samples.map(x=>x.power)),start=samples[0].timestamp,end=samples.at(-1).timestamp;
  const pts=samples.map(x=>`${30+(x.timestamp-start)/Math.max(1,end-start)*690},${170-x.power/max*140}`).join(' ');
  return `<div class="curve"><svg viewBox="0 0 750 205" role="img" aria-label="${e(d.alias)}实际功率变化"><path d="M30 30H720M30 100H720M30 170H720" stroke="#dce4df" fill="none"/><polyline points="${pts}" stroke="#146b53" stroke-width="2.5" fill="none"/>${samples.length===1?`<circle cx="30" cy="${170-samples[0].power/max*140}" r="4" fill="#146b53"/>`:''}<text x="30" y="20">${e(number(max,1))} W</text><text x="30" y="195">${e(date(start,true))}</text><text x="720" y="195" text-anchor="end">${e(date(end,true))}</text></svg></div>`;
}
function deviceView(id){
  const d=state.data.devices.find(x=>x.id===Number(id))||(state.detail?.id===Number(id)?state.detail:null);
  if(!d)return empty('当前周期找不到这台家电','选择更长的统计周期或返回设备列表。',link('devices','返回列表'));
  return `<div class="toolbar"><code>${e(d.plug_id)}</code>${status(d)}${d.ended?'':btn('token','重新生成密钥',`data-id="${d.id}"`)}<a class="button" href="/api/devices/${d.id}/export">下载读数 CSV</a></div><div class="metrics">${metric('当前功率',d.online?number(d.last.power,1):'—','W',d.last?`最新 ${date(d.last.timestamp,true)}`:'等待首次上传')}${metric('周期用电',number(d.energy),'kWh',`${state.days} 天内的有效记录`)}${metric('采样覆盖率',number(d.coverage*100,1),'%',`${d.sampleCount} 条采样`)}${metric('估算费用',d.energy===null?'—':number(d.energy*state.user.price,2),'元','不等同于电费账单')}</div>${section('功率变化',curve(d))}<div class="split">${section('用电计算依据',`<dl><dt>累计计量部分</dt><dd>${number(d.counterEnergy)} kWh</dd><dt>功率积分部分</dt><dd>${number(d.calculatedEnergy)} kWh</dd><dt>同类对比</dt><dd>${e(d.comparisonReason||'已有匹配基准')}</dd></dl>${link('comparison','查看同类基准')}`)}${section('AI 电器识别',`<p>功率特征只能辅助推测，所属电器由你确认。</p>${btn('identify','分析电器候选类型',`data-id="${d.id}"`,true)}${!state.data.aiConfigured?'<p class="footnote">尚未配置 AI 服务。</p>':''}`)}</div>${d.ended?'':section('电器信息',`<form data-form="edit" data-id="${d.id}" class="inline-form">${field('别名',input('alias',d.alias,'','required maxlength="40"'))}${field('类型',typeSelect(d.type))}${field('房间',input('room',d.room,'','required maxlength="40"'))}${field('规格',input('spec',d.spec,'','maxlength="120"'))}${formError}<button class="button primary" type="submit">保存信息</button></form>`)}${!d.ended?section('更换电器 / 解绑',`<p class="muted">解绑会立即撤销上传密钥，并保留历史用电记录。更换电器时，解绑后使用相同插座 ID 建立新绑定。</p>${btn('unbind-confirm','解绑插座',`data-id="${d.id}"`)}`):''}`;
}
function suggestions(list){
  if(!list.length)return empty('暂无有依据的节电建议','持续采集数据后再评估；数据不足时不会编造节电收益。');
  return list.map((s,i)=>`<div class="advice-row"><span class="priority">${String(i+1).padStart(2,'0')}</span><div><div class="section-head"><h2>${e(s.title)}</h2>${badge({pending:'待采纳',adopted:'已采纳',deferred:'已暂缓'}[s.status])}</div><p><a href="#device/${s.bindingId}">${e(s.alias)}</a></p><p>${e(s.text)}</p><p class="muted">依据：${e(s.basis)}</p><div class="form-actions">${s.status!=='adopted'?btn('action','采纳建议',`data-key="${e(s.key)}" data-status="adopted"`,true):''}${s.status!=='deferred'?btn('action','暂缓',`data-key="${e(s.key)}" data-status="deferred"`):''}${s.status!=='pending'?btn('action','恢复待处理',`data-key="${e(s.key)}" data-status="pending"`):''}</div></div></div>`).join('');
}
function reportButtons(){return `<div class="form-actions">${btn('generate-report','生成统计报告','data-ai="false"',true)}${btn('generate-report','生成 AI 报告','data-ai="true"')}<label class="compact-field">周期 <select id="report-days">${[1,7,30].map(d=>`<option value="${d}"${d===state.days?' selected':''}>近 ${d} 天</option>`).join('')}</select></label></div><p class="footnote">统计报告依据真实记录。AI 报告需要配置模型服务，并在设置中授权发送去标识化的用电摘要。</p>`;}
function reportsView(){return `${reportButtons()}${section('历史报告',state.reports.length?table(['生成时间','统计周期','报告来源','操作'],state.reports.map(r=>[date(r.created,true),`${date(r.from_time)} — ${date(r.to_time)}`,badge(r.kind==='ai'?'AI 模型':'实测统计'),`<a href="#report/${r.id}">阅读报告 →</a>`])):empty('还没有生成报告','上传连续读数后生成第一份用电报告。'))}`;}
function reportView(r){
  const s=r.body.snapshot;
  return `<div class="toolbar"><span>${date(r.from_time)} — ${date(r.to_time)}</span>${badge(r.kind==='ai'?'AI 模型分析':'实测统计与规则')}${btn('print','打印 / 保存 PDF')}${btn('download-report','下载报告')}</div><div class="metrics">${metric('周期已记录',number(s.energy),'kWh',`${s.devices.length} 台已接入家电`)}${metric('估算费用',number((s.energy||0)*r.body.price,2),'元',`电价 ${r.body.price} 元 / kWh`)}${metric('采样覆盖率',number(s.coverage*100,1),'%','缺失部分不记为零')}${metric('报告来源',r.kind==='ai'?'AI':'统计','','保留生成时的数据快照')}</div>${section('用电分析',`<div class="report-text">${e(r.body.text)}</div>`)}${section('全部已接入家电耗电情况',table(['电器','插座 ID','用电量','占比','费用估算','采样覆盖'],s.devices.map(d=>[e(d.alias),`<code>${e(d.plug_id)}</code>`,`${number(d.energy)} kWh`,s.energy&&d.energy!==null?`${number(d.energy/s.energy*100,1)}%`:'—',d.energy===null?'—':`${number(d.energy*r.body.price,2)} 元`,`${number(d.coverage*100,1)}%`])))}${section('同类对比',comparisonTable(s))}${section('建议依据',suggestions(s.suggestions.map(x=>({...x,status:state.data.suggestions.find(v=>v.key===x.key)?.status||x.status}))))}<p class="footnote">本报告保持生成时的数据不变。后续补传的数据可通过重新生成报告纳入。</p>`;
}
function comparisonTable(s){return table(['电器 / 规格','实测用电','同类周期基准','差异','来源与条件'],s.devices.map(d=>[`${e(d.alias)}<small class="subtext">${e(d.type)} · ${e(d.spec||'规格未填写')}</small>`,`${number(d.energy)} kWh`,d.baseline?`${number(d.baseline.periodKwh)} kWh`:'—',d.baseline&&d.energy!==null?`${number((d.energy/d.baseline.periodKwh-1)*100,1)}%`:'—',d.baseline?`${e(d.baseline.source)}<small class="subtext">${e(d.baseline.conditions)} · ${d.baseline.sampleSize} 个样本</small>`:e(d.comparisonReason)]));}
function comparisonView(){return `${state.data.hasBenchmarks?'':`<div class="notice warn"><div><strong>尚未接入真实同类基准</strong><p>当前只展示你的实测用电，不提供虚构的平均值或排名。</p></div></div>`}${section('同类用电比较',comparisonTable(state.data))}<p class="muted">比较要求品类和规格匹配，至少有 3 天连续有效观察且采样覆盖率达 80%。环境、使用时长和能效仍可能影响结果。</p>`;}
function alertsView(){
  if(!state.data.activeCount)return empty('还没有绑定插座','绑定后可以查看设备连接状态。',link('add','添加智能插座',true));
  const list=state.data.devices.filter(d=>!d.ended&&!d.online);
  return list.length?table(['家电','状态','最后上传','操作'],list.map(d=>[e(d.alias),status(d),d.last?date(d.last.timestamp,true):'未上传过数据',`<a href="#device/${d.id}">查看设备 →</a>`])):empty('当前插座均在线','没有需要处理的离线设备。');
}
function integrationView(){return `<div class="notice"><div><strong>HTTP 功率数据接入</strong><p>每个智能插座使用自己的 ID 与上传密钥。HTTPS 公网或局域网地址由部署环境决定。</p></div>${link('add','绑定插座')}</div>${section('上传接口',`<dl><dt>方法 / 路径</dt><dd><code>POST /api/telemetry</code></dd><dt>当前地址</dt><dd><code>${e(location.origin)}/api/telemetry</code></dd><dt>认证</dt><dd><code>Authorization: Bearer &lt;设备密钥&gt;</code></dd><dt>请求格式</dt><dd><code>Content-Type: application/json</code></dd></dl><pre>{
  "deviceId": "YOUR_DEVICE_ID",
  "timestamp": "UTC ISO 8601 时间或毫秒时间戳",
  "powerWatts": 100,
  "energyKwh": 12.345
}</pre><p class="muted">energyKwh 为可选的硬件累计电量；powerWatts 为必填实时功率。建议每 10–60 秒上传一次，支持 90 天内离线补传。</p>`)}${section('安全与数据约束','<p>重复时间戳与相同数据按幂等请求处理；同一时间戳数据冲突会拒绝。负功率、非法电量、过期时间或错误密钥会返回错误。</p><p>重新生成密钥后，旧密钥立即失效。更换电器需要结束旧绑定，保留历史并重新绑定。</p>')}${section('连接环境','<p>本地 127.0.0.1 地址仅在这台电脑可访问。硬件接入时需将服务部署到它能访问的局域网或 HTTPS 公网地址。</p>')}`;}
function settingsView(){return `<form data-form="settings">${section('家庭与电价',`<div class="inline-form">${field('家庭名称',input('name',state.user.name,'','required maxlength="40"'))}${field('单一电价（元 / kWh）',input('price',state.user.price,'','type="number" step="0.001" min="0" max="100" required'))}${field('家庭时区',`<select name="timezone">${['Asia/Hong_Kong','Asia/Shanghai','Asia/Taipei','Asia/Tokyo','Europe/London','America/New_York','UTC'].map(t=>`<option${t===state.user.timezone?' selected':''}>${t}</option>`).join('')}</select>`)}</div>`)}${section('AI 与隐私',`<p>${state.data.aiConfigured?badge('模型服务已配置'):badge('模型服务未配置',true)}</p><label class="check"><input type="checkbox" name="aiConsent"${state.user.aiConsent?' checked':''}>允许发送去标识化用电摘要，用于 AI 报告与电器候选识别</label><p class="muted">模型请求不发送账户邮箱、家庭名称或插座密钥。分析摘要可能包含电器类型、规格、功率与用电模式；关闭授权后仍可使用统计报告。</p><p class="muted">AI 配置由服务环境变量管理，密钥不下发到浏览器。</p>`)}${formError}<div class="form-actions"><button class="button primary" type="submit">保存设置</button></div></form>${section('账户',`<dl><dt>登录邮箱</dt><dd>${e(state.user.email)}</dd></dl>${btn('logout','退出登录')}`)}`;}

async function render(){
  if(!state.user){authView();return;}
  const r=route(),s=state.data;
  if(!s){app.innerHTML='<div class="initial-loading">正在读取用电记录…</div>';return;}
  if(r==='overview')shell('用电总览',`${state.user.name} · 实测记录`,overview());
  else if(r==='devices')shell('插座与家电',`${s.activeCount} 台家电 · ${s.online} 个在线`,devicesView());
  else if(r==='add')shell('添加智能插座','设置电器归属与设备上传认证',addView());
  else if(r.startsWith('device/')){
    const id=Number(r.split('/')[1]);let d=s.devices.find(x=>x.id===id)||(state.detail?.id===id?state.detail:null);
    if(!d){shell('家电详情','正在读取…','');try{const result=await api(`/api/devices/${id}?days=${state.days}`);if(route()===r){state.detail=result.device;render();}}catch(err){toast(err.message);navigate('devices');}return;}
    shell(d.alias,d.ended?'历史绑定 · 解绑前的用电记录':'功率 · 电量 · 设备认证 · 电器信息',deviceView(id));
  }
  else if(r==='reports')shell('用电报告','真实统计与可选 AI 分析',reportsView());
  else if(r.startsWith('report/')){
    const id=Number(r.split('/')[1]);
    if(state.report?.id===id){shell('用电报告',`生成于 ${date(state.report.created,true)}`,reportView(state.report));return;}
    shell('用电报告','正在读取报告…','');
    try{const report=await api(`/api/reports/${id}`);if(route()===r){state.report=report;render();}}catch(err){toast(err.message);navigate('reports');}
  }
  else if(r==='comparison')shell('同类电器对比','数据来源 · 匹配条件 · 比较依据',comparisonView());
  else if(r==='advice')shell('节电建议','依据实测记录 · 采纳状态已保存',`${link('comparison','查看同类对比')}${section('节电行动',suggestions(s.suggestions))}`);
  else if(r==='alerts')shell('设备状态','根据最新上传时间判断 · 超过 5 分钟无读数显示离线',alertsView());
  else if(r==='integration')shell('设备接入','智能插座 HTTP 上传协议',integrationView());
  else if(r==='settings')shell('家庭与设置','家庭信息 · 电价 · 时区 · AI 授权',settingsView());
  else navigate('overview');
}
function credentialModal(data){
  const command=`curl -X POST '${location.origin}/api/telemetry' -H 'Authorization: Bearer ${data.token}' -H 'Content-Type: application/json' -d '{"deviceId":"${data.deviceId}","timestamp":${Date.now()},"powerWatts":100}'`;
  showModal(`<h2>设备上传密钥已生成</h2><p>插座 <code>${e(data.deviceId)}</code> · 仅本次显示，关闭后无法再次读取。</p><label class="field"><span>上传密钥</span><input id="device-token" readonly value="${e(data.token)}"></label><div class="form-actions">${btn('copy-token','复制密钥','',true)}${btn('copy-command','复制上传命令')}</div><p class="muted">请将密钥配置到对应插座。不要分享给他人。</p><details><summary>查看上传请求</summary><pre id="upload-command">${e(command)}</pre></details>`);
}

document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;
  event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
  const b=Object.fromEntries(new FormData(form));
  try{
    if(form.dataset.form==='auth'){
      const result=await api(`/api/${state.authMode==='register'?'register':'login'}`,{method:'POST',body:b});
      state.user=result.user;const me=await api('/api/me');state.categories=me.categories;
      await load();connectEvents();navigate('overview');render();
    }else if(form.dataset.form==='bind'){
      const result=await api('/api/devices',{method:'POST',body:b});await load();navigate('devices');render();credentialModal(result);
    }else if(form.dataset.form==='edit'){
      await api(`/api/devices/${form.dataset.id}`,{method:'PATCH',body:b});await load();render();toast('电器信息已保存');
    }else if(form.dataset.form==='settings'){
      const result=await api('/api/settings',{method:'PATCH',body:{...b,price:Number(b.price),aiConsent:!!b.aiConsent}});state.user=result.user;await load();render();toast('设置已保存');
    }
  }catch(err){setError(form,err.message);}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const period=event.target.closest('[data-period]');
  if(period){event.preventDefault();state.days=Number(period.dataset.period);await refresh();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  try{
    if(action==='auth-mode'){state.authMode=state.authMode==='login'?'register':'login';authView();}
    else if(action==='close')closeModal();
    else if(action==='logout'){await api('/api/logout',{method:'POST'});state.stream?.close();clearTimeout(refreshTimer);state.user=null;state.data=null;state.report=null;state.detail=null;closeModal();render();}
    else if(action==='copy-token'){await navigator.clipboard.writeText(document.querySelector('#device-token').value);toast('设备密钥已复制');}
    else if(action==='copy-command'){const token=document.querySelector('#device-token').value;const deviceId=modal.querySelector('code').textContent;await navigator.clipboard.writeText(`curl -X POST '${location.origin}/api/telemetry' -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"deviceId":"${deviceId}","timestamp":${Date.now()},"powerWatts":100}'`);toast('上传命令已复制');}
    else if(action==='token'){showModal(`<h2>重新生成上传密钥？</h2><p>旧密钥立即失效，插座需要配置新密钥才能继续上传。</p><div class="form-actions">${btn('token-confirm','确认重新生成',`data-id="${target.dataset.id}"`,true)}${btn('close','取消')}</div>`);}
    else if(action==='token-confirm'){target.disabled=true;credentialModal(await api(`/api/devices/${target.dataset.id}/token`,{method:'POST'}));}
    else if(action==='unbind-confirm'){showModal(`<h2>确认解绑这台插座？</h2><p>上传密钥立即撤销，历史用电记录保留。重新绑定时会创建新的家电记录。</p><div class="form-actions">${btn('unbind','确认解绑',`data-id="${target.dataset.id}"`,true)}${btn('close','取消')}</div>`);}
    else if(action==='unbind'){target.disabled=true;await api(`/api/devices/${target.dataset.id}`,{method:'DELETE'});closeModal();await load();navigate('devices');toast('已解绑，历史记录已保留');}
    else if(action==='identify'){target.disabled=true;target.textContent='正在分析…';const result=await api(`/api/devices/${target.dataset.id}/identify`,{method:'POST'});showModal(`<h2>AI 电器候选分析</h2><div class="report-text">${e(result.analysis)}</div><p class="muted">请在家电信息中手动确认类型。</p>`);}
    else if(action==='action'){target.disabled=true;await api('/api/actions',{method:'POST',body:{key:target.dataset.key,status:target.dataset.status}});await refresh();toast('建议状态已保存');}
    else if(action==='generate-report'){
      target.disabled=true;target.textContent='正在生成…';
      const days=Number(document.querySelector('#report-days').value);const result=await api('/api/reports',{method:'POST',body:{days,ai:target.dataset.ai==='true'}});
      await load();navigate(`report/${result.id}`);
    }
    else if(action==='print')window.print();
    else if(action==='download-report'){
      const r=state.report;const text=`家庭用电报告\n${date(r.from_time)} — ${date(r.to_time)}\n\n${r.body.text}\n\n家电明细\n${r.body.snapshot.devices.map(d=>`${d.alias} (${d.plug_id})：${number(d.energy)} kWh`).join('\n')}`;
      const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`energy-report-${r.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }catch(err){toast(err.message);}finally{if(target.isConnected){target.disabled=false;if(action==='identify')target.textContent='分析电器候选类型';if(action==='generate-report')target.textContent=target.dataset.ai==='true'?'生成 AI 报告':'生成统计报告';}}
});
document.addEventListener('input',event=>{
  if(event.target.id==='device-search'){state.search=event.target.value;updateDevices();}
});
document.addEventListener('change',event=>{if(event.target.id==='room-filter'){state.filter=event.target.value;updateDevices();}});
function updateDevices(){const list=state.data.devices.filter(d=>!d.ended&&(state.filter==='all'||d.room===state.filter)&&[d.alias,d.plug_id,d.type].join(' ').toLowerCase().includes(state.search.toLowerCase()));document.querySelector('#device-results').innerHTML=list.length?deviceTable(list):empty('没有匹配的家电','调整搜索或房间条件。');}
modal.addEventListener('cancel',()=>modal.replaceChildren());
window.addEventListener('hashchange',render);
setInterval(()=>{if(state.user&&!modal.open&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)&&['overview','alerts'].includes(route().split('/')[0]))refresh();},30000);
try{
  const me=await api('/api/me');state.user=me.user;state.categories=me.categories;await load();connectEvents();render();
}catch(err){if(err.status===401)authView();else app.innerHTML=`<main>${empty('暂时无法连接服务',err.message,btn('reload','重新加载'))}</main>`;}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="reload"]'))location.reload();});
