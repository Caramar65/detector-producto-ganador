(function(){
'use strict';
const LOGO='/salud-vida-logo.svg';
const PRIVACY_URL='https://salvidatienda.mitiendanube.com/politica-de-privacidad/';
const TERMS_URL='https://detector-producto-ganador.vercel.app/terminos-de-uso.html';
const LEGAL_URL='https://detector-producto-ganador.vercel.app/aviso-legal.html';
const PRIVACY_VERSION='2026-08-26-v2';
function addStyle(){
 const s=document.createElement('style');
 s.textContent=`
 .dpg-brand{display:flex;align-items:center;gap:14px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18)}
 .dpg-brand img{display:block;width:76px;height:76px;object-fit:contain;object-position:center;background:#fff;border-radius:14px;padding:5px;box-shadow:0 4px 14px rgba(0,0,0,.16);flex:0 0 auto}
 .dpg-brand strong{font-size:13px;display:block;opacity:.98;line-height:1.35}
 .dpg-brand span{font-size:11px;opacity:.82;display:block;margin-top:3px;line-height:1.45}
 .dpg-legal-footer{margin:28px auto 10px;max-width:1220px;padding:18px 20px;border-top:1px solid #e5e7ef;color:#667085;font-size:11px;line-height:1.6}.dpg-legal-footer a{color:#4937c4;text-decoration:none}
 .dpg-disclaimer{margin:16px 0;padding:14px 16px;border:1px solid #e5e7ef;border-radius:12px;background:#fffdf5;color:#5b4b16;font-size:12px;line-height:1.55}.dpg-consent{margin:12px 0;padding:11px;border:1px solid #ddd9ff;border-radius:10px;background:#faf9ff;font-size:11px;line-height:1.5;color:#344054}.dpg-consent input{width:auto;margin-right:7px;vertical-align:middle}.dpg-consent a{color:#4937c4}
 @media(max-width:600px){.dpg-brand{gap:10px;margin-top:14px;padding-top:12px}.dpg-brand img{width:58px;height:58px;border-radius:11px;padding:4px}.dpg-brand strong{font-size:12px}.dpg-brand span{font-size:10px}}
 `;
 document.head.appendChild(s);
}
function injectBrand(){
 const header=document.querySelector('header .hero');
 if(header && !document.getElementById('dpg-brand')){
  const b=document.createElement('div');b.id='dpg-brand';b.className='dpg-brand';
  b.innerHTML='<img src="'+LOGO+'" alt="Salud y Vida Tienda Online"><div><strong>Producto de Salud y Vida Tienda Online</strong><span>Herramienta digital de Salvidatienda para investigación y evaluación de productos.</span></div>';
  header.appendChild(b);
 }
 const main=document.querySelector('main');
 if(main && !document.getElementById('dpg-disclaimer')){
  const d=document.createElement('div');d.id='dpg-disclaimer';d.className='dpg-disclaimer';
  d.innerHTML='<b>⚠️ Aviso importante:</b> Los resultados del Detector de Producto Ganador son orientativos y se generan mediante investigación automatizada y análisis de datos disponibles. No constituyen garantía de ventas, rentabilidad ni asesoría médica, jurídica, financiera o regulatoria. Verifica siempre las fuentes, la normativa y las condiciones reales del mercado antes de tomar decisiones.';
  const h2=main.querySelector('h2'); if(h2) h2.insertAdjacentElement('beforebegin',d); else main.prepend(d);
 }
 if(!document.getElementById('dpg-legal-footer')){
  const f=document.createElement('footer');f.id='dpg-legal-footer';f.className='dpg-legal-footer';
  f.innerHTML='<b>Salud y Vida Tienda Online</b> · Producto digital de Salvidatienda<br>Al usar las funciones de guardado aceptas el tratamiento de tus datos conforme a la política aplicable. <a href="'+PRIVACY_URL+'" target="_blank" rel="noopener">Política de privacidad</a> · <a href="'+LEGAL_URL+'" target="_blank" rel="noopener">Aviso legal</a> · <a href="'+TERMS_URL+'" target="_blank" rel="noopener">Términos de uso</a><br>Contacto: saludyvidatiendaonline@outlook.com';
  document.body.appendChild(f);
 }
}
function addConsent(){
 const modal=document.getElementById('dpg-auth-modal'); if(!modal || document.getElementById('dpg-privacy-consent')) return;
 const msg=document.getElementById('dpg-auth-msg'); if(!msg) return;
 const wrap=document.createElement('div');wrap.id='dpg-privacy-consent';wrap.className='dpg-consent';
 wrap.innerHTML='<label style="font-weight:400;margin:0"><input id="dpg-consent-check" type="checkbox"> He leído y acepto el <a href="'+PRIVACY_URL+'" target="_blank" rel="noopener">Aviso de privacidad y tratamiento de datos</a> y los <a href="'+TERMS_URL+'" target="_blank" rel="noopener">Términos de uso</a>. Entiendo que el correo se utilizará para crear y validar mi acceso y guardar mis investigaciones.</label>';
 msg.parentNode.insertBefore(wrap,msg);
 modal.addEventListener('click',function(e){
  const btn=e.target.closest('#dpg-auth-send'); if(!btn) return;
  const check=document.getElementById('dpg-consent-check');
  if(!check || !check.checked){
   e.preventDefault();e.stopImmediatePropagation();
   msg.textContent='Debes aceptar el aviso de privacidad y los términos de uso para crear tu acceso y guardar la investigación.';
   msg.style.color='#b42318';
   return;
  }
  try{
   const pending=JSON.parse(localStorage.getItem('dpg_pending_research_v39')||'null');
   if(pending){
    pending.privacyConsentAt=new Date().toISOString();
    pending.privacyPolicyVersion=PRIVACY_VERSION;
    pending.termsVersion=PRIVACY_VERSION;
    localStorage.setItem('dpg_pending_research_v39',JSON.stringify(pending));
   }
   localStorage.setItem('dpg_privacy_consent_v1',JSON.stringify({at:new Date().toISOString(),version:PRIVACY_VERSION}));
  }catch(_e){}
 },true);
}
function loadDeviceBridge(){
 if(document.getElementById('dpg-device-bridge')) return;
 const s=document.createElement('script');s.id='dpg-device-bridge';s.src='/device-bridge.js?v=20260827';s.defer=true;document.head.appendChild(s);
}
function init(){
 addStyle();injectBrand();loadDeviceBridge();
 const observer=new MutationObserver(()=>{injectBrand();addConsent();});
 observer.observe(document.body,{childList:true,subtree:true});
 addConsent();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
