import { Bell, BellOff, BellRing, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

type PushState = 'loading' | 'unsupported' | 'denied' | 'inactive' | 'active' | 'working';

const applicationServerKey = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export function PushNotificationsButton() {
  const [state, setState] = useState<PushState>('loading');
  const { notify } = useToast();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? 'active' : 'inactive'))
      .catch(() => setState('unsupported'));
  }, []);

  const toggle = async () => {
    if (state === 'unsupported' || state === 'denied' || state === 'working' || state === 'loading') return;
    setState('working');
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await api.unsubscribePush(current.endpoint);
        await current.unsubscribe();
        setState('inactive');
        notify('Notifications désactivées sur cet appareil.', 'info');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'inactive');
        notify('Autorisez les notifications dans votre navigateur pour recevoir les messages.', 'info');
        return;
      }
      const config = await api.pushConfig();
      if (!config.data.enabled) throw new Error('Les notifications sont momentanément désactivées.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.data.publicKey),
      });
      const serialized = subscription.toJSON();
      await api.subscribePush({
        ...serialized,
        locale: navigator.language || 'fr',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lubumbashi',
      });
      setState('active');
      notify('Notifications activées : verset du jour et nouvelles prédications.');
    } catch (reason) {
      setState('inactive');
      notify(reason instanceof Error ? reason.message : 'Impossible d’activer les notifications.', 'error');
    }
  };

  const labels: Record<PushState, string> = {
    loading: 'Vérification…',
    unsupported: 'Notifications indisponibles',
    denied: 'Notifications bloquées',
    inactive: 'Activer les notifications',
    active: 'Notifications actives',
    working: 'Veuillez patienter…',
  };
  const Icon = state === 'active' ? BellRing : state === 'denied' || state === 'unsupported' ? BellOff : Bell;

  return (
    <button
      type="button"
      className={`push-button push-button--${state}`}
      onClick={() => void toggle()}
      disabled={state === 'unsupported' || state === 'denied' || state === 'loading' || state === 'working'}
      title={state === 'active' ? 'Cliquer pour désactiver' : labels[state]}
    >
      {state === 'working' || state === 'loading' ? <LoaderCircle className="is-spinning" size={17} /> : <Icon size={17} />}
      <span>{labels[state]}</span>
    </button>
  );
}
