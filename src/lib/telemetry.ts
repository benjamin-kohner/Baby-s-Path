import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../App';

export const trackEvent = async (
  eventName: string,
  sessionName: string,
  metadata: string = '{}'
) => {
  if (!db || !auth?.currentUser) return;
  try {
    const timestamp = new Date().toISOString();
    // Unique ID for the event, e.g. userId + timestamp + random
    const eventId = `${auth.currentUser.uid}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const eventRef = doc(db, 'telemetry', eventId);
    await setDoc(eventRef, {
      eventName,
      userId: auth.currentUser.uid,
      sessionName: sessionName || 'unknown',
      timestamp,
      metadata
    });
  } catch (err) {
    console.error('Failed to log telemetry', err);
  }
};

