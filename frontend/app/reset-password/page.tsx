'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../../src/api';
import '../login/login.css';
import '../register/customer/register-customer.css';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await api.requestPasswordReset(identifier.trim());
      setDevCode(result.developmentCode || '');
      setStep(2);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not request a reset code.'); }
    finally { setLoading(false); }
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await api.confirmPasswordReset(identifier.trim(), code, newPassword);
      setStep(3);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not reset your password.'); }
    finally { setLoading(false); }
  }

  async function resend() {
    try { const result = await api.requestPasswordReset(identifier.trim()); setDevCode(result.developmentCode || ''); } catch { /* resend failures are non-fatal */ }
  }

  return <main className="login-page">
    <section className="login-story" aria-label="Reset your ZimMarket password">
      <Link className="login-brand" href="/"><span className="login-logo">Z</span><span>ZimMarket</span></Link>
      <div className="login-story-copy">
        <span className="login-eyebrow">ACCOUNT RECOVERY</span>
        <h1>Forgot your<br/><em>password?</em></h1>
        <p>Confirm the identity behind your account and choose a new password to get back in.</p>
      </div>
      <small className="login-location">Proudly built for Zimbabwe</small>
    </section>
    <section className="login-panel"><div className="login-form-wrap">
      <Link className="back-home" href="/login"><ArrowLeft/> Back to sign in</Link>
      <div className="mobile-brand"><span className="login-logo">Z</span><span>ZimMarket</span></div>
      {step === 1 && <>
        <span className="form-kicker">RESET PASSWORD</span>
        <h2>Reset your password</h2>
        <p className="form-intro">Enter the email or phone number on your account and we&apos;ll send a reset code.</p>
        <form onSubmit={requestCode} className="login-form">
          <label htmlFor="identifier">Email or phone number</label>
          <input id="identifier" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com or +263…" autoComplete="username" required autoFocus/>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" disabled={loading || !identifier.trim()}>{loading ? <><LoaderCircle className="spin"/> Sending…</> : <>Send reset code <ArrowRight/></>}</button>
        </form>
      </>}
      {step === 2 && <div className="verification-step">
        <span><KeyRound/></span>
        <h2>Enter your reset code</h2>
        <p>Enter the six-digit code sent to <b>{identifier}</b>, then choose a new password.</p>
        {devCode && <div className="development-code">Development code: <b>{devCode}</b></div>}
        <form onSubmit={confirmReset} className="login-form">
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="000000" autoFocus required/>
          <label htmlFor="newPassword">New password</label>
          <input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={10} required placeholder="At least 10 characters"/>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" disabled={loading || code.length !== 6 || newPassword.length < 10}>{loading ? <><LoaderCircle className="spin"/> Resetting…</> : <>Reset password <ArrowRight/></>}</button>
        </form>
        <button className="resend-code" type="button" onClick={resend}>Send another code</button>
      </div>}
      {step === 3 && <div className="verification-step">
        <span><ShieldCheck/></span>
        <h2>Password updated</h2>
        <p>Your password has been reset and you&apos;ve been signed out on all devices for security. Sign in with your new password.</p>
        <Link className="login-submit" href="/login">Back to sign in <ArrowRight/></Link>
      </div>}
      <div className="secure-note"><LockKeyhole/> Your connection is secure and encrypted.</div>
    </div></section>
  </main>;
}
