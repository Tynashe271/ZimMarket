'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, MailX, ShieldCheck } from 'lucide-react';
import { api } from '../../src/api';
import '../login/login.css';

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const signature = params.get('signature');
    if (!userId || !signature) { setStatus('error'); setError('This unsubscribe link is missing information.'); return; }
    api.unsubscribe(userId, signature)
      .then(() => setStatus('done'))
      .catch(reason => { setStatus('error'); setError(reason instanceof Error ? reason.message : 'This unsubscribe link is no longer valid.'); });
  }, []);

  return <main className="login-page">
    <section className="login-story" aria-label="Unsubscribe from ZimMarket emails">
      <Link className="login-brand" href="/"><span className="login-logo">Z</span><span>ZimMarket</span></Link>
      <div className="login-story-copy">
        <span className="login-eyebrow">EMAIL PREFERENCES</span>
        <h1>Manage your<br/><em>email updates.</em></h1>
        <p>You can always turn notifications back on from your account settings.</p>
      </div>
      <small className="login-location">Proudly built for Zimbabwe</small>
    </section>
    <section className="login-panel"><div className="login-form-wrap">
      <div className="mobile-brand"><span className="login-logo">Z</span><span>ZimMarket</span></div>
      {status === 'loading' && <div className="verification-step"><span><LoaderCircle className="spin"/></span><h2>Updating your preferences…</h2></div>}
      {status === 'done' && <div className="verification-step">
        <span><MailX/></span>
        <h2>You're unsubscribed</h2>
        <p>We won't send these emails to you anymore. Account security messages, like sign-in codes, still go through.</p>
        <Link className="login-submit" href="/">Back to ZimMarket <ArrowRight/></Link>
      </div>}
      {status === 'error' && <div className="verification-step">
        <span><ShieldCheck/></span>
        <h2>Couldn't update your preferences</h2>
        <p>{error}</p>
        <Link className="login-submit" href="/dashboard">Go to your dashboard <ArrowRight/></Link>
      </div>}
    </div></section>
  </main>;
}
