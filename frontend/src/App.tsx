'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, Bot, ChevronRight, Heart, LoaderCircle, MapPin, Menu, MessageCircle, Search, Send, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Store, Truck, UserRound, X } from 'lucide-react';
import { api, Business, MarketplaceService, Product, savedSession, saveSession, Session } from './api';
import { addToCart } from './cart';

const categories = [
  { name: 'Electronics', icon: '⌁', tone: 'mint' }, { name: 'Fashion', icon: '✦', tone: 'rose' },
  { name: 'Home & living', icon: '⌂', tone: 'sand' }, { name: 'Beauty', icon: '✿', tone: 'lilac' },
  { name: 'Food & grocery', icon: '◌', tone: 'peach' }, { name: 'Services', icon: '◇', tone: 'blue' },
];

const sampleProducts: Product[] = [
  { id: 'sample-1', name: 'Handwoven market basket', slug: 'basket', description: 'Made locally with natural fibres', price: 24, business: { name: 'Mbare Makers', slug: 'mbare-makers' } },
  { id: 'sample-2', name: 'Roasted Arabica coffee', slug: 'coffee', description: 'Small-batch, rich and balanced', price: 12, business: { name: 'Eastern Highlands Co.', slug: 'eastern-highlands' } },
  { id: 'sample-3', name: 'Everyday linen shirt', slug: 'linen-shirt', description: 'Lightweight and locally tailored', price: 38, business: { name: 'Harare Thread', slug: 'harare-thread' } },
  { id: 'sample-4', name: 'Minimal desk lamp', slug: 'desk-lamp', description: 'Warm light for focused spaces', price: 46, business: { name: 'GadgetHub Demo', slug: 'gadgethub-demo' } },
];

function money(value: number | string) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value)); }

type PageName = 'home' | 'marketplace' | 'services' | 'businesses' | 'about';

export function App({ page = 'home' }: { page?: PageName }) {
  // The server and the browser must start with identical markup. Restore the
  // browser-only session after hydration instead of reading localStorage here.
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [query, setQuery] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setSession(savedSession());
    if (page === 'home' && new URLSearchParams(window.location.search).get('join') === '1') setAuthOpen(true);
    if (page === 'marketplace') setQuery(new URLSearchParams(window.location.search).get('q') || '');
    api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    Promise.all([api.businesses().then(setBusinesses), api.services().then(setServices), api.publicProducts().then(setProducts), api.ads()]).catch(() => setNotice('Some marketplace services are unavailable. Check that the backend is running.'));
  }, []);

  useEffect(() => {
    if (page !== 'home') return;
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.14, rootMargin: '0px 0px -35px' });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [page]);

  useEffect(() => {
    if (!session || session.user.accountType !== 'CUSTOMER') return;
    api.products(session.accessToken).then(setProducts).catch((error: Error) => setNotice(error.message));
  }, [session]);

  const visibleSession = hydrated ? session : null;
  const shownProducts = products.length ? products : sampleProducts;
  const filtered = useMemo(() => shownProducts.filter(p => `${p.name} ${p.description} ${p.business.name}`.toLowerCase().includes(query.toLowerCase())), [shownProducts, query]);
  const customerMarketplace = page === 'marketplace' && visibleSession?.user.accountType === 'CUSTOMER';
  const filteredBusinesses = useMemo(() => businesses.filter(b => `${b.name} ${b.industry || ''} ${b.branches?.[0]?.city || ''}`.toLowerCase().includes(query.toLowerCase())), [businesses, query]);

  const updateSession = (next: Session | null) => {
    saveSession(next);
    setSession(next);
    setAuthOpen(false);
    // Sign-out always returns to a clean landing page and prevents the browser's
    // Back button from reopening the authenticated screen.
    window.location.replace(next ? '/dashboard' : '/');
  };
  async function saveProduct(product:Product){if(!session){window.location.href='/login/customer';return;}try{await api.followProduct(session.accessToken,product.id);setNotice(`${product.name} saved with restock and price-drop alerts.`);}catch(error){setNotice(error instanceof Error?error.message:'Product could not be saved.')}}
  async function bookService(service:MarketplaceService){if(!session){window.location.href='/login/customer';return;}const value=window.prompt('Enter appointment date and time (example: 2026-08-25T10:00)','');if(!value)return;const startsAt=new Date(value);if(Number.isNaN(startsAt.getTime())){setNotice('Enter a valid appointment date and time.');return;}try{await api.createBooking(session.accessToken,{serviceId:service.id,startsAt:startsAt.toISOString()});setNotice(`${service.name} booking requested. Track it in your dashboard.`);}catch(error){setNotice(error instanceof Error?error.message:'Booking could not be created.')}}
  function cartProduct(product:Product){if(product.id.startsWith('sample-')){setNotice('Sign in to load live products before adding to cart.');return;}try{addToCart(product);setNotice(`${product.name} added to your multi-business cart.`);}catch(error){setNotice(error instanceof Error?error.message:'Product could not be added.')}}

  return <>
    <header className="nav-shell">
      <a className="brand" href="#top" aria-label="ZimMarket home"><span className="brand-mark">Z</span><span>ZimMarket</span></a>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <a href="/marketplace" onClick={() => setMenuOpen(false)}>Marketplace</a><a href="/services" onClick={() => setMenuOpen(false)}>Services</a><a href="/businesses" onClick={() => setMenuOpen(false)}>Businesses</a><a href="/about" onClick={() => setMenuOpen(false)}>How it works</a>
      </nav>
      <div className="nav-actions">
        {visibleSession ? <><span className="account-pill"><UserRound size={15}/>{visibleSession.user.accountType.toLowerCase()}</span><button className="text-button" onClick={() => updateSession(null)}>Sign out</button></> : <button className="text-button" onClick={() => window.location.href = '/login/customer'}>Sign in</button>}
        <button className="primary small" onClick={() => window.location.href = visibleSession ? (visibleSession.user.accountType==='ADMIN'?'/admin':'/dashboard') : '/login/business'}>{visibleSession ? 'Dashboard' : 'Join ZimMarket'} <ArrowRight size={16}/></button>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button>
      </div>
    </header>

    <main id="top">
      {page === 'home' && <><section className="hero earthy-hero">
        <span className="earth-orbit orbit-one"></span><span className="earth-orbit orbit-two"></span>
        <div className="hero-copy">
          <div className="eyebrow hero-reveal reveal-one fade-in"><span></span> Built for Zimbabwe</div>
          <h1 className="hero-reveal reveal-two fade-in">Everything local,<br/><em>all in one place.</em></h1>
          <p className="hero-reveal reveal-three fade-in">Discover trusted businesses, useful services and great products from across Zimbabwe. Simple to find. Safe to buy.</p>
          <form className="search-box hero-reveal reveal-four slide-in-up" onSubmit={e => { e.preventDefault(); window.location.href = `/marketplace?q=${encodeURIComponent(query)}`; }}>
            <Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="What are you looking for?" aria-label="Search marketplace"/><button>Search</button>
          </form>
          <div className="trust-row hero-reveal reveal-five fade-in"><span><ShieldCheck/> Verified sellers</span><span><Truck/> Local delivery</span><span><ShoppingBag/> Secure shopping</span></div>
        </div>
        <div className="hero-art" aria-label="Featured local marketplace products">
          <div className="sun"></div><div className="arch"></div>
          <div className="floating-card card-one"><span className="product-visual woven">◫</span><div><small>LOCAL CRAFT</small><b>Made with care</b></div></div>
          <div className="floating-card card-two"><span className="product-visual coffee">☕</span><div><small>FRESH FINDS</small><b>From nearby</b></div></div>
          <div className="stat-card"><strong>1,200+</strong><span>local businesses</span></div>
        </div>
      </section><div className="market-ribbon"><div><span>SHOP LOCAL</span><i>✦</i><span>GROW TOGETHER</span><i>✦</i><span>MADE IN ZIMBABWE</span><i>✦</i><span>TRUSTED BUSINESSES</span><i>✦</i><span>SHOP LOCAL</span><i>✦</i><span>GROW TOGETHER</span><i>✦</i><span>MADE IN ZIMBABWE</span></div></div></>}

      {page !== 'home' && !customerMarketplace && <section className="page-banner"><span className="kicker">ZIMMARKET</span><h1>{page === 'marketplace' ? 'Explore the marketplace' : page === 'services' ? 'Book local services' : page === 'businesses' ? 'Meet local businesses' : 'Shopping local, made simple'}</h1><p>{page === 'marketplace' ? 'Browse live products from trusted Zimbabwean sellers.' : page === 'services' ? 'Find skilled professionals and useful services near you.' : page === 'businesses' ? 'Discover verified shops and independent businesses across Zimbabwe.' : 'A safer, simpler connection between customers and local businesses.'}</p>{page === 'marketplace' && <form className="search-box page-search" onSubmit={event => event.preventDefault()}><Search size={20}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products and sellers"/><button>Search</button></form>}</section>}

      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}

      {(page === 'home' || (page === 'marketplace' && !customerMarketplace)) && <section className="section categories" aria-labelledby="category-title">
        <div className="section-heading reveal-block" data-reveal><div><span className="kicker">EXPLORE</span><h2 id="category-title">Shop by category</h2></div><a href="/marketplace">Browse everything <ArrowRight size={16}/></a></div>
        <div className="category-grid reveal-grid" data-reveal>{categories.map((item, index) => <button style={{'--item-index': index, animationDelay: `${index * 0.1}s`} as React.CSSProperties} key={item.name} onClick={() => { if (page === 'marketplace') setQuery(item.name); else window.location.href = `/marketplace?q=${encodeURIComponent(item.name)}`; }}><span className={`category-icon ${item.tone}`}>{item.icon}</span><b>{item.name}</b><ChevronRight size={16}/></button>)}</div>
      </section>}

      {page === 'home' && <section className="home-story"><div className="story-art reveal-left" data-reveal><span className="story-sun"></span><div className="story-stamp">PROUDLY<br/><b>LOCAL</b><br/>263</div><div className="story-card"><Store/><span><small>FROM AROUND THE CORNER</small><b>To your doorstep</b></span></div></div><div className="story-copy reveal-right" data-reveal><span className="kicker">OUR MARKET, OUR PEOPLE</span><h2>Good things grow<br/>when we buy local.</h2><p>Every purchase supports an independent maker, a neighbourhood shop, or a growing Zimbabwean business. ZimMarket brings them closer to you.</p><div className="story-numbers"><span><b>10</b><small>Provinces connected</small></span><span><b>1.2k+</b><small>Local businesses</small></span><span><b>24/7</b><small>Market discovery</small></span></div><a href="/businesses">Meet the businesses <ArrowRight/></a></div></section>}

      {customerMarketplace && <section className="customer-market" aria-labelledby="customer-market-title">
        <div className="customer-market-hero"><div><span>YOUR MARKETPLACE</span><h1 id="customer-market-title">Welcome back{visibleSession.user.fullName ? `, ${visibleSession.user.fullName.split(' ')[0]}` : ''}.</h1><p>Choose a trusted shop, explore what it offers, then purchase a product or book a service.</p></div><a href="/dashboard">My account <ArrowRight/></a></div>
        <div className="market-search-row"><form onSubmit={event=>event.preventDefault()}><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search shops, categories or locations"/><button>Find a shop</button></form><span><ShieldCheck/> Verified local businesses</span></div>
        <div className="customer-market-heading"><div><span>AVAILABLE NOW</span><h2>Choose a shop</h2></div><b>{filteredBusinesses.length} shop{filteredBusinesses.length===1?'':'s'}</b></div>
        <div className="customer-shop-grid">{filteredBusinesses.map((business,index)=><a href={`/shops/${business.slug}`} key={business.id}><div className={`customer-shop-art shop-tone-${index%4}`}><Store/><span>{business.industry||'Local business'}</span></div><div><h3>{business.name} <BadgeCheck/></h3><p><MapPin/> {business.branches?.[0]?.city||'Zimbabwe'} · {business.verificationLevel.toLowerCase()} verified</p><span>View products & services <ArrowRight/></span></div></a>)}</div>
        {!filteredBusinesses.length&&<div className="customer-market-empty"><Store/><h3>No shops match your search</h3><p>Try another name, category or location.</p></div>}
        {services.length>0&&<div className="customer-service-strip"><div><span>SERVICES NEAR YOU</span><h2>Book from local experts</h2></div><div>{services.slice(0,3).map(service=><a href={`/shops/${service.business.slug}`} key={service.id}><Sparkles/><span><b>{service.name}</b><small>{service.business.name} · {service.durationMinutes} min</small></span><ArrowRight/></a>)}</div><a href="/services">Browse all services</a></div>}
      </section>}

      {page === 'marketplace' && !customerMarketplace && <section className="section market" id="market" aria-labelledby="market-title">
        <div className="section-heading"><div><span className="kicker">HANDPICKED FOR YOU</span><h2 id="market-title">Fresh from the market</h2></div><button className="filter"><SlidersHorizontal size={16}/> Filter</button></div>
        {session?.user.accountType !== 'CUSTOMER' && <p className="live-hint">Sign in as a customer to replace the preview with live products from the backend.</p>}
        <div className="product-grid">{filtered.map((product, index) => <article className="product-card" key={product.id}>
          <div className={`product-image visual-${index % 4}`}><span>{['⌁','◉','✦','◇'][index % 4]}</span><button onClick={()=>saveProduct(product)} aria-label={`Save ${product.name}`}><Heart size={18}/></button>{index === 0 && <label>Popular</label>}</div>
          <div className="product-info"><small>{product.business.name}</small><h3>{product.name}</h3><p>{product.description || 'Available from a trusted local seller.'}</p><div><strong>{money(product.price)}</strong><button onClick={()=>cartProduct(product)}>Add to cart <ShoppingBag size={14}/></button></div></div>
        </article>)}</div>
        {!filtered.length && <div className="empty">No products match “{query}”. Try another search.</div>}
      </section>}

      {page === 'services' && <section className="section service-section" id="services">
        <div className="section-heading"><div><span className="kicker">BOOK LOCAL EXPERTS</span><h2>Services available now</h2></div><span className="api-status online"><i></i>{services.length} live service{services.length === 1 ? '' : 's'}</span></div>
        <div className="service-grid">{services.length ? services.map(service => <article key={service.id}><span className="service-icon"><Sparkles/></span><div><small>{service.category}</small><h3>{service.name}</h3><p>{service.description || `Professional service from ${service.business.name}.`}</p><span>{service.durationMinutes} min · {service.price ? `${service.currency || 'USD'} ${Number(service.price).toFixed(2)}` : 'Ask for price'}</span></div><button onClick={() => bookService(service)}>Book service <ArrowRight size={15}/></button></article>) : <div className="empty">No active services are listed yet.</div>}</div>
      </section>}

      {page === 'businesses' && <section className="section businesses" id="businesses">
        <div className="section-heading"><div><span className="kicker">CLOSE TO HOME</span><h2>Businesses worth knowing</h2></div><span className={`api-status ${apiOnline ? 'online' : 'offline'}`}><i></i>{apiOnline ? 'Backend connected' : 'Backend offline'}</span></div>
        <div className="business-list">{(businesses.length ? businesses : [{ id:'preview', name:'GadgetHub Demo', slug:'gadgethub-demo', industry:'Electronics', communityTags:['Local business'], verificationLevel:'BASIC', branches:[{id:'branch', name:'Harare CBD', city:'Harare', province:'Harare', deliveryAreas:[]}]}]).map(b => <article key={b.id}>
          <div className="store-avatar"><Store/></div><div><h3>{b.name} <BadgeCheck size={16}/></h3><p>{b.industry || 'Local business'} · {b.communityTags?.[0] || 'Zimbabwean owned'}</p><span><MapPin size={14}/>{b.branches?.[0]?.city || 'Zimbabwe'}</span></div><button onClick={() => window.location.href = `/shops/${b.slug}`}>Visit store <ArrowRight size={15}/></button>
        </article>)}</div>
      </section>}

      {page === 'about' && <section className="how" id="how"><div><span className="kicker">A BETTER WAY TO SHOP LOCAL</span><h2>From search to doorstep,<br/>we keep it simple.</h2></div><ol><li><b>01</b><h3>Discover</h3><p>Search local products, services and trusted businesses.</p></li><li><b>02</b><h3>Connect</h3><p>Compare options and speak directly with sellers.</p></li><li><b>03</b><h3>Shop safely</h3><p>Order confidently with clear updates along the way.</p></li></ol></section>}
      {(page === 'home' || page === 'about') && <section className="cta"><div className="reveal-left" data-reveal><span>Made for buyers. Built for business.</span><h2>Your next customer<br/>is already looking.</h2><p>Open your digital storefront and reach more people across Zimbabwe.</p><button onClick={() => window.location.href = '/login/business'}>Start selling today <ArrowRight size={17}/></button></div><div className="cta-mark reveal-right" data-reveal>Z</div></section>}
    </main>

    <footer><a className="brand" href="/"><span className="brand-mark">Z</span><span>ZimMarket</span></a><p>Zimbabwe's marketplace for local products, services and businesses.</p><div><a href="/marketplace">Marketplace</a><a href="/services">Services</a><a href="/businesses">Businesses</a><a href="/about">About</a></div><small>© 2026 ZimMarket. Made with care in Zimbabwe.</small></footer>
    <Assistant />
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={updateSession}/>} 
  </>;
}

type ChatMessage = { role: 'assistant' | 'user'; text: string; mode?: 'ai' | 'local' };

function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: 'Hi! I’m Zim. I can help you find products, services, local businesses and delivery information.' }]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setMessages(current => [...current, { role: 'user', text: message }]);
    setInput(''); setLoading(true);
    try {
      const response = await api.assistant(message);
      setMessages(current => [...current, { role: 'assistant', text: response.reply, mode: response.mode }]);
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', text: error instanceof Error ? `I couldn’t connect: ${error.message}` : 'I couldn’t connect to the marketplace.' }]);
    } finally { setLoading(false); }
  }

  return <div className="assistant-wrap">
    {open && <section className="assistant-panel" aria-label="ZimMarket assistant">
      <header><span><span className="assistant-avatar"><Bot size={19}/></span><span><b>Zim Assistant</b><small><i></i> Marketplace help</small></span></span><button onClick={() => setOpen(false)} aria-label="Close assistant"><X size={19}/></button></header>
      <div className="assistant-messages">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.role === 'assistant' && <Sparkles size={13}/>}<span>{message.text}{message.mode && <small>{message.mode === 'ai' ? 'AI answer' : 'Live catalog answer'}</small>}</span></div>)}{loading && <div className="chat-message assistant typing"><LoaderCircle className="spin" size={16}/><span>Checking ZimMarket…</span></div>}</div>
      <div className="quick-prompts"><button onClick={() => setInput('What products are available?')}>Find products</button><button onClick={() => setInput('What services can I book?')}>Find services</button></div>
      <form onSubmit={send}><input value={input} onChange={event => setInput(event.target.value)} maxLength={800} placeholder="Ask Zim anything…" aria-label="Message Zim assistant"/><button disabled={!input.trim() || loading} aria-label="Send message"><Send size={17}/></button></form>
      <footer>Zim never asks for passwords or payment details.</footer>
    </section>}
    <button className="assistant-toggle" onClick={() => setOpen(!open)} aria-label="Open ZimMarket assistant">{open ? <X/> : <MessageCircle/>}<span>Ask Zim</span></button>
  </div>;
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (session: Session) => void }) {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [identifier, setIdentifier] = useState('customer@zimmarket.local');
  const [phone, setPhone] = useState('+263');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('ChangeMe123!');
  const [accountType, setAccountType] = useState<'CUSTOMER'|'BUSINESS'>('CUSTOMER');
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setLoading(true); try { if (mode === 'login') onSuccess(await api.login(identifier, password)); else { const created = await api.register({ phone, email: email || undefined, password, accountType, ...(accountType === 'CUSTOMER' ? { fullName, city, acceptedPolicies } : {}) }); if (accountType === 'BUSINESS') { const slug = businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); await api.createBusiness(created.accessToken, { name: businessName.trim(), slug }); } onSuccess(created); } } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setLoading(false); } }
  return <div className="modal-backdrop fade-in" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal scale-in" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={onClose}><X/></button><span className="brand-mark">Z</span><span className="kicker">WELCOME TO ZIMMARKET</span><h2 id="auth-title">{mode === 'login' ? 'Good to see you again.' : 'Create your account.'}</h2><p>{mode === 'login' ? 'Sign in to open your marketplace or private dashboard.' : 'Choose the account that matches how you will use ZimMarket.'}</p><form onSubmit={submit}>{mode === 'login' ? <label>Email or phone<input value={identifier} onChange={e => setIdentifier(e.target.value)} required/></label> : <><div className="account-choice"><button type="button" className={accountType === 'CUSTOMER' ? 'selected' : ''} onClick={() => setAccountType('CUSTOMER')}><ShoppingBag/>Customer<small>Shop and book</small></button><button type="button" className={accountType === 'BUSINESS' ? 'selected' : ''} onClick={() => setAccountType('BUSINESS')}><Store/>Business<small>Sell and manage</small></button></div>{accountType === 'CUSTOMER' && <><label>Full name<input value={fullName} onChange={e => setFullName(e.target.value)} minLength={2} required/></label><label>City or town<input value={city} onChange={e => setCity(e.target.value)} minLength={2} required/></label></>}{accountType === 'BUSINESS' && <label>Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} minLength={2} required/></label>}<label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} required/></label><label>Email <small>(optional)</small><input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label></>}<label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={10} required/></label>{mode === 'register' && accountType === 'CUSTOMER' && <label className="policy-check"><input type="checkbox" checked={acceptedPolicies} onChange={e => setAcceptedPolicies(e.target.checked)} required/><span>I accept the Terms, Privacy, Purchasing, Returns and Review policies.</span></label>}{error && <div className="form-error">{error}</div>}<button className="primary auth-submit" disabled={loading}>{loading ? <LoaderCircle className="spin"/> : mode === 'login' ? 'Sign in' : accountType === 'BUSINESS' ? 'Register business' : 'Create customer account'} {!loading && <ArrowRight size={17}/>}</button></form><button className="switch-mode" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>{mode === 'login' && <small className="demo-note">Demo details are pre-filled. The backend must be seeded and running.</small>}</div></div>;
}
