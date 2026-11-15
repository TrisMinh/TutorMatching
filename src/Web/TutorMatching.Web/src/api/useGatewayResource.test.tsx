import {act,renderHook,waitFor} from '@testing-library/react';
import {useGatewayResource} from './useGatewayResource';
it('ignores an old response after selecting a different resource',async()=>{
 let resolveOld!:(value:string)=>void;
 const old=()=>new Promise<string>(resolve=>{resolveOld=resolve;});
 const current=()=>Promise.resolve('current date slots');
 const {result,rerender}=renderHook(({loader})=>useGatewayResource(loader,''),{initialProps:{loader:old}});
 rerender({loader:current});
 await waitFor(()=>expect(result.current.data).toBe('current date slots'));
 await act(async()=>resolveOld('previous date slots'));
 expect(result.current.data).toBe('current date slots');
});
