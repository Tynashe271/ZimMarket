'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, FileText, LoaderCircle, Store } from 'lucide-react';
import { api, saveSession } from '../../../src/api';
import '../../login/login.css';
import './register-business.css';

export default function RegisterBusinessPage() {
  const [stage, setStage] = useState<'existing'|'new'>('existing');
  const [licenceHelp, setLicenceHelp] = useState(false);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('+263'); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!acceptedPolicies) { setError('Please confirm you are 18 or older and accept the Terms and Privacy policy to continue.'); return; }
    setLoading(true);
    try {
      const session = await api.register({ phone, email: email || undefined, password, accountType: 'BUSINESS', acceptedPolicies });
      const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const business = await api.createBusiness(session.accessToken, { name: name.trim(), slug: `${baseSlug}-${Date.now().toString().slice(-5)}` });
      if (stage === 'new' && licenceHelp) await api.createSupportTicket(session.accessToken, { businessId: business.id, category: 'BUSINESS_LICENSING', subject: 'Business licence application assistance', details: `New business “${name.trim()}” requested guidance with the relevant registration and licence application process.` });
      saveSession(session); window.location.href = '/dashboard';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Registration could not be completed.'); }
    finally { setLoading(false); }
  }
  return <main className="business-register-page">
    <aside className="register-aside"><Link className="login-brand" href="/"><span className="login-logo">Z</span><span>ZimMarket</span></Link><div><span>SELL ON ZIMMARKET</span><h1>Bring your business to the marketplace.</h1><p>Register once, then manage your storefront, listings and orders from your business dashboard.</p><ol><li><i><Check/></i> Create your business account</li><li><i>2</i> Add your business details</li><li><i>3</i> Publish your storefront</li></ol></div><small>ZimMarket supports your application process. Official licences are issued by the relevant authorities.</small></aside>
    <section className="register-main"><div className="business-form-wrap"><Link className="back-home" href="/login/business"><ArrowLeft/> Business login</Link><div className="mobile-brand"><span className="login-logo">Z</span><span>ZimMarket</span></div><span className="form-kicker">BUSINESS REGISTRATION</span><h2>Register your business</h2><p className="form-intro">Tell us where your business is today.</p>
      <div className="business-stage"><button type="button" className={stage==='existing'?'selected':''} onClick={()=>{setStage('existing');setLicenceHelp(false)}}><BadgeCheck/><b>Existing business</b><small>I already operate a business</small></button><button type="button" className={stage==='new'?'selected':''} onClick={()=>setStage('new')}><Building2/><b>New business</b><small>I’m just getting started</small></button></div>
      {stage==='new'&&<label className={`licence-option ${licenceHelp?'selected':''}`}><input type="checkbox" checked={licenceHelp} onChange={e=>setLicenceHelp(e.target.checked)}/><FileText/><span><b>Help me apply for a business licence</b><small>ZimMarket will open an assistance request and guide you to the relevant authority.</small></span></label>}
      <form className="business-register-form" onSubmit={submit}><label>Business name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} required placeholder="e.g. Mbare Makers"/></label><label>Business phone<input value={phone} onChange={e=>setPhone(e.target.value)} required placeholder="+263…"/></label><label>Email <small>(optional)</small><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="business@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} required placeholder="At least 10 characters"/></label><label className="policy-check"><input type="checkbox" checked={acceptedPolicies} onChange={e=>setAcceptedPolicies(e.target.checked)}/><span>I confirm I am 18 years of age or older, and I accept the <Link href="/terms" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Terms</Link> and <Link href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Privacy</Link> policies.</span></label>{error&&<div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={loading}>{loading?<><LoaderCircle className="spin"/> Registering…</>:<>Register business <ArrowRight/></>}</button></form><p className="join-copy">Already registered? <Link href="/login/business">Sign in to your business</Link></p>
    </div></section>
  </main>;
}
