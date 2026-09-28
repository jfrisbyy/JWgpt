// Email + password accounts with server-side sessions.
// The Worker entry resolves the session cookie and passes the signed-in user to the
// rest of the app through the internal x-petey-user-* headers. Any copy of those
// headers sent by a browser is removed first, so they cannot be forged.
const sessionCookie='__Host-petey_session';
const sessionDays=30,resetHours=48,maxFailedLogins=8,lockMinutes=15,pbkdf2Iterations=100000;
const identityHeaders=['x-petey-user-id','x-petey-user-email','oai-authenticated-user-id','oai-authenticated-user-email'];
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=text=>Uint8Array.from(text.match(/../g)||[],h=>parseInt(h,16));
const randomToken=(size=32)=>hex(crypto.getRandomValues(new Uint8Array(size)));
const normalEmail=value=>str(value,254).trim().toLowerCase();
const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const shortCode=()=>randomToken(8).toUpperCase().match(/.{1,4}/g).join('-');
const cleanCode=value=>str(value,100).replace(/[\s-]/g,'').toUpperCase();
function safeEqual(a,b){a=String(a);b=String(b);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
function passwordProblem(password){if(typeof password!=='string'||password.length<10)return 'Use a password of at least 10 characters.';if(password.length>200)return 'Use a password under 200 characters.';return null}
async function derive(password,salt,iterations){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256))}
async function hashPassword(password){const salt=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2$${pbkdf2Iterations}$${hex(salt)}$${await derive(password,salt,pbkdf2Iterations)}`}
async function checkPassword(password,stored){const [scheme,iterations,salt,expected]=String(stored).split('$');if(scheme!=='pbkdf2'||!expected)return false;return safeEqual(await derive(password,fromHex(salt),Number(iterations)),expected)}
function readCookie(request,name){for(const part of (request.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()}return null}
const setSession=token=>`${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDays*86400}`;
const clearSession=()=>`${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function withCookie(response,cookie){response.headers.append('Set-Cookie',cookie);return response}

async function authenticate(request,env){
 const token=readCookie(request,sessionCookie);if(!token||!/^[0-9a-f]{64}$/.test(token)||!env.DB)return null;
 const row=await env.DB.prepare('SELECT u.id,u.email,s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').bind(await digestText(token)).first();
 if(!row||row.expires_at<=new Date().toISOString())return null;
 return {id:row.id,email:row.email};
}
// Returns a copy of the request whose identity headers come only from the verified session.
function withIdentity(request,user){
 const headers=new Headers(request.headers);for(const name of identityHeaders)headers.delete(name);
 if(user){headers.set('x-petey-user-id',user.id);headers.set('x-petey-user-email',user.email)}
 return new Request(request,{headers});
}
async function startSession(env,userId){
 const token=randomToken(),now=new Date();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=? AND expires_at<=?').bind(userId,now.toISOString()),
  env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(await digestText(token),userId,now.toISOString(),new Date(now.getTime()+sessionDays*86400000).toISOString())
 ]);
 return token;
}
const signedIn=(env,userId,body={signedIn:true})=>startSession(env,userId).then(token=>withCookie(json(body),setSession(token)));

async function authAPI(request,env){
 const u=new URL(request.url),db=studyDB(env);
 if(request.method!=='POST')return json({error:'Use POST.'},405);
 if(request.headers.get('Origin')!==u.origin)return json({error:'Invalid origin.'},403);
 if(u.pathname==='/api/auth/logout'){const token=readCookie(request,sessionCookie);if(token)await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digestText(token)).run();return withCookie(json({signedOut:true}),clearSession())}
 const d=await requestData(request,4000),email=normalEmail(d.email),now=new Date().toISOString();

 if(u.pathname==='/api/auth/login'){
  const user=email?await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first():null;
  if(user?.locked_until&&user.locked_until>now)return json({error:'Too many attempts. Wait 15 minutes, then try again.',code:'LOCKED'},429);
  if(!user||!await checkPassword(str(d.password,200),user.password_hash)){
   if(user){const failed=user.failed_logins+1;await db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').bind(failed>=maxFailedLogins?0:failed,failed>=maxFailedLogins?new Date(Date.now()+lockMinutes*60000).toISOString():null,user.id).run()}
   return json({error:'That email and password do not match.'},401);
  }
  await db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=?').bind(user.id).run();
  return signedIn(env,user.id);
 }

 if(u.pathname==='/api/auth/register'){
  const name=str(d.name,80).trim(),code=cleanCode(d.code),problem=passwordProblem(d.password);
  if(!validEmail(email))return json({error:'Enter a valid email address.'},400);if(problem)return json({error:problem},400);if(!name)return json({error:'Enter the name you would like to use.'},400);
  if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return json({error:'An account already uses this email. Sign in instead.'},409);
  const adminEmail=normalEmail(env.FAMILY_ADMIN_EMAIL);
  if(!code&&adminEmail&&email===adminEmail){
   // First administrator sign-up. An admin member left over from the previous sign-in system is linked to this account.
   const existing=await db.prepare("SELECT m.owner FROM members m LEFT JOIN users u ON u.id=m.owner WHERE m.role='admin' AND u.id IS NULL ORDER BY m.joined_at LIMIT 1").bind().first();
   const id=existing?.owner||crypto.randomUUID();
   await db.batch([
    db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES (?,?,?,?)').bind(id,email,await hashPassword(d.password),now),
    db.prepare("INSERT INTO members(owner,name,role,active,profile,joined_at) VALUES (?,?,'admin',1,'{}',?) ON CONFLICT(owner) DO NOTHING").bind(id,name,now)
   ]);
   return signedIn(env,id,{signedIn:true,joined:true});
  }
  if(!code)return json({error:'Enter your family invitation code.'},400);
  const hash=await digestText(code),id=crypto.randomUUID();
  const invite=await db.prepare('SELECT hash FROM invitations WHERE hash=? AND redeemed_by IS NULL AND revoked=0 AND expires_at>?').bind(hash,now).first();
  if(!invite)return json({error:'This invitation is invalid, expired, or already used.'},400);
  await db.batch([
   db.prepare('UPDATE invitations SET redeemed_by=? WHERE hash=? AND redeemed_by IS NULL AND revoked=0 AND expires_at>?').bind(id,hash,now),
   db.prepare('INSERT INTO users(id,email,password_hash,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM invitations WHERE hash=? AND redeemed_by=?)').bind(id,email,await hashPassword(d.password),now,hash,id),
   db.prepare("INSERT INTO members(owner,name,role,profile,joined_at) SELECT ?,?,'member','{}',? WHERE EXISTS (SELECT 1 FROM invitations WHERE hash=? AND redeemed_by=?)").bind(id,name,now,hash,id)
  ]);
  if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return json({error:'This invitation is invalid, expired, or already used.'},400);
  return signedIn(env,id,{signedIn:true,joined:true});
 }

 if(u.pathname==='/api/auth/reset'){
  // Uses a one-time code from the administrator. Also sets up accounts for members who joined before email sign-in existed.
  const problem=passwordProblem(d.password),hash=await digestText(cleanCode(d.code));if(problem)return json({error:problem},400);if(!validEmail(email))return json({error:'Enter a valid email address.'},400);
  const reset=await db.prepare('SELECT owner FROM password_resets WHERE hash=? AND used_at IS NULL AND expires_at>?').bind(hash,now).first();
  if(!reset)return json({error:'This reset code is invalid, expired, or already used.'},400);
  const current=await db.prepare('SELECT id,email FROM users WHERE id=?').bind(reset.owner).first(),taken=await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if(taken&&taken.id!==reset.owner)return json({error:'Another account already uses this email.'},409);
  const passwordHash=await hashPassword(d.password);
  await db.batch([
   db.prepare('UPDATE password_resets SET used_at=? WHERE hash=?').bind(now,hash),
   current?db.prepare('UPDATE users SET email=?,password_hash=?,failed_logins=0,locked_until=NULL WHERE id=?').bind(email,passwordHash,reset.owner):db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES (?,?,?,?)').bind(reset.owner,email,passwordHash,now),
   db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(reset.owner)
  ]);
  return signedIn(env,reset.owner);
 }

 if(u.pathname==='/api/auth/password'){
  const owner=request.headers.get('x-petey-user-id');if(!owner)return json({error:'Sign in first.'},401);
  const user=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(owner).first(),problem=passwordProblem(d.password);
  if(!user||!await checkPassword(str(d.current,200),user.password_hash))return json({error:'Your current password is not correct.'},400);if(problem)return json({error:problem},400);
  await db.batch([db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(d.password),owner),db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(owner)]);
  return signedIn(env,owner,{changed:true});
 }
 return json({error:'Not found.'},404);
}
// Administrator: create a one-time code a member uses to set a new password (or first set up email sign-in).
async function createPasswordReset(env,adminId,memberId){
 const db=studyDB(env),member=await db.prepare('SELECT owner FROM members WHERE owner=?').bind(str(memberId,200)).first();if(!member)return json({error:'Member not found.'},404);
 const code=shortCode(),expires=new Date(Date.now()+resetHours*3600000).toISOString();
 await db.batch([db.prepare('UPDATE password_resets SET used_at=? WHERE owner=? AND used_at IS NULL').bind(new Date().toISOString(),member.owner),db.prepare('INSERT INTO password_resets(hash,owner,created_by,expires_at) VALUES (?,?,?,?)').bind(await digestText(cleanCode(code)),member.owner,adminId,expires)]);
 return json({code,expiresAt:expires},201);
}
