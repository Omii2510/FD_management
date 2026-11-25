import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  Bell,
  Calculator,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Heart,
  Landmark,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { roleHomePath } from '../utils/rolePaths';

const CURRENT_YEAR = new Date().getFullYear();

const money = (amount, compact = false) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: compact ? 'compact' : 'standard',
}).format(Number(amount) || 0);

const getErrorMessage = (error) => error?.response?.data?.message || 'Something went wrong. Please try again.';

const HomePage = ({ authenticationFirst = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const [selectedPlans, setSelectedPlans] = useState([]);
  const [activeModal, setActiveModal] = useState(authenticationFirst ? 'auth' : null);
  const [activePlan, setActivePlan] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isWorkspaceLogin, setIsWorkspaceLogin] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const plansQuery = useQuery({
    queryKey: ['fd-plans'],
    queryFn: async () => {
      const { data } = await api.get('/fd-plans?limit=50');
      return data.data.plans || [];
    },
  });
  const advertisementsQuery = useQuery({
    queryKey: ['advertisements', 'homepage-banner'],
    queryFn: async () => {
      const { data } = await api.get('/advertisements?placement=homepage_banner&limit=5');
      return data.data.advertisements || [];
    },
  });
  const userQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data.user;
    },
    retry: false,
    staleTime: 60_000,
  });
  const currentUser = userQuery.data;
  useEffect(() => {
    if (authenticationFirst && currentUser) {
      navigate(roleHomePath(currentUser.role), { replace: true });
    }
  }, [authenticationFirst, currentUser, navigate]);
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get('/users/favorites?limit=50');
      return data.data.favorites || [];
    },
    enabled: Boolean(currentUser),
    retry: false,
  });
  const clearPrivateQueries = () => {
    queryClient.removeQueries({ queryKey: ['favorites'] });
    queryClient.removeQueries({ queryKey: ['applications'] });
    queryClient.removeQueries({ queryKey: ['panel'] });
    queryClient.removeQueries({ queryKey: ['user-panel'] });
  };

  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(plansQuery.data || [])]
      .filter((plan) => !query || `${plan.planName} ${plan.bankId?.bankName} ${plan.bankId?.bankCode}`.toLowerCase().includes(query))
      .sort((a, b) => sortBy === 'rate'
        ? b.standardInterestRate - a.standardInterestRate
        : a.planName.localeCompare(b.planName));
  }, [plansQuery.data, search, sortBy]);

  const favoriteIds = new Set((favoritesQuery.data || []).map((favorite) => String(favorite.fdPlanId?._id || favorite.fdPlanId)));

  const favoriteMutation = useMutation({
    mutationFn: async ({ plan, isFavorite }) => {
      if (isFavorite) await api.delete(`/users/favorites/${plan._id}`);
      else await api.post(`/users/favorites/${plan._id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => {
      if (error.response?.status === 401) {
        setNotice('Sign in to save your favorite FD plans.');
        setActiveModal('auth');
      } else {
        setNotice(getErrorMessage(error));
      }
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/fd/calculate', payload);
      return data.data.calculation;
    },
  });
  const compareMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/fd/compare', payload);
      return data.data.comparison;
    },
  });
  const authMutation = useMutation({
    mutationFn: async (payload) => {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const { data } = await api.post(endpoint, payload);
      return data;
    },
    onSuccess: (response) => {
      setNotice(response.message);
      if (!isRegistering) {
        clearPrivateQueries();
        queryClient.setQueryData(['current-user'], response.data.user);
        setActiveModal(null);
        if (response.data.user.role === 'user' && isWorkspaceLogin) {
          setNotice('This account has customer access only. Bank accounts must be created by an admin, and admin access must be provisioned separately.');
        } else {
          navigate(roleHomePath(response.data.user.role));
        }
      }
    },
  });
  const googleMutation = useMutation({
    mutationFn: async (idToken) => {
      const { data } = await api.post('/auth/google', { idToken });
      return data.data.user;
    },
    onSuccess: (user) => {
      clearPrivateQueries();
      queryClient.setQueryData(['current-user'], user);
      setActiveModal(null);
      setNotice('Signed in with Google.');
      navigate(roleHomePath(user.role));
    },
  });
  const handleGoogleCredential = (idToken) => googleMutation.mutate(idToken);
  const applicationMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/users/applications', payload);
      return data.data.application;
    },
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setActiveModal('application-success');
      setActivePlan({ ...activePlan, createdApplication: application });
    },
  });

  const openCalculation = (plan) => {
    setActivePlan(plan);
    calculateMutation.reset();
    setActiveModal('calculator');
  };

  const toggleComparison = (plan) => {
    setSelectedPlans((selected) => selected.some((item) => item._id === plan._id)
      ? selected.filter((item) => item._id !== plan._id)
      : selected.length < 10 ? [...selected, plan] : selected);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      queryClient.setQueryData(['current-user'], null);
      clearPrivateQueries();
      setActiveModal(null);
      setNotice('You have been signed out.');
    } catch (error) {
      setNotice(getErrorMessage(error));
    }
  };

  if (authenticationFirst && userQuery.isLoading) {
    return <div className="auth-first-loading">Checking your sign-in status…</div>;
  }

  return (
    <div className="app-shell">
      {!authenticationFirst && <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="FD Connect home">
            <span className="brand-mark"><Landmark size={21} strokeWidth={2.2} /></span>
            <span>fd<span className="brand-light">connect</span></span>
          </a>
          <button className="mobile-menu-button" type="button" aria-label="Toggle menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav className={`main-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#explore" onClick={() => setMobileMenuOpen(false)}>Explore FDs</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#trust" onClick={() => setMobileMenuOpen(false)}>Why FD Connect</a>
            <button type="button" className="staff-login-link" onClick={() => {
              setIsRegistering(false);
              setIsWorkspaceLogin(true);
              setMobileMenuOpen(false);
              setActiveModal('auth');
            }}>Bank / Admin login</button>
          </nav>
          <div className="header-actions">
            {currentUser ? (
              <>
                <button className="icon-button notification-button" type="button" aria-label="View notifications" onClick={() => { setNotice('Your enquiries and updates are available in your account.'); setActiveModal('account'); }}>
                  <Bell size={18} />
                </button>
                <button className="button button-outline button-small" type="button" onClick={() => navigate(roleHomePath(currentUser.role))}>
                  {currentUser.role === 'user' ? currentUser.fullName?.split(' ')[0] || 'My account' : 'Workspace'}
                </button>
              </>
            ) : (
              <>
                <button className="button button-quiet button-small hide-mobile" type="button" onClick={() => { setIsRegistering(false); setIsWorkspaceLogin(false); setActiveModal('auth'); }}>Log in</button>
                <button className="button button-primary button-small" type="button" onClick={() => { setIsRegistering(true); setIsWorkspaceLogin(false); setActiveModal('auth'); }}>Create account</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-content">
            <div className="hero-copy">
              <div className="eyebrow eyebrow-light"><Sparkles size={14} /> A smarter way to save</div>
              <h1>Find an FD that fits <span>your future.</span></h1>
              <p className="hero-description">Compare fixed deposit rates from trusted banks, understand your returns, and enquire directly with the bank.</p>
              <a className="button button-white" href="#explore">Explore fixed deposits <ArrowRight size={17} /></a>
              <div className="hero-proof">
                <span className="proof-avatars"><i>R</i><i>A</i><i>S</i></span>
                <span><strong>Clear rates.</strong> Confident decisions.</span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-card hero-card-main">
                <div className="hero-card-top"><span className="hero-bank-icon"><Landmark size={20} /></span><span className="rate-tag">TOP RATE</span></div>
                <span className="hero-card-caption">Fixed deposit interest</span>
                <strong className="hero-rate">7.85<span>%</span></strong>
                <div className="hero-card-bottom"><span>Up to 5 years</span><span className="hero-card-arrow"><ArrowRight size={16} /></span></div>
              </div>
              <div className="floating-note"><span className="floating-icon"><TrendingUp size={17} /></span><span><b>Know your returns</b><small>Before you decide</small></span></div>
              <div className="floating-shield"><ShieldCheck size={23} /></div>
            </div>
          </div>
          <div className="hero-bottom-line"><span /> Your savings deserve a better look <span /></div>
        </section>

        <section className="trust-strip" id="trust">
          <div className="trust-item"><ShieldCheck size={20} /><span><b>Bank-hosted journey</b><small>Enquire directly with banks</small></span></div>
          <div className="trust-divider" />
          <div className="trust-item"><BadgeCheck size={20} /><span><b>Compare with clarity</b><small>Rates and terms in one place</small></span></div>
          <div className="trust-divider" />
          <div className="trust-item"><LockKeyhole size={20} /><span><b>Your choice, always</b><small>No deposit payments on FD Connect</small></span></div>
        </section>

        <section className="explore-section section-wrap" id="explore">
          <div className="section-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> EXPLORE FIXED DEPOSITS</div>
              <h2>Make your money work <span>smarter.</span></h2>
              <p>Browse current deposit plans and find one that matches your goals.</p>
            </div>
            <button type="button" className="text-link" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              How it works <ArrowRight size={16} />
            </button>
          </div>

          {advertisementsQuery.isError && <p className="sponsored-error" role="status">Sponsored offers are temporarily unavailable.</p>}
          {advertisementsQuery.data?.length > 0 && <div className="sponsored-ad-grid" aria-label="Sponsored bank offers">
            {advertisementsQuery.data.map((advertisement) => (
              <a className="sponsored-ad-card" href={advertisement.destinationUrl} target="_blank" rel="noopener noreferrer" key={advertisement._id}>
                <img src={advertisement.bannerImageUrl} alt={`Sponsored offer: ${advertisement.title}`} loading="lazy" />
                <span className="sponsored-ad-copy">
                  <small>SPONSORED · {advertisement.bankId?.bankName || 'Partner bank'}</small>
                  <strong>{advertisement.title}</strong>
                  {advertisement.description && <span>{advertisement.description}</span>}
                </span>
              </a>
            ))}
          </div>}

          <div className="market-tools">
            <label className="search-field">
              <Search size={19} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bank or FD plan" aria-label="Search bank or FD plan" />
              {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}
            </label>
            <label className="sort-field"><SlidersHorizontal size={17} /><span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort plans">
                <option value="rate">Highest rate</option>
                <option value="name">Bank name</option>
              </select><ChevronDown size={15} />
            </label>
            <span className="result-count">{visiblePlans.length} plans</span>
          </div>

          {plansQuery.isLoading ? (
            <div className="loading-grid" aria-label="Loading fixed deposit plans"><span /><span /><span /></div>
          ) : plansQuery.isError ? (
            <div className="empty-state">
              <span className="empty-icon"><CircleHelp size={25} /></span>
              <h3>We couldn’t load plans just now</h3>
              <p>Please check your connection and try again.</p>
              <button className="button button-outline" type="button" onClick={() => plansQuery.refetch()}>Try again</button>
            </div>
          ) : visiblePlans.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Search size={24} /></span>
              <h3>{search ? 'No matching plans' : 'Plans are on their way'}</h3>
              <p>{search ? 'Try another bank or plan name.' : 'There are no approved FD plans available at the moment. Please check back soon.'}</p>
              {search && <button className="button button-outline" type="button" onClick={() => setSearch('')}>Clear search</button>}
            </div>
          ) : (
            <div className="plans-grid">
              {visiblePlans.map((plan, index) => (
                <article className={`plan-card ${index === 0 ? 'plan-card-featured' : ''}`} key={plan._id}>
                  {index === 0 && <span className="plan-ribbon"><Sparkles size={12} /> HIGH INTEREST</span>}
                  <div className="plan-card-top">
                    <div className="bank-brand">
                      {plan.bankId?.logoUrl
                        ? <img className="bank-logo" src={plan.bankId.logoUrl} alt={`${plan.bankId.bankName} logo`} />
                        : <span className={`bank-logo bank-logo-fallback bank-tone-${index % 4}`}><Landmark size={19} /></span>}
                      <div><h3>{plan.bankId?.bankName || 'Partner bank'}</h3><span>{plan.bankId?.bankCode || 'FD partner'}</span></div>
                    </div>
                    <button
                      type="button"
                      className={`favorite-button ${favoriteIds.has(String(plan._id)) ? 'is-favorite' : ''}`}
                      aria-label={favoriteIds.has(String(plan._id)) ? 'Remove from saved plans' : 'Save plan'}
                      aria-pressed={favoriteIds.has(String(plan._id))}
                      onClick={() => currentUser
                        ? favoriteMutation.mutate({ plan, isFavorite: favoriteIds.has(String(plan._id)) })
                        : (setNotice('Sign in to save your favorite FD plans.'), setActiveModal('auth'))}
                    ><Heart size={18} fill={favoriteIds.has(String(plan._id)) ? 'currentColor' : 'none'} /></button>
                  </div>
                  <div className="plan-name-row"><h4>{plan.planName}</h4><span className="verified-label"><BadgeCheck size={13} /> Verified</span></div>
                  <div className="rate-display"><strong>{Number(plan.standardInterestRate).toFixed(2)}<small>%</small></strong><span>p.a. interest</span></div>
                  <div className="plan-details">
                    <div><span>Tenure</span><b>{formatTenure(plan.minTenureDays, plan.maxTenureDays)}</b></div>
                    <div><span>Minimum deposit</span><b>{money(plan.minAmount)}</b></div>
                    <div><span>Interest payout</span><b>{formatLabel(plan.interestPayout)}</b></div>
                  </div>
                  <div className="plan-card-actions">
                    <button className="button button-outline button-card-secondary" type="button" onClick={() => toggleComparison(plan)}>
                      {selectedPlans.some((item) => item._id === plan._id) ? <Check size={15} /> : <ArrowDownUp size={15} />}
                      {selectedPlans.some((item) => item._id === plan._id) ? 'Added' : 'Compare'}
                    </button>
                    <button className="button button-primary button-card-primary" type="button" onClick={() => openCalculation(plan)}>View returns <ArrowRight size={15} /></button>
                  </div>
                  <button className="plan-terms-link" type="button" onClick={() => { setActivePlan(plan); setActiveModal('details'); }}>Plan details <ArrowRight size={14} /></button>
                </article>
              ))}
            </div>
          )}
          {plansQuery.data?.length > 0 && <p className="rates-note"><CircleHelp size={14} /> Rates and returns are indicative. Confirm the latest terms directly with the bank.</p>}
        </section>

        <section className="calculator-band">
          <div className="calculator-band-inner">
            <div className="calculator-illustration"><Calculator size={27} /><span className="calc-spark calc-spark-one">+</span><span className="calc-spark calc-spark-two">×</span></div>
            <div className="calculator-band-copy"><span>PLAN WITH CONFIDENCE</span><h2>Curious how much you could earn?</h2><p>Estimate FD returns based on a plan’s current rate, amount, and tenure.</p></div>
            <a href="#explore" className="button button-white">Calculate returns <ArrowRight size={16} /></a>
          </div>
        </section>

        <section className="steps-section section-wrap" id="how-it-works">
          <div className="section-heading section-heading-centered">
            <div className="eyebrow"><span className="eyebrow-dot" /> SIMPLE BY DESIGN</div>
            <h2>A better FD choice in <span>3 steps.</span></h2>
            <p>We help you compare. Your bank takes it from there.</p>
          </div>
          <div className="steps-grid">
            <div className="step-card"><span className="step-number">01</span><span className="step-icon"><Search size={21} /></span><h3>Explore your options</h3><p>Discover fixed deposit plans and compare their rates, terms, and features in one place.</p></div>
            <div className="step-connector"><span /></div>
            <div className="step-card"><span className="step-number">02</span><span className="step-icon"><Calculator size={21} /></span><h3>Understand your returns</h3><p>Estimate interest and maturity value using the bank’s listed rate and your chosen tenure.</p></div>
            <div className="step-connector"><span /></div>
            <div className="step-card"><span className="step-number">03</span><span className="step-icon"><ExternalLink size={21} /></span><h3>Enquire with the bank</h3><p>Share your enquiry and continue to the official bank website for KYC and deposit booking.</p></div>
          </div>
        </section>

        <section className="disclaimer-band">
          <span className="disclaimer-icon"><ShieldCheck size={21} /></span>
          <p><strong>Your deposit stays with your bank.</strong> FD Connect does not accept or process fixed deposit payments. Any KYC, booking, or payment happens securely through the bank’s official channels.</p>
          <a href="#explore">Explore plans <ArrowRight size={14} /></a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-block"><a className="brand brand-footer" href="#"><span className="brand-mark"><Landmark size={19} /></span><span>fd<span className="brand-light">connect</span></span></a><p>Clear comparisons. Confident saving.<br />Your next FD starts with a better look.</p></div>
          <div className="footer-links"><b>Explore</b><a href="#explore">Fixed deposits</a><a href="#how-it-works">How it works</a></div>
          <div className="footer-links"><b>Good to know</b><a href="#trust">About FD Connect</a><a href="#trust">Safety &amp; trust</a></div>
          <div className="footer-help"><span className="help-icon"><CircleHelp size={18} /></span><span><b>Need a hand?</b><small>We’re here to help you choose with confidence.</small></span></div>
        </div>
        <div className="footer-bottom"><span>© {CURRENT_YEAR} FD Connect. All rights reserved.</span><span>We compare. Your bank takes it from there.</span></div>
      </footer>
      </>}

      {!authenticationFirst && selectedPlans.length > 0 && (
        <div className="compare-dock">
          <div><span className="compare-dock-icon"><ArrowDownUp size={17} /></span><b>{selectedPlans.length} plan{selectedPlans.length > 1 ? 's' : ''} selected</b><span className="compare-dock-hint">Compare rates and estimated returns</span></div>
          <button className="button button-primary" type="button" disabled={selectedPlans.length < 2} onClick={() => { compareMutation.reset(); setActiveModal('compare'); }}>
            Compare plans <ArrowRight size={16} />
          </button>
          <button className="dock-clear" type="button" onClick={() => setSelectedPlans([])} aria-label="Clear selected plans"><X size={18} /></button>
        </div>
      )}

      {!authenticationFirst && notice && <div className="toast-message" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      {activeModal && (
        <Modal
          className={authenticationFirst ? 'auth-first-modal' : ''}
          onClose={() => {
            if (!authenticationFirst) {
              setActiveModal(null);
              setNotice('');
            }
          }}
        >
          {activeModal === 'auth' && (
            <div className="modal-content">
              {authenticationFirst && <a className="auth-first-brand" href="/"><span className="brand-mark"><Landmark size={20} /></span><span>fd<span className="brand-light">connect</span></span></a>}
              <ModalHeading icon={<LockKeyhole size={19} />} title={isRegistering ? 'Create your account' : isWorkspaceLogin ? 'Bank / Admin login' : 'Welcome back'} subtitle={isRegistering ? 'Save plans and keep track of your FD enquiries.' : isWorkspaceLogin ? 'Sign in with the account provisioned for your bank or administrator role.' : 'Sign in to see your saved plans and enquiries.'} onClose={() => { if (!authenticationFirst) setActiveModal(null); }} />
              {authenticationFirst && <a className="auth-first-marketplace-link" href="/marketplace">Explore FD plans without signing in</a>}
              {notice && <div className="inline-notice">{notice}</div>}
              <form className="form-stack" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const payload = {
                  email: String(form.get('email')).trim(),
                  password: String(form.get('password')),
                };
                if (isRegistering) payload.fullName = String(form.get('fullName')).trim();
                authMutation.mutate(payload);
              }}>
                {isRegistering && <label>Full name<input name="fullName" type="text" autoComplete="name" minLength="2" required placeholder="e.g. Aanya Sharma" /></label>}
                <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
                <label>Password<input name="password" type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={isRegistering ? 8 : undefined} required placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'} /></label>
                {authMutation.isError && <p className="form-error" role="alert">{getErrorMessage(authMutation.error)}</p>}
                <button className="button button-primary button-full" type="submit" disabled={authMutation.isPending}>{authMutation.isPending ? 'Please wait…' : isRegistering ? 'Create account' : 'Log in'} <ArrowRight size={16} /></button>
                {!isWorkspaceLogin && <>
                  <div className="auth-divider"><span>or continue with</span></div>
                  <GoogleSignInButton
                    clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
                    onCredential={handleGoogleCredential}
                    disabled={googleMutation.isPending}
                  />
                  {googleMutation.isError && <p className="form-error" role="alert">{getErrorMessage(googleMutation.error)}</p>}
                </>}
                <p className="form-footnote">By continuing, you agree to use FD Connect for plan discovery and enquiries. Deposit booking and payment are handled by your bank.</p>
                {isWorkspaceLogin
                  ? <>
                    <p className="form-footnote">Bank accounts are created by an administrator. Contact FD Connect support if you need admin access.</p>
                    {authenticationFirst && <button type="button" className="auth-switch" onClick={() => { setIsWorkspaceLogin(false); authMutation.reset(); setNotice(''); }}>Customer login</button>}
                  </>
                  : <button type="button" className="auth-switch" onClick={() => { setIsRegistering(!isRegistering); setIsWorkspaceLogin(false); authMutation.reset(); setNotice(''); }}>
                    {isRegistering ? 'Already have an account? Log in' : 'New to FD Connect? Create an account'}
                  </button>}
                {authenticationFirst && !isWorkspaceLogin && <button type="button" className="auth-switch" onClick={() => { setIsRegistering(false); setIsWorkspaceLogin(true); authMutation.reset(); setNotice(''); }}>Bank / Admin login</button>}
              </form>
            </div>
          )}

          {activeModal === 'calculator' && activePlan && (
            <CalculatorForm
              plan={activePlan}
              mutation={calculateMutation}
              onClose={() => setActiveModal(null)}
              onApply={() => {
                setActiveModal(currentUser ? 'apply' : 'auth');
                if (!currentUser) setNotice('Sign in or create an account to send an enquiry.');
              }}
            />
          )}

          {activeModal === 'compare' && (
            <CompareForm plans={selectedPlans} mutation={compareMutation} onClose={() => setActiveModal(null)} />
          )}

          {activeModal === 'details' && activePlan && (
            <div className="modal-content">
              <ModalHeading icon={<Landmark size={19} />} title={activePlan.planName} subtitle={activePlan.bankId?.bankName || 'Partner bank'} onClose={() => setActiveModal(null)} />
              <div className="detail-rate"><strong>{Number(activePlan.standardInterestRate).toFixed(2)}%</strong><span>standard interest rate per annum</span></div>
              {activePlan.seniorCitizenInterestRate != null && <div className="detail-row"><span>Senior citizen rate</span><b>{Number(activePlan.seniorCitizenInterestRate).toFixed(2)}%</b></div>}
              <div className="detail-row"><span>Deposit range</span><b>{money(activePlan.minAmount)} – {activePlan.maxAmount ? money(activePlan.maxAmount) : 'No stated maximum'}</b></div>
              <div className="detail-row"><span>Tenure</span><b>{formatTenure(activePlan.minTenureDays, activePlan.maxTenureDays)}</b></div>
              <div className="detail-row"><span>Interest payout</span><b>{formatLabel(activePlan.interestPayout)}</b></div>
              <div className="detail-row"><span>Premature withdrawal</span><b>{activePlan.prematureWithdrawalAllowed ? 'Allowed' : 'Check with bank'}</b></div>
              {activePlan.description && <p className="details-description">{activePlan.description}</p>}
              {activePlan.eligibilityDescription && <p className="details-description">{activePlan.eligibilityDescription}</p>}
              <p className="form-footnote">Plan details can change. Confirm the latest rate, eligibility, and terms with the bank before applying.</p>
              <button className="button button-primary button-full" type="button" onClick={() => openCalculation(activePlan)}>Estimate my returns <ArrowRight size={16} /></button>
            </div>
          )}

          {activeModal === 'apply' && activePlan && (
            <ApplicationForm
              plan={activePlan}
              user={currentUser}
              mutation={applicationMutation}
              onClose={() => setActiveModal(null)}
            />
          )}

          {activeModal === 'application-success' && activePlan?.createdApplication && (
            <div className="modal-content success-content">
              <ModalHeading icon={<Check size={20} />} title="Your enquiry is ready" subtitle={`Reference ${activePlan.createdApplication.referenceCode}`} onClose={() => setActiveModal(null)} />
              <p>Your enquiry for <strong>{activePlan.planName}</strong> has been recorded. Continue with the bank to complete any KYC and deposit booking.</p>
              {activePlan.createdApplication.officialBankRedirectUrl && (
                <a className="button button-primary button-full" href={activePlan.createdApplication.officialBankRedirectUrl} target="_blank" rel="noreferrer">
                  Continue to official bank website <ExternalLink size={16} />
                </a>
              )}
              <p className="form-footnote">FD Connect does not collect your deposit or process payment. The bank handles the rest of the journey.</p>
              <button className="button button-outline button-full" type="button" onClick={() => { setActivePlan(null); navigate(roleHomePath(currentUser?.role)); }}>View my enquiries</button>
            </div>
          )}

          {activeModal === 'account' && currentUser && (
            <AccountPanel
              user={currentUser}
              onLogout={handleLogout}
              onClose={() => setActiveModal(null)}
            />
          )}
        </Modal>
      )}
    </div>
  );
};

const Modal = ({ children, onClose, className = '' }) => (
  <div className={`modal-backdrop ${className}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-label="FD Connect dialog">
      {children}
    </section>
  </div>
);

const ModalHeading = ({ icon, title, subtitle, onClose }) => (
  <div className="modal-heading">
    <span className="modal-heading-icon">{icon}</span>
    <div><h2>{title}</h2><p>{subtitle}</p></div>
    <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
  </div>
);

const CalculatorForm = ({ plan, mutation, onClose, onApply }) => {
  const [amount, setAmount] = useState(Number(plan.minAmount) || 10000);
  const [tenure, setTenure] = useState(Number(plan.minTenureDays));
  const [category, setCategory] = useState('standard');
  const maximum = Number(plan.maxAmount) || 100000000000;
  const runCalculation = (event) => {
    event.preventDefault();
    mutation.mutate({ planId: plan._id, principal: Number(amount), tenureDays: Number(tenure), customerCategory: category });
  };
  return (
    <div className="modal-content">
      <ModalHeading icon={<Calculator size={19} />} title="Estimate your returns" subtitle={`${plan.planName} · ${plan.bankId?.bankName || 'Partner bank'}`} onClose={onClose} />
      <div className="calculator-rate-summary"><span>Listed rate</span><strong>{Number(plan.standardInterestRate).toFixed(2)}% <small>p.a.</small></strong></div>
      <form className="form-stack" onSubmit={runCalculation}>
        <label>Deposit amount <span className="input-hint">{money(plan.minAmount)} minimum</span>
          <div className="input-with-prefix"><span>₹</span><input type="number" min={Number(plan.minAmount)} max={maximum} step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        </label>
        <label>Tenure <span className="input-hint">{formatTenure(plan.minTenureDays, plan.maxTenureDays)}</span>
          <div className="input-with-suffix"><input type="number" min={plan.minTenureDays} max={plan.maxTenureDays} value={tenure} onChange={(event) => setTenure(event.target.value)} required /><span>days</span></div>
        </label>
        <label>Customer category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="standard">Standard</option>
            <option value="senior_citizen">Senior citizen</option>
          </select>
        </label>
        {mutation.isError && <p className="form-error" role="alert">{getErrorMessage(mutation.error)}</p>}
        <button className="button button-primary button-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Calculating…' : 'Calculate returns'} <ArrowRight size={16} /></button>
      </form>
      {mutation.data && (
        <div className="calculation-result" aria-live="polite">
          <span>Estimated maturity value</span>
          <strong>{money(mutation.data.maturityAmount)}</strong>
          <div><span>Estimated interest</span><b>{money(mutation.data.interest)}</b></div>
          <p>Indicative estimate only. Actual returns may differ based on bank terms and tax.</p>
          <button type="button" className="button button-dark button-full" onClick={onApply}>Enquire with this bank <ArrowRight size={16} /></button>
        </div>
      )}
      <p className="form-footnote">This estimate is not a guarantee or investment advice. The bank will confirm final terms.</p>
    </div>
  );
};

const CompareForm = ({ plans, mutation, onClose }) => {
  const [amount, setAmount] = useState(Number(plans[0]?.minAmount) || 10000);
  const [tenure, setTenure] = useState(Number(plans[0]?.minTenureDays) || 365);
  const [category, setCategory] = useState('standard');
  return (
    <div className="modal-content compare-modal-content">
      <ModalHeading icon={<ArrowDownUp size={19} />} title="Compare FD plans" subtitle={`${plans.length} plans selected`} onClose={onClose} />
      <div className="compare-selected-list">{plans.map((plan) => <div key={plan._id}><span>{plan.bankId?.bankName}</span><b>{plan.planName}</b><strong>{Number(plan.standardInterestRate).toFixed(2)}%</strong></div>)}</div>
      <form className="form-stack compare-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({ planIds: plans.map((plan) => plan._id), principal: Number(amount), tenureDays: Number(tenure), customerCategory: category });
      }}>
        <div className="form-inline">
          <label>Deposit amount<input type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Tenure (days)<input type="number" min="1" value={tenure} onChange={(event) => setTenure(event.target.value)} required /></label>
        </div>
        <label>Customer category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="standard">Standard</option><option value="senior_citizen">Senior citizen</option></select></label>
        {mutation.isError && <p className="form-error" role="alert">{getErrorMessage(mutation.error)}</p>}
        <button className="button button-primary button-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Comparing…' : 'Compare estimated returns'} <ArrowRight size={16} /></button>
      </form>
      {mutation.data && <div className="compare-results">{mutation.data.map((result, index) => <div className="compare-result-row" key={result.planId}><span className="compare-rank">{index + 1}</span><div><b>{result.planName}</b><small>{result.bank?.bankName}</small></div><div className="compare-result-value"><strong>{money(result.maturityAmount)}</strong><small>+{money(result.interest)} interest</small></div></div>)}</div>}
      <p className="form-footnote">Only eligible, currently approved plans are included. Estimates are indicative and exclude tax and penalties.</p>
    </div>
  );
};

const GoogleSignInButton = ({ clientId, onCredential, disabled }) => {
  const buttonRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  const usableClientId = clientId && !clientId.includes('<') && !clientId.includes('>');
  useEffect(() => {
    credentialHandler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!usableClientId) return undefined;
    let attempts = 0;
    let timer;
    const renderGoogleButton = () => {
      const identity = window.google?.accounts?.id;
      if (!identity || !buttonRef.current) return false;
      buttonRef.current.replaceChildren();
      identity.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) credentialHandler.current(response.credential);
        },
      });
      identity.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      });
      return true;
    };

    if (!renderGoogleButton()) {
      timer = window.setInterval(() => {
        attempts += 1;
        if (renderGoogleButton() || attempts >= 50) window.clearInterval(timer);
      }, 100);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [clientId, usableClientId]);

  if (!usableClientId) {
    return <p className="google-signin-note">Google sign-in is unavailable until VITE_GOOGLE_CLIENT_ID is configured.</p>;
  }
  return <div className={`google-signin-container ${disabled ? 'is-disabled' : ''}`} ref={buttonRef} aria-disabled={disabled} />;
};

const ApplicationForm = ({ plan, user, mutation, onClose }) => {
  const [consent, setConsent] = useState(false);
  const [maxBirthDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div className="modal-content">
      <ModalHeading icon={<ExternalLink size={19} />} title="Enquire about this FD" subtitle={`${plan.planName} · ${plan.bankId?.bankName} (${plan.bankId?.bankCode})`} onClose={onClose} />
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        mutation.mutate({
          fdPlanId: plan._id,
          applicantName: String(form.get('applicantName')).trim(),
          applicantPhone: String(form.get('applicantPhone')).trim(),
          dateOfBirth: String(form.get('dateOfBirth')),
          addressLine: String(form.get('addressLine')).trim(),
          city: String(form.get('city')).trim(),
          state: String(form.get('state')).trim(),
          postalCode: String(form.get('postalCode')).trim(),
          aadhaarLast4: String(form.get('aadhaarLast4')).trim(),
          depositAmount: Number(form.get('depositAmount')),
          tenureDays: Number(form.get('tenureDays')),
          customerCategory: String(form.get('customerCategory')),
          consent: { dataSharingAccepted: true, noticeVersion: 'v3' },
        });
      }}>
        <label>Legal name<input name="applicantName" type="text" autoComplete="name" minLength="2" maxLength="100" defaultValue={user?.fullName || ''} required /></label>
      <label>Account email<input type="email" value={user?.email || ''} readOnly /><span className="input-hint">{user?.emailVerifiedAt ? 'Email verified' : 'Verify your account email before sending this enquiry.'}</span></label>
      <label>Contact phone<input name="applicantPhone" type="tel" autoComplete="tel" pattern="[+]?[0-9 ()-]{7,20}" defaultValue={user?.phone || ''} required /><span className="input-hint">Phone OTP is not configured, so this number is unverified. It will be shared only with your consent.</span></label>
      <label>Date of birth<input name="dateOfBirth" type="date" max={maxBirthDate} autoComplete="bday" required /></label>
      <label>Street address<input name="addressLine" type="text" autoComplete="street-address" minLength="5" maxLength="300" required /></label>
      <div className="form-inline">
        <label>City<input name="city" type="text" autoComplete="address-level2" minLength="2" maxLength="100" required /></label>
        <label>State<input name="state" type="text" autoComplete="address-level1" minLength="2" maxLength="100" required /></label>
      </div>
      <label>Postal code<input name="postalCode" type="text" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}" minLength="6" maxLength="6" required /></label>
        <label>Aadhaar last 4 digits<input name="aadhaarLast4" type="text" inputMode="numeric" pattern="[0-9]{4}" minLength="4" maxLength="4" autoComplete="off" required /><span className="input-hint">Do not upload or enter your full Aadhaar number. These digits are not shared with the bank.</span></label>
        <label>How much are you considering?<div className="input-with-prefix"><span>₹</span><input name="depositAmount" type="number" min={Number(plan.minAmount)} max={Number(plan.maxAmount) || undefined} step="1000" defaultValue={Number(plan.minAmount)} required /></div></label>
        <label>Preferred tenure (days)<input name="tenureDays" type="number" min={plan.minTenureDays} max={plan.maxTenureDays} defaultValue={plan.minTenureDays} required /></label>
        <label>Customer category<select name="customerCategory" defaultValue="standard"><option value="standard">Standard</option><option value="senior_citizen">Senior citizen</option></select></label>
        <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree to share my legal name, account email, unverified contact phone, date of birth, address, and FD enquiry details with the selected bank. FD Connect does not collect Aadhaar documents or a full Aadhaar number; the last four digits are stored with my enquiry but are not shared with the bank.</span></label>
        {mutation.isError && <p className="form-error" role="alert">{getErrorMessage(mutation.error)}</p>}
        <button className="button button-primary button-full" type="submit" disabled={!consent || mutation.isPending}>{mutation.isPending ? 'Sending enquiry…' : 'Send enquiry'} <ArrowRight size={16} /></button>
        <p className="form-footnote">This sends an enquiry only. FD Connect does not collect deposits or payments. The bank handles KYC and booking on its official channels.</p>
      </form>
    </div>
  );
};

const AccountPanel = ({ user, onLogout, onClose }) => {
  const applicationsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data } = await api.get('/users/applications?limit=20');
      return data.data.applications || [];
    },
    retry: false,
  });
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get('/users/favorites?limit=20');
      return data.data.favorites || [];
    },
    retry: false,
  });
  return (
    <div className="modal-content account-content">
      <ModalHeading icon={<Wallet size={19} />} title={`Hello, ${user.fullName?.split(' ')[0] || 'there'}`} subtitle={user.email} onClose={onClose} />
      <h3 className="account-section-title">My enquiries</h3>
      {applicationsQuery.isLoading ? <p className="account-empty">Loading your enquiries…</p>
        : applicationsQuery.data?.length ? applicationsQuery.data.map((application) => (
          <div className="account-list-row" key={application._id}>
            <div><b>{application.planNameSnapshot}</b><small>{application.referenceCode} · {formatLabel(application.status)}</small></div>
            <strong>{money(application.depositAmount)}</strong>
          </div>
        )) : <p className="account-empty">Your enquiries will appear here after you contact a bank.</p>}
      <h3 className="account-section-title account-title-spaced">Saved plans</h3>
      {favoritesQuery.data?.length ? favoritesQuery.data.map((favorite) => (
        <div className="account-list-row" key={favorite._id}>
          <div><b>{favorite.fdPlanId?.planName || 'FD plan'}</b><small>{favorite.fdPlanId?.bankId?.bankName || 'Partner bank'}</small></div>
          <Heart size={16} className="account-heart" />
        </div>
      )) : <p className="account-empty">Save a plan with the heart icon to find it here later.</p>}
      <button className="button button-outline button-full account-logout" type="button" onClick={onLogout}>Sign out</button>
    </div>
  );
};

const formatTenure = (minimum, maximum) => {
  const years = (days) => {
    if (days >= 365 && days % 365 === 0) return `${days / 365} yr${days === 365 ? '' : 's'}`;
    if (days >= 30 && days % 30 === 0) return `${days / 30} mo${days === 30 ? '' : 's'}`;
    return `${days} days`;
  };
  return minimum === maximum ? years(minimum) : `${years(minimum)} – ${years(maximum)}`;
};

const formatLabel = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default HomePage;
