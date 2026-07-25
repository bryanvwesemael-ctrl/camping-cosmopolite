import { useT } from '../i18n';
import { Button } from '../components/Button';

export default function NotFound() {
  const t = useT();
  return (
    <section className="min-h-[70vh] grid place-items-center text-center px-5 pt-24">
      <div>
        <p className="font-head text-6xl font-bold text-green">404</p>
        <p className="mt-3 text-lg text-muted">{t.hero.subtitle}</p>
        <div className="mt-6"><Button to="/">{t.nav.home}</Button></div>
      </div>
    </section>
  );
}
