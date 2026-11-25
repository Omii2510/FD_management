import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Heart,
  Landmark,
  LayoutDashboard,
  LogOut,
  UserRound,
} from 'lucide-react';
import api from '../api/axios';
import { roleHomePath } from '../utils/rolePaths';

const request = async (url) => {
  const { data } = await api.get(url);
  return data.data;
};

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const formatLabel = (value = '') =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const UserPanelPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState('overview');
  const userQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: () => request('/auth/me').then((data) => data.user),
    retry: false,
  });
  const user = userQuery.data;
  const applicationsQuery = useQuery({
    queryKey: ['user-panel', 'applications', user?._id],
    queryFn: () => request('/users/applications?limit=50'),
    enabled: user?.role === 'user',
    retry: false,
  });
  const favoritesQuery = useQuery({
    queryKey: ['user-panel', 'favorites', user?._id],
    queryFn: () => request('/users/favorites?limit=50'),
    enabled: user?.role === 'user',
    retry: false,
  });
  const removeFavorite = useMutation({
    mutationFn: async (planId) => api.delete(`/users/favorites/${planId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-panel', 'favorites', user?._id] }),
  });
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['current-user'], null);
      queryClient.removeQueries({ queryKey: ['favorites'] });
      queryClient.removeQueries({ queryKey: ['applications'] });
      queryClient.removeQueries({ queryKey: ['panel'] });
      queryClient.removeQueries({ queryKey: ['user-panel'] });
      navigate('/');
    },
  });

  if (userQuery.isLoading) return <div className="customer-loading">Loading your account…</div>;
  if (!user || user.role !== 'user') return <Navigate to={roleHomePath(user?.role)} replace />;

  const applications = applicationsQuery.data?.applications || [];
  const favorites = favoritesQuery.data?.favorites || [];
  const sections = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
    { id: 'enquiries', label: 'My enquiries', icon: <ClipboardList size={17} /> },
    { id: 'saved', label: 'Saved FD plans', icon: <Heart size={17} /> },
    { id: 'profile', label: 'My profile', icon: <UserRound size={17} /> },
  ];

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <a className="brand" href="/marketplace" onClick={(event) => { event.preventDefault(); navigate('/marketplace'); }}>
          <span className="brand-mark"><Landmark size={20} /></span>
          <span>fd<span className="brand-light">connect</span></span>
        </a>
        <div className="customer-header-actions">
          <span className="customer-role">Customer account</span>
          <button type="button" className="button button-outline button-small" onClick={() => navigate('/marketplace')}>
            Browse FDs <ArrowRight size={14} />
          </button>
          <button type="button" className="customer-logout" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={15} /><span>Sign out</span>
          </button>
        </div>
      </header>
      <div className="customer-layout">
        <aside className="customer-sidebar">
          <div className="customer-greeting">
            <span className="customer-avatar"><UserRound size={19} /></span>
            <b>{user.fullName}</b>
            <small>{user.email}</small>
          </div>
          <nav aria-label="Customer dashboard">
            {sections.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`customer-nav-item ${section === item.id ? 'active' : ''}`}
                onClick={() => setSection(item.id)}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </nav>
          <p className="customer-sidebar-note">FD Connect helps you compare plans and send enquiries. Deposits are completed directly with the bank.</p>
        </aside>
        <main className="customer-main">
          <div className="customer-title">
            <div>
              <span className="customer-eyebrow">YOUR FD CONNECT ACCOUNT</span>
              <h1>{sections.find((item) => item.id === section)?.label}</h1>
              <p>{customerSectionDescription(section)}</p>
            </div>
            {section === 'overview' && <button className="button button-primary" type="button" onClick={() => navigate('/marketplace')}>Explore FD plans <ArrowRight size={15} /></button>}
          </div>
          {applicationsQuery.isError && <CustomerError message="Could not load your enquiries." />}
          {favoritesQuery.isError && <CustomerError message="Could not load your saved plans." />}
          {section === 'overview' && (
            <CustomerOverview
              user={user}
              applications={applications}
              favorites={favorites}
              isLoading={applicationsQuery.isLoading || favoritesQuery.isLoading}
              onNavigate={setSection}
              onExplore={() => navigate('/marketplace')}
            />
          )}
          {section === 'enquiries' && (
            <CustomerEnquiries applications={applications} isLoading={applicationsQuery.isLoading} />
          )}
          {section === 'saved' && (
            <CustomerFavorites
              favorites={favorites}
              isLoading={favoritesQuery.isLoading}
              onExplore={() => navigate('/marketplace')}
              onRemove={(planId) => removeFavorite.mutate(planId)}
              isRemoving={removeFavorite.isPending}
              removeError={removeFavorite.isError}
            />
          )}
          {section === 'profile' && <CustomerProfile user={user} />}
          {logout.isError && <CustomerError message={logout.error?.response?.data?.message || 'Could not sign out. Please try again.'} />}
        </main>
      </div>
    </div>
  );
};

const customerSectionDescription = (section) => {
  if (section === 'overview') return 'Keep track of your FD enquiries, saved plans, and account details.';
  if (section === 'enquiries') return 'Follow up on the FD plans you have contacted banks about.';
  if (section === 'saved') return 'Your shortlist of plans to revisit or enquire about.';
  return 'Review the account information used for your FD Connect enquiries.';
};

const CustomerOverview = ({ user, applications, favorites, isLoading, onNavigate, onExplore }) => (
  <>
    <section className="customer-welcome">
      <div>
        <span className="customer-eyebrow">WELCOME BACK</span>
        <h2>{user.fullName?.split(' ')[0] || 'There'}, your savings journey is in one place.</h2>
        <p>Compare offers, review enquiry updates, and continue with the bank when you are ready.</p>
      </div>
      <button className="button button-primary" type="button" onClick={onExplore}>Explore FDs <ArrowRight size={15} /></button>
    </section>
    <div className="customer-stat-grid">
      <button type="button" className="customer-stat" onClick={() => onNavigate('enquiries')}>
        <span><ClipboardList size={17} /></span><small>FD enquiries</small><strong>{isLoading ? '…' : applications.length}</strong>
      </button>
      <button type="button" className="customer-stat" onClick={() => onNavigate('saved')}>
        <span><Heart size={17} /></span><small>Saved plans</small><strong>{isLoading ? '…' : favorites.length}</strong>
      </button>
      <div className="customer-stat">
        <span><Building2 size={17} /></span><small>Account role</small><strong>Customer</strong>
      </div>
    </div>
    <section className="customer-latest">
      <div className="customer-section-heading"><h2>Recent enquiries</h2><button type="button" onClick={() => onNavigate('enquiries')}>View all <ArrowRight size={14} /></button></div>
      {isLoading ? <p className="customer-empty">Loading account activity…</p>
        : applications.length ? applications.slice(0, 3).map((application) => (
          <div className="customer-enquiry-row" key={application._id}>
            <div><b>{application.planNameSnapshot}</b><small>{application.bankId?.bankName || 'Partner bank'} · {application.referenceCode}</small></div>
            <span className={`status-badge status-${application.status}`}>{formatLabel(application.status)}</span>
          </div>
        )) : <p className="customer-empty">No enquiries yet. Browse FD plans to get started.</p>}
    </section>
  </>
);

const CustomerEnquiries = ({ applications, isLoading }) => {
  if (isLoading) return <div className="customer-empty">Loading your enquiries…</div>;
  if (!applications.length) return <div className="customer-empty">You have not sent any FD enquiries yet.</div>;
  return (
    <div className="panel-table-wrap"><table className="panel-table customer-table">
      <thead><tr><th>Plan and bank</th><th>Reference</th><th>Amount</th><th>Submitted</th><th>Contact status</th><th>Status</th></tr></thead>
      <tbody>{applications.map((application) => (
        <tr key={application._id}>
          <td><b>{application.planNameSnapshot}</b><small>{application.bankId?.bankName || 'Partner bank'} · {application.bankId?.bankCode || ''}</small></td>
          <td>{application.referenceCode}</td>
          <td>{money(application.depositAmount)}</td>
          <td>{new Date(application.createdAt).toLocaleDateString('en-IN')}</td>
          <td>{application.phoneVerifiedAt ? 'Phone verified' : 'Phone unverified'}</td>
          <td><span className={`status-badge status-${application.status}`}>{formatLabel(application.status)}</span><small>{application.statusHistory?.map((entry) => formatLabel(entry.status)).join(' → ') || 'No prior updates'}</small><small>Updated {new Date(application.statusUpdatedAt || application.createdAt).toLocaleDateString('en-IN')}</small></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
};

const CustomerFavorites = ({ favorites, isLoading, onExplore, onRemove, isRemoving, removeError }) => {
  if (isLoading) return <div className="customer-empty">Loading saved plans…</div>;
  if (!favorites.length) {
    return <div className="customer-empty">You have not saved any plans yet.<button className="button button-primary" type="button" onClick={onExplore}>Explore FD plans <ArrowRight size={14} /></button></div>;
  }
  return (
    <>
      {removeError && <CustomerError message="Could not remove the saved plan." />}
      <div className="customer-favorite-grid">
        {favorites.map((favorite) => {
          const plan = favorite.fdPlanId;
          if (!plan) return null;
          return (
            <article className="customer-favorite-card" key={favorite._id}>
              <div><small>{plan.bankId?.bankName || 'Partner bank'} · {plan.bankId?.bankCode || ''}</small><h2>{plan.planName}</h2></div>
              <strong>{Number(plan.standardInterestRate).toFixed(2)}% <small>p.a.</small></strong>
              <span>Minimum deposit {money(plan.minAmount)}</span>
              <button type="button" className="customer-remove" onClick={() => onRemove(plan._id)} disabled={isRemoving}>Remove saved plan</button>
            </article>
          );
        })}
      </div>
    </>
  );
};

const CustomerProfile = ({ user }) => (
  <section className="customer-profile-card">
    <div><span>Legal name</span><strong>{user.fullName}</strong></div>
    <div><span>Email address</span><strong>{user.email}</strong></div>
    <div><span>Email verification</span><strong>{user.emailVerifiedAt ? 'Verified' : 'Not verified'}</strong></div>
    <div><span>Phone number</span><strong>{user.phone || 'Not added to profile'}</strong></div>
    <div><span>Phone verification</span><strong>{user.phoneVerifiedAt ? 'Verified' : 'Not verified (SMS unavailable)'}</strong></div>
    <div><span>Sign-in method</span><strong>{user.authProvider === 'google' ? 'Google' : 'Email and password'}</strong></div>
  </section>
);

const CustomerError = ({ message }) => <div className="customer-error" role="alert">{message}</div>;

export default UserPanelPage;
