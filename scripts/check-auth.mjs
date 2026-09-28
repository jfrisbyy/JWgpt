// Email + password sign-in: registration, admin bootstrap, sessions, lockout, password change and reset codes.
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {testEnvironment,request} from './check-studies.mjs';
const env={...testEnvironment(),FAMILY_ADMIN_EMAIL:'Admin@Family.test'};
const origin='https://study.test';
const cookieOf=r=>(r.headers.get('Set-Cookie')||'').split(';')[0];
const send=(path,{body,cookie,method='POST',from=origin}={})=>worker.fetch(new Request(origin+path,{method,headers:{Origin:from,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
const account=async cookie=>(await send('/api/account',{method:'GET',cookie})).json();

// A member from the previous sign-in system (admin person-a exists in the test data without a user row, once we remove it).
await env.DB.prepare("DELETE FROM users WHERE id='person-a'").bind().run();
await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id='person-a'").bind().run();

// Validation and origin checks.
assert.equal((await send('/api/auth/login',{body:{email:'x@y.z',password:'whatever'},from:'https://evil.test'})).status,403);
assert.equal((await send('/api/auth/register',{body:{email:'bad',password:'long enough pw',name:'A'}})).status,400);
assert.equal((await send('/api/auth/register',{body:{email:'a@b.co',password:'short',name:'A'}})).status,400);
assert.equal((await send('/api/auth/register',{body:{email:'a@b.co',password:'long enough pw',name:'A'}})).status,400,'invitation code required');
assert.equal((await worker.fetch(new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin},body:'not json'}),env)).status,400);

// Admin bootstrap links the legacy administrator record.
let r=await send('/api/auth/register',{body:{email:'admin@family.test',password:'correct horse battery',name:'Admin'}});
assert.equal(r.status,200);const adminCookie=cookieOf(r);
assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.match(r.headers.get('Set-Cookie'),/Secure/);assert.match(r.headers.get('Set-Cookie'),/SameSite=Lax/);
let a=await account(adminCookie);assert.equal(a.member.id,'person-a');assert.equal(a.member.role,'admin');assert.equal(a.email,'admin@family.test');
assert.equal((await send('/api/auth/register',{body:{email:'admin@family.test',password:'correct horse battery',name:'Again'}})).status,409);

// Invitation registration.
const invite=await (await send('/api/family/invitations',{body:{label:'Cousin'},cookie:adminCookie})).json();
r=await send('/api/auth/register',{body:{email:'cousin@family.test',password:'cousin password 1',name:'Cousin',code:invite.code.toLowerCase()}});
assert.equal(r.status,200);const cousinCookie=cookieOf(r);a=await account(cousinCookie);assert.equal(a.member.name,'Cousin');assert.equal(a.member.role,'member');
assert.equal((await send('/api/auth/register',{body:{email:'other@family.test',password:'other password 1',name:'Other',code:invite.code}})).status,400,'invitation is single use');
assert.equal((await send('/api/studies',{method:'GET',cookie:cousinCookie})).status,200);

// Login, wrong password, lockout.
assert.equal((await send('/api/auth/login',{body:{email:'cousin@family.test',password:'wrong password'}})).status,401);
assert.equal((await send('/api/auth/login',{body:{email:'nobody@family.test',password:'wrong password'}})).status,401);
r=await send('/api/auth/login',{body:{email:'COUSIN@family.test',password:'cousin password 1'}});assert.equal(r.status,200);
for(let i=0;i<8;i++)await send('/api/auth/login',{body:{email:'cousin@family.test',password:'wrong password'}});
assert.equal((await send('/api/auth/login',{body:{email:'cousin@family.test',password:'cousin password 1'}})).status,429);
await env.DB.prepare("UPDATE users SET locked_until=NULL WHERE email='cousin@family.test'").bind().run();

// Password change signs out other sessions.
const second=cookieOf(await send('/api/auth/login',{body:{email:'cousin@family.test',password:'cousin password 1'}}));
assert.equal((await send('/api/auth/password',{body:{current:'nope',password:'new cousin password'},cookie:cousinCookie})).status,400);
r=await send('/api/auth/password',{body:{current:'cousin password 1',password:'new cousin password'},cookie:cousinCookie});assert.equal(r.status,200);
const cousinNew=cookieOf(r);assert.equal((await account(second)).signedIn,false);assert.equal((await account(cousinNew)).signedIn,true);

// Logout ends the session.
assert.equal((await send('/api/auth/logout',{cookie:cousinNew})).status,200);assert.equal((await account(cousinNew)).signedIn,false);

// Reset codes: only admins create them; they set up legacy members (person-b has no user row) and are single use.
await env.DB.prepare("DELETE FROM users WHERE id='person-b'").bind().run();
const cousinAgain=cookieOf(await send('/api/auth/login',{body:{email:'cousin@family.test',password:'new cousin password'}}));
assert.equal((await send('/api/family/password-resets',{body:{id:'person-b'},cookie:cousinAgain})).status,403);
const members=await (await send('/api/family/members',{method:'GET',cookie:adminCookie})).json();assert.equal(members.members.find(m=>m.id==='person-b').hasLogin,false);
const reset=await (await send('/api/family/password-resets',{body:{id:'person-b'},cookie:adminCookie})).json();assert.ok(reset.code);
r=await send('/api/auth/reset',{body:{email:'b@family.test',password:'person b password',code:reset.code}});assert.equal(r.status,200);
a=await account(cookieOf(r));assert.equal(a.member.id,'person-b');
assert.equal((await send('/api/auth/reset',{body:{email:'b@family.test',password:'person b password',code:reset.code}})).status,400);
assert.equal((await send('/api/auth/login',{body:{email:'b@family.test',password:'person b password'}})).status,200);

// Expired sessions are rejected.
await env.DB.prepare("UPDATE auth_sessions SET expires_at='2000-01-01T00:00:00.000Z'").bind().run();
assert.equal((await account(adminCookie)).signedIn,false);
console.log('Auth passed: invitation registration, admin bootstrap and legacy linking, secure cookies, login, lockout, logout, password change, reset/setup codes, forged-header rejection, and session expiry.');
