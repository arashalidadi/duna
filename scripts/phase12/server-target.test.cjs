'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DbStop } = require('./db-policy.cjs');
const { exactUrl, envFile, pgpassPassword, inspectContainer, connections,
  dockerQuery, inspectSession, journalGrantSql } = require('./server-target.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'phase12-server-target-'));
const runtime = 'postgresql://shipping_runtime_p11:runtime-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const owner = 'postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const container = {environment:{POSTGRES_USER:'shipping',POSTGRES_PASSWORD:'docker-secret'}};
test('real runtime DATABASE_URL remains separate from migration-owner connection', () => {
  assert.equal(exactUrl(runtime,'shipping_runtime_p11'),runtime);
  assert.throws(()=>exactUrl(runtime,'shipping'),DbStop);
  assert.throws(()=>exactUrl(owner,'shipping_runtime_p11'),DbStop);
  assert.deepEqual(connections({DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:owner},root,container),
    {owner,runtime});
  assert.equal(connections({DATABASE_URL:runtime},root,container).owner,
    'postgresql://shipping:docker-secret@127.0.0.1:5432/duna_seed_test?schema=public');
  assert.throws(()=>connections({DATABASE_URL:runtime},root,{environment:{POSTGRES_USER:'postgres'}}),DbStop);
  const elsewhere='postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test1?schema=public';
  assert.throws(()=>connections({DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:elsewhere},root,container),DbStop);
  for(const url of [runtime.replace('?schema=public','?schema=private'),
    runtime.replace('127.0.0.1','localhost'),runtime.replace(':5432',':5433')])
    assert.throws(()=>exactUrl(url,'shipping_runtime_p11'),DbStop);
});
test('reads an existing dotenv/pgpass as data, never executes or prints it', () => {
  const file=path.join(root,'.env');
  fs.writeFileSync(file,`# comment\nDATABASE_URL='${owner}'\nMIGRATOR_DATABASE_URL="${owner}"\nOTHERS=ignored\n`,{mode:0o600});
  assert.equal(envFile(file).MIGRATOR_DATABASE_URL,owner);
  assert.equal(connections({DATABASE_URL:runtime},root,container).owner,owner);
  fs.writeFileSync(file,`DATABASE_URL=${runtime}\nDATABASE_URL=${owner}\n`);
  assert.throws(()=>envFile(file),DbStop);
  fs.unlinkSync(file);
  const passfile=path.join(root,'pgpass');
  fs.writeFileSync(passfile,'127.0.0.1:5432:duna_seed_test:shipping:has\\:colon\n',{mode:0o600});
  assert.equal(pgpassPassword(passfile),'has:colon');
  assert.match(connections({DATABASE_URL:runtime,PGPASSFILE:passfile},root,{environment:{}}).owner,
    /shipping:has%3Acolon@127\.0\.0\.1/);
  fs.chmodSync(passfile,0o644);
  assert.throws(()=>pgpassPassword(passfile),DbStop);
  fs.unlinkSync(passfile);
});
test('Docker inspection refuses wrong/stopped container, port mapping or PG client major', () => {
  function run(_bin,args) {
    if (args[0]==='inspect') return {status:0,stdout:JSON.stringify([{Name:'/erp-postgres',
      State:{Running:true},NetworkSettings:{Ports:{'5432/tcp':[
        {HostPort:'5432',HostIp:'127.0.0.1'}]}},
      Config:{Env:['POSTGRES_USER=shipping','POSTGRES_PASSWORD=private']}}])};
    return {status:0,stdout:'psql (PostgreSQL) 16.8\n'};
  }
  const inspected=inspectContainer(run);
  assert.equal(inspected.environment.POSTGRES_USER,'shipping');
  assert.equal(inspected.environment.POSTGRES_PASSWORD,'private');
  const wrong=(_bin,args) => args[0]==='inspect' ?
    {status:0,stdout:JSON.stringify([{Name:'/other',State:{Running:true},
      NetworkSettings:{Ports:{'5432/tcp':[{HostPort:'5432',HostIp:'127.0.0.1'}]}}}])} :
    {status:0,stdout:'psql (PostgreSQL) 16.8'};
  assert.throws(()=>inspectContainer(wrong),DbStop);
});
test('correlates host backend PID to container session and restricts any grant to shipping', () => {
  const nonce='phase12-'+'a'.repeat(24),pid=4321;
  let command='';
  const runner=(_bin,args,config)=>{
    command=JSON.stringify(args)+' '+config.input;
    return {status:0,stdout:JSON.stringify({match:true,journalOwner:'postgres',history:[{
      name:'reviewed',checksum:'2'.repeat(64),finished:true,rolledback:false}]})};
  };
  const result=inspectSession(container,pid,nonce,runner,'postgres');
  assert.equal(result.journalOwner,'postgres');
  assert.equal(result.adminRole,'postgres');
  assert.match(command,/pg_stat_activity/);
  assert.match(command,/application_name/);
  assert.match(command,/4321/);
  assert(!command.includes('docker-secret'));
  const sql=journalGrantSql(pid,nonce,'postgres');
  assert.match(sql,/GRANT SELECT, INSERT, UPDATE ON TABLE public\._prisma_migrations TO shipping;/);
  assert.doesNotMatch(sql,/GRANT.*shipping_runtime_p11/);
  assert.doesNotMatch(sql,/ALTER.*OWNER|DROP|DELETE FROM/i);
  assert.match(fs.readFileSync(path.join(__dirname,'../../apps/api/scripts/phase12-db-deploy.ts'),'utf8'),
    /inspectSession\(container, session\.pid, nonce, undefined, 'postgres'\)/);
  assert.throws(()=>journalGrantSql(pid,'invalid','postgres'),DbStop);
  assert.throws(()=>journalGrantSql(pid,nonce,'random-owner'),DbStop);
  assert.throws(()=>inspectSession(container,pid,nonce,()=>({status:0,stdout:'{"match":false}'})),DbStop);
  const fail=()=>({status:1,stderr:'password=secret'});
  assert.throws(()=>dockerQuery('SELECT 1;',container,fail), (error)=>
    error instanceof DbStop && !/secret|password=/.test(error.message));
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
