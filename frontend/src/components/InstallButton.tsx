import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const { notify } = useToast();
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const install = async () => {
    if (window.matchMedia('(display-mode: standalone)').matches) { notify('L’application est déjà installée.', 'info'); return; }
    if (!prompt) { notify('Utilisez le menu du navigateur puis « Ajouter à l’écran d’accueil ».', 'info'); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    notify(choice.outcome === 'accepted' ? 'Installation lancée.' : 'Installation annulée.', 'info');
    setPrompt(null);
  };
  return <button className="button button--gold" onClick={install}><Download size={17} /> Installer l’application</button>;
}
