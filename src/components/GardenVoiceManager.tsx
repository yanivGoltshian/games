import { useEffect, useRef, useState } from 'react';
import { GARDEN_SENTENCES, getGardenVoiceKey, type GardenVoiceLanguage } from '../content/gardenSentences';
import { subscribeAppLifecycle } from '../platform/useAppLifecycle';
import { startGardenRecording, type GardenRecording } from '../services/gardenVoiceMedia';
import { deleteGardenVoice, readGardenVoice, saveGardenVoice } from '../services/gardenVoiceStorage';
import './gardenVoiceManager.css';

function VoiceEditor({ voiceKey, sentence, language }: { voiceKey: string; sentence: string; language: GardenVoiceLanguage }) {
  const [saved, setSaved] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'loading' | 'permission' | 'recording' | 'finishing' | 'saving' | null>('loading');
  const active = useRef(true);
  const session = useRef<{ controller: AbortController; recording?: GardenRecording } | null>(null);

  useEffect(() => {
    active.current = true;
    let mounted = true;
    void readGardenVoice(voiceKey).then((clip) => {
      if (mounted) setSaved(clip);
    }).catch(() => {
      if (mounted) setStatus('לא הצלחנו לקרוא את ההקלטה המקומית.');
    }).finally(() => {
      if (mounted) setBusy(null);
    });
    const unsubscribe = subscribeAppLifecycle((state) => {
      if (state === 'background') session.current?.controller.abort();
    });
    return () => {
      mounted = false;
      active.current = false;
      unsubscribe();
      session.current?.controller.abort();
      session.current = null;
    };
  }, [voiceKey]);

  const playable = draft ?? saved;
  useEffect(() => {
    if (!playable) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(playable);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [playable]);

  const capture = async () => {
    if (busy || session.current) return;
    const controller = new AbortController();
    session.current = { controller };
    setBusy('permission');
    setStatus('ממתינים להרשאת מיקרופון.');
    try {
      const recording = await startGardenRecording(controller.signal);
      if (session.current?.controller === controller) session.current.recording = recording;
      if (active.current && !controller.signal.aborted) {
        setBusy('recording');
        setStatus('מקליטים… אפשר ללחוץ על עצירה כשמסיימים.');
      }
      const clip = await recording.result;
      if (active.current && !controller.signal.aborted) {
        setDraft(clip);
        setStatus('ההקלטה טרם נשמרה. אפשר להאזין, לשמור או לבטל.');
      }
    } catch (error) {
      if (active.current && session.current?.controller === controller) {
        setStatus(controller.signal.aborted ? 'ההקלטה בוטלה.'
          : (error instanceof DOMException || error instanceof Error)
              && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
            ? 'לא ניתנה הרשאת מיקרופון. אפשר להמשיך עם הקריינות הרגילה.'
            : 'לא הצלחנו להקליט במכשיר הזה. הקריינות הרגילה נשארת זמינה.');
      }
    } finally {
      if (session.current?.controller === controller) {
        session.current = null;
        if (active.current) setBusy(null);
      }
    }
  };

  const changeSaved = async (clip: Blob | null) => {
    setBusy('saving');
    try {
      if (clip) await saveGardenVoice(voiceKey, clip);
      else await deleteGardenVoice(voiceKey);
      if (active.current) {
        setDraft(null);
        setSaved(clip);
        setStatus(clip ? 'ההקלטה נשמרה במכשיר הזה.' : 'ההקלטה נמחקה. המשפט ישתמש בקריינות הרגילה.');
      }
    } catch {
      if (active.current) setStatus(clip ? 'לא הצלחנו לשמור את ההקלטה. אפשר לנסות שוב.' : 'לא הצלחנו למחוק את ההקלטה.');
    } finally {
      if (active.current) setBusy(null);
    }
  };
  const cancel = () => {
    session.current?.controller.abort();
    session.current = null;
    setBusy(null);
    setStatus('ההקלטה בוטלה.');
  };

  return (
    <div className="garden-voice__editor">
      <p className="garden-voice__sentence" lang={language} dir={language === 'he' ? 'rtl' : 'ltr'}>{sentence}</p>
      <div className="garden-voice__actions">
        {busy === 'permission'
          ? <button className="secondary-button" type="button" onClick={cancel}>ביטול בקשת הרשאה</button>
          : busy === 'recording'
            ? <button className="primary-button" type="button" onClick={() => { setBusy('finishing'); session.current?.recording?.stop(); }}>עצירת הקלטה</button>
            : <button className="primary-button" type="button" disabled={busy !== null || draft !== null} onClick={() => { void capture(); }}>
                {saved ? 'הקלטת גרסה חדשה' : 'התחלת הקלטה'}
              </button>}
        {draft && <>
          <button className="primary-button" type="button" disabled={busy !== null} onClick={() => { void changeSaved(draft); }}>שמירת ההקלטה</button>
          <button className="secondary-button" type="button" disabled={busy !== null} onClick={() => { setDraft(null); setStatus('ההקלטה החדשה לא נשמרה.'); }}>ביטול ההקלטה החדשה</button>
        </>}
        {saved && !draft && <button className="danger-button" type="button" disabled={busy !== null} onClick={() => { void changeSaved(null); }}>מחיקת ההקלטה</button>}
      </div>
      {previewUrl && busy === null && <audio controls src={previewUrl} aria-label="האזנה להקלטה מקומית" onError={() => setStatus('לא ניתן להשמיע את ההקלטה במכשיר הזה.')} />}
      <p role="status">{status}</p>
    </div>
  );
}

export function GardenVoiceManager({ useSean }: { useSean: boolean }) {
  const [language, setLanguage] = useState<GardenVoiceLanguage>('he');
  const [sentenceId, setSentenceId] = useState<string>(GARDEN_SENTENCES[0].id);
  const sentence = GARDEN_SENTENCES.find((item) => item.id === sentenceId) ?? GARDEN_SENTENCES[0];
  const model = useSean ? sentence.seanModel : sentence.model;
  const voiceKey = getGardenVoiceKey(sentence, useSean, language);
  return (
    <section className="caregiver-card garden-voice" aria-labelledby="garden-voice-title">
      <h2 id="garden-voice-title">הקול שלכם בגן המילים</h2>
      <p>בחרו משפט ושפה והקליטו עד 15 שניות. רק המשפט המלא יושמע בקול שלכם. השאלות והמילים יישארו בקול הקריינית.</p>
      <p>ההקלטות נשמרות רק במכשיר הזה. גן המילים לא מקשיב לילד.</p>
      <div className="settings-grid">
        <label>שפת ההקלטה
          <select value={language} onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'he')}>
            <option value="he">עברית</option><option value="en">אנגלית</option>
          </select>
        </label>
        <label>משפט להקלטה
          <select value={sentenceId} onChange={(event) => setSentenceId(event.target.value)}>
            {GARDEN_SENTENCES.map((item) => <option key={item.id} value={item.id}>{(useSean ? item.seanModel : item.model)[language]}</option>)}
          </select>
        </label>
      </div>
      <VoiceEditor key={voiceKey} voiceKey={voiceKey} language={language} sentence={model[language]} />
    </section>
  );
}
