// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {aiFetch,useAIUsage} from './aiGovernance';
import {AIUsageFeedback} from '../components/ai/AIUsageFeedback';
import {useLanguageStore} from '../stores/languageStore';
afterEach(()=>{cleanup();vi.unstubAllGlobals();useLanguageStore.getState().setLanguage('en');useAIUsage.setState({remaining:null,minute:null,retry:null,code:null});});
it('does not fabricate allowance when provider/server headers are absent',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));await aiFetch('/api/ai/explain');render(<AIUsageFeedback/>);expect(screen.queryByRole('status')).toBeNull();});
it('reads application allowance and Retry-After, distinguishing it from Gemini quota',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({detail:{code:'daily_quota_exceeded'}}),{status:429,headers:{'X-AI-Remaining-Daily':'0','Retry-After':'3600'}})));await expect(aiFetch('/api/v2/ai/explain')).rejects.toThrow('daily');render(<AIUsageFeedback/>);expect(screen.getByText(/not your Gemini project quota/)).toBeTruthy();expect(screen.getByText(/3600 s/)).toBeTruthy();});
it('localizes scope guidance, retains cancellation and includes trusted cookies',async()=>{useLanguageStore.getState().setLanguage('zh-CN');const fetch=vi.fn(async(_url,init)=>{expect(init.credentials).toBe('include');return new Response(JSON.stringify({detail:{code:'out_of_scope'}}),{status:422});});vi.stubGlobal('fetch',fetch);await expect(aiFetch('/api/ai/explain')).rejects.toThrow('科学');});
