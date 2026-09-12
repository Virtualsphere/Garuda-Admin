import { useState } from 'react';
import { Phone, Loader2, PhoneCall, PhoneOff } from 'lucide-react';
import callingService from '../../../services/callingService';

const SIZE_STYLES = {
  sm: 'px-2.5 py-1 text-[11px] gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
};

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
};

/**
 * Click-to-call against the agents IVR. The backend only places the call — it
 * returns no live call state — so the button reports what it knows (dialling /
 * placed / failed) and settles back to idle rather than pretending to track
 * the conversation.
 */
export default function CallButton({
  phone,
  recordName,
  recordId,
  recordType = 'MASTER_AGENT',
  landId,
  variant = 'solid',
  size = 'sm',
  className = '',
  onCallPlaced,
}) {
  const [state, setState] = useState('idle');

  const handleCall = async (e) => {
    e.stopPropagation();
    if (!phone || state === 'dialing') return;

    setState('dialing');
    try {
      await callingService.clickToCall({
        customerNumber: phone,
        departmentType: 'agents',
        callerName: recordName,
        missionContext: `${recordType.replace(/_/g, ' ')} — ${recordName || phone}${
          recordId ? ` (#${recordId})` : ''
        }`,
        landId,
      });
      setState('placed');
      onCallPlaced?.();
      // The call is now with the IVR; let the button return to a usable state.
      setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      console.error('Click-to-call failed:', err);
      setState('failed');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const tone =
    variant === 'outline'
      ? 'bg-white border border-[#e7e5e4] text-[#1c1917] hover:border-[#2563EB] hover:text-[#2563EB]'
      : variant === 'ghost'
      ? 'bg-transparent text-[#57534e] hover:text-[#2563EB]'
      : 'bg-[#2563EB] text-white border border-[#2563EB] hover:bg-[#1d4ed8]';

  const label =
    state === 'dialing'
      ? 'Dialling…'
      : state === 'placed'
      ? 'Call placed'
      : state === 'failed'
      ? 'Retry'
      : 'Call';

  const Icon =
    state === 'dialing' ? Loader2 : state === 'placed' ? PhoneCall : state === 'failed' ? PhoneOff : Phone;

  return (
    <button
      type="button"
      onClick={handleCall}
      disabled={!phone || state === 'dialing'}
      title={phone ? `Call ${recordName || phone}` : 'No phone number on record'}
      className={`inline-flex items-center rounded-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        SIZE_STYLES[size] || SIZE_STYLES.sm
      } ${
        state === 'failed'
          ? 'bg-rose-50 border border-rose-200 text-rose-700'
          : state === 'placed'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : tone
      } ${className}`}
    >
      <Icon
        className={`${ICON_SIZES[size] || ICON_SIZES.sm} ${
          state === 'dialing' ? 'animate-spin' : ''
        }`}
      />
      <span>{label}</span>
    </button>
  );
}
