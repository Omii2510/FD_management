const { useEffect, useState } = React;
const html = htm.bind((type, props, ...children) => {
  if (props && Object.prototype.hasOwnProperty.call(props, 'class')) {
    props = { ...props, className: props.class };
    delete props.class;
  }
  return React.createElement(type, props, ...children);
});
const API_BASE = '/api/v1';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

async function api(path, options = {}) {
  const headers = {};
  let body;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers,
    body,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    const error = new Error(result?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.details = result?.details;
    throw error;
  }
  return { ...(result?.data || {}), message: result?.message || '' };
}

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const toIso = (value) => new Date(value).toISOString();
const localDateTime = (offsetMs = 0) => {
  const date = new Date(Date.now() + offsetMs);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function ErrorMessage({ children }) {
  return children ? html`<p class="error" role="alert">${children}</p>` : null;
}

function Notice({ children }) {
  return children ? html`<p class="notice" role="status">${children}</p>` : null;
}

function Empty({ children }) {
  return html`<div class="empty">${children}</div>`;
}

function Status({ value }) {
  const tone = ['approved', 'active', 'booked'].includes(value) ? 'ok'
    : ['rejected', 'inactive', 'suspended', 'cancelled'].includes(value) ? 'no' : 'wait';
  return html`<span class=${`tag ${tone}`}>${label(value || 'unknown')}</span>`;
}

function Tabs({ items, value, onChange }) {
  return html`<nav aria-label="Workspace sections">${items.map(([id, title]) => html`
    <button key=${id} type="button" aria-current=${value === id} onClick=${() => onChange(id)}>${title}</button>
  `)}</nav>`;
}

function Shell({ user, title, onLogout, children }) {
  const [logoutError, setLogoutError] = useState('');
  const signOut = async () => {
    setLogoutError('');
    try {
      await onLogout();
    } catch (requestError) {
      setLogoutError(requestError.message);
    }
  };
  return html`<div>
    <header class="top">
      <div class="brand">FD Connect<small>${title}${user?.fullName ? ` · ${user.fullName}` : ''}</small></div>
      ${user && html`<button class="btn ghost" type="button" onClick=${signOut}>Sign out</button>`}
    </header>
    ${logoutError && html`<main><${ErrorMessage}>${logoutError}<//></main>`}
    ${children}
  </div>`;
}

function Auth({ onLogin }) {
  const [role, setRole] = useState('user');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const chooseRole = (nextRole) => {
    setRole(nextRole);
    setMode('login');
    setError('');
    setNotice('');
    setVerificationUrl('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setVerificationUrl('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    try {
      if (role === 'user' && mode === 'signup') {
        const result = await api('/auth/register', {
          method: 'POST',
          body: {
            fullName: String(form.get('fullName')).trim(),
            email,
            password,
          },
        });
        setNotice(result.message || 'Account created. Verify your email before signing in.');
        if (result.emailVerificationToken) {
          setVerificationUrl(`${API_BASE}/auth/verify-email/${encodeURIComponent(result.emailVerificationToken)}`);
        }
      } else {
        const result = await api('/auth/login', { method: 'POST', body: { email, password } });
        onLogin(result.user);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="auth">
    <div class="brand" style=${{ fontSize: '1.8rem' }}>FD Connect
      <small>Compare fixed deposit plans and contact banks directly.</small>
    </div>
    <div class="seg" role="group" aria-label="Choose account type">
      <button type="button" aria-pressed=${role === 'user'} onClick=${() => chooseRole('user')}>Customer</button>
      <button type="button" aria-pressed=${role === 'bank'} onClick=${() => chooseRole('bank')}>Bank</button>
      <button type="button" aria-pressed=${role === 'admin'} onClick=${() => chooseRole('admin')}>Admin</button>
    </div>
    <form class="card stack" onSubmit=${submit}>
      <h1>${role === 'user' && mode === 'signup' ? 'Create your account' : `${label(role)} login`}</h1>
      ${role === 'user' && mode === 'signup' && html`<label>Full name
        <input name="fullName" autoComplete="name" minLength="2" maxLength="100" required />
      </label>`}
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete=${mode === 'signup' ? 'new-password' : 'current-password'} minLength=${mode === 'signup' ? '8' : undefined} required /></label>
      <${ErrorMessage}>${error}<//>
      <${Notice}>${notice}<//>
      ${verificationUrl && html`<p class="mut">For local development, <a href=${verificationUrl}>verify your email</a>, then sign in.</p>`}
      <button class="btn" type="submit" disabled=${busy}>${busy ? 'Please wait…' : role === 'user' && mode === 'signup' ? 'Create account' : 'Log in'}</button>
      ${role === 'user' && html`<button key="switch-account-mode" type="button" class="btn ghost" onClick=${() => {
        setMode(mode === 'login' ? 'signup' : 'login');
        setError('');
        setNotice('');
        setVerificationUrl('');
      }}>${mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
      <p key="google-sign-in-note" class="mut">Google sign-in requires OAuth configuration and is not enabled on this standalone page.</p>`}
      ${role === 'bank' && html`<p class="mut">Bank accounts are created by an administrator. Contact your administrator for access.</p>`}
      ${role === 'admin' && html`<p class="mut">Use the administrator account configured by the system operator.</p>`}
    </form>
  </div>`;
}

function PlanCard({ plan, onEnquire }) {
  return html`<article class="card stack">
    <div><h3>${plan.planName}</h3><span class="mut">${plan.bankId?.bankName || 'Partner bank'} · ${plan.bankId?.bankCode || ''}</span></div>
    <div class="rate">${Number(plan.standardInterestRate).toFixed(2)}% <span class="mut">p.a.</span></div>
    <div class="mut">${plan.minTenureDays}–${plan.maxTenureDays} days · from ${money(plan.minAmount)}</div>
    <p class="mut">${label(plan.interestPayout)} payout</p>
    ${onEnquire && html`<button class="btn" type="button" onClick=${onEnquire}>Send enquiry</button>`}
  </article>`;
}

function EnquiryForm({ plan, user, onClose, onComplete }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api('/users/applications', {
        method: 'POST',
        body: {
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
          officialBankRedirectUrl: String(form.get('officialBankRedirectUrl')).trim(),
          consent: { dataSharingAccepted: form.get('consent') === 'on', noticeVersion: 'v1' },
        },
      });
      onComplete();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="card stack">
    <div class="row"><h2>Enquire: ${plan.planName}</h2><button class="btn ghost" type="button" onClick=${onClose}>Cancel</button></div>
    <p class="mut">${plan.bankId?.bankName || 'Partner bank'} · ${plan.bankId?.bankCode || ''}</p>
    <form class="stack" onSubmit=${submit}>
      <div class="two">
        <label>Deposit amount (₹)<input name="depositAmount" type="number" min=${Number(plan.minAmount)} max=${plan.maxAmount ? Number(plan.maxAmount) : undefined} step="0.01" required /></label>
        <label>Preferred tenure (days)<input name="tenureDays" type="number" min=${plan.minTenureDays} max=${plan.maxTenureDays} step="1" required /></label>
      </div>
      <label>Legal name<input name="applicantName" defaultValue=${user.fullName || ''} minLength="2" maxLength="100" autoComplete="name" required /></label>
      <label>Phone number<input name="applicantPhone" defaultValue=${user.phone || ''} type="tel" autoComplete="tel" required /></label>
      <p class="mut">Phone verification is not configured; your phone number will be marked unverified.</p>
      <div class="two">
        <label>Date of birth<input name="dateOfBirth" type="date" max=${TODAY_ISO} required /></label>
        <label>Aadhaar last four digits<input name="aadhaarLast4" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" required /></label>
      </div>
      <label>Address<input name="addressLine" minLength="5" maxLength="300" autoComplete="street-address" required /></label>
      <div class="form-grid">
        <label>City<input name="city" minLength="2" maxLength="100" required /></label>
        <label>State<input name="state" minLength="2" maxLength="100" required /></label>
        <label>Postal code<input name="postalCode" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required /></label>
        <label>Customer category<select name="customerCategory"><option value="standard">Standard</option><option value="senior_citizen">Senior citizen</option></select></label>
      </div>
      <label>Official bank website (optional)<input name="officialBankRedirectUrl" type="url" placeholder="https://…" /></label>
      <label class="check"><input name="consent" type="checkbox" required />
        <span>I consent to sharing these enquiry details with this bank. FD Connect does not collect Aadhaar documents or the full Aadhaar number. Complete KYC and deposit booking through the bank.</span>
      </label>
      <${ErrorMessage}>${error}<//>
      <button class="btn" type="submit" disabled=${busy}>${busy ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  </div>`;
}

function EnquiryList({ applications, empty }) {
  if (!applications.length) return html`<${Empty}>${empty}<//>`;
  return html`<div class="stack">${applications.map((application) => html`
    <article class="card stack" key=${application._id}>
      <div class="row"><h3>${application.planNameSnapshot || application.fdPlanId?.planName || 'FD enquiry'}</h3><${Status} value=${application.status} /></div>
      <div>${application.bankId?.bankName || 'Partner bank'} · ${money(application.depositAmount)} · ${application.tenureDays} days</div>
      <div class="mut">${application.applicantName || application.userId?.fullName || 'Customer'} · ${application.applicantPhone || ''}</div>
      <div class="user-ref">${application.referenceCode || ''} · ${dateLabel(application.createdAt)}</div>
    </article>
  `)}</div>`;
}

function UserWorkspace({ user, onLogout }) {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api('/fd-plans?limit=50'),
      api('/advertisements?limit=50'),
      api('/users/applications?limit=50'),
    ]).then(([planData, adData, applicationData]) => {
      if (!active) return;
      setPlans(planData.plans || []);
      setAds(adData.advertisements || []);
      setApplications(applicationData.applications || []);
      setError('');
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);

  const finishEnquiry = () => {
    setSelectedPlan(null);
    setTab('enquiries');
    setRevision((value) => value + 1);
  };

  return html`<${Shell} user=${user} title="Customer workspace" onLogout=${onLogout}>
    <${Tabs} items=${[['plans', 'FD plans'], ['enquiries', `My enquiries (${applications.length})`]]} value=${tab} onChange=${setTab} />
    <main>
      <h1>${tab === 'plans' ? 'Explore fixed deposits' : 'My enquiries'}</h1>
      <p class="mut">${tab === 'plans' ? 'Compare currently approved plans from partner banks.' : 'Track enquiries you have sent to banks.'}</p>
      <${ErrorMessage}>${error}<//>
      ${loading ? html`<p class="mut">Loading from FD Connect…</p>` : tab === 'plans' ? html`
        ${ads.map((ad) => html`<article class="ad" key=${ad._id}>
          ${ad.bannerImageUrl && html`<img src=${ad.bannerImageUrl} alt="" />`}
          <strong>Sponsored · ${ad.title}</strong><p>${ad.description || ''}</p>
          <a href=${ad.destinationUrl} target="_blank" rel="noopener noreferrer">Learn more</a>
        </article>`)}
        ${plans.length ? html`<div class="grid">${plans.map((plan) => html`
          <${PlanCard} key=${plan._id} plan=${plan} onEnquire=${user.emailVerifiedAt ? () => setSelectedPlan(plan) : undefined} />
        `)}</div>` : html`<${Empty}>No approved FD plans are available yet.<//>`}
        ${!user.emailVerifiedAt && html`<p class="notice">Verify your email before sending an FD enquiry.</p>`}
        ${selectedPlan && html`<${EnquiryForm} plan=${selectedPlan} user=${user} onClose=${() => setSelectedPlan(null)} onComplete=${finishEnquiry} />`}
      ` : html`<${EnquiryList} applications=${applications} empty="You have not sent an enquiry yet." />`}
    </main>
  <//>`;
}

function BankWorkspace({ user, onLogout }) {
  const [tab, setTab] = useState('plans');
  const [bank, setBank] = useState(null);
  const [plans, setPlans] = useState([]);
  const [applications, setApplications] = useState([]);
  const [ads, setAds] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [effectiveFromDefault] = useState(() => localDateTime());
  const [adSchedule] = useState(() => ({
    start: localDateTime(60 * 60 * 1000),
    end: localDateTime(8 * 24 * 60 * 60 * 1000),
  }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api('/banks/me'),
      api('/fd-plans/mine?limit=50'),
      api('/banks/panel/applications?limit=50'),
      api('/advertisements/bank/advertisements?limit=50'),
    ]).then(([bankData, planData, applicationData, adData]) => {
      if (!active) return;
      setBank(bankData.bank);
      setPlans(planData.plans || []);
      setApplications(applicationData.applications || []);
      setAds(adData.advertisements || []);
      setError('');
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      setNotice(result?.message || 'Saved.');
      setRevision((value) => value + 1);
      return result;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const maxAmount = String(form.get('maxAmount')).trim();
    const seniorRate = String(form.get('seniorCitizenInterestRate')).trim();
    const result = await run(async () => {
      const result = await api('/fd-plans', {
        method: 'POST',
        body: {
          planName: String(form.get('planName')).trim(),
          description: String(form.get('description')).trim(),
          minAmount: Number(form.get('minAmount')),
          ...(maxAmount ? { maxAmount: Number(maxAmount) } : {}),
          minTenureDays: Number(form.get('minTenureDays')),
          maxTenureDays: Number(form.get('maxTenureDays')),
          standardInterestRate: Number(form.get('standardInterestRate')),
          ...(seniorRate ? { seniorCitizenInterestRate: Number(seniorRate) } : {}),
          interestPayout: String(form.get('interestPayout')),
          compoundingFrequency: String(form.get('compoundingFrequency')),
          effectiveFrom: toIso(String(form.get('effectiveFrom'))),
        },
      });
      return api(`/fd-plans/${result.plan._id}/submit`, { method: 'POST', body: {} });
    });
    if (result) formElement.reset();
  };

  const requestAd = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const banner = form.get('banner');
      const bannerForm = new FormData();
      bannerForm.append('banner', banner);
      const uploaded = await api('/advertisements/bank/banner', { method: 'POST', body: bannerForm });
      const fdPlanId = String(form.get('fdPlanId')).trim();
      const ad = await api('/advertisements/bank/advertisements', {
        method: 'POST',
        body: {
          title: String(form.get('title')).trim(),
          description: String(form.get('description')).trim(),
          bannerImageUrl: uploaded.bannerImageUrl,
          destinationUrl: String(form.get('destinationUrl')).trim(),
          proposedBudget: Number(form.get('proposedBudget')),
          campaignObjective: String(form.get('campaignObjective')),
          objectiveDetails: String(form.get('objectiveDetails')).trim(),
          placement: String(form.get('placement')),
          startAt: toIso(String(form.get('startAt'))),
          endAt: toIso(String(form.get('endAt'))),
          ...(fdPlanId ? { fdPlanId } : {}),
        },
      });
      const submitted = await api(`/advertisements/bank/advertisements/${ad.advertisement._id}/submit`, { method: 'POST', body: {} });
      setNotice(submitted.message);
      setRevision((value) => value + 1);
      formElement.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateApplication = (applicationId, status) => run(() => api(
    `/banks/panel/applications/${applicationId}/status`,
    { method: 'PATCH', body: { status } },
  ));
  const approvedPlans = plans.filter((plan) => plan.status === 'approved');

  return html`<${Shell} user=${user} title=${bank?.bankName || 'Bank workspace'} onLogout=${onLogout}>
    <${Tabs} items=${[['plans', 'FD plans'], ['ads', `Ad requests (${ads.length})`], ['enquiries', `User enquiries (${applications.length})`]]} value=${tab} onChange=${setTab} />
    <main>
      <h1>${bank?.bankName || 'Bank workspace'}</h1>
      <p class="mut">Manage your fixed deposit plans, ad requests, and customer enquiries.</p>
      ${bank && html`<p><${Status} value=${bank.verificationStatus} /> ${bank.isActive ? 'Account active' : 'Account inactive'}</p>`}
      <${ErrorMessage}>${error}<//><${Notice}>${notice}<//>
      ${loading ? html`<p class="mut">Loading bank workspace…</p>` : error ? html`<p class="mut">Some bank tools require an approved, active bank account. Contact the administrator if access is pending.</p>` : tab === 'plans' ? html`
        <h2>Add an FD plan</h2>
        <form class="card stack" onSubmit=${createPlan}>
          <label>Plan name<input name="planName" minLength="2" maxLength="150" required /></label>
          <label>Description<textarea name="description" rows="2" maxLength="3000"></textarea></label>
          <div class="two">
            <label>Minimum deposit (₹)<input name="minAmount" type="number" min="1" step="0.01" required /></label>
            <label>Maximum deposit (optional)<input name="maxAmount" type="number" min="1" step="0.01" /></label>
          </div>
          <div class="two">
            <label>Minimum tenure (days)<input name="minTenureDays" type="number" min="1" max="36500" required /></label>
            <label>Maximum tenure (days)<input name="maxTenureDays" type="number" min="1" max="36500" required /></label>
          </div>
          <div class="two">
            <label>Standard interest rate (% p.a.)<input name="standardInterestRate" type="number" min="0" max="20" step="0.01" required /></label>
            <label>Senior citizen rate (optional)<input name="seniorCitizenInterestRate" type="number" min="0" max="20" step="0.01" /></label>
          </div>
          <div class="two">
            <label>Interest payout<select name="interestPayout"><option value="maturity">At maturity</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-yearly</option><option value="yearly">Yearly</option></select></label>
            <label>Compounding frequency<select name="compoundingFrequency"><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="half_yearly">Half-yearly</option><option value="yearly">Yearly</option><option value="none">None</option></select></label>
          </div>
          <label>Effective from<input name="effectiveFrom" type="datetime-local" defaultValue=${effectiveFromDefault} required /></label>
          <button class="btn" type="submit" disabled=${busy}>{busy ? 'Submitting…' : 'Save and submit for admin review'}</button>
        </form>
        <h2>Your plans</h2>
        ${plans.length ? html`<div class="stack">${plans.map((plan) => html`<article class="card row" key=${plan._id}>
          <div><h3>${plan.planName}</h3><span class="mut">${Number(plan.standardInterestRate).toFixed(2)}% · ${money(plan.minAmount)} minimum</span></div>
          <${Status} value=${plan.status} />
          ${['draft', 'rejected'].includes(plan.status) && html`<button class="btn" type="button" disabled=${busy} onClick=${() => run(() => api(`/fd-plans/${plan._id}/submit`, { method: 'POST', body: {} }))}>Submit for review</button>`}
        </article>`)}</div>` : html`<${Empty}>No plans yet. Add a plan to send it for review.<//>`}
      ` : tab === 'ads' ? html`
        <h2>Request an advertisement</h2>
        <form class="card stack" onSubmit=${requestAd}>
          <label>Advertisement title<input name="title" minLength="2" maxLength="150" required /></label>
          <label>Description<textarea name="description" rows="2" maxLength="3000"></textarea></label>
          <label>Banner (JPEG, PNG, or WebP; up to 5 MB)<input name="banner" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <p class="file-hint">The banner is uploaded securely before the request is sent to the administrator.</p>
          <label>Destination URL<input name="destinationUrl" type="url" placeholder="https://…" required /></label>
          <label>Promoted plan (optional)<select name="fdPlanId"><option value="">No specific plan</option>${approvedPlans.map((plan) => html`<option value=${plan._id} key=${plan._id}>${plan.planName}</option>`)}</select></label>
          <div class="two">
            <label>Proposed budget (₹)<input name="proposedBudget" type="number" min="0.01" step="0.01" required /></label>
            <label>Objective<select name="campaignObjective"><option value="plan_enquiries">FD plan enquiries</option><option value="brand_awareness">Brand awareness</option><option value="website_traffic">Website traffic</option><option value="other">Other</option></select></label>
          </div>
          <label>Objective details<input name="objectiveDetails" maxLength="2000" /></label>
          <div class="two">
            <label>Placement<select name="placement"><option value="homepage_banner">Homepage banner</option><option value="featured_fd">Featured FD</option><option value="sponsored_search">Sponsored search</option><option value="sidebar">Sidebar</option></select></label>
            <label>Starts<input name="startAt" type="datetime-local" defaultValue=${adSchedule.start} required /></label>
          </div>
          <label>Ends<input name="endAt" type="datetime-local" defaultValue=${adSchedule.end} required /></label>
          <button class="btn" type="submit" disabled=${busy}>{busy ? 'Uploading and submitting…' : 'Send ad request to admin'}</button>
        </form>
        <h2>Your ad requests</h2>
        ${ads.length ? html`<div class="stack">${ads.map((ad) => html`<article class="card row" key=${ad._id}>
          <div><h3>${ad.title}</h3><span class="mut">${money(ad.proposedBudget)} · ${label(ad.placement)}</span>${ad.rejectionReason && html`<p class="mut">Admin feedback: ${ad.rejectionReason}</p>`}</div>
          <${Status} value=${ad.status} />
        </article>`)}</div>` : html`<${Empty}>No ad requests submitted yet.<//>`}
      ` : html`
        <h2>User enquiries</h2>
        ${applications.length ? html`<div class="stack">${applications.map((application) => html`<article class="card stack" key=${application._id}>
          <div class="row"><h3>${application.applicantName || application.userId?.fullName || 'Customer'} · ${application.planNameSnapshot}</h3><${Status} value=${application.status} /></div>
          <div>${application.userId?.email || 'No email'} · ${application.applicantPhone || 'No phone'} <span class="tag wait">Phone unverified</span></div>
          <div class="mut">${money(application.depositAmount)} · ${application.tenureDays} days · ${application.referenceCode}</div>
          <div class="row">
            <select aria-label=${`Update ${application.referenceCode} status`} value="" onChange=${(event) => {
              const nextStatus = event.currentTarget.value;
              if (nextStatus) updateApplication(application._id, nextStatus);
            }}>
              <option value="">Update status…</option>
              ${['submitted_to_bank', 'bank_processing', 'booked', 'rejected'].filter((value) => value !== application.status).map((value) => html`<option value=${value} key=${value}>${label(value)}</option>`)}
            </select>
            <span class="user-ref">${dateLabel(application.createdAt)}</span>
          </div>
        </article>`)}</div>` : html`<${Empty}>No user enquiries yet.<//>`}
      `}
    </main>
  <//>`;
}

function AdminWorkspace({ user, onLogout }) {
  const [tab, setTab] = useState('banks');
  const [banks, setBanks] = useState([]);
  const [ads, setAds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api('/banks/admin/all?limit=50'),
      api('/advertisements/admin/advertisements?limit=50'),
      api('/admin/applications?limit=50'),
    ]).then(([bankData, adData, applicationData]) => {
      if (!active) return;
      setBanks(bankData.banks || []);
      setAds(adData.advertisements || []);
      setApplications(applicationData.applications || []);
      setError('');
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      setNotice(result?.message || 'Saved.');
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const registerBank = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await run(() => api('/admin/banks', {
      method: 'POST',
      body: {
        bank: {
          bankName: String(form.get('bankName')).trim(),
          bankCode: String(form.get('bankCode')).trim(),
          bankType: String(form.get('bankType')),
          officialWebsite: String(form.get('officialWebsite')).trim(),
          contactEmail: String(form.get('contactEmail')).trim(),
          customerCare: String(form.get('customerCare')).trim(),
          headquarters: String(form.get('headquarters')).trim(),
        },
        bankUser: {
          fullName: String(form.get('representative')).trim(),
          email: String(form.get('bankEmail')).trim(),
          password: String(form.get('bankPassword')),
        },
      },
    }));
    if (result) formElement.reset();
  };

  const reviewAd = (ad, status) => {
    const rejectionReason = status === 'rejected' ? window.prompt('Reason for rejecting this ad request:') : undefined;
    if (status === 'rejected' && !rejectionReason?.trim()) return;
    run(() => api(`/advertisements/admin/advertisements/${ad._id}/review`, {
      method: 'PATCH',
      body: { status, ...(rejectionReason ? { rejectionReason: rejectionReason.trim() } : {}) },
    }));
  };

  const updateBank = (bank, verificationStatus) => run(() => api(`/banks/${bank._id}/status`, {
    method: 'PATCH',
    body: { verificationStatus, isActive: verificationStatus === 'approved' },
  }));
  const deactivateBank = (bank) => {
    if (window.confirm(`Deactivate ${bank.bankName}? Bank login access will also be disabled.`)) {
      run(() => api(`/banks/${bank._id}`, { method: 'DELETE' }));
    }
  };

  return html`<${Shell} user=${user} title="Administrator workspace" onLogout=${onLogout}>
    <${Tabs} items=${[['banks', `Banks (${banks.length})`], ['ads', `Ad requests (${ads.length})`], ['enquiries', `User enquiries (${applications.length})`]]} value=${tab} onChange=${setTab} />
    <main>
      <h1>${tab === 'banks' ? 'Manage partner banks' : tab === 'ads' ? 'Advertisement requests' : 'Customer enquiries'}</h1>
      <p class="mut">Administrator controls for the FD Connect platform.</p>
      <${ErrorMessage}>${error}<//><${Notice}>${notice}<//>
      ${loading ? html`<p class="mut">Loading administrator workspace…</p>` : tab === 'banks' ? html`
        <h2>Register a bank and create its login</h2>
        <form class="card stack" onSubmit=${registerBank}>
          <div class="two">
            <label>Bank name<input name="bankName" minLength="2" maxLength="150" required /></label>
            <label>Bank code<input name="bankCode" minLength="2" maxLength="20" pattern="[A-Za-z0-9_-]+" required /></label>
          </div>
          <div class="two">
            <label>Bank type<select name="bankType"><option value="public">Public</option><option value="private">Private</option><option value="small_finance">Small finance</option><option value="cooperative">Cooperative</option><option value="other">Other</option></select></label>
            <label>Official website<input name="officialWebsite" type="url" placeholder="https://…" /></label>
          </div>
          <div class="two">
            <label>Contact email<input name="contactEmail" type="email" /></label>
            <label>Customer care phone<input name="customerCare" maxLength="100" /></label>
          </div>
          <label>Headquarters<input name="headquarters" maxLength="200" /></label>
          <h3>Bank representative login</h3>
          <div class="form-grid">
            <label>Representative name<input name="representative" minLength="2" maxLength="100" required /></label>
            <label>Login email<input name="bankEmail" type="email" autoComplete="email" required /></label>
            <label>Temporary password<input name="bankPassword" type="password" minLength="8" maxLength="72" autoComplete="new-password" required /></label>
          </div>
          <p class="mut">The new bank is created pending administrator approval. Send its temporary password securely.</p>
          <button class="btn" type="submit" disabled=${busy}>{busy ? 'Registering…' : 'Register bank'}</button>
        </form>
        <h2>Registered banks</h2>
        ${banks.length ? html`<div class="stack">${banks.map((bank) => html`<article class="card row" key=${bank._id}>
          <div><h3>${bank.bankName} · ${bank.bankCode}</h3><span class="mut">${label(bank.bankType)} · ${bank.contactEmail || ''}</span><p><${Status} value=${bank.verificationStatus} /> ${bank.isActive ? 'Access active' : 'Access inactive'}</p></div>
          <div class="row">
            ${bank.verificationStatus !== 'approved' && html`<button class="btn" type="button" disabled=${busy} onClick=${() => updateBank(bank, 'approved')}>Approve</button>`}
            ${bank.verificationStatus === 'pending' && html`<button class="btn bad" type="button" disabled=${busy} onClick=${() => updateBank(bank, 'rejected')}>Reject</button>`}
            ${bank.isActive && html`<button class="btn bad" type="button" disabled=${busy} onClick=${() => deactivateBank(bank)}>Deactivate</button>`}
          </div>
        </article>`)}</div>` : html`<${Empty}>No banks registered yet.<//>`}
      ` : tab === 'ads' ? html`
        ${ads.length ? html`<div class="stack">${ads.map((ad) => html`<article class="card stack" key=${ad._id}>
          <div class="row"><h3>${ad.title}</h3><${Status} value=${ad.status} /></div>
          ${ad.bannerImageUrl && html`<img src=${ad.bannerImageUrl} alt="" style=${{ maxWidth: '100%', maxHeight: '180px', objectFit: 'cover' }} />`}
          <div>${ad.bankId?.bankName || 'Bank'} · ${ad.fdPlanId?.planName || 'No linked plan'} · ${money(ad.proposedBudget)}</div>
          <p class="mut">${ad.description || ''}</p>
          <div class="row"><a href=${ad.destinationUrl} target="_blank" rel="noopener noreferrer">Destination</a>
            ${ad.status === 'pending_review' && html`<span>
              <button class="btn" type="button" disabled=${busy} onClick=${() => reviewAd(ad, 'approved')}>Approve</button>
              <button class="btn bad" type="button" disabled=${busy} onClick=${() => reviewAd(ad, 'rejected')}>Reject</button>
            </span>`}
          </div>
          ${ad.rejectionReason && html`<p class="mut">Rejection reason: ${ad.rejectionReason}</p>`}
        </article>`)}</div>` : html`<${Empty}>No advertisement requests are waiting for review.<//>`}
      ` : applications.length ? html`<${EnquiryList} applications=${applications} empty="No customer enquiries yet." />` : html`<${Empty}>No customer enquiries yet.<//>`}
    </main>
  <//>`;
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const result = await api('/auth/me');
        if (active) setUser(result.user);
      } catch (requestError) {
        if (requestError.status === 401) {
          try {
            await api('/auth/refresh', { method: 'POST', body: {} });
            const result = await api('/auth/me');
            if (active) setUser(result.user);
          } catch (refreshError) {
            if (active && refreshError.status !== 401) setError(refreshError.message);
          }
        } else if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) setChecking(false);
      }
    };
    restore();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    setUser(null);
    setError('');
  };

  if (checking) return html`<main><p class="mut">Connecting to FD Connect…</p></main>`;
  if (!user) return html`<div><${ErrorMessage}>${error}<//><${Auth} onLogin=${setUser} /></div>`;
  if (user.role === 'admin') return html`<${AdminWorkspace} user=${user} onLogout=${logout} />`;
  if (user.role === 'bank') return html`<${BankWorkspace} user=${user} onLogout=${logout} />`;
  return html`<${UserWorkspace} user=${user} onLogout=${logout} />`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
