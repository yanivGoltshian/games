import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  FamilyPhotoConversionError,
  convertFamilyPhoto,
} from '../services/familyPhotoConversion';
import {
  FAMILY_PHOTO_LIBRARY_LIMIT,
  FamilyPhotoStorageError,
  addFamilyPhoto,
  deleteAllFamilyPhotos,
  deleteFamilyPhoto,
} from '../services/familyPhotoStorage';
import { useFamilyPhotoPreviews } from './useFamilyPhotoPreviews';

interface FamilyPhotoManagerProps {
  onLibraryCountChange?: (count: number) => void;
}

function photoErrorMessage(error: unknown): string {
  if (error instanceof FamilyPhotoConversionError) {
    return {
      'unsupported-file': 'הקובץ שנבחר אינו תמונה נתמכת.',
      'file-too-large': 'התמונה גדולה מדי לעיבוד בטוח במכשיר.',
      'decode-failed': 'לא הצלחנו לפתוח את התמונה. אפשר לבחור תמונה אחרת.',
      'invalid-dimensions': 'מידות התמונה אינן נתמכות.',
      'canvas-failed': 'המכשיר לא הצליח להכין עותק פרטי של התמונה.',
      'encode-failed': 'המרת התמונה לעותק פרטי נכשלה.',
      'metadata-remained': 'התמונה לא נשמרה כי הסרת המטא־דאטה לא הושלמה.',
    }[error.code];
  }
  if (error instanceof FamilyPhotoStorageError) {
    return {
      unavailable: 'אחסון התמונות המקומי אינו זמין בדפדפן הזה.',
      'upgrade-failed': 'פתיחת מאגר התמונות המקומי נכשלה.',
      'upgrade-blocked': 'חלון אחר של האפליקציה חוסם כרגע את מאגר התמונות.',
      'quota-exceeded': 'אין מספיק מקום פנוי במכשיר לשמירת התמונה.',
      'write-interrupted': 'שמירת התמונה הופסקה לפני שהסתיימה.',
      duplicate: 'התמונה הזאת כבר נמצאת בספרייה המקומית.',
      'library-full': `הספרייה מלאה. אפשר לשמור עד ${FAMILY_PHOTO_LIBRARY_LIMIT} תמונות.`,
      'read-failed': 'קריאת ספריית התמונות המקומית נכשלה.',
      'delete-failed': 'מחיקת התמונה המקומית נכשלה.',
    }[error.code];
  }
  return 'הפעולה לא הושלמה. שום תמונת מקור לא נשמרה.';
}

export function FamilyPhotoManager({ onLibraryCountChange }: FamilyPhotoManagerProps) {
  const { previews, loading, error: loadError, reload } = useFamilyPhotoPreviews();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onLibraryCountChange?.(previews.length);
  }, [onLibraryCountChange, previews.length]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = '';
    if (files.length === 0) {
      return;
    }

    setBusy(true);
    setStatus(null);
    let added = 0;
    let firstError: string | null = null;
    for (const file of files) {
      try {
        const converted = await convertFamilyPhoto(file);
        await addFamilyPhoto({
          blob: converted.blob,
          width: converted.width,
          height: converted.height,
        });
        added += 1;
      } catch (error) {
        firstError ??= photoErrorMessage(error);
      }
    }
    if (mountedRef.current) {
      setBusy(false);
      if (added > 0) {
        reload();
      }
      setStatus(
        firstError
          ? `${added > 0 ? `נשמרו ${added} תמונות. ` : ''}${firstError}`
          : `${added === 1 ? 'התמונה נשמרה' : `${added} תמונות נשמרו`} רק במכשיר הזה.`,
      );
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const deleted = await deleteFamilyPhoto(id);
      if (mountedRef.current) {
        setStatus(deleted ? 'התמונה נמחקה מהמכשיר.' : 'התמונה כבר לא נמצאת במכשיר.');
        reload();
      }
    } catch (error) {
      if (mountedRef.current) {
        setStatus(photoErrorMessage(error));
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setConfirmDeleteId(null);
      }
    }
  };

  const handleDeleteAll = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const deleted = await deleteAllFamilyPhotos();
      if (mountedRef.current) {
        setStatus(deleted > 0 ? `נמחקו ${deleted} תמונות מהמכשיר.` : 'ספריית התמונות כבר ריקה.');
        reload();
      }
    } catch (error) {
      if (mountedRef.current) {
        setStatus(photoErrorMessage(error));
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setConfirmDeleteAll(false);
      }
    }
  };

  const libraryFull = previews.length >= FAMILY_PHOTO_LIBRARY_LIMIT;

  return (
    <section className="caregiver-card family-photo-manager" aria-labelledby="family-photo-manager-title">
      <div className="family-photo-manager__heading">
        <div>
          <h2 id="family-photo-manager-title">תמונות משפחתיות לפאזל</h2>
          <p>פעולה למבוגרים בלבד. הבחירה נפתחת דרך קבצים או תמונות באייפד.</p>
        </div>
        <strong aria-label={`${previews.length} מתוך ${FAMILY_PHOTO_LIBRARY_LIMIT} תמונות`}>
          {previews.length}/{FAMILY_PHOTO_LIBRARY_LIMIT}
        </strong>
      </div>

      <p className="family-photo-manager__privacy">
        התמונה מפוענחת ונבנית מחדש כאן במכשיר כדי להסיר פרטי מקור ומיקום. נשמר רק עותק מקומי
        מוקטן, עד 1600 פיקסלים בצד הארוך. שום תמונה אינה נשלחת, מסונכרנת או נשמרת בענן.
      </p>

      <div className="family-photo-manager__actions">
        <label
          className={`primary-button file-picker-button ${libraryFull || busy ? 'is-disabled' : ''}`}
          aria-disabled={libraryFull || busy}
        >
          <span>{busy ? 'מעבדת תמונות…' : 'הוספת תמונות במכשיר'}</span>
          <input
            accept="image/*,.heic,.heif"
            aria-label="הוספת תמונות משפחתיות מהמכשיר"
            disabled={libraryFull || busy}
            multiple
            onChange={(event) => void handleFiles(event)}
            type="file"
          />
        </label>
        {previews.length > 0 && !confirmDeleteAll ? (
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => setConfirmDeleteAll(true)}
            type="button"
          >
            מחיקת כל התמונות
          </button>
        ) : null}
      </div>

      {libraryFull ? (
        <p className="family-photo-manager__limit">
          הספרייה מוגבלת ל־{FAMILY_PHOTO_LIBRARY_LIMIT} תמונות כדי לשמור על אחסון מקומי צפוי.
          אפשר למחוק תמונה ואז להוסיף אחרת.
        </p>
      ) : null}

      {confirmDeleteAll ? (
        <div className="confirm-reset" role="alert">
          <p>למחוק את כל התמונות המקומיות? אין דרך להחזיר אותן מתוך האפליקציה.</p>
          <div className="confirm-reset__actions">
            <button className="danger-button" disabled={busy} onClick={() => void handleDeleteAll()} type="button">
              כן, למחוק הכול
            </button>
            <button className="secondary-button" disabled={busy} onClick={() => setConfirmDeleteAll(false)} type="button">
              להשאיר את התמונות
            </button>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="family-photo-manager__error" role="alert">
          <p>{photoErrorMessage(loadError)}</p>
          <button className="secondary-button" onClick={reload} type="button">לנסות שוב</button>
        </div>
      ) : null}

      {!loading && !loadError && previews.length === 0 ? (
        <p className="family-photo-manager__empty">עדיין אין תמונות מקומיות. הפאזלים המובנים נשארים זמינים תמיד.</p>
      ) : null}

      {previews.length > 0 ? (
        <div className="family-photo-manager__grid">
          {previews.map((preview, index) => (
            <article className="family-photo-manager__item" key={preview.id} data-photo-id={preview.id}>
              <img
                alt={preview.label ?? `תמונה משפחתית מקומית ${index + 1}`}
                src={preview.objectUrl}
              />
              {confirmDeleteId === preview.id ? (
                <div className="family-photo-manager__confirm">
                  <button
                    aria-label={`אישור מחיקת תמונה ${index + 1}`}
                    className="danger-button"
                    disabled={busy}
                    onClick={() => void handleDelete(preview.id)}
                    type="button"
                  >
                    למחוק
                  </button>
                  <button
                    aria-label={`ביטול מחיקת תמונה ${index + 1}`}
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteId(null)}
                    type="button"
                  >
                    ביטול
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`מחיקת תמונה משפחתית מקומית ${index + 1}`}
                  className="danger-button"
                  disabled={busy}
                  onClick={() => setConfirmDeleteId(preview.id)}
                  type="button"
                >
                  מחיקה
                </button>
              )}
            </article>
          ))}
        </div>
      ) : null}

      <p className="family-photo-manager__status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
