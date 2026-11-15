export type ActionNotification = {message: string; tone: 'success' | 'error'};
export const ACTION_NOTIFICATION_EVENT = 'tutormatching:action-notification';
export function notifyAction(message: string, tone: ActionNotification['tone'] = 'success') {
  window.dispatchEvent(new CustomEvent<ActionNotification>(ACTION_NOTIFICATION_EVENT, {detail: {message, tone}}));
}
