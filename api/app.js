const fs=require('fs');
const path=require('path');

module.exports=async function handler(req,res){
  try{
    let html=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
    const tag='<script src="/supabase-client.js"></script>';
    if(!html.includes('/supabase-client.js')) html=html.replace('</head>',tag+'\n</head>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(html);
  }catch(e){
    console.error('App render error',e);
    return res.status(500).send('No fue posible cargar la aplicación.');
  }
};