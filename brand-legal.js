(function(){
'use strict';
const LOGO='data:image/jpeg;base64,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';
const PRIVACY_URL='https://salvidatienda.mitiendanube.com/politica-de-privacidad/';
const TERMS_URL='https://detector-producto-ganador.vercel.app/terminos-de-uso.html';
const LEGAL_URL='https://detector-producto-ganador.vercel.app/aviso-legal.html';
const PRIVACY_VERSION='2026-08-25-v1';
function addStyle(){
 const s=document.createElement('style');
 s.textContent=`.dpg-brand{display:flex;align-items:center;gap:12px;margin-top:10px}.dpg-brand img{width:58px;height:58px;object-fit:contain;border-radius:10px;background:#fff;padding:3px}.dpg-brand strong{font-size:12px;display:block;opacity:.95}.dpg-brand span{font-size:11px;opacity:.8;display:block;margin-top:2px}.dpg-legal-footer{margin:28px auto 10px;max-width:1220px;padding:18px 20px;border-top:1px solid #e5e7ef;color:#667085;font-size:11px;line-height:1.6}.dpg-legal-footer a{color:#4937c4;text-decoration:none}.dpg-disclaimer{margin:16px 0;padding:14px 16px;border:1px solid #e5e7ef;border-radius:12px;background:#fffdf5;color:#5b4b16;font-size:12px;line-height:1.55}.dpg-consent{margin:12px 0;padding:11px;border:1px solid #ddd9ff;border-radius:10px;background:#faf9ff;font-size:11px;line-height:1.5;color:#344054}.dpg-consent input{width:auto;margin-right:7px;vertical-align:middle}.dpg-consent a{color:#4937c4}`;
 document.head.appendChild(s);
}
function injectBrand(){
 const header=document.querySelector('header .hero');
 if(header && !document.getElementById('dpg-brand')){
  const b=document.createElement('div');b.id='dpg-brand';b.className='dpg-brand';
  b.innerHTML='<img src="'+LOGO+'" alt="Salud y Vida Tienda Online"><div><strong>Producto de Salud y Vida Tienda Online</strong><span>Herramienta digital independiente para investigación y evaluación de productos.</span></div>';
  header.appendChild(b);
 }
 const main=document.querySelector('main');
 if(main && !document.getElementById('dpg-disclaimer')){
  const d=document.createElement('div');d.id='dpg-disclaimer';d.className='dpg-disclaimer';
  d.innerHTML='<b>⚠️ Aviso importante:</b> Los resultados del Detector de Producto Ganador son orientativos y se generan mediante investigación automatizada y análisis de datos disponibles. No constituyen garantía de ventas, rentabilidad ni asesoría médica, jurídica, financiera o regulatoria. Debes verificar las fuentes, la normativa y las condiciones reales del mercado antes de tomar decisiones.';
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
   e.preventDefault(); e.stopImmediatePropagation();
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
function init(){
 addStyle(); injectBrand();
 const observer=new MutationObserver(()=>addConsent());
 observer.observe(document.body,{childList:true,subtree:true});
 addConsent();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
