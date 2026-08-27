(function(){
'use strict';
const SUPABASE_URL='https://qpvtygafwobaxltdntdg.supabase.co';
const SUPABASE_KEY='sb_publishable_cjJpoVZoghi9x1bzI5H2ng_Zh_GNxx5';
const TOKEN_KEY='dpg_device_token_v1',VISITOR_KEY='dpg_visitor_id_v39',STORE_KEY='dpg_saved_research_v39';
let sb=null;
function get(k){try{return localStorage.getItem(k)||''}catch{return ''}}
function set(k,v){try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k)}catch{}}
function status(msg,type){const el=document.getElementById('status');if(!el)return;el.className='status show'+(type==='error'?' error':type==='success'?' success':'');el.textContent=msg}
function loadSupabase(){return new Promise((resolve,reject)=>{if(window.supabase?.createClient)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
function loadLocal(){try{const a=JSON.parse(get(STORE_KEY)||'[]');return Array.isArray(a)?a:[]}catch{return []}}
function saveLocal(a){try{set(STORE_KEY,JSON.stringify(a))}catch{}}
function renderEmpty(){const list=document.getElementById('historyList');if(list)list.innerHTML='<div class="emptyHistory">No hay investigaciones guardadas.</div>';const all=document.getElementById('dpg-delete-all');if(all)all.remove()}
function removeLocalById(id){saveLocal(loadLocal().filter(x=>String(x.id)!==String(id)&&String(x.researchId||'')!==String(id)))}
function addDeleteAllButton(){
 const history=document.getElementById('history'),list=document.getElementById('historyList');
 if(!history||!list||history.style.display==='none')return;
 const items=loadLocal();
 let btn=document.getElementById('dpg-delete-all');
 if(!items.length){if(btn)btn.remove();return}
 if(!btn){
  btn=document.createElement('button');btn.id='dpg-delete-all';btn.className='danger';btn.type='button';btn.textContent='🗑️ ELIMINAR TODAS LAS INVESTIGACIONES';btn.style.margin='8px 0 4px';
  const h2=history.querySelector('h2');if(h2)h2.insertAdjacentElement('afterend',btn);else history.prepend(btn);
 }
}
async function rpc(name,args){try{const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}catch(e){console.warn('cloud-delete',name,e);return null}}
async function deleteOne(id){
 const token=get(TOKEN_KEY),visitor=get(VISITOR_KEY);
 if(!token||!visitor){status('❌ No se pudo identificar este dispositivo. Inicia sesión/valida tu acceso nuevamente.','error');return false}
 const result=await rpc('delete_report_with_device_token',{p_device_token:token,p_visitor_id:visitor,p_report_id:id});
 if(!result?.ok){status(result?.reason==='invalid_device'?'❌ El acceso de este dispositivo ya no es válido. Vuelve a validar tu correo.':'❌ No se pudo eliminar la investigación de la nube. La investigación no se borró localmente.','error');return false}
 removeLocalById(id);return true;
}
async function deleteAll(){
 const token=get(TOKEN_KEY),visitor=get(VISITOR_KEY);
 if(!token||!visitor){status('❌ No se pudo identificar este dispositivo. Inicia sesión/valida tu acceso nuevamente.','error');return false}
 const result=await rpc('delete_all_reports_with_device_token',{p_device_token:token,p_visitor_id:visitor});
 if(!result?.ok){status(result?.reason==='invalid_device'?'❌ El acceso de este dispositivo ya no es válido. Vuelve a validar tu correo.':'❌ No se pudieron eliminar las investigaciones de la nube. No se modificó el historial local.','error');return false}
 saveLocal([]);renderEmpty();status('🗑️ Se eliminaron '+Number(result.deleted||0)+' investigaciones guardadas de tu cuenta.','success');return true;
}
function install(){
 document.addEventListener('click',async function(e){
  const all=e.target.closest('#dpg-delete-all');
  if(all){e.preventDefault();e.stopImmediatePropagation();if(!confirm('¿Eliminar TODAS las investigaciones guardadas de tu cuenta? Esta acción no se puede deshacer.'))return;all.disabled=true;all.textContent='Eliminando...';await deleteAll();all.disabled=false;if(document.getElementById('dpg-delete-all'))document.getElementById('dpg-delete-all').textContent='🗑️ ELIMINAR TODAS LAS INVESTIGACIONES';return;}
  const b=e.target.closest('[data-delete]');
  if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=b.getAttribute('data-delete');if(!id)return;
  if(!confirm('¿Eliminar esta investigación? Esta acción no se puede deshacer.'))return;
  b.disabled=true;b.textContent='Eliminando...';
  const ok=await deleteOne(id);
  if(ok){const item=b.closest('.historyItem');if(item)item.remove();if(!loadLocal().length)renderEmpty();addDeleteAllButton();status('🗑️ Investigación eliminada correctamente de tu cuenta.','success');}
  else{b.disabled=false;b.textContent='Eliminar';}
 },true);
 const observer=new MutationObserver(()=>addDeleteAllButton());observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});addDeleteAllButton();
}
async function init(){try{await loadSupabase();sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});install()}catch(e){console.warn('cloud-delete init failed',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
