import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {gatewayClient,GatewayError} from '../api';
import {ProfileCompletionGate} from './ProfileCompletionGate';
afterEach(()=>vi.restoreAllMocks());
it.each([404,503])('never blocks a student dashboard for missing optional profile details (%s)',async status=>{
 const load=vi.spyOn(gatewayClient,'getStudentProfile').mockRejectedValue(new GatewayError(status));
 render(<MemoryRouter><ProfileCompletionGate role="Student"><h1>Personal dashboard</h1></ProfileCompletionGate></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'Personal dashboard'})).toBeInTheDocument();
 expect(load).not.toHaveBeenCalled();
});
