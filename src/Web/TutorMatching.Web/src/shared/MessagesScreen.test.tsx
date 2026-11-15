import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {gatewayClient} from '../api';
import {MessagesScreen} from './MessagesScreen';

const conversation={id:'thread',peerName:'Tutor An',peerRole:'Tutor' as const,tutorId:'tutor',updatedAtUtc:'2026-11-15T00:00:00Z',lastMessage:null,unreadCount:0};
beforeEach(()=>{
 vi.spyOn(gatewayClient,'listConversations').mockResolvedValue({items:[conversation],page:1,pageSize:50,total:1});
 vi.spyOn(gatewayClient,'getConversation').mockResolvedValue(conversation);
 vi.spyOn(gatewayClient,'getMessages').mockResolvedValue({items:[],hasMore:false,nextBefore:null});
 vi.spyOn(gatewayClient,'unreadMessages').mockResolvedValue({count:0});
 vi.spyOn(gatewayClient,'listCourses').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'getStudentProfile').mockResolvedValue({id:'s',userId:'s',displayName:'Student A',educationLevel:-1,learningGoal:'',timezone:'Asia/Ho_Chi_Minh',status:'Active',version:1,interests:[]});
 Element.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>vi.restoreAllMocks());
function mount(){return render(<MemoryRouter initialEntries={['/student/messages?conversation=thread']}><MessagesScreen/></MemoryRouter>);}
it('retains the draft after a failed send and reuses its retry key',async()=>{
 const user=userEvent.setup(),send=vi.spyOn(gatewayClient,'sendMessage').mockRejectedValueOnce(new Error('Temporarily unavailable')).mockResolvedValueOnce({id:1,conversationId:'thread',clientMessageId:'key',body:'Hello tutor',createdAtUtc:'2026-11-15T00:00:00Z',isMine:true});
 mount();const input=await screen.findByRole('textbox',{name:'Message'});await waitFor(()=>expect(input).toBeEnabled());
 await user.type(input,'Hello tutor');await user.click(screen.getByRole('button',{name:'Send'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is kept');expect(input).toHaveValue('Hello tutor');
 await user.click(screen.getByRole('button',{name:'Send'}));await waitFor(()=>expect(input).toHaveValue(''));
 expect(send.mock.calls[1][2]).toBe(send.mock.calls[0][2]);expect(screen.getByText('Hello tutor',{exact:true})).toBeInTheDocument();
});
it('does not send while an IME composition is active or on whitespace',async()=>{
 const send=vi.spyOn(gatewayClient,'sendMessage');mount();const input=await screen.findByRole('textbox',{name:'Message'});await waitFor(()=>expect(input).toBeEnabled());
 fireEvent.change(input,{target:{value:'   '}});expect(screen.getByRole('button',{name:'Send'})).toBeDisabled();
 fireEvent.change(input,{target:{value:'Xin chào'}});fireEvent.keyDown(input,{key:'Enter',isComposing:true});expect(send).not.toHaveBeenCalled();
});
it('shows a thread loading error instead of presenting an empty successful conversation',async()=>{
 vi.spyOn(gatewayClient,'getMessages').mockRejectedValue(new Error('Messages could not be loaded'));
 mount();expect(await screen.findByRole('alert')).toHaveTextContent('Messages could not be loaded');
 expect(screen.getByRole('button',{name:'Retry messages'})).toBeEnabled();expect(screen.queryByText('Start with a hello')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Send'})).toBeDisabled();
});

it('keeps a failed new conversation visible and recoverable in the mobile thread pane',async()=>{
 vi.spyOn(gatewayClient,'startConversation').mockRejectedValue(new Error('Unable to contact tutor'));
 render(<MemoryRouter initialEntries={['/student/messages?tutor=tutor']}><MessagesScreen/></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Unable to contact tutor');
 expect(document.querySelector('.messages-workspace')).toHaveClass('has-thread');
 expect(screen.getByRole('button',{name:'Back to conversations'})).toBeEnabled();
});
