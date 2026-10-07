import { Construction, Plus } from 'lucide-react';

export function AdminPlaceholderPage({ title }: { title: string }) {
  return <div className="admin-placeholder"><span><Construction size={31} /></span><h1>{title}</h1><p>Cette vue utilisera les routes déjà disponibles dans l’API. Sa structure est prête à recevoir les données du serveur.</p><button className="button button--primary"><Plus size={17} /> Ajouter un élément</button></div>;
}
