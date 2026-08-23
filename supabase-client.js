(function(){
  'use strict';
  const SUPABASE_URL='https://qpvtygafwobaxltdntdg.supabase.co';
  const SUPABASE_KEY='sb_publishable_cjJpoVZoghi9x1bzI5H2ng_Zh_GNxx5';
  const STORE_KEY='dpg_saved_research_v39';
  let sb=null, session=null, lastResearch=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function loadScript(){return new Promise((resolve,reject)=>{if(window.supabase?.createClient)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  function showStatus(message,type){const el=document.getElementById('status');if(!el)return;el.className='status show'+(type==='error'?' error':type==='success'?' success':'');el.textContent=message;}
  function openAuthModal(){const modal=document.getElementById('dpg-auth-modal');if(modal)modal.style.display='flex';}
  async function ensureProfile(){
    if(!session?.user)return false;
    const user=session.user;
    const payload={id:user.id,full_name:user.user_metadata?.full_name||user.email||'Usuario',email:user.email||null,updated_at:new Date().toISOString()};
    const {error}=await sb.from('profiles').upsert(payload,{onConflict:'id'});
    if(error){console.warn('profile',error);return false;}
    return true;
  }
  async function init(){
    await loadScript();
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
    const r=await sb.auth.getSession();
    session=r.data.session||null;
    sb.auth.onAuthStateChange((_e,s)=>{
      session=s||null;
      updateAccount();
      if(session){
        setTimeout(async()=>{
          await ensureProfile();
          await syncCloudHistory();
          await autoSavePending();
        },150);
      }
    });
    addAccountUI();
    patchAnalytics();
    event('app_opened',{page:location.pathname});
    if(session){await ensureProfile();await syncCloudHistory();}
  }
  function addAccountUI(){
    const box=document.createElement('div');box.id='dpg-account';box.style.cssText='position:fixed;top:14px;right:14px;z-index:9999;font-family:Arial,sans-serif';
    document.body.appendChild(box);updateAccount();
    const modal=document.createElement('div');modal.id='dpg-auth-modal';modal.style.cssText='display:none;position:fixed;inset:0;background:#0008;z-index:10000;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML='<div style="max-width:430px;width:100%;background:white;border-radius:16px;padding:22px;box-shadow:0 20px 60px #0004"><h2 style="margin-top:0">🔐 Guarda tus investigaciones</h2><p style="color:#667085;font-size:13px;line-height:1.5">La investigación puede descargarse sin registrarte. Para <b>guardarla en la nube</b> y verla después desde cualquier dispositivo, crea tu acceso gratuito con nombre y correo.</p><label style="display:block;font-size:12px;font-weight:700;margin:10px 0 5px">Nombre</label><input id="dpg-name" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #d7dbe5;border-radius:9px" placeholder="Tu nombre"><label style="display:block;font-size:12px;font-weight:700;margin:10px 0 5px">Correo</label><input id="dpg-email" type="email" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #d7dbe5;border-radius:9px" placeholder="tu@email.com"><div id="dpg-auth-msg" style="font-size:12px;margin:10px 0;line-height:1.45"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="dpg-auth-close" style="border:0;border-radius:9px;padding:10px 14px;background:#eeeaff;color:#4937c4;font-weight:700">Ahora no</button><button id="dpg-auth-send" style="border:0;border-radius:9px;padding:10px 14px;background:#5b45ea;color:white;font-weight:700">Continuar</button></div></div>';
    document.body.appendChild(modal);
    document.getElementById('dpg-auth-close').onclick=()=>modal.style.display='none';
    document.getElementById('dpg-auth-send').onclick=async()=>{
      const name=document.getElementById('dpg-name').value.trim(),email=document.getElementById('dpg-email').value.trim(),msg=document.getElementById('dpg-auth-msg');
      if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg.textContent='Escribe un nombre y un correo válido.';msg.style.color='#b42318';return;}
      msg.textContent='Enviando enlace de acceso...';msg.style.color='#667085';
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,data:{full_name:name}}});
      if(error){msg.textContent='No pudimos enviar el enlace: '+error.message;msg.style.color='#b42318';return;}
      msg.innerHTML='✅ Enlace enviado. Revisa tu correo y ábrelo para activar tu acceso. <b>No cierres esta página</b>; cuando regreses, la investigación pendiente se guardará automáticamente.';msg.style.color='#087443';
    };
  }
  function updateAccount(){
    const box=document.getElementById('dpg-account');if(!box)return;
    if(session){
      const name=esc(session.user.user_metadata?.full_name||session.user.email||'Cuenta');
      box.innerHTML='<button id="dpg-account-btn" style="border:0;border-radius:999px;padding:8px 12px;background:white;color:#4937c4;box-shadow:0 4px 16px #0002;font-weight:700">👤 '+name+' · Salir</button>';
      document.getElementById('dpg-account-btn').onclick=()=>sb.auth.signOut();
    }else{
      box.innerHTML='<button id="dpg-account-btn" style="border:0;border-radius:999px;padding:8px 12px;background:white;color:#4937c4;box-shadow:0 4px 16px #0002;font-weight:700">🔐 Guardar mis investigaciones</button>';
      document.getElementById('dpg-account-btn').onclick=openAuthModal;
    }
  }
  async function event(name,extra={}){try{await sb.from('usage_events').insert({user_id:session?.user?.id||null,event_name:name,product_count:extra.product_count||null,metadata:extra});}catch(e){console.warn('analytics',e);}}
  async function saveCloud(item){
    if(!session?.user)return {ok:false,reason:'login'};
    const report=item.report||item.result||item;
    const title=item.title||report?.overallWinner?.productName||'Investigación';
    const productCount=Number(item.productCount||report?.products?.length||1);
    const researchId=item.researchId||report?.researchId||('LOCAL-'+Date.now());
    const payload={user_id:session.user.id,research_id:researchId,title,product_count:productCount,winner_product:report?.overallWinner?.productName||item.winner_product||null,report};
    const {error}=await sb.from('research_reports').upsert(payload,{onConflict:'user_id,research_id'});
    if(error){console.warn('saveCloud',error);return {ok:false,reason:'database',error};}
    await event('report_saved',{product_count:productCount,research_id:researchId});
    return {ok:true,researchId};
  }
  async function autoSavePending(){
    if(!session?.user||!lastResearch)return;
    const ok=await saveCloud({researchId:lastResearch.researchId,title:lastResearch.overallWinner?.productName||'Investigación',productCount:lastResearch.products?.length||1,report:lastResearch});
    if(ok.ok){
      const modal=document.getElementById('dpg-auth-modal');if(modal)modal.style.display='none';
      showStatus('✅ Investigación guardada correctamente en Supabase y asociada a tu cuenta.','success');
    }
  }
  async function syncCloudHistory(){
    if(!session?.user)return;
    const {data,error}=await sb.from('research_reports').select('*').order('created_at',{ascending:false}).limit(50);
    if(error){console.warn('history',error);return;}
    let local=[];try{local=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');if(!Array.isArray(local))local=[];}catch{}
    const map=new Map(local.map(x=>[x.researchId||x.id,x]));
    (data||[]).forEach(row=>{map.set(row.research_id,{id:row.id,researchId:row.research_id,title:row.title,productCount:row.product_count,winner:row.winner_product,report:row.report,createdAt:row.created_at,savedAt:row.created_at});});
    const merged=[...map.values()].sort((a,b)=>new Date(b.createdAt||b.savedAt||0)-new Date(a.createdAt||a.savedAt||0)).slice(0,50);
    localStorage.setItem(STORE_KEY,JSON.stringify(merged));
  }
  function patchAnalytics(){
    const originalFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:input?.url||'';
      const isResearch=String(url).includes('/api/research');
      if(!isResearch)return originalFetch(input,init);
      let body={};try{body=JSON.parse(init?.body||'{}');}catch{}
      await event('analysis_started',{product_count:body?.products?.length||null});
      const response=await originalFetch(input,init);
      try{
        const clone=response.clone(),data=await clone.json();
        if(response.ok){lastResearch=data;window.__DPG_LAST_RESEARCH__=data;await event('analysis_completed',{product_count:data?.products?.length||null,research_id:data?.researchId||null});}
        else await event('analysis_failed',{status:response.status,error:data?.error||'unknown'});
      }catch{}
      return response;
    };
    const demo=document.getElementById('demo');if(demo)demo.addEventListener('click',()=>event('demo_clicked',{product_count:5}));
    const history=document.getElementById('showHistory');if(history)history.addEventListener('click',()=>event('history_opened'));
    const newBtn=document.getElementById('newResearch');if(newBtn)newBtn.addEventListener('click',()=>event('new_research'));
    const originalSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      const result=originalSet.apply(this,arguments);
      if(key===STORE_KEY){
        try{
          const list=JSON.parse(value);
          if(session&&Array.isArray(list)&&list.length){
            const newest=list.slice().sort((a,b)=>new Date(b.savedAt||b.createdAt||0)-new Date(a.savedAt||a.createdAt||0))[0];
            saveCloud(newest).catch(console.warn);
          }
        }catch(e){console.warn('storage sync',e);}
      }
      return result;
    };
    document.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      const text=(b.textContent||'').toUpperCase();
      if(text.includes('GUARDAR')||text.includes('SAVE')){
        if(!session){
          showStatus('ℹ️ Para guardar esta investigación en la nube necesitas crear tu acceso gratuito con nombre y correo.','');
          openAuthModal();
          event('save_requires_login');
          return;
        }
        if(lastResearch){
          const result=await saveCloud({researchId:lastResearch.researchId,title:lastResearch.overallWinner?.productName||'Investigación',productCount:lastResearch.products?.length||1,report:lastResearch});
          if(result.ok)showStatus('✅ Investigación guardada correctamente en Supabase. Puedes verla en Investigaciones guardadas.','success');
          else showStatus('❌ No se pudo guardar la investigación. Revisa la conexión con Supabase.','error');
        }else showStatus('⚠️ No hay una investigación activa para guardar.','error');
      }
      if(text.includes('DESCARGAR'))event('report_downloaded',{product_count:lastResearch?.products?.length||null});
      if(text.includes('EMAIL')||text.includes('CORREO'))event('email_clicked',{product_count:lastResearch?.products?.length||null});
      if(text.includes('ELIMINAR'))event('report_deleted');
    });
  }
  init().catch(e=>console.warn('Supabase init failed',e));
})();
