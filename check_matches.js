const fs = require('fs'); 
const data = JSON.parse(fs.readFileSync('e:/Proxy/bank2.bzld.click.har', 'utf8')); 
const entries = data.log.entries.filter(e => e.response && e.response.content && e.response.content.text && e.response.content.text.includes('dataType: "json"')); 
entries.forEach(e => { 
  console.log('URL: ' + e.request.url); 
  const text = e.response.content.text; 
  const matches = [...text.matchAll(/.{0,50}dataType: "json".{0,50}/g)]; 
  matches.forEach(m => console.log('Match: ' + m[0].replace(/\n/g, ' '))); 
  console.log('---'); 
});
