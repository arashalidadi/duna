'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { StageFailure, inspectLine, safeDbResult, prechangeApproval, offlineCommands,
  workflow, applicationManager, verifyWebArchive, readOnlyRoutes } = require('./server-workflow.cjs');
const runtime='postgresql://shipping_runtime_p11:runtime-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const owner='postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const inspect=`PHASE12_DB_INSPECT_PASS: PG16 erp-postgres correlation; journal owner=shipping; pending Phase 12=1; owner journal grant needed=false; permissions=0/7; digest=${'a'.repeat(64)}`;
const dbMarker='PHASE12_DB_VERIFY_PASS: checksum/history, RetentionPolicy structure, three protective triggers, seven Phase 12 permission codes (reserved actions ungranted), runtime read-only identity/privileges; configured archive criteria=0; configured deletion thresholds=0. No policy/schedule set by this command.';
test('inspection marker identifies idempotent/no-op vs required writes; backup prerequisite never guessed', () => {
  assert.equal(inspectLine(inspect).needsWrite,true);
  assert.equal(inspectLine(inspect.replace('pending Phase 12=1','pending Phase 12=0')
    .replace('permissions=0/7','permissions=7/7')).needsWrite,false);
  assert.equal(prechangeApproval({},false),'NO_DB_CHANGE');
  assert.throws(()=>prechangeApproval({},true,{isTTY:false}),StageFailure);
  assert.equal(prechangeApproval({PHASE12_PRECHANGE_BACKUP_ATTESTED:'I_HAVE_RESTORED_PRECHANGE_BACKUP'},true),
    'I_HAVE_RESTORED_PRECHANGE_BACKUP');
  assert.throws(()=>inspectLine('prisma status failed'),StageFailure);
  assert.match(safeDbResult(dbMarker),/runtime Prisma read: PASS/);
  assert.throws(()=>safeDbResult('PASS'),StageFailure);
});
test('apply uses owner only for DB, checks/restarts only apps AFTER verification, no schedules or demo seed', async () => {
  const commands=[],output=[];
  const run=(bin,args,env={})=>{
    commands.push({bin,args,env:{DATABASE_URL:env.DATABASE_URL,
      MIGRATOR_DATABASE_URL:env.MIGRATOR_DATABASE_URL,
      RUNTIME_DATABASE_URL:env.RUNTIME_DATABASE_URL,
      PGPASSFILE:env.PGPASSFILE,
      PHASE12_PRECHANGE_BACKUP_ATTESTED:env.PHASE12_PRECHANGE_BACKUP_ATTESTED}});
    if (bin==='pnpm' && args.join(' ')==='--version') return '9.15.9\n';
    if (bin==='systemctl' && args.includes('MainPID')) return '12345\n';
    if (args.at(-1)==='inspect') return inspect;
    if (args.at(-1)==='apply' || args.at(-1)==='verify') return dbMarker;
    return 'PASS\n';
  };
  const options={run,env:{DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:owner,
    PGPASSFILE:'/protected/owner-passfile',
    PHASE12_PRECHANGE_BACKUP_ATTESTED:'I_HAVE_RESTORED_PRECHANGE_BACKUP'},
    containerInspect:()=>({environment:{POSTGRES_USER:'shipping'}}),
    resolveUrls:()=>({owner,runtime}),review:()=>{},installCheck:()=>false,
    commands:()=>[['test-only-offline','scripts/phase12','node',['--test','fake.test.cjs']]],
    managerFactory:(env)=>{
      assert.equal(env.DATABASE_URL,runtime);
      assert.equal(env.MIGRATOR_DATABASE_URL,undefined);
      assert.equal(env.PGPASSFILE,undefined);
      return {kind:'systemd',units:['duna-api.service','duna-web.service']};
    },
    activations:()=>[['duna-phase12-archive.timer','disabled']],routes:(env)=>{
      assert.equal(env.DATABASE_URL,runtime);
      assert.equal(env.MIGRATOR_DATABASE_URL,undefined);
    },
    output:(line)=>output.push(line)};
  await workflow('apply',options);
  const calls=commands.map(({args})=>args.join(' '));
  const inspected=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts inspect'));
  const applied=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts apply'));
  const verified=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts verify'));
  const restart=calls.findIndex((x)=>x==='restart duna-api.service duna-web.service');
  assert.ok(inspected>=0 && inspected<applied && applied<verified && verified<restart);
  for (const cmd of commands) {
    if (cmd.args[0]==='exec' && cmd.args[1]==='tsx' &&
        cmd.args[2]==='apps/api/scripts/phase12-db-deploy.ts') {
      assert.equal(cmd.env.DATABASE_URL,owner);
      assert.equal(cmd.env.RUNTIME_DATABASE_URL,runtime);
    } else {
      assert.notEqual(cmd.env.DATABASE_URL,owner);
      assert.equal(cmd.env.MIGRATOR_DATABASE_URL,undefined);
      assert.equal(cmd.env.PGPASSFILE,undefined);
      assert.equal(cmd.env.RUNTIME_DATABASE_URL,undefined);
      if (cmd.bin==='node') assert.equal(cmd.env.DATABASE_URL,runtime);
    }
  }
  assert.equal(commands.find((x)=>x.args.at(-1)==='apply').env.PHASE12_PRECHANGE_BACKUP_ATTESTED,
    'I_HAVE_RESTORED_PRECHANGE_BACKUP');
  assert(output.some((line)=>line.startsWith('PHASE12_APPLY_PASS:')));
  assert(!commands.some(({args})=>args.join(' ').includes('seed:demo')));
  const unsafe=[];
  await assert.rejects(workflow('apply',{...options,run:(bin,args,env)=>{
    unsafe.push(args.join(' ')); return run(bin,args,env);
  },activations:()=>[['duna-phase12-archive.timer','enabled']],output:()=>{}}),StageFailure);
  assert(!unsafe.some((args)=>args.endsWith('phase12-db-deploy.ts apply')));
});
test('independent test executes NO migrate/seed/restart and fails closed with readable summary', async () => {
  const calls=[],lines=[];
  const run=(bin,args)=>{
    calls.push(`${bin} ${args.join(' ')}`);
    if(bin==='pnpm'&&args[0]==='--version') return '9.15.9';
    if(args.at(-1)==='inspect') return inspect.replace('pending Phase 12=1','pending Phase 12=0')
      .replace('permissions=0/7','permissions=7/7');
    if(args.at(-1)==='verify') return dbMarker;
    return 'PASS';
  };
  await workflow('test',{run,env:{DATABASE_URL:runtime},output:(m)=>lines.push(m),
    containerInspect:()=>({environment:{}}),resolveUrls:()=>({runtime,owner}),
    review:()=>{},installCheck:()=>false,commands:()=>[],
    activations:()=>[['duna-phase12-archive.timer','disabled']],routes:()=>{}});
  assert(!calls.some((line)=>/migrate deploy|seed-phase12|restart|docker compose/.test(line)));
  assert(lines.some((line)=>line.startsWith('PHASE12_TEST_PASS:')));
  const failed=[];
  await assert.rejects(workflow('test',{run:(bin,args)=>{
    if (bin==='pnpm'&&args[0]==='--version') return '9.15.9';
    if (args.at(-1)==='inspect') throw new StageFailure('Migration checksum differs');
    return 'PASS';
  },env:{DATABASE_URL:runtime},output:(m)=>failed.push(m),
  containerInspect:()=>({environment:{}}),resolveUrls:()=>({runtime,owner}),
  review:()=>{},installCheck:()=>false,commands:()=>[]}),StageFailure);
  assert(failed.some((line)=>line.includes('[FAIL] Independent read-only')));
  assert(failed.some((line)=>line.startsWith('PHASE12_TEST_FAIL:')));
});
test('test plan includes static/mocks/authorization/legacy regression, isolated Web build, no DB fixture runner', () => {
  const offline=offlineCommands('test');
  const commands=offline.map(([, ,bin,args])=>`${bin} ${args.join(' ')}`).join('\n');
  assert.match(commands,/prisma generate/);
  assert.match(commands,/prisma validate/);
  assert.match(commands,/test-phase12-archive\.ts/);
  assert.match(commands,/test-phase12-http\.ts/);
  assert.match(commands,/check:phase11:authz/);
  assert.match(commands,/check:seed-safety/);
  assert.match(commands,/check:api:build/);
  assert.match(commands,/@shipping\/web build/);
  assert.doesNotMatch(commands,/migrate deploy|db:seed|seed-demo|seed-phase12-permissions\.ts --/);
  assert.doesNotMatch(commands,/(?:exec tsx|node) apps\/api\/scripts\/run-phase12-archive\.ts/);
  const source=fs.readFileSync(path.join(__dirname,'server-workflow.cjs'),'utf8');
  assert.doesNotMatch(source,/run\('systemctl',\s*\['(?:enable|start|daemon-reload)'/);
  assert.doesNotMatch(source,/run\('node',\s*\['scripts\/phase12\/render-units\.cjs'/);
  assert.doesNotMatch(source,/prisma migrate reset/);
});
test('dashboard proof reads the actual App Router manifest, not the prerender manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'p12-archive-route-'));
  try {
    const manifest = path.join(root,'apps/web/.next/app-path-routes-manifest.json');
    fs.mkdirSync(path.dirname(manifest),{ recursive:true });
    fs.mkdirSync(path.join(root,'apps/web/messages'),{ recursive:true });
    for (const locale of ['en','fa','ar']) {
      fs.writeFileSync(path.join(root,`apps/web/messages/${locale}.json`),
        JSON.stringify({ archive:{ title:'Archive' } }));
    }
    fs.writeFileSync(manifest,JSON.stringify({ '/[locale]/(dashboard)/archive/page':'/[locale]/archive' }));
    assert.doesNotThrow(() => verifyWebArchive(root));
    fs.writeFileSync(manifest,'{}');
    assert.throws(() => verifyWebArchive(root), /protected archive dashboard route/);
  } finally { fs.rmSync(root,{ recursive:true, force:true }); }
});

test('live route probe uses only unauthenticated GETs and catches a missing audit/archive handler', async () => {
  const requests=[];
  let bad=false;
  const api=http.createServer((request,response)=>{
    requests.push([request.method,request.url,request.headers.authorization]);
    response.statusCode=request.url==='/api/v1/health' ? 200 :
      bad && request.url==='/api/v1/audit/export' ? 404 : 401;
    response.end('');
  });
  const web=http.createServer((request,response)=>{
    requests.push([request.method,request.url,request.headers.authorization]);
    response.statusCode=request.url?.endsWith('/archive') ? 200 : 404;
    response.end('');
  });
  try {
    await Promise.all([new Promise(resolve=>api.listen(0,'127.0.0.1',resolve)),
      new Promise(resolve=>web.listen(0,'127.0.0.1',resolve))]);
    const env={API_PORT:String(api.address().port),PHASE12_WEB_PORT:String(web.address().port)};
    await readOnlyRoutes(env);
    assert.equal(requests.length,9);
    assert.ok(requests.every(([method,,auth])=>method==='GET' && auth===undefined));
    bad=true;
    await assert.rejects(readOnlyRoutes(env),/audit\/export: expected 401, got 404/);
  } finally { await Promise.all([new Promise(resolve=>api.close(resolve)),
    new Promise(resolve=>web.close(resolve))]); }
});

test('app manager refuses incomplete/unapproved systemd units without touching any service', () => {
  assert.throws(()=>applicationManager({PHASE12_API_SYSTEMD_UNIT:'erp-postgres.service'},()=>''),StageFailure);
  assert.throws(()=>applicationManager({PHASE12_API_SYSTEMD_UNIT:'duna-api.service'},()=>''),StageFailure);
  assert.deepEqual(applicationManager({PHASE12_API_SYSTEMD_UNIT:'duna-api.service',
    PHASE12_WEB_SYSTEMD_UNIT:'duna-web.service'},(_bin,args)=>
      `ActiveState=active\nWorkingDirectory=/home/user/duna/apps/${args[1]==='duna-api.service'?'api':'web'}\n`,
    '/home/user/duna'),{kind:'systemd',units:['duna-api.service','duna-web.service']});
});
