'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { api, saveSession } from '../../src/api';

type LoginKind = 'customer' | 'business' | 'admin';
export function LoginClient({ kind }: { kind: LoginKind }) {
  const isBusiness = kind === 'business';
  const isAdmin = kind === 'admin';
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const session = isAdmin ? await api.adminLogin(identifier.trim(),password) : await api.login(identifier.trim(), password);
      const validType = isAdmin ? session.user.accountType==='ADMIN' : isBusiness ? session.user.accountType==='BUSINESS' : session.user.accountType === 'CUSTOMER';
      if (!validType) throw new Error(`This is not a ${kind} account. Please use the correct account portal.`);
      saveSession(session); window.location.replace(isAdmin ? '/admin' : isBusiness ? '/dashboard' : '/marketplace');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not sign you in. Please try again.'); }
    finally { setLoading(false); }
  }
  return <main className={`login-page login-${kind}`}>
    <section className="login-story" aria-label={`About ZimMarket for ${kind}s`}>
      <Link className="login-brand" href="/"><span className="login-logo">Z</span><span>ZimMarket</span></Link>
      <div className="login-story-copy"><span className="login-eyebrow">{isAdmin?'AUTHORIZED PERSONNEL ONLY':isBusiness?'ZIMMARKET FOR BUSINESS':'YOUR LOCAL MARKETPLACE'}</span><h1>{isAdmin?<>Protect the market.<br/><em>Operate with care.</em></>:isBusiness?<><span>Grow your business,</span><br/><em>reach further.</em></>:<>Welcome back<br/>to something <em>local.</em></>}</h1><p>{isAdmin?'Review businesses, investigate reports and protect marketplace users from one secure operations console.':isBusiness?'Manage your storefront, products and orders from one simple dashboard built for Zimbabwean businesses.':'Shop and book with trusted businesses from every corner of Zimbabwe.'}</p><div className="login-benefits">{isAdmin?<><span><ShieldCheck/> Role-protected administration</span><span><LockKeyhole/> Audited moderation actions</span><span><Store/> Marketplace oversight</span></>:isBusiness?<><span><Store/> Manage your storefront</span><span><ShoppingBag/> Track products and orders</span><span><ShieldCheck/> Build customer trust</span></>:<><span><ShieldCheck/> Trusted local sellers</span><span><ShoppingBag/> Shop and book in one place</span><span><Store/> Support local businesses</span></>}</div></div>
      <div className="login-landscape" aria-hidden="true"><span className="login-sun"/><span className="login-hill hill-back"/><span className="login-hill hill-front"/><span className="login-stall"><i/><i/><i/><b>ZM</b></span></div><small className="login-location">Proudly built for Zimbabwe</small>
    </section>
    <section className="login-panel"><div className="login-form-wrap">
      <Link className="back-home" href="/"><ArrowLeft/> Back to landing page</Link><div className="mobile-brand"><span className="login-logo">Z</span><span>ZimMarket</span></div>
      {!isAdmin&&<div className="login-type-switch" aria-label="Choose account login"><Link className={!isBusiness?'active':''} href="/login/customer"><ShoppingBag/> Customer</Link><Link className={isBusiness?'active':''} href="/login/business"><Store/> Business</Link></div>}
      <span className="form-kicker">{isAdmin?'SECURE ADMIN PORTAL':isBusiness?'BUSINESS PORTAL':'CUSTOMER LOGIN'}</span><h2>{isAdmin?'Administrator sign in':isBusiness?'Sign in to your business':'Sign in to your account'}</h2><p className="form-intro">{isAdmin?'Use an authorized administrator account to continue.':isBusiness?'Access your storefront and business dashboard.':'Continue shopping, booking and supporting local.'}</p>
      <form onSubmit={submit} className="login-form"><label htmlFor="identifier">Email or phone number</label><input id="identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com or +263…" autoComplete="username" required autoFocus/><div className="password-heading"><label htmlFor="password">Password</label><Link href="/reset-password">Forgot password?</Link></div><div className="password-field"><input id="password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" minLength={10} required/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff/>:<Eye/>}</button></div><label className="remember-row"><input type="checkbox" defaultChecked/><span>Keep me signed in on this device</span></label>{error&&<div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={loading}>{loading?<><LoaderCircle className="spin"/> Signing in…</>:<>Sign in as {kind} <ArrowRight/></>}</button></form>
      {isAdmin?<p className="join-copy">Need access? Contact the platform owner. <Link href="/login/business">Business sign in</Link></p>:<p className="join-copy">New to ZimMarket? <Link href={isBusiness?'/register/business':'/register/customer'}>{isBusiness?'Register your business':'Create a customer account'}</Link></p>}<div className="secure-note"><LockKeyhole/> Your connection is secure and encrypted.</div>
    </div></section>
  </main>;
}
