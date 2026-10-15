import {lazy,Suspense} from 'react';
import LegacyApp from './LegacyApp';
const ExperimentPlatform=lazy(()=>import('../experiments/components/Platform').then(module=>({default:module.ExperimentPlatform})));
/** The v1 view never initializes a v2 runtime or changes legacy clock semantics. */
export default function App(){return new URLSearchParams(location.search).get('context')==='v1'?<LegacyApp/>:<Suspense fallback={<p role="status">Loading experiments…</p>}><ExperimentPlatform/></Suspense>;}
