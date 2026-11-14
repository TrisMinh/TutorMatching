import {render,screen,fireEvent} from '@testing-library/react';
import {NotificationAvatar,NotificationDetails,notificationTitle,notificationSummary} from './notificationPresentation';
import type {NotificationItem} from '../api';
const notice:NotificationItem={id:'n',type:'BookingConfirmed',title:'Booking confirmed',body:'Booking 11111111-1111-4111-8111-111111111111 starts at 2026-11-22T20:00:00.0000000+00:00.',status:'Unread',createdAtUtc:'2026-11-14T11:31:00Z'};
it('sanitizes old text when booking enrichment is unavailable',()=>{
 const text=notificationSummary(notice);expect(text).toContain('23 Nov, 03:00 (GMT+7)');expect(text).not.toContain('11111111');expect(text).not.toContain('T20:00:00');
});
it('uses the actual name for initials when an avatar fails',()=>{
 render(<NotificationAvatar item={{...notice,actorName:'Linh Tran',avatarUrl:'/missing.jpg'}}/>);
 fireEvent.error(screen.getByLabelText('Avatar of Linh Tran').querySelector('img')!);
 expect(screen.getByLabelText('Avatar of Linh Tran')).toHaveTextContent('LT');
});
it('keeps the event heading and shows participant, class and Vietnam time underneath',()=>{
 const item={...notice,actorName:'Linh Tran',className:'English',startAtUtc:'2026-11-22T20:00:00Z'};
 expect(notificationTitle(item)).toBe('Booking confirmed');
 render(<NotificationDetails item={item}/>);
 expect(screen.getByText('Linh Tran')).toBeVisible();
 expect(screen.getByText('English')).toBeVisible();
 expect(screen.getByText('23 Nov, 03:00 (GMT+7)')).toBeVisible();
 expect(screen.getByLabelText('Avatar of Linh Tran')).toBeVisible();
});
it('shows the course once when enrollment has no scheduled lesson yet',()=>{
 const item={...notice,type:'CourseEnrolled',title:'New student enrolled',actorName:'Linh Tran',className:'UX Research Class',body:'Linh Tran enrolled in UX Research Class.'};
 expect(notificationTitle(item)).toBe('New student enrolled');
 render(<NotificationDetails item={item}/>);
 expect(screen.getAllByText('UX Research Class')).toHaveLength(1);
 expect(screen.getByText('Linh Tran')).toBeVisible();
 expect(screen.queryByText('Linh Tran enrolled in UX Research Class.')).not.toBeInTheDocument();
});
