// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {CanvasHeightHandle} from './CanvasHeightHandle';
import {workspaceStore} from './editor';
it('resizes by keyboard within bounds without mutating experiment or camera state',()=>{workspaceStore.setState({height:560});const before=structuredClone(workspaceStore.getState().camera);render(<CanvasHeightHandle/>);const handle=screen.getByRole('separator',{name:'Resize canvas height'});fireEvent.keyDown(handle,{key:'ArrowDown'});expect(workspaceStore.getState().height).toBe(570);fireEvent.keyDown(handle,{key:'Home'});fireEvent.keyDown(handle,{key:'ArrowUp'});expect(workspaceStore.getState().height).toBe(360);fireEvent.keyDown(handle,{key:'End'});fireEvent.keyDown(handle,{key:'ArrowDown'});expect(workspaceStore.getState().height).toBe(900);expect(workspaceStore.getState().camera).toEqual(before);cleanup();workspaceStore.setState({height:560});});
