import http from 'node:http';
http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{const j=JSON.parse(b);const u=JSON.stringify(j.messages[0].content);let text;
if(j.system.includes('translator')){const m=/<transcript>\\n([\s\S]*?)\\n<\/transcript>/.exec(u);text=(m?m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"'):'').split('\n').map(p=>!p.trim()?p:p.replace(/^(\[[\d:]+\] )?/,'$1[HI] ')).join('\n');}
else text='{"maxPoints":10,"points":7,"criteria":[{"name":"Task list is real and specific","points":4,"max":5,"reason":"Four concrete tasks listed."},{"name":"One task chosen","points":0,"max":5,"reason":"No task was circled for this week."}],"feedback":"Good, concrete list. Next, mark which task you will try with AI this week."}';
res.setHeader('content-type','application/json');res.end(JSON.stringify({content:[{type:'text',text}]}));});}).listen(4791,'127.0.0.1');
