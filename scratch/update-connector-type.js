const Datastore = require('@seald-io/nedb');
const path = require('path');

const db = new Datastore({ filename: path.join(process.cwd(), 'src/data/connectors.db'), autoload: true });

db.loadDatabase((err) => {
  if (err) { console.error('Load error:', err); process.exit(1); }
  
  db.update({ id: 'test-port' }, { $set: { connectorType: 'core', name: 'Core Serena Test' } }, {}, (err, n) => {
    if (err) console.error('Error test-port:', err);
    else console.log('Updated test-port:', n, 'docs');
  });
  
  db.update({ id: 'core-serena' }, { $set: { connectorType: 'core' } }, {}, (err, n) => {
    if (err) console.error('Error core-serena:', err);
    else console.log('Updated core-serena:', n, 'docs');
  });

  setTimeout(() => {
    db.find({}, (err, docs) => {
      if (err) { console.error(err); process.exit(1); }
      docs.forEach(d => console.log(`[${d.id}] connectorType=${d.connectorType} name="${d.name}"`));
      process.exit(0);
    });
  }, 800);
});
