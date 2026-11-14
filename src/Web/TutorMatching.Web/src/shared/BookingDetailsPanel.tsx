import type {ReactNode} from 'react';
import {MotionLink} from './MotionLink';
import './booking-details-panel.css';
type Props={title:string;status:string;rows:Array<[string,ReactNode]>;backTo:string;actions:ReactNode};
export function BookingDetailsPanel({title,status,rows,backTo,actions}:Props){
 return <div className="booking-detail-layout booking-detail-shared"><section className="student-card booking-detail-card"><header className="booking-detail-heading"><MotionLink to={backTo} className="booking-detail-back">← Back to schedule</MotionLink><div><h2>{title}</h2><span className="booking-status" data-status={status}>{status}</span></div></header><div className="detail-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section><aside className="student-card booking-actions-card" aria-label="Booking actions"><h2>Manage booking</h2>{actions}</aside></div>;
}
