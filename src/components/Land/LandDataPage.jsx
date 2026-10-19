import React, { useState, useEffect } from 'react';
import './LandDataPage.css';
import { useAuth } from '../../context/AuthContext';
import landService from '../../services/landService';
import { landCode } from '../../utils/landRecord';
import VerifiedLandsList from './VerifiedLandsList';
import PhysicalVerificationList from './PhysicalVerificationList';
import PhoneVerificationList from './PhoneVerificationList';
import ReviewDetailsList from './ReviewDetailsList';
import TraineeLandsList from './TraineeLandsList';
import AddLandForm from './AddLandForm';
import LandEditor from './LandEditor';
import LandDetailModal from './LandDetailModal';

const ALL_COMPLETE = {
  call_verification_status: 'complete',
  physcial_verification_status: 'complete',
  verification_status: 'complete',
};

/**
 * Editor actions per queue. `overrides` are the status changes that move a
 * land along the pipeline — these match what the old admin panel sent:
 * Phone → (verify: everything complete | send to physical audit),
 * Physical → (approve: everything complete | send to final review),
 * Review → (approve), Verified/Trainee → save.
 */
const QUEUES = {
  phone: {
    heading: 'VERIFY DETAILS',
    permission: 'call_verification',
    actions: [
      { key: 'save', label: 'SAVE', successText: 'Changes saved.' },
      {
        key: 'physical',
        label: 'SEND TO PHYSICAL AUDIT',
        overrides: { call_verification_status: 'complete', physcial_verification_status: 'pending', verification_status: 'pending' },
        successText: 'Land moved to the Physical list.',
      },
      { key: 'verify', label: 'VERIFY & APPROVE', primary: true, via: 'callVerify', overrides: ALL_COMPLETE, successText: 'Land verified.' },
    ],
  },
  physical: {
    heading: 'PHYSICAL AUDIT',
    permission: 'physical_verification',
    actions: [
      { key: 'save', label: 'SAVE', successText: 'Changes saved.' },
      {
        key: 'review',
        label: 'SEND TO FINAL REVIEW',
        overrides: { call_verification_status: 'complete', physcial_verification_status: 'complete', verification_status: 'pending' },
        successText: 'Land moved to Review details.',
      },
      { key: 'verify', label: 'COMPLETE & VERIFY', primary: true, overrides: ALL_COMPLETE, successText: 'Land verified.' },
    ],
  },
  review: {
    heading: 'FINAL REVIEW',
    permission: 'final_verification',
    showStatusFields: true,
    actions: [
      { key: 'save', label: 'SAVE', successText: 'Changes saved.' },
      { key: 'verify', label: 'APPROVE', primary: true, overrides: ALL_COMPLETE, successText: 'Land verified.' },
    ],
  },
  verified: {
    heading: 'VERIFIED LAND',
    permission: 'final_verification',
    showStatusFields: true,
    actions: [{ key: 'save', label: 'SAVE CHANGES', primary: true, successText: 'Changes saved.' }],
  },
  trainee: {
    heading: 'TRAINEE SUBMISSION',
    permission: 'call_verification',
    actions: [
      { key: 'save', label: 'SAVE', successText: 'Changes saved.' },
      { key: 'verify', label: 'VERIFY & APPROVE', primary: true, via: 'callVerify', overrides: ALL_COMPLETE, successText: 'Land verified.' },
    ],
  },
};

// Level-2 tab → the queue whose list it shows.
const TAB_QUEUE = {
  phone: 'phone',
  'verify-details': 'phone',
  physical: 'physical',
  review: 'review',
  verified: 'verified',
  trainee: 'trainee',
};

const SUB_TABS = [
  {
    key: 'phone',
    label: 'Phone list',
    icon: <><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>,
  },
  {
    key: 'verify-details',
    label: 'Verify details',
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  },
  {
    key: 'physical',
    label: 'Physical list',
    icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  },
  { key: 'review', label: 'Review details', icon: <path d="M2 12h3l3-9 5 18 3-9h5" /> },
  {
    key: 'verified',
    label: 'Verified lands',
    green: true,
    icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  },
  {
    key: 'trainee',
    label: 'Trainee observation',
    icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  },
];

export default function LandDataPage() {
  const { hasPermission, permissionsLoaded } = useAuth();
  const [activeLevel1, setActiveLevel1] = useState('verification');
  const [activeLevel2, setActiveLevel2] = useState('verified');
  // Land open in the "Verify details" tab (picked from the Phone list).
  const [vettingLand, setVettingLand] = useState(null);
  // Land open in the editor on any other queue tab: { land, queue }.
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState(null);

  // Top-bar quick-add lands the user on the Add land form.
  useEffect(() => {
    const onQuickAdd = (e) => {
      if (e.detail?.type === 'land') setActiveLevel1('add-land');
    };
    window.addEventListener('garuda:quick-add', onQuickAdd);
    return () => window.removeEventListener('garuda:quick-add', onQuickAdd);
  }, []);

  const flash = (text, type = 'success') => {
    setNotice({ text, type });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const switchLevel2 = (key) => {
    setActiveLevel2(key);
    setEditing(null);
  };

  const openEditor = (land, queue) => {
    setViewing(null);
    if (queue === 'phone') {
      setVettingLand(land);
      setActiveLevel2('verify-details');
    } else {
      setEditing({ land, queue });
    }
  };

  const closeEditor = (queue) => {
    if (queue === 'phone') {
      setVettingLand(null);
      setActiveLevel2('phone');
    } else {
      setEditing(null);
    }
  };

  const handleEditorDone = (queue, _actionKey, successText) => {
    closeEditor(queue);
    flash(successText);
  };

  /** Confirm and delete; resolves true when the land is gone (the list then drops the row). */
  const deleteLand = async (land) => {
    const name = land.farmerDetails?.name ? ` (${land.farmerDetails.name})` : '';
    if (!window.confirm(`Delete land ${landCode(land)}${name}? This cannot be undone.`)) return false;
    try {
      await landService.delete(land.id);
      flash(`Land ${landCode(land)} deleted.`);
      return true;
    } catch (err) {
      console.error('Failed to delete land:', err);
      flash(err.response?.data?.message || 'Failed to delete land.', 'error');
      return false;
    }
  };

  const deleteFromEditor = async (land, queue) => {
    if (await deleteLand(land)) closeEditor(queue);
  };

  const listProps = (queue) => ({
    onView: (land) => setViewing({ land, queue }),
    onEdit: (land) => openEditor(land, queue),
    onDelete: deleteLand,
  });

  const renderEditor = (land, queue) => (
    <LandEditor
      key={land.id}
      landId={land.id}
      heading={QUEUES[queue].heading}
      actions={QUEUES[queue].actions}
      showStatusFields={QUEUES[queue].showStatusFields}
      onBack={() => closeEditor(queue)}
      onDone={(actionKey, successText) => handleEditorDone(queue, actionKey, successText)}
      onDelete={() => deleteFromEditor(land, queue)}
    />
  );

  const noAccess = (
    <div className="land-data-empty">
      {permissionsLoaded ? 'You do not have access to this page. Ask an admin to grant it under Settings → Permissions.' : 'Checking access...'}
    </div>
  );

  const renderVerification = () => {
    const queue = TAB_QUEUE[activeLevel2];
    if (!hasPermission(QUEUES[queue].permission)) return noAccess;

    if (activeLevel2 === 'verify-details') {
      return vettingLand ? renderEditor(vettingLand, 'phone') : (
        <div className="land-data-empty">Pick a land from the Phone list and press “Start vetting” to verify its details here.</div>
      );
    }
    if (editing && editing.queue === queue) return renderEditor(editing.land, queue);

    switch (activeLevel2) {
      case 'phone':
        return <PhoneVerificationList onView={(land) => setViewing({ land, queue })} onVet={(land) => openEditor(land, 'phone')} onDelete={deleteLand} />;
      case 'physical':
        return <PhysicalVerificationList {...listProps('physical')} />;
      case 'review':
        return <ReviewDetailsList {...listProps('review')} />;
      case 'verified':
        return <VerifiedLandsList {...listProps('verified')} />;
      case 'trainee':
        return <TraineeLandsList {...listProps('trainee')} />;
      default:
        return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>;
    }
  };

  return (
    <div className="land-data-page">
      {/* Level 1 Sub Tabs */}
      <div className="land-data-sub-tabs">
        <button
          className={`ld-sub-tab${activeLevel1 === 'add-land' ? ' active' : ''}`}
          onClick={() => setActiveLevel1('add-land')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add land
        </button>
        <button
          className={`ld-sub-tab${activeLevel1 === 'verification' ? ' active' : ''}`}
          onClick={() => setActiveLevel1('verification')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Verification
        </button>
      </div>

      {/* Level 2 Sub Tabs (only show if Verification is selected) */}
      {activeLevel1 === 'verification' && (
        <div className="verification-sub-tabs">
          {SUB_TABS.map((tab) => {
            const isActive = activeLevel2 === tab.key;
            const activeClass = isActive ? (tab.green ? ' active-green' : ' active') : '';
            return (
              <button key={tab.key} className={`ver-sub-tab${activeClass}`} onClick={() => switchLevel2(tab.key)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {tab.icon}
                </svg>
                {tab.label}
                {tab.key === 'verify-details' && vettingLand && ` • ${landCode(vettingLand)}`}
              </button>
            );
          })}
        </div>
      )}

      {notice && (
        <div className={`land-data-notice${notice.type === 'error' ? ' error' : ''}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Content Area */}
      <div className="land-data-content">
        {activeLevel1 === 'add-land' && (hasPermission('add_land') ? <AddLandForm /> : noAccess)}
        {activeLevel1 === 'verification' && renderVerification()}
      </div>

      {viewing && (
        <LandDetailModal
          landId={viewing.land.id}
          onClose={() => setViewing(null)}
          onEdit={() => openEditor(viewing.land, viewing.queue)}
        />
      )}
    </div>
  );
}
