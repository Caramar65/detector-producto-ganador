const fs=require('fs');
const path=require('path');

module.exports=async function handler(req,res){
  try{
    let html=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
    const supabaseTag='<script src="/supabase-client.js"></script>';
    const scoringBridge=`<script>
(function(){
  if(window.__dpgScoringBridge)return;
  window.__dpgScoringBridge=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    if(method==='POST'&&/\\/api\\/research(?:\\?|$)/.test(url)){
      const response=await nativeFetch(input,init);
      if(!response.ok)return response;
      try{
        const cloned=response.clone();
        const result=await cloned.json();
        let products=[];
        try{
          const body=init&&init.body;
          if(typeof body==='string')products=JSON.parse(body).products||[];
          else if(body instanceof FormData)products=[];
        }catch(e){}
        const scored=await nativeFetch('/api/recalculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({result,products})});
        if(scored.ok){
          const data=await scored.json();
          return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
        }
      }catch(e){
        console.warn('Scoring bridge fallback:',e);
      }
      return response;
    }
    return nativeFetch(input,init);
  };
})();
</script>`;
    if(!html.includes('/supabase-client.js'))html=html.replace('</head>',supabaseTag+'\n</head>');
    if(!html.includes('__dpgScoringBridge'))html=html.replace('</head>',scoringBridge+'\n</head>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(html);
  }catch(e){
    console.error('App render error',e);
    return res.status(500).send('No fue posible cargar la aplicación.');
  }
};
