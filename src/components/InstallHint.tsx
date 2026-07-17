import { useMemo } from 'react';

export function InstallHint() {
  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  }, []);

  return (
    <details className="install-card" open={!isStandalone}>
      <summary>{isStandalone ? 'האפליקציה כבר מותקנת על המסך' : 'איך מתקינים על האייפד?'}</summary>
      <div className="install-card__body">
        <ol>
          <li>בספארי פותחים את כפתור השיתוף.</li>
          <li>בוחרים <strong>הוספה למסך הבית</strong>.</li>
          <li>מאשרים את השם “הרפתקת למידה”.</li>
          <li>בכרום: Share ואז <strong>Add to Home Screen</strong>.</li>
        </ol>
        <p>אחרי ההתקנה המשחקים יעבדו גם בלי רשת, אחרי טעינה ראשונה.</p>
      </div>
    </details>
  );
}
