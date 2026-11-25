import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleAlert,
  ClipboardList,
  FileCheck2,
  Landmark,
  LogOut,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { roleHomePath } from '../utils/rolePaths';

const request = async (url) => {
  const { data } = await api.get(url);
  return data.data;
};
const formatLabel = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

const PanelPage = ({ expectedRole }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sectionState, setSectionState] = useState({ role: null, section: 'overview' });
  const [message, setMessage] = useState('');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const meQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: () => request('/auth/me').then((data) => data.user),
    retry: false,
  });
  const user = meQuery.data;
  const role = user?.role;
  const section = sectionState.role === role ? sectionState.section : 'overview';
  const setSection = (nextSection) => setSectionState({ role, section: nextSection });
  const dashboardUrl = role === 'admin' ? '/admin/dashboard' : '/banks/panel/dashboard';
  const dashboardQuery = useQuery({
    queryKey: ['panel', 'dashboard', role],
    queryFn: () => request(dashboardUrl),
    enabled: Boolean(role && role !== 'user'),
  });

  const mutation = useMutation({
    mutationFn: async ({ method = 'patch', url, payload }) => {
      const { data } = await api[method](url, payload);
      return data;
    },
    onSuccess: (response) => {
      setMessage(response.message || 'Changes saved.');
      queryClient.invalidateQueries({ queryKey: ['panel'] });
    },
    onError: (error) => setMessage(error.response?.data?.message || 'Could not save your changes. Please try again.'),
  });

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      queryClient.setQueryData(['current-user'], null);
      queryClient.removeQueries({ queryKey: ['favorites'] });
      queryClient.removeQueries({ queryKey: ['applications'] });
      queryClient.removeQueries({ queryKey: ['panel'] });
      queryClient.removeQueries({ queryKey: ['user-panel'] });
      navigate('/');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not sign out. Please try again.');
    }
  };

  if (meQuery.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading your workspace…</div>;
  if (!user || !['admin', 'bank'].includes(user.role)) {
    return <Navigate to={roleHomePath(user?.role)} replace />;
  }
  if (expectedRole && role !== expectedRole) {
    return <Navigate to={roleHomePath(role)} replace />;
  }

  const sections = role === 'admin'
    ? [
      { id: 'overview', label: 'Overview', icon: <Wallet size={17} /> },
      { id: 'banks', label: 'Banks', icon: <Building2 size={17} /> },
      { id: 'plans', label: 'FD plan review', icon: <FileCheck2 size={17} /> },
      { id: 'advertisements', label: 'Ad requests', icon: <Megaphone size={17} /> },
      { id: 'applications', label: 'Customer enquiries', icon: <ClipboardList size={17} /> },
      { id: 'users', label: 'Users', icon: <Users size={17} /> },
      { id: 'audit', label: 'Audit logs', icon: <ClipboardList size={17} /> },
    ]
    : [
      { id: 'overview', label: 'Overview', icon: <Wallet size={17} /> },
      { id: 'applications', label: 'Enquiries', icon: <ClipboardList size={17} /> },
      { id: 'plans', label: 'FD plans', icon: <FileCheck2 size={17} /> },
      { id: 'campaigns', label: 'Promotions', icon: <Megaphone size={17} /> },
    ];

  const workspaceContent = (
    <>
      <div className="workspace-title-row">
        <div>
          <div className="workspace-eyebrow">{role === 'admin' ? 'PLATFORM MANAGEMENT' : 'BANK OPERATIONS'}</div>
          <h1>{sections.find((item) => item.id === section)?.label || 'Overview'}</h1>
          <p>{getSectionDescription(role, section)}</p>
        </div>
        {section === 'plans' && role === 'bank' && (
          <button type="button" className="button button-primary" onClick={() => setShowPlanForm(true)}><Plus size={16} /> Add FD plan</button>
        )}
        {section === 'banks' && role === 'admin' && (
          <button type="button" className="button button-primary" onClick={() => setShowBankForm(true)}><Plus size={16} /> Add bank</button>
        )}
      </div>
      {message && <div className="workspace-message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss"><X size={15} /></button></div>}
      {dashboardQuery.isError && <ErrorBanner error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />}
      {section === 'overview' && <Overview role={role} data={dashboardQuery.data} isLoading={dashboardQuery.isLoading} navigate={setSection} />}
      {section === 'applications' && role === 'bank' && <BankApplications mutation={mutation} />}
      {section === 'plans' && role === 'bank' && <BankPlans mutation={mutation} />}
      {section === 'campaigns' && role === 'bank' && <BankPromotions mutation={mutation} />}
      {section === 'applications' && role === 'admin' && <AdminApplications />}
      {section === 'banks' && role === 'admin' && <AdminBanks mutation={mutation} />}
      {section === 'plans' && role === 'admin' && <AdminPlans mutation={mutation} />}
      {section === 'advertisements' && role === 'admin' && <AdminAdvertisements mutation={mutation} />}
      {section === 'users' && role === 'admin' && <AdminUsers mutation={mutation} />}
      {section === 'audit' && role === 'admin' && <AuditLogs />}
    </>
  );

  return (
    <>
      {role === 'admin' ? (
        <AdminWorkspace
          user={user}
          sections={sections}
          section={section}
          setSection={(nextSection) => { setSection(nextSection); setMessage(''); }}
          navigate={navigate}
          logout={logout}
        >
          {workspaceContent}
        </AdminWorkspace>
      ) : (
        <BankWorkspace
          user={user}
          sections={sections}
          section={section}
          setSection={(nextSection) => { setSection(nextSection); setMessage(''); }}
          navigate={navigate}
          logout={logout}
        >
          {workspaceContent}
        </BankWorkspace>
      )}
      {showPlanForm && <PlanForm onClose={() => setShowPlanForm(false)} onSave={(payload) => mutation.mutate(
        { method: 'post', url: '/fd-plans', payload },
        { onSuccess: () => setShowPlanForm(false) }
      )} isSaving={mutation.isPending} error={mutation.error} />}
      {showBankForm && <BankForm onClose={() => setShowBankForm(false)} onSave={(payload) => mutation.mutate(
        payload,
        { onSuccess: () => setShowBankForm(false) }
      )} isSaving={mutation.isPending} error={mutation.error} />}
    </>
  );
};

export const AdminPanelPage = () => <PanelPage expectedRole="admin" />;
export const BankPanelPage = () => <PanelPage expectedRole="bank" />;

const AdminWorkspace = ({ user, sections, section, setSection, navigate, logout, children }) => (
  <div className="workspace workspace-admin">
    <header className="workspace-header">
      <a className="brand" href="/marketplace" onClick={(event) => { event.preventDefault(); navigate('/marketplace'); }}>
        <span className="brand-mark"><Landmark size={20} /></span><span>fd<span className="brand-light">connect</span></span>
      </a>
      <div className="workspace-header-right">
        <span className="workspace-role admin"><ShieldCheck size={14} /> Administrator</span>
        <span className="workspace-user">{user.fullName}</span>
        <button type="button" className="workspace-logout" onClick={logout}><LogOut size={15} /><span>Sign out</span></button>
      </div>
    </header>
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <button type="button" className="back-to-market" onClick={() => navigate('/marketplace')}><ArrowLeft size={15} /> Marketplace</button>
        <div className="sidebar-caption">ADMIN TOOLS</div>
        <nav aria-label="Admin workspace navigation">
          {sections.map((item) => (
            <button type="button" key={item.id} className={`workspace-nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
              {item.icon}<span>{item.label}</span>{section === item.id && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <ShieldCheck size={18} />
          <b>Platform administration</b>
          <p>Manage partner banks, review advertising requests, and monitor customer enquiries.</p>
        </div>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  </div>
);

const BankWorkspace = ({ user, sections, section, setSection, navigate, logout, children }) => (
  <div className="workspace workspace-bank bank-workspace">
    <header className="workspace-header bank-workspace-header">
      <a className="brand" href="/marketplace" onClick={(event) => { event.preventDefault(); navigate('/marketplace'); }}>
        <span className="brand-mark"><Landmark size={20} /></span><span>fd<span className="brand-light">connect</span></span>
      </a>
      <div className="workspace-header-right">
        <span className="workspace-role"><Building2 size={14} /> Bank partner</span>
        <span className="workspace-user">{user.fullName}</span>
        <button type="button" className="workspace-logout" onClick={logout}><LogOut size={15} /><span>Sign out</span></button>
      </div>
    </header>
    <section className="bank-workspace-banner">
      <div>
        <span className="workspace-eyebrow">BANK PARTNER PORTAL</span>
        <h1>{user.bankId?.bankName || 'Your bank workspace'}</h1>
        <p>Manage deposit plans, customer enquiries, and promotion requests from your bank.</p>
      </div>
      <button type="button" className="button button-outline" onClick={() => navigate('/marketplace')}>View marketplace <ArrowRight size={15} /></button>
    </section>
    <nav className="bank-workspace-nav" aria-label="Bank workspace navigation">
      {sections.map((item) => (
        <button type="button" key={item.id} className={`workspace-nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
    <main className="workspace-main bank-workspace-main">{children}</main>
  </div>
);

const getSectionDescription = (role, section) => {
  if (section === 'overview') return role === 'admin' ? 'A clear view of marketplace activity and pending work.' : 'Keep track of your FD plans, customer enquiries, and promotions.';
  if (section === 'applications') return 'Review and update enquiries customers sent to your bank.';
  if (section === 'plans') return role === 'admin' ? 'Review submitted FD plans before they appear publicly.' : 'Manage your FD plan listings and submission status.';
  if (section === 'applications') return role === 'admin' ? 'View customer enquiries and review their current bank-processing history.' : 'Review and update enquiries customers sent to your bank.';
  if (section === 'banks') return 'Review partner bank profiles and verification status.';
  if (section === 'advertisements') return 'Review advertising requests submitted by partner banks.';
  if (section === 'users') return 'View user accounts and manage access when needed.';
  if (section === 'audit') return 'Review administrative actions across FD Connect.';
  return 'Manage your bank campaigns and advertisements.';
};

const ErrorBanner = ({ error, onRetry }) => (
  <div className="panel-error"><CircleAlert size={18} /><span>{error?.response?.data?.message || 'Could not load this information.'}</span><button type="button" onClick={onRetry}>Retry</button></div>
);

const Overview = ({ role, data, isLoading, navigate }) => {
  if (isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading overview…</div>;
  if (!data) return <EmptyPanel title="No overview available" text="Try reloading the page." />;
  const cards = role === 'admin'
    ? [
      ['Total users', data.users?.total, <Users key="users" size={19} />, 'Registered customer accounts'],
      ['Active banks', data.banks?.active, <Building2 key="banks" size={19} />, `${data.banks?.pendingReview || 0} pending verification`],
      ['Plans to review', data.plans?.pendingReview, <FileCheck2 key="plans" size={19} />, 'Awaiting admin decision'],
      ['Open enquiries', data.applications?.pending, <ClipboardList key="applications" size={19} />, `${data.applications?.total || 0} total received`],
      ['Ad reviews', data.advertisements?.pendingReview, <Megaphone key="ads" size={19} />, 'Pending moderation'],
    ]
    : [
      ['FD plans', data.plans?.total, <FileCheck2 key="plans" size={19} />, `${data.plans?.approved || 0} approved`],
      ['Open enquiries', data.applications?.active, <ClipboardList key="applications" size={19} />, `${data.applications?.total || 0} total received`],
      ['Booked deposits', data.applications?.booked, <Wallet key="booked" size={19} />, 'Confirmed by your bank'],
      ['Promotions', data.advertisements?.total, <Megaphone key="promotions" size={19} />, `${data.advertisements?.active || 0} active`],
    ];
  return (
    <>
      <div className={`metric-grid ${role === 'admin' ? 'metric-grid-admin' : ''}`}>{cards.map(([label, value, icon, caption]) => <div className="metric-card" key={label}><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value ?? 0}</strong><small>{caption}</small></div>)}</div>
      <div className="panel-welcome">
        <div><span className="workspace-eyebrow">YOUR NEXT STEP</span><h2>{role === 'admin' ? 'Keep the marketplace up to date.' : 'Help customers move forward with confidence.'}</h2><p>{role === 'admin' ? 'Review pending banks and FD plans to keep public information accurate.' : 'Review new enquiries and keep your FD details current for customers.'}</p></div>
        <div className="panel-welcome-actions">
          <button type="button" className="button button-primary" onClick={() => navigate('applications')}>View enquiries <ArrowRight size={15} /></button>
          {role === 'bank' && <button type="button" className="button button-outline" onClick={() => navigate('plans')}>Manage plans</button>}
          {role === 'admin' && <button type="button" className="button button-outline" onClick={() => navigate('plans')}>Review FD plans</button>}
        </div>
      </div>
      <div className="panel-info-note"><ShieldCheck size={17} /><span>{role === 'admin' ? 'Updates to public bank and plan details should be reviewed before publishing.' : 'Deposits and payments remain on the official bank website. FD Connect only shares enquiry information with user consent.'}</span></div>
      {role === 'admin' && data.recentActivity?.length > 0 && <section className="panel-section-card panel-recent-activity">
        <h2>Recent administrative activity</h2>
        {data.recentActivity.map((item) => <div className="compact-row" key={item._id}>
          <span><b>{formatLabel(item.action)}</b><small>{item.performedBy?.fullName || 'Administrator'} · {new Date(item.createdAt).toLocaleString('en-IN')}</small></span>
          <small>{formatLabel(item.entityType || '')}</small>
        </div>)}
      </section>}
      {role === 'bank' && data.recentApplications?.length > 0 && <section className="panel-section-card panel-recent-activity">
        <h2>Recent customer enquiries</h2>
        {data.recentApplications.map((item) => <div className="compact-row" key={item._id}>
          <span><b>{item.applicantName || item.userId?.fullName || 'Customer'} · {item.planNameSnapshot}</b><small>{item.referenceCode} · {new Date(item.createdAt).toLocaleDateString('en-IN')}</small></span>
          <StatusBadge status={item.status} />
        </div>)}
      </section>}
    </>
  );
};

const BankApplications = ({ mutation }) => {
  const query = useQuery({ queryKey: ['panel', 'applications'], queryFn: () => request('/banks/panel/applications?limit=50') });
  const [selectedApplication, setSelectedApplication] = useState(null);
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading enquiries…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const applications = query.data.applications || [];
  return applications.length ? <>
    <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Customer</th><th>FD plan</th><th>Amount</th><th>Received</th><th>Status</th><th>Update status</th></tr></thead><tbody>
      {applications.map((application) => <tr key={application._id}>
        <td><b>{application.applicantName || application.userId?.fullName || 'Customer'}</b><small>{application.applicantPhone || ''} · {application.phoneVerifiedAt ? 'Phone verified' : 'Phone unverified'}</small><small>{application.userId?.email || ''} · {application.userId?.emailVerifiedAt ? 'Email verified' : 'Email unverified'}</small><small>{application.referenceCode}</small><button className="table-action" type="button" onClick={() => setSelectedApplication(application)}>View details</button></td>
        <td>{application.planNameSnapshot}</td>
        <td>{money(application.depositAmount)}</td>
        <td>{new Date(application.createdAt).toLocaleDateString('en-IN')}</td>
        <td><StatusBadge status={application.status} /></td>
        <td><select aria-label={`Update status for ${application.referenceCode}`} value="" onChange={(event) => {
          if (!event.target.value) return;
          mutation.mutate({ url: `/banks/panel/applications/${application._id}/status`, payload: { status: event.target.value } });
          query.refetch();
        }}><option value="">Update…</option>{['submitted_to_bank', 'bank_processing', 'booked', 'rejected'].filter((status) => status !== application.status).map((status) => <option value={status} key={status}>{formatLabel(status)}</option>)}</select></td>
      </tr>)}
    </tbody></table></div>
    {selectedApplication && <BankApplicationDetails application={selectedApplication} onClose={() => setSelectedApplication(null)} />}
  </> : <EmptyPanel title="No enquiries yet" text="Customer enquiries for your bank will appear here." />;
};

const BankApplicationDetails = ({ application, onClose, admin = false }) => {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['panel', admin ? 'admin-application' : 'bank-application', application._id],
    queryFn: () => request(admin ? `/admin/applications/${application._id}` : `/banks/panel/applications/${application._id}`),
  });
  const [note, setNote] = useState('');
  const noteMutation = useMutation({
    mutationFn: async (content) => {
      const { data } = await api.post(`/banks/panel/applications/${application._id}/notes`, { note: content });
      return data;
    },
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['panel', 'bank-application', application._id] });
      queryClient.invalidateQueries({ queryKey: ['panel', 'applications'] });
    },
  });
  const detailsApplication = detailQuery.data?.application || application;
  const details = [
    ['Legal name', detailsApplication.applicantName || detailsApplication.userId?.fullName || 'Not provided'],
    ['Contact email', detailsApplication.userId?.email || 'Not provided'],
    ['Email verification', detailsApplication.userId?.emailVerifiedAt ? 'Verified' : 'Not verified'],
    ['Contact phone', detailsApplication.applicantPhone || detailsApplication.userId?.phone || 'Not provided'],
    ['Phone verification', detailsApplication.phoneVerifiedAt ? 'Verified' : 'Not verified (SMS verification is not configured)'],
    ['Date of birth', detailsApplication.dateOfBirth ? new Date(detailsApplication.dateOfBirth).toLocaleDateString('en-IN') : 'Not provided'],
    ['Address', [detailsApplication.addressLine, detailsApplication.city, detailsApplication.state, detailsApplication.postalCode].filter(Boolean).join(', ') || 'Not provided'],
    ['Identity/KYC', detailsApplication.kycStatus === 'not_collected' ? 'Not collected by FD Connect; complete KYC on bank channels' : formatLabel(detailsApplication.kycStatus)],
    ['FD plan', detailsApplication.planNameSnapshot],
    ['Deposit amount', money(detailsApplication.depositAmount)],
    ['Preferred tenure', `${detailsApplication.tenureDays} days`],
    ['Data-sharing consent', detailsApplication.consent?.dataSharingAccepted ? 'Accepted' : 'Not recorded'],
  ];
  return (
    <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="bank-application-title">
        <div className="panel-modal-heading"><div><h2 id="bank-application-title">Customer enquiry</h2><p>{detailsApplication.referenceCode} · {formatLabel(detailsApplication.status)}</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {detailQuery.isError && <ErrorBanner error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}
        <div className="enquiry-detail-list">{details.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <p className="form-footnote">The customer consented to share enquiry details. FD Connect does not store Aadhaar documents or a full Aadhaar number. Complete identity checks only through your bank’s approved process.</p>
        {detailsApplication.statusHistory?.length > 0 && <section className="enquiry-history"><h3>Status history</h3>{detailsApplication.statusHistory.map((entry) => <div key={entry._id || `${entry.status}-${entry.changedAt}`}><StatusBadge status={entry.status} /><small>{entry.changedBy?.fullName || formatLabel(entry.actorRole)} · {new Date(entry.changedAt).toLocaleString('en-IN')}</small></div>)}</section>}
        {detailsApplication.internalNotes?.length > 0 && <section className="enquiry-history"><h3>{admin ? 'Bank internal notes' : 'Internal notes'}</h3>{detailsApplication.internalNotes.map((entry) => <div key={entry._id || entry.createdAt}><b>{entry.note}</b><small>{entry.createdBy?.fullName || 'Bank user'} · {new Date(entry.createdAt).toLocaleString('en-IN')}</small></div>)}</section>}
        {!admin && <form className="panel-form enquiry-note-form" onSubmit={(event) => {
          event.preventDefault();
          if (note.trim()) noteMutation.mutate(note.trim());
        }}>
          <label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Add a note visible only to bank staff." required /></label>
          {noteMutation.isError && <p className="form-error">{noteMutation.error.response?.data?.message || 'Could not save the note.'}</p>}
          <button type="submit" className="table-action" disabled={noteMutation.isPending || !note.trim()}>{noteMutation.isPending ? 'Saving…' : 'Add internal note'}</button>
        </form>}
        <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
};

const BankPlans = ({ mutation }) => {
  const query = useQuery({ queryKey: ['panel', 'bank-plans'], queryFn: () => request('/fd-plans/mine?limit=50') });
  const [planForEdit, setPlanForEdit] = useState(null);
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading FD plans…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const plans = query.data.plans || [];
  return <>
    {plans.length ? (
      <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Plan</th><th>Interest rate</th><th>Min. deposit</th><th>Tenure</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {plans.map((plan) => <tr key={plan._id}>
          <td><b>{plan.planName}</b><small>{formatLabel(plan.interestPayout)} payout</small></td>
          <td className="rate-cell">{Number(plan.standardInterestRate).toFixed(2)}%</td>
          <td>{money(plan.minAmount)}</td>
          <td>{plan.minTenureDays}–{plan.maxTenureDays} days</td>
          <td><StatusBadge status={plan.status} /></td>
          <td><div className="table-action-group">
            {['draft', 'rejected', 'inactive'].includes(plan.status) && <button className="table-action" type="button" onClick={() => setPlanForEdit(plan)}>Edit</button>}
            {['draft', 'rejected'].includes(plan.status) && <button className="table-action" type="button" onClick={() => mutation.mutate({ method: 'post', url: `/fd-plans/${plan._id}/submit`, payload: {} })}>Submit for review</button>}
            {plan.status === 'approved' && <button className="table-action table-action-danger" type="button" onClick={() => {
              if (window.confirm(`Deactivate ${plan.planName}? It will no longer appear in public results.`)) {
                mutation.mutate({ method: 'delete', url: `/fd-plans/${plan._id}` });
              }
            }}>Deactivate</button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
    ) : <EmptyPanel title="Add your first FD plan" text="Create a plan to share your bank’s deposit terms with customers." />}
    {planForEdit && <PlanForm plan={planForEdit} onClose={() => setPlanForEdit(null)} onSave={(payload) => mutation.mutate(
      { method: 'patch', url: `/fd-plans/${planForEdit._id}`, payload },
      { onSuccess: () => setPlanForEdit(null) }
    )} isSaving={mutation.isPending} error={mutation.error} />}
  </>;
};

const AdminApplications = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const query = useQuery({
    queryKey: ['panel', 'admin-applications', statusFilter],
    queryFn: () => request(`/admin/applications?limit=50${statusFilter ? `&status=${statusFilter}` : ''}`),
  });
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading customer enquiries…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const applications = query.data.applications || [];
  return <>
    <label className="panel-filter">Enquiry status
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
        <option value="">All statuses</option>
        {['initiated', 'redirected', 'submitted_to_bank', 'bank_processing', 'booked', 'rejected', 'cancelled', 'expired', 'unknown'].map((status) => <option value={status} key={status}>{formatLabel(status)}</option>)}
      </select>
    </label>
    {applications.length ? <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Customer</th><th>Bank / plan</th><th>Amount</th><th>Received</th><th>Status</th><th>Details</th></tr></thead><tbody>
      {applications.map((application) => <tr key={application._id}>
        <td><b>{application.applicantName || application.userId?.fullName || 'Customer'}</b><small>{application.userId?.email || 'No email'} · {application.referenceCode}</small></td>
        <td>{application.bankId?.bankName || 'Partner bank'}<small>{application.planNameSnapshot}</small></td>
        <td>{money(application.depositAmount)}</td>
        <td>{new Date(application.createdAt).toLocaleDateString('en-IN')}</td>
        <td><StatusBadge status={application.status} /></td>
        <td><button className="table-action" type="button" onClick={() => setSelectedApplication(application)}>View details</button></td>
      </tr>)}
    </tbody></table></div> : <EmptyPanel title="No customer enquiries" text="Customer enquiries will appear here after they are sent to a bank." />}
    {selectedApplication && <BankApplicationDetails application={selectedApplication} admin onClose={() => setSelectedApplication(null)} />}
  </>;
};

const BankPromotions = ({ mutation }) => {
  const campaignsQuery = useQuery({ queryKey: ['panel', 'campaigns'], queryFn: () => request('/advertisements/bank/campaigns?limit=50') });
  const adsQuery = useQuery({ queryKey: ['panel', 'advertisements'], queryFn: () => request('/advertisements/bank/advertisements?limit=50') });
  const [showAdForm, setShowAdForm] = useState(false);
  const [adForEdit, setAdForEdit] = useState(null);
  const queryClient = useQueryClient();
  const adMutation = useMutation({
    mutationFn: async ({ payload, advertisementId }) => {
      const { data: saved } = advertisementId
        ? await api.patch(`/advertisements/bank/advertisements/${advertisementId}`, payload)
        : await api.post('/advertisements/bank/advertisements', payload);
      const { data: submitted } = await api.post(`/advertisements/bank/advertisements/${saved.data.advertisement._id}/submit`);
      return submitted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['panel'] });
      setShowAdForm(false);
      setAdForEdit(null);
    },
  });
  if (campaignsQuery.isLoading || adsQuery.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading promotions…</div>;
  if (campaignsQuery.isError) return <ErrorBanner error={campaignsQuery.error} onRetry={() => campaignsQuery.refetch()} />;
  if (adsQuery.isError) return <ErrorBanner error={adsQuery.error} onRetry={() => adsQuery.refetch()} />;
  const campaigns = campaignsQuery.data.campaigns || [];
  const advertisements = adsQuery.data.advertisements || [];
  return <div className="promotion-columns">
    <div className="panel-section-card"><h2>Campaigns</h2><p>Campaign payment records are managed separately from FD deposits.</p>{campaigns.length ? campaigns.map((campaign) => <div className="compact-row" key={campaign._id}><span><b>{campaign.campaignName}</b><small>{campaign.campaignType.replace('_', ' ')}</small></span><StatusBadge status={campaign.status} /></div>) : <EmptyPanel title="No campaigns" text="Create a campaign when you are ready to promote a plan." />}</div>
    <div className="panel-section-card"><h2>Advertisements</h2><p>Promotional placements are reviewed before going live.</p><button className="table-action" type="button" onClick={() => { setAdForEdit(null); setShowAdForm(true); }}>Request advertisement</button>{advertisements.length ? advertisements.map((ad) => <div className="compact-row" key={ad._id}><span><b>{ad.title}</b><small>{formatLabel(ad.placement)} · {money(ad.proposedBudget)}</small>{ad.rejectionReason && <small>Admin feedback: {ad.rejectionReason}</small>}</span><span><StatusBadge status={ad.status} />{['draft', 'rejected'].includes(ad.status) && <button className="table-action" type="button" onClick={() => { setAdForEdit(ad); setShowAdForm(true); }}>Edit &amp; resubmit</button>}</span></div>) : <EmptyPanel title="No advertisements" text="Submit an advertisement request for admin review." />}</div>
    {mutation.isError && <div className="panel-error">{mutation.error?.response?.data?.message || 'Could not update promotions.'}</div>}
    {showAdForm && <AdvertisementForm advertisement={adForEdit} onClose={() => setShowAdForm(false)} onSave={(payload) => adMutation.mutate(
      { payload, advertisementId: adForEdit?._id }
    )} isSaving={adMutation.isPending} error={adMutation.error} />}
  </div>;
};

const AdminBanks = ({ mutation }) => {
  const query = useQuery({ queryKey: ['panel', 'banks'], queryFn: () => request('/banks/admin/all?limit=50') });
  const [bankForLogin, setBankForLogin] = useState(null);
  const [bankForEdit, setBankForEdit] = useState(null);
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading banks…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const banks = query.data.banks || [];
  return banks.length ? <>
    <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Bank</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{banks.map((bank) => <tr key={bank._id}>
      <td><b>{bank.bankName}</b><small>{bank.bankCode}</small></td><td>{formatLabel(bank.bankType)}</td><td><StatusBadge status={bank.verificationStatus === 'approved' && !bank.isActive ? 'inactive' : bank.verificationStatus} /></td>
      <td><div className="table-action-group">
        {bank.verificationStatus === 'pending' && <>
          <button className="table-action" type="button" onClick={() => mutation.mutate({ url: `/banks/${bank._id}/status`, payload: { verificationStatus: 'approved', isActive: true } })}>Approve</button>
          <button className="table-action table-action-danger" type="button" onClick={() => mutation.mutate({ url: `/banks/${bank._id}/status`, payload: { verificationStatus: 'rejected' } })}>Reject</button>
        </>}
        <button className="table-action" type="button" onClick={() => setBankForEdit(bank)}>Edit</button>
        {!bank.isActive && bank.verificationStatus !== 'pending' && <button className="table-action" type="button" onClick={() => mutation.mutate({ url: `/banks/${bank._id}/status`, payload: { verificationStatus: 'approved', isActive: true } })}>Activate</button>}
        {bank.isActive && bank.verificationStatus === 'approved' && <button className="table-action" type="button" onClick={() => setBankForLogin(bank)}>Create bank login</button>}
        {bank.isActive && <button className="table-action table-action-danger" type="button" onClick={() => {
          if (window.confirm(`Deactivate ${bank.bankName}? Bank user access will also be disabled.`)) {
            mutation.mutate({ method: 'delete', url: `/banks/${bank._id}` });
          }
        }}>Deactivate</button>}
      </div></td>
    </tr>)}</tbody></table></div>
    {bankForLogin && <BankUserForm bank={bankForLogin} onClose={() => setBankForLogin(null)} onSave={(payload) => mutation.mutate(
      { method: 'post', url: '/auth/admin/bank-users', payload },
      { onSuccess: () => setBankForLogin(null) }
    )} isSaving={mutation.isPending} error={mutation.error} />}
    {bankForEdit && <BankForm bank={bankForEdit} onClose={() => setBankForEdit(null)} onSave={(payload) => mutation.mutate(
      payload,
      { onSuccess: () => setBankForEdit(null) }
    )} isSaving={mutation.isPending} error={mutation.error} />}
  </> : <EmptyPanel title="No partner banks yet" text="Use Add bank to register your first partner bank." />;
};

const AdminPlans = ({ mutation }) => {
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const query = useQuery({
    queryKey: ['panel', 'admin-plans', statusFilter],
    queryFn: () => request(`/fd-plans/admin/all?limit=50${statusFilter ? `&status=${statusFilter}` : ''}`),
  });
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading FD plans…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const plans = query.data.plans || [];
  return <>
    <label className="panel-filter">Plan status
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
        <option value="pending_review">Pending review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="draft">Draft</option>
        <option value="inactive">Inactive</option>
        <option value="expired">Expired</option>
        <option value="">All statuses</option>
      </select>
    </label>
    {plans.length ? <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Plan</th><th>Bank</th><th>Rate</th><th>Deposit minimum</th><th>Tenure</th><th>Status / actions</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan._id}>
      <td><b>{plan.planName}</b><small>{formatLabel(plan.interestPayout)} payout</small></td><td>{plan.bankId?.bankName || 'Partner bank'}</td><td className="rate-cell">{Number(plan.standardInterestRate).toFixed(2)}%</td><td>{money(plan.minAmount)}</td><td>{plan.minTenureDays}–{plan.maxTenureDays} days</td>
      <td><StatusBadge status={plan.status} /><div className="table-action-group">
        {plan.status === 'pending_review' && <>
          <button className="table-action" type="button" onClick={() => mutation.mutate({ url: `/fd-plans/${plan._id}/review`, payload: { status: 'approved', reviewNotes: 'Approved by administrator.' } })}>Approve</button>
          <button className="table-action table-action-danger" type="button" onClick={() => {
            const reviewNotes = window.prompt('Reason for rejecting this FD plan?');
            if (!reviewNotes?.trim()) return;
            mutation.mutate({ url: `/fd-plans/${plan._id}/review`, payload: { status: 'rejected', reviewNotes: reviewNotes.trim() } });
          }}>Reject</button>
        </>}
        {plan.status === 'approved' && <button className="table-action table-action-danger" type="button" onClick={() => {
          if (window.confirm(`Deactivate ${plan.planName}? It will no longer appear in public results.`)) {
            mutation.mutate({ method: 'delete', url: `/fd-plans/${plan._id}` });
          }
        }}>Deactivate</button>}
      </div></td>
    </tr>)}</tbody></table></div> : <EmptyPanel title="No FD plans" text={statusFilter === 'pending_review' ? 'There are no plans waiting for review.' : 'No plans match this status.'} />}
  </>;
};

const AdminAdvertisements = ({ mutation }) => {
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const query = useQuery({
    queryKey: ['panel', 'admin-advertisements', statusFilter],
    queryFn: () => request(`/advertisements/admin/advertisements?limit=50${statusFilter ? `&status=${statusFilter}` : ''}`),
  });
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading ad requests…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const advertisements = query.data.advertisements || [];
  return <>
    <label className="panel-filter">Advertisement status
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
        <option value="pending_review">Pending review</option>
        <option value="approved">Approved</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="rejected">Rejected</option>
        <option value="">All statuses</option>
      </select>
    </label>
    {advertisements.length ? (
    <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Advertisement</th><th>Bank</th><th>Placement / objective</th><th>Budget</th><th>Schedule</th><th>Status / actions</th></tr></thead><tbody>
      {advertisements.map((ad) => <tr key={ad._id}>
        <td><b>{ad.title}</b><small>{ad.description || ad.fdPlanId?.planName || 'Bank promotion'}</small>{ad.objectiveDetails && <small>{ad.objectiveDetails}</small>}</td>
        <td><b>{ad.bankId?.bankName || 'Partner bank'}</b><small>{ad.bankId?.bankCode || ''}</small></td>
        <td>{formatLabel(ad.placement)}<small>{formatLabel(ad.campaignObjective || '')}</small></td>
        <td>{money(ad.proposedBudget)}</td>
        <td>{new Date(ad.startAt).toLocaleDateString('en-IN')} – {new Date(ad.endAt).toLocaleDateString('en-IN')}</td>
        <td><StatusBadge status={ad.status} /><div className="table-action-group">
          {ad.status === 'pending_review' && <>
            <button className="table-action" type="button" onClick={() => mutation.mutate({
              url: `/advertisements/admin/advertisements/${ad._id}/review`,
              payload: { status: 'approved' },
            })}>Approve</button>
            <button className="table-action table-action-danger" type="button" onClick={() => {
              const rejectionReason = window.prompt('Reason for rejecting this advertisement?');
              if (!rejectionReason?.trim()) return;
              mutation.mutate({
                url: `/advertisements/admin/advertisements/${ad._id}/review`,
                payload: { status: 'rejected', rejectionReason: rejectionReason.trim() },
              });
            }}>Reject</button>
          </>}
          {['approved', 'scheduled', 'active'].includes(ad.status) && <button className="table-action table-action-danger" type="button" onClick={() => mutation.mutate({
            url: `/advertisements/admin/advertisements/${ad._id}/status`,
            payload: { status: 'paused' },
          })}>Pause</button>}
          {ad.status === 'paused' && <button className="table-action" type="button" onClick={() => mutation.mutate({
            url: `/advertisements/admin/advertisements/${ad._id}/status`,
            payload: { status: 'active' },
          })}>Resume</button>}
        </div></td>
      </tr>)}
    </tbody></table></div>
    ) : <EmptyPanel title="No ad requests" text={statusFilter === 'pending_review' ? 'There are no ads waiting for review.' : 'No advertisements match this status.'} />}
  </>;
};

const AdminUsers = ({ mutation }) => {
  const query = useQuery({ queryKey: ['panel', 'users'], queryFn: () => request('/admin/users?limit=50') });
  const [userForPasswordReset, setUserForPasswordReset] = useState(null);
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading users…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const users = query.data.users || [];
  return users.length ? <>
    <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Bank</th><th>Access</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}>
      <td><b>{user.fullName}</b><small>{new Date(user.createdAt).toLocaleDateString('en-IN')}</small></td><td>{user.email}</td><td>{formatLabel(user.role)}</td><td>{user.bankId?.bankName || '—'}</td><td><StatusBadge status={user.isActive ? 'active' : 'inactive'} /></td>
      <td><div className="table-action-group">
        <button className="table-action" type="button" disabled={user.role === 'admin'} onClick={() => mutation.mutate({ url: `/admin/users/${user._id}/status`, payload: { isActive: !user.isActive } })}>{user.isActive ? 'Deactivate' : 'Activate'}</button>
        {user.role === 'bank' && <button className="table-action" type="button" onClick={() => setUserForPasswordReset(user)}>Reset password</button>}
      </div></td>
    </tr>)}</tbody></table></div>
    {userForPasswordReset && <ResetBankPasswordForm user={userForPasswordReset} onClose={() => setUserForPasswordReset(null)} onSave={(payload) => mutation.mutate(
      { method: 'patch', url: `/admin/bank-users/${userForPasswordReset._id}/password`, payload },
      { onSuccess: () => setUserForPasswordReset(null) }
    )} isSaving={mutation.isPending} error={mutation.error} />}
  </> : <EmptyPanel title="No users found" text="User accounts will appear here." />;
};

const AuditLogs = () => {
  const query = useQuery({ queryKey: ['panel', 'audit-logs'], queryFn: () => request('/admin/audit-logs?limit=50') });
  if (query.isLoading) return <div className="panel-loading"><span className="loading-spinner" /> Loading audit history…</div>;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const logs = query.data.logs || [];
  return logs.length ? <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Action</th><th>Performed by</th><th>Record</th><th>Date</th></tr></thead><tbody>{logs.map((log) => <tr key={log._id}>
    <td><b>{formatLabel(log.action)}</b></td><td>{log.performedBy?.fullName || 'Admin'}</td><td>{formatLabel(log.entityType)} · {String(log.entityId || '').slice(-6)}</td><td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
  </tr>)}</tbody></table></div> : <EmptyPanel title="No audit activity" text="Administrative changes will be recorded here." />;
};

const BankForm = ({ bank, onClose, onSave, isSaving, error }) => (
  <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="bank-form-title">
      <div className="panel-modal-heading"><div><h2 id="bank-form-title">{bank ? 'Edit partner bank' : 'Register a partner bank'}</h2><p>{bank ? 'Update the bank profile and contact information.' : 'A bank login is created now; approve the bank before it can access the panel.'}</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form className="panel-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const bankDetails = {
          bankName: String(form.get('bankName')).trim(),
          bankCode: String(form.get('bankCode')).trim(),
          bankType: String(form.get('bankType')),
          logoUrl: String(form.get('logoUrl')).trim() || undefined,
          description: String(form.get('description')).trim() || undefined,
          officialWebsite: String(form.get('officialWebsite')).trim() || undefined,
          contactEmail: String(form.get('contactEmail')).trim() || undefined,
          customerCare: String(form.get('customerCare')).trim() || undefined,
          headquarters: String(form.get('headquarters')).trim() || undefined,
        };
        if (bank) {
          onSave({ method: 'patch', url: `/banks/${bank._id}`, payload: bankDetails });
          return;
        }
        onSave({
          method: 'post',
          url: '/admin/banks',
          payload: {
            bank: bankDetails,
            bankUser: {
              fullName: String(form.get('bankUserName')).trim(),
              email: String(form.get('bankUserEmail')).trim(),
              password: String(form.get('bankUserPassword')),
            },
          },
        });
      }}>
        <label>Bank name<input name="bankName" defaultValue={bank?.bankName || ''} required minLength="2" maxLength="150" /></label>
        <div className="panel-form-grid">
          <label>Bank code<input name="bankCode" defaultValue={bank?.bankCode || ''} required minLength="2" maxLength="20" pattern="[A-Za-z0-9_-]+" /></label>
          <label>Bank type<select name="bankType" defaultValue={bank?.bankType || 'private'}><option value="public">Public</option><option value="private">Private</option><option value="small_finance">Small finance</option><option value="cooperative">Cooperative</option><option value="other">Other</option></select></label>
        </div>
        <label>Logo URL<input name="logoUrl" type="url" defaultValue={bank?.logoUrl || ''} placeholder="https://example.com/logo.png" /></label>
        <label>Official website<input name="officialWebsite" type="url" defaultValue={bank?.officialWebsite || ''} placeholder="https://example.com" /></label>
        <div className="panel-form-grid">
          <label>Contact email<input name="contactEmail" type="email" defaultValue={bank?.contactEmail || ''} /></label>
          <label>Customer care phone<input name="customerCare" defaultValue={bank?.customerCare || ''} maxLength="100" /></label>
        </div>
        <div className="panel-form-grid">
          <label>Headquarters<input name="headquarters" defaultValue={bank?.headquarters || ''} maxLength="200" /></label>
          <label>Description<input name="description" defaultValue={bank?.description || ''} maxLength="3000" /></label>
        </div>
        {!bank && <>
          <h3>Bank panel login</h3>
          <label>Representative name<input name="bankUserName" required minLength="2" maxLength="100" autoComplete="name" /></label>
          <label>Login email<input name="bankUserEmail" type="email" required autoComplete="email" /></label>
          <label>Temporary password<input name="bankUserPassword" type="password" required minLength="8" maxLength="72" autoComplete="new-password" /></label>
        </>}
        {error && <p className="form-error">{error.response?.data?.message || 'Could not register the bank.'}</p>}
        <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Saving…' : bank ? 'Save changes' : 'Register bank'} <ArrowRight size={15} /></button></div>
      </form>
    </section>
  </div>
);

const ResetBankPasswordForm = ({ user, onClose, onSave, isSaving, error }) => (
  <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="reset-bank-password-title">
      <div className="panel-modal-heading"><div><h2 id="reset-bank-password-title">Reset bank login password</h2><p>{user.email} · send the temporary password through a secure channel.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form className="panel-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({ password: String(form.get('password')) });
      }}>
        <label>New temporary password<input name="password" type="password" required minLength="8" maxLength="72" autoComplete="new-password" /></label>
        {error && <p className="form-error">{error.response?.data?.message || 'Could not reset the bank login password.'}</p>}
        <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Resetting…' : 'Reset password'} <ArrowRight size={15} /></button></div>
      </form>
    </section>
  </div>
);

const BankUserForm = ({ bank, onClose, onSave, isSaving, error }) => (
  <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="bank-user-form-title">
      <div className="panel-modal-heading"><div><h2 id="bank-user-form-title">Create bank login</h2><p>{bank.bankName} · banks cannot self-register.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form className="panel-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          bankId: bank._id,
          fullName: String(form.get('fullName')).trim(),
          email: String(form.get('email')).trim(),
          password: String(form.get('password')),
        });
      }}>
        <label>Bank representative<input name="fullName" required minLength="2" maxLength="100" /></label>
        <label>Login email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Temporary password<input name="password" type="password" required minLength="8" maxLength="72" autoComplete="new-password" /></label>
        {error && <p className="form-error">{error.response?.data?.message || 'Could not create the bank login.'}</p>}
        <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Creating…' : 'Create login'} <ArrowRight size={15} /></button></div>
      </form>
    </section>
  </div>
);

const AdvertisementForm = ({ advertisement, onClose, onSave, isSaving, error }) => {
  const plansQuery = useQuery({
    queryKey: ['panel', 'approved-bank-plans'],
    queryFn: () => request('/fd-plans/mine?limit=50&status=approved'),
  });
  const [bannerImageUrl, setBannerImageUrl] = useState(() => advertisement?.bannerImageUrl || '');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [scheduleDefaults] = useState(() => {
    const now = new Date();
    return {
      start: advertisement?.startAt
        ? toLocalDateTimeInput(new Date(advertisement.startAt))
        : toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000)),
      end: advertisement?.endAt
        ? toLocalDateTimeInput(new Date(advertisement.endAt))
        : toLocalDateTimeInput(new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)),
    };
  });
  const uploadBanner = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setBannerImageUrl('');
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Banner images must be 5 MB or smaller.');
      return;
    }

    const formData = new FormData();
    formData.append('banner', file);
    setIsUploading(true);
    try {
      const { data } = await api.post('/advertisements/bank/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBannerImageUrl(data.data.bannerImageUrl);
    } catch (uploadFailure) {
      setUploadError(uploadFailure.response?.data?.message || 'Could not upload the banner. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="advertisement-form-title">
        <div className="panel-modal-heading"><div><h2 id="advertisement-form-title">{advertisement ? 'Edit advertisement request' : 'Request an advertisement'}</h2><p>Admin approval is required before it goes live.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <form className="panel-form" onSubmit={(event) => {
          event.preventDefault();
          if (!bannerImageUrl) {
            setUploadError('Upload a banner image before submitting the request.');
            return;
          }
          const form = new FormData(event.currentTarget);
          const fdPlanId = String(form.get('fdPlanId'));
          onSave({
            title: String(form.get('title')).trim(),
            description: String(form.get('description')).trim() || undefined,
            bannerImageUrl,
            destinationUrl: String(form.get('destinationUrl')).trim(),
            proposedBudget: String(form.get('proposedBudget')),
            campaignObjective: String(form.get('campaignObjective')),
            objectiveDetails: String(form.get('objectiveDetails')).trim() || undefined,
            placement: String(form.get('placement')),
            startAt: new Date(String(form.get('startAt'))).toISOString(),
            endAt: new Date(String(form.get('endAt'))).toISOString(),
            ...(advertisement ? { fdPlanId: fdPlanId || null } : (fdPlanId ? { fdPlanId } : {})),
          });
        }}>
          <label>Ad title<input name="title" defaultValue={advertisement?.title || ''} required minLength="2" maxLength="150" /></label>
          <label>Description<input name="description" defaultValue={advertisement?.description || ''} maxLength="3000" /></label>
          <label>Banner image (JPEG, PNG, or WebP; up to 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadBanner} disabled={isUploading} required={!bannerImageUrl} /></label>
          {bannerImageUrl && <img className="ad-banner-preview" src={bannerImageUrl} alt="Uploaded advertisement banner preview" />}
          {isUploading && <p role="status">Uploading banner…</p>}
          {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
          <label>Destination URL<input name="destinationUrl" type="url" defaultValue={advertisement?.destinationUrl || ''} required placeholder="https://…" /></label>
          <div className="panel-form-grid">
            <label>Placement<select name="placement" defaultValue={advertisement?.placement || 'homepage_banner'}><option value="homepage_banner">Homepage banner</option><option value="featured_fd">Featured FD</option><option value="sponsored_search">Sponsored search</option><option value="sidebar">Sidebar</option></select></label>
            <label>Promoted FD plan<select name="fdPlanId" defaultValue={advertisement?.fdPlanId?._id || advertisement?.fdPlanId || ''}><option value="">None</option>{(plansQuery.data?.plans || []).map((plan) => <option value={plan._id} key={plan._id}>{plan.planName}</option>)}</select></label>
          </div>
          <div className="panel-form-grid">
            <label>Proposed budget (₹)<input name="proposedBudget" type="number" min="0.01" step="0.01" defaultValue={advertisement?.proposedBudget || ''} required /></label>
            <label>Campaign objective<select name="campaignObjective" defaultValue={advertisement?.campaignObjective || 'plan_enquiries'}><option value="brand_awareness">Brand awareness</option><option value="plan_enquiries">FD plan enquiries</option><option value="website_traffic">Website traffic</option><option value="other">Other</option></select></label>
          </div>
          <label>Objective details<input name="objectiveDetails" defaultValue={advertisement?.objectiveDetails || ''} maxLength="2000" /></label>
          <div className="panel-form-grid">
            <label>Starts<input name="startAt" type="datetime-local" required defaultValue={scheduleDefaults.start} /></label>
            <label>Ends<input name="endAt" type="datetime-local" required defaultValue={scheduleDefaults.end} /></label>
          </div>
          {plansQuery.isError && <p className="form-error">Could not load approved plans. You can still submit without linking a plan.</p>}
          {error && <p className="form-error">{error.response?.data?.message || 'Could not submit the advertisement request.'}</p>}
          <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving || isUploading}>{isSaving ? 'Submitting…' : advertisement ? 'Update & resubmit' : 'Send to admin'} <ArrowRight size={15} /></button></div>
        </form>
      </section>
    </div>
  );
};

const toLocalDateTimeInput = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const PlanForm = ({ plan, onClose, onSave, isSaving, error }) => {
  const [effectiveFromDefault] = useState(() => plan?.effectiveFrom
    ? toLocalDateTimeInput(new Date(plan.effectiveFrom))
    : toLocalDateTimeInput(new Date()));
  return (
  <div className="panel-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="plan-form-title">
      <div className="panel-modal-heading"><div><h2 id="plan-form-title">{plan ? 'Edit fixed deposit plan' : 'Add a fixed deposit plan'}</h2><p>Customers will see this after admin approval.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form className="panel-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const effectiveUntil = String(form.get('effectiveUntil'));
        const seniorRate = String(form.get('seniorCitizenInterestRate'));
        onSave({
          planName: String(form.get('planName')).trim(),
          description: String(form.get('description')).trim(),
          minAmount: String(form.get('minAmount')),
          maxAmount: String(form.get('maxAmount')) || undefined,
          minTenureDays: Number(form.get('minTenureDays')),
          maxTenureDays: Number(form.get('maxTenureDays')),
          standardInterestRate: Number(form.get('standardInterestRate')),
          seniorCitizenInterestRate: seniorRate ? Number(seniorRate) : (plan ? null : undefined),
          interestPayout: String(form.get('interestPayout')),
          compoundingFrequency: String(form.get('compoundingFrequency')),
          calculationMethod: String(form.get('calculationMethod')).trim(),
          prematureWithdrawalAllowed: form.get('prematureWithdrawalAllowed') === 'on',
          prematureWithdrawalPenaltyDescription: String(form.get('prematureWithdrawalPenaltyDescription')).trim(),
          taxSavingEligible: form.get('taxSavingEligible') === 'on',
          eligibilityDescription: String(form.get('eligibilityDescription')).trim(),
          termsUrl: String(form.get('termsUrl')).trim(),
          sourceUrl: String(form.get('sourceUrl')).trim(),
          sourceDocumentUrl: String(form.get('sourceDocumentUrl')).trim(),
          effectiveFrom: new Date(String(form.get('effectiveFrom'))).toISOString(),
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : (plan ? null : undefined),
        });
      }}>
        <label>Plan name<input name="planName" defaultValue={plan?.planName || ''} required minLength="2" maxLength="150" placeholder="e.g. 1-year fixed deposit" /></label>
        <label>Description<input name="description" defaultValue={plan?.description || ''} maxLength="3000" /></label>
        <div className="panel-form-grid"><label>Minimum deposit (₹)<input name="minAmount" type="number" min="1" step="0.01" defaultValue={plan?.minAmount || ''} required /></label><label>Maximum deposit (₹)<input name="maxAmount" type="number" min="1" step="0.01" defaultValue={plan?.maxAmount || ''} /></label></div>
        <div className="panel-form-grid"><label>Minimum tenure (days)<input name="minTenureDays" type="number" min="1" defaultValue={plan?.minTenureDays || ''} required /></label><label>Maximum tenure (days)<input name="maxTenureDays" type="number" min="1" defaultValue={plan?.maxTenureDays || ''} required /></label></div>
        <div className="panel-form-grid"><label>Standard rate (% p.a.)<input name="standardInterestRate" type="number" min="0" max="20" step="0.01" defaultValue={plan?.standardInterestRate ?? ''} required /></label><label>Senior rate (% p.a.)<input name="seniorCitizenInterestRate" type="number" min="0" max="20" step="0.01" defaultValue={plan?.seniorCitizenInterestRate ?? ''} /></label></div>
        <div className="panel-form-grid"><label>Interest payout<select name="interestPayout" defaultValue={plan?.interestPayout || 'maturity'}><option value="maturity">At maturity</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-yearly</option><option value="yearly">Yearly</option></select></label><label>Compounding frequency<select name="compoundingFrequency" defaultValue={plan?.compoundingFrequency || 'quarterly'}><option value="none">None</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-yearly</option><option value="yearly">Yearly</option></select></label></div>
        <label>Calculation method<input name="calculationMethod" defaultValue={plan?.calculationMethod || ''} maxLength="500" /></label>
        <label className="panel-checkbox"><span>Premature withdrawal allowed</span><input name="prematureWithdrawalAllowed" type="checkbox" defaultChecked={plan?.prematureWithdrawalAllowed || false} /></label>
        <label>Premature withdrawal penalty<input name="prematureWithdrawalPenaltyDescription" defaultValue={plan?.prematureWithdrawalPenaltyDescription || ''} maxLength="2000" /></label>
        <label className="panel-checkbox"><span>Tax-saving eligible</span><input name="taxSavingEligible" type="checkbox" defaultChecked={plan?.taxSavingEligible || false} /></label>
        <label>Eligibility details<input name="eligibilityDescription" defaultValue={plan?.eligibilityDescription || ''} maxLength="3000" /></label>
        <label>Terms URL<input name="termsUrl" type="url" defaultValue={plan?.termsUrl || ''} /></label>
        <div className="panel-form-grid"><label>Source URL<input name="sourceUrl" type="url" defaultValue={plan?.sourceUrl || ''} /></label><label>Source document URL<input name="sourceDocumentUrl" type="url" defaultValue={plan?.sourceDocumentUrl || ''} /></label></div>
        <div className="panel-form-grid">
          <label>Effective from<input name="effectiveFrom" type="datetime-local" defaultValue={effectiveFromDefault} required /></label>
          <label>Effective until<input name="effectiveUntil" type="datetime-local" defaultValue={plan?.effectiveUntil ? toLocalDateTimeInput(new Date(plan.effectiveUntil)) : ''} /></label>
        </div>
        {error && <p className="form-error">{error.response?.data?.message || 'Could not save the plan.'}</p>}
        <p className="form-footnote">{plan ? 'Changes to an inactive plan return it to draft status. Submit it for review before it appears in public search.' : 'New plans start as drafts. Submit them for admin review before they appear in public search.'}</p>
        <div className="panel-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Saving…' : plan ? 'Save changes' : 'Save draft'} <ArrowRight size={15} /></button></div>
      </form>
    </section>
  </div>
  );
};

const StatusBadge = ({ status }) => <span className={`status-badge status-${status}`}>{formatLabel(status)}</span>;
const EmptyPanel = ({ title, text }) => <div className="panel-empty"><span><RefreshCw size={19} /></span><h3>{title}</h3><p>{text}</p></div>;

export default PanelPage;
