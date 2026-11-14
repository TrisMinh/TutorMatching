import {render,screen,act,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Toast} from './Toast';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('renders outside page flow and closes after three seconds',()=>{
 vi.useFakeTimers();const onClose=vi.fn();
 const {container}=render(<Toast message="You are enrolled" onClose={onClose}/>);
 expect(container).toBeEmptyDOMElement();
 expect(screen.getByRole('status')).toHaveTextContent('You are enrolled');
 act(()=>vi.advanceTimersByTime(2999));expect(onClose).not.toHaveBeenCalled();
 act(()=>vi.advanceTimersByTime(1));expect(onClose).toHaveBeenCalledOnce();
});
