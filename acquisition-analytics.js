(function(){
'use strict';
const SUPABASE_URL='https://qpvtygafwobaxltdntdg.supabase.co';
const SUPABASE_KEY='sb_publishable_cjJpoVZoghi9x1bzI5H2ng_Zh_GNxx5';
const VISITOR_KEY='dpg_visitor_id_v39',SOURCE_KEY='dpg_acquisition_v1';
let client=null,visitorId='';
function get(k){try{return localStorage.getItem(k)||''}catch{return ''}}
function set(k,v){try{localStorage.setItem(k,v)}catch{}}
function getVisitor(){let id=get(VISITOR_KEY);if(!id){id='v_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);set(VISITOR_KEY,id)}return id}
function sourceData(){const p=new URLSearchParams(location.search),existing=(()=>{try{return JSON.parse(get(SOURCE_KEY)||'null')}catch{return null}})()||{};const keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'];const q={};keys.forEach(k=>{const v=p.get(k);if(v)q[k]=v});let source=q.utm_source||existing.utm_source||'';if(!source){const ref=document.referrer||'';if(/tiktok\.com/i.test(ref))source='tiktok';else if(/facebook\.com|fb\.me/i.test(ref))source='facebook';else if(/instagram\.com/i.test(ref))source='instagram';else if(/google\./i.test(ref))source='google';else if(ref)source='referral';else source='direct'}return Object.assign({},existing,q,{source,landing_path:location.pathname,landing_at:existing.landing_at||new Date().toISOString(),referrer:document.referrer||existing.referrer||''})}
async function initClient(){if(window.supabase?.createClient){client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});return}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';await new Promise((res,rej)=>{s.onload=res;s.onerror=rej;document.head.appendChild(s)});client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}})}
async function log(name,extra){if(!client)return;try{await client.from('usage_events').insert({event_name:name,metadata:Object.assign({visitor_id:visitorId},extra||{})})}catch(e){console.warn('acquisition analytics',e)}}
async function main(){visitorId=getVisitor();const data=sourceData();set(SOURCE_KEY,JSON.stringify(data));await initClient();const first=!get('dpg_acquisition_logged_v1');if(first){set('dpg_acquisition_logged_v1','1');await log('acquisition_landing',{source:data.source,utm_source:data.utm_source||null,utm_medium:data.utm_medium||null,utm_campaign:data.utm_campaign||null,utm_content:data.utm_content||null,utm_term:data.utm_term||null,fbclid:data.fbclid||null,gclid:data.gclid||null,referrer:data.referrer||null,landing_path:data.landing_path})}window.DPG_ACQUISITION=data;window.DPG_TRACK_EVENT=log;}
main().catch(e=>console.warn('acquisition init',e));
})();