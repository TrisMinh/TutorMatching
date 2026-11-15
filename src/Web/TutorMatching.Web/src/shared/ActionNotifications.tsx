import {useCallback, useEffect, useState} from 'react';
import {Toast} from './Toast';
import {ACTION_NOTIFICATION_EVENT, type ActionNotification} from './notificationEvents';

export function ActionNotifications() {
  const [notification, setNotification] = useState<(ActionNotification & {id: number}) | null>(null);
  const close = useCallback(() => setNotification(null), []);
  useEffect(() => {
    let id = 0;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<ActionNotification>).detail;
      setNotification({...detail, id: ++id});
    };
    window.addEventListener(ACTION_NOTIFICATION_EVENT, receive);
    return () => window.removeEventListener(ACTION_NOTIFICATION_EVENT, receive);
  }, []);
  return notification ? <Toast key={notification.id} message={notification.message} tone={notification.tone} onClose={close} /> : null;
}
