const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, extra = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: module.exports, module, process: { env: {} }, Buffer, URL, Response, ...extra,
      require: name => name in mocks ? mocks[name] : require(name) });
  return module.exports;
}
test('instance names do not collide after punctuation removal or shared prefix', () => {
  const api = load('src/lib/whatsapp.ts', { './money': { waDigits: x => x } });
  assert.notEqual(api.instanceNameFor('a-b'), api.instanceNameFor('ab'));
  assert.notEqual(api.instanceNameFor('x'.repeat(30)+'a'), api.instanceNameFor('x'.repeat(30)+'b'));
  assert.throws(() => api.instanceNameFor(''));
});
test('existing mother account password is never reset', async () => {
  const sql = async parts => {
    const q = parts.join('?');
    if (q.includes('from "user"')) return [{ id: 'owner' }];
    if (q.includes('from schools')) return [{ user_id: 'owner' }];
    throw Error('Unexpected write: '+q);
  };
  const api = load('src/lib/mae.server.ts', {
    '@/lib/db': { getSql: async () => sql },
    '@/lib/site': { PLATFORM_OWNER_EMAIL: 'contato@smarttatame.com.br' },
    'better-auth/crypto': { hashPassword: () => { throw Error('Password overwrite'); } },
  });
  assert.equal(await api.ensureMaeAccount(), 'owner');
});
test('concurrent invoice reservations are unique and isolated by tenant and day', async () => {
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync(path.join(root, 'migrations/0021_wa_dispatch_claims.sql'), 'utf8'));
    const reserve = (u,d) => db.query('insert into wa_dispatch_claims (user_id,kind,item_id,dispatch_day) values ($1,$2,$3,$4) on conflict do nothing returning item_id', [u,'invoice','invoice1',d]);
    const rows = await Promise.all([reserve('a','2026-09-13'),reserve('a','2026-09-13')]);
    assert.equal(rows.reduce((n,r)=>n+r.rows.length,0),1);
    assert.equal((await reserve('b','2026-09-13')).rows.length,1);
    assert.equal((await reserve('a','2026-09-14')).rows.length,1);
  } finally { await db.close(); }
});
test('academies receive their own token, never the platform token', async () => {
  const instances = new Map();
  const created = [];
  const sql = async (parts,...args) => {
    const q = parts.join('?');
    if(q.includes('select wa_url, wa_instance')) return [{wa_url:'http://129.121.55.118',wa_instance:'mother',wa_token:'GLOBAL',owner_user_id:'owner'}];
    if(q.includes('select user_id from schools')) return [{user_id:args[0]}];
    if(q.includes('insert into wa_school_instances')) { if(!instances.has(args[0])) instances.set(args[0],{instance_name:args[1],instance_token:args[2],provisioned:false});return []; }
    if(q.includes('select instance_name')) return [instances.get(args[0])];
    if(q.includes('update wa_school_instances')) {instances.get(args[0]).provisioned=true;return [];}
    if(q.includes('update schools')) return [];
    throw Error('Unexpected query: '+q);
  };
  sql.query=async()=>[];
  const api = load('src/lib/platform-wa.server.ts', {
    '@/lib/db':{getSql:async()=>sql},
    '@/lib/site':{isMaeEmail:()=>false,PLATFORM_OWNER_EMAIL:'owner@example.com'},
    '@/lib/whatsapp':{normalizeEvolutionUrl:x=>x,instanceNameFor:id=>'ts'+id,
      createEvolutionInstance:async opts=>{created.push(opts);assert.equal(opts.token,'GLOBAL');assert.notEqual(opts.instanceToken,'GLOBAL');},
      evolutionState:async opts=>{assert.notEqual(opts.token,'GLOBAL');return 'close';}},
  });
  const a=await api.ensureSchoolWa('a');const b=await api.ensureSchoolWa('b');
  assert.notEqual(a.token,b.token);assert.notEqual(a.instance,b.instance);
  assert.equal((await api.ensureSchoolWa('a')).token,a.token);
  assert.equal(created.length,2);
});
