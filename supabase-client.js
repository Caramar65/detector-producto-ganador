(function(){
  'use strict';
  const SUPABASE_URL='https://qpvtygafwobaxltdntdg.supabase.co';
  const SUPABASE_KEY='sb_publishable_cjJpoVZoghi9x1bzI5H2ng_Zh_GNxx5';
  const APP_URL='https://detector-producto-ganador.vercel.app';
  const STORE_KEY='dpg_saved_research_v39';
  const PENDING_KEY='dpg_pending_research_v39';
  const INTENT_KEY='dpg_save_intent_v39';
  const NAME_KEY='dpg_pending_name_v39';
  const VISITOR_KEY='dpg_visitor_id_v39';
  let sb=null, session=null, lastResearch=null, authModal=null, promptShownForResearchId=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function loadScript(){return new Promise((resolve,reject)=>{if(window.supabase?.createClient)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  function showStatus(message,type){const el=document.getElementById('status');if(!el)return;el.className='status show'+(type==='error'?' error':type==='success'?' success':'');el.textContent=message;}
  function getVisitorId(){try{let id=localStorage.getItem(VISITOR_KEY);if(!id){id='v_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);localStorage.setItem(VISITOR_KEY,id);}return id;}catch{return 'anonymous';}}
  function openAuthModal(mode='save'){
    if(!authModal)return;
    const title=document.getElementById('dpg-auth-title'),desc=document.getElementById('dpg-auth-desc'),msg=document.getElementById('dpg-auth-msg');
    if(title)title.textContent=mode==='save'?'🔐 Guarda esta investigación':'🔐 Guarda tus investigaciones';
    if(desc)desc.innerHTML='Puedes <b>descargar e imprimir</b> el informe sin registrarte. Si quieres conservarlo en la nube y abrirlo después desde cualquier dispositivo, crea tu acceso gratuito con nombre y correo.';
    if(msg&&!msg.textContent.startsWith('✅'))msg.textContent='';
    authModal.style.display='flex';
  }
  function closeAuthModal(){if(authModal)authModal.style.display='none';}
  function getPendingName(){try{return localStorage.getItem(NAME_KEY)||'';}catch{return '';}}
  function setPendingName(name){try{localStorage.setItem(NAME_KEY,name);}catch{}}
  function setSaveIntent(v){try{if(v)localStorage.setItem(INTENT_KEY,'1');else localStorage.removeItem(INTENT_KEY);}catch{}}
  function hasSaveIntent(){try{return localStorage.getItem(INTENT_KEY)==='1';}catch{return false;}}
  function clearSaveIntent(){try{localStorage.removeItem(INTENT_KEY);}catch{}}
  async function ensureProfile(){
    if(!session?.user)return false;
    const user=session.user,pendingName=getPendingName();
    const payload={id:user.id,full_name:pendingName||user.user_metadata?.full_name||user.email||'Usuario',email:user.email||null,updated_at:new Date().toISOString()};
    const {error}=await sb.from('profiles').upsert(payload,{onConflict:'id'});
    if(error){console.warn('profile',error);return false;}
    if(pendingName)try{localStorage.removeItem(NAME_KEY);}catch{}
    return true;
  }
  function loadPending(){if(lastResearch)return lastResearch;try{const raw=localStorage.getItem(PENDING_KEY);if(raw)lastResearch=JSON.parse(raw);}catch(e){console.warn('pending load',e);}return lastResearch;}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY);}catch{};lastResearch=null;}
  function getSafeRedirect(){return APP_URL+'/?auth=1';}
  async function init(){
    await loadScript();
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
    const r=await sb.auth.getSession();session=r.data.session||null;
    sb.auth.onAuthStateChange((_e,s)=>{session=s||null;if(session)setTimeout(async()=>{await ensureProfile();await syncCloudHistory();if(hasSaveIntent())await autoSavePending();},150);});
    addAccountUI();
    patchAnalytics();
    event('app_opened',{page:location.pathname});
    if(session){await ensureProfile();await syncCloudHistory();if(hasSaveIntent())await autoSavePending();}
  }
  function addAccountUI(){
    const modal=document.createElement('div');modal.id='dpg-auth-modal';modal.style.cssText='display:none;position:fixed;inset:0;background:#0008;z-index:10000;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML='<div style="max-width:430px;width:100%;background:white;border-radius:16px;padding:22px;box-shadow:0 20px 60px #0004"><h2 id="dpg-auth-title" style="margin-top:0">🔐 Guarda esta investigación</h2><p id="dpg-auth-desc" style="color:#667085;font-size:13px;line-height:1.5">Puedes <b>descargar e imprimir</b> el informe sin registrarte. Si quieres conservarlo en la nube y abrirlo después desde cualquier dispositivo, crea tu acceso gratuito con nombre y correo.</p><label style="display:block;font-size:12px;font-weight:700;margin:10px 0 5px">Nombre</label><input id="dpg-name" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #d7dbe5;border-radius:9px" placeholder="Tu nombre"><label style="display:block;font-size:12px;font-weight:700;margin:10px 0 5px">Correo</label><input id="dpg-email" type="email" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #d7dbe5;border-radius:9px" placeholder="tu@email.com"><div id="dpg-auth-msg" style="font-size:12px;margin:10px 0;line-height:1.45"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="dpg-auth-close" style="border:0;border-radius:9px;padding:10px 14px;background:#eeeaff;color:#4937c4;font-weight:700">Ahora no</button><button id="dpg-auth-send" style="border:0;border-radius:9px;padding:10px 14px;background:#5b45ea;color:white;font-weight:700">Guardar y continuar</button></div></div>';
    document.body.appendChild(modal);authModal=modal;
    const savedName=getPendingName();if(savedName)document.getElementById('dpg-name').value=savedName;
    document.getElementById('dpg-auth-close').onclick=()=>{setSaveIntent(false);closeAuthModal();};
    document.getElementById('dpg-auth-send').onclick=async()=>{
      const name=document.getElementById('dpg-name').value.trim(),email=document.getElementById('dpg-email').value.trim(),msg=document.getElementById('dpg-auth-msg');
      if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg.textContent='Escribe un nombre y un correo válido.';msg.style.color='#b42318';return;}
      setPendingName(name);setSaveIntent(true);msg.textContent='Enviando enlace de acceso...';msg.style.color='#667085';
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:getSafeRedirect(),shouldCreateUser:true,data:{full_name:name}}});
      if(error){
        const rateLimited=/rate limit|too many|429/i.test(error.message||'');
        msg.textContent=rateLimited?'⚠️ El correo de acceso está temporalmente limitado. Tu investigación sigue disponible y no se ha perdido. Puedes descargarla ahora y volver a Guardar más tarde.':'❌ No pudimos enviar el enlace: '+error.message;
        msg.style.color='#b42318';
        if(rateLimited){setSaveIntent(true);setTimeout(()=>{closeAuthModal();showStatus('⚠️ El correo de acceso está temporalmente limitado. La investigación no se perdió; puedes descargarla ahora y volver a Guardar más tarde.','error');},3200);}
        return;
      }
      msg.innerHTML='✅ Enlace enviado. Revisa tu correo y ábrelo para activar tu acceso. Después volverás automáticamente a la app y la investigación se guardará en tu cuenta.';msg.style.color='#087443';
    };
  }
  async function event(name,extra={}){try{await sb.from('usage_events').insert({user_id:session?.user?.id||null,event_name:name,product_count:extra.product_count||null,metadata:Object.assign({visitor_id:getVisitorId()},extra)});}catch(e){console.warn('analytics',e);}}
  async function saveCloud(item){
    if(!session?.user)return {ok:false,reason:'login'};
    const report=item.report||item.result||item,title=item.title||report?.overallWinner?.productName||'Investigación';
    const productCount=Number(item.productCount||report?.products?.length||1),researchId=item.researchId||report?.researchId||('LOCAL-'+Date.now());
    const payload={user_id:session.user.id,research_id:researchId,title,product_count:Math.max(1,Math.min(5,productCount)),winner_product:report?.overallWinner?.productName||item.winner_product||null,report};
    const {error}=await sb.from('research_reports').upsert(payload,{onConflict:'user_id,research_id'});
    if(error){console.warn('saveCloud',error);return {ok:false,reason:'database',error};}
    await event('report_saved',{product_count:productCount,research_id:researchId});return {ok:true,researchId};
  }
  async function autoSavePending(){
    const pending=loadPending();if(!session?.user||!pending)return;
    const result=await saveCloud({researchId:pending.researchId,title:pending.overallWinner?.productName||'Investigación',productCount:pending.products?.length||1,report:pending});
    if(result.ok){clearPending();clearSaveIntent();closeAuthModal();showStatus('✅ Investigación guardada correctamente en la nube y asociada a tu cuenta.','success');const h=document.getElementById('showHistory');if(h)h.click();}
    else showStatus('❌ Tu acceso se activó, pero no pudimos guardar la investigación. Intenta Guardar nuevamente.','error');
  }
  async function syncCloudHistory(){
    if(!session?.user)return;const {data,error}=await sb.from('research_reports').select('*').order('created_at',{ascending:false}).limit(50);if(error){console.warn('history',error);return;}
    let local=[];try{local=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');if(!Array.isArray(local))local=[];}catch{}
    const map=new Map(local.map(x=>[x.researchId||x.id,x]));(data||[]).forEach(row=>map.set(row.research_id,{id:row.id,researchId:row.research_id,title:row.title,productCount:row.product_count,winner:row.winner_product,report:row.report,createdAt:row.created_at,savedAt:row.created_at}));
    try{localStorage.setItem(STORE_KEY,JSON.stringify([...map.values()].sort((a,b)=>new Date(b.createdAt||b.savedAt||0)-new Date(a.createdAt||a.savedAt||0)).slice(0,50)));}catch{}
  }
  function showPostAnalysisSavePrompt(data){
    if(!data||!data.products?.length)return;const rid=data.researchId||data.overallWinner?.productName||String(Date.now());
    if(promptShownForResearchId===rid||session)return;promptShownForResearchId=rid;
    try{localStorage.setItem(PENDING_KEY,JSON.stringify(data));}catch{}
    setTimeout(()=>{if(!session)openAuthModal('save');},700);
  }
  function patchAnalytics(){
    const originalFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:input?.url||'',isResearch=String(url).includes('/api/research');if(!isResearch)return originalFetch(input,init);
      let body={};try{body=JSON.parse(init?.body||'{}');}catch{} await event('analysis_started',{product_count:body?.products?.length||null});
      const response=await originalFetch(input,init);
      try{const clone=response.clone(),data=await clone.json();if(response.ok){lastResearch=data;window.__DPG_LAST_RESEARCH__=data;try{localStorage.setItem(PENDING_KEY,JSON.stringify(data));}catch{}await event('analysis_completed',{product_count:data?.products?.length||null,research_id:data?.researchId||null});showPostAnalysisSavePrompt(data);}else await event('analysis_failed',{status:response.status,error:data?.error||'unknown'});}catch{} return response;
    };
    const demo=document.getElementById('demo');if(demo)demo.addEventListener('click',()=>event('demo_clicked',{product_count:5}));
    const history=document.getElementById('showHistory');if(history)history.addEventListener('click',()=>event('history_opened'));
    const newBtn=document.getElementById('newResearch');if(newBtn)newBtn.addEventListener('click',()=>{clearPending();clearSaveIntent();event('new_research');});
    document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const text=(b.textContent||'').toUpperCase();
      if(text.includes('GUARDAR')||text.includes('SAVE')){if(b.id==='dpg-auth-send'||b.id==='dpg-auth-close')return;if(!session){setSaveIntent(true);openAuthModal('save');event('save_requires_login');return;}const pending=loadPending();if(pending){const result=await saveCloud({researchId:pending.researchId,title:pending.overallWinner?.productName||'Investigación',productCount:pending.products?.length||1,report:pending});if(result.ok){clearPending();clearSaveIntent();showStatus('✅ Investigación guardada correctamente en la nube.','success');}else showStatus('❌ No se pudo guardar la investigación. Revisa la conexión con Supabase.','error');}else showStatus('⚠️ No hay una investigación activa para guardar.','error');}
      if(text.includes('DESCARGAR'))event('report_downloaded',{product_count:lastResearch?.products?.length||null});if(text.includes('EMAIL')||text.includes('CORREO'))event('email_clicked',{product_count:lastResearch?.products?.length||null});if(text.includes('ELIMINAR'))event('report_deleted');
    });
  }
  init().catch(e=>console.warn('Supabase init failed',e));
})();