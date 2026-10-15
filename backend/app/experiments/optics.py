"""Scalar coherent Fraunhofer optics. Probability lives on a bounded discrete screen grid."""
import math,bisect
from functools import lru_cache
from app.schemas.ai import StrictModel,Number
from app.experiments.registry import bounds
class OpticalParameters(StrictModel):
    wavelength:Number;slitSeparation:Number;slitWidth:Number;screenDistance:Number;screenHalfRange:Number
    detectionEvents:Number;samplingRate:Number;seed:Number;detectionMode:Number

def sinc(x):return 1-x*x/6 if abs(x)<1e-8 else math.sin(x)/x
def intensity(p,y):
    sn=y/math.hypot(p['screenDistance'],y)
    return math.cos(math.pi*p['slitSeparation']*sn/p['wavelength'])**2*sinc(math.pi*p['slitWidth']*sn/p['wavelength'])**2
@lru_cache(maxsize=16)
def _profile(wavelength,separation,width,distance,half):
    p=dict(wavelength=wavelength,slitSeparation=separation,slitWidth=width,screenDistance=distance);ys=[-half+2*half*i/1000 for i in range(1001)];values=[intensity(p,y) for y in ys];total=sum(values);probs=[v/total for v in values];cdf=[];acc=0
    for v in probs:acc+=v;cdf.append(acc)
    cdf[-1]=1.
    return tuple(ys),tuple(values),tuple(probs),tuple(cdf)
def profile(p):return _profile(*(p[k] for k in ['wavelength','slitSeparation','slitWidth','screenDistance','screenHalfRange']))
def detections(p,n):
    ys,values,probs,cdf=profile(p);state=p['seed'];indices=[]
    for _ in range(n):
        state=(1664525*state+1013904223)%4294967296;u=(state+.5)/4294967296;indices.append(min(1000,bisect.bisect_left(cdf,u)))
    return indices
class OpticalPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        p=OpticalParameters.model_validate(data).model_dump();bounds(p,self.manifest)
        for k in ['seed','detectionEvents','detectionMode']:
            if not p[k].is_integer():raise ValueError('Expected integral seed/event/mode')
            p[k]=int(p[k])
        if p['slitWidth']>=p['slitSeparation']:raise ValueError('Slits must be distinct: width < separation')
        if (p['slitSeparation']+p['slitWidth'])**2/(p['wavelength']*p['screenDistance'])>.1:raise ValueError('Invalid Fraunhofer configuration: increase screen distance or reduce aperture; Fresnel ratio must be ≤0.1')
        return p
    def create_initial_state(self,p):return self.evaluate_query(p,{'events':0})['state']
    def evaluate_query(self,parameters,query):
        p=self.validate_parameters(parameters)
        if not isinstance(query,dict) or set(query)!={'events'} or type(query['events']) is not int or not 0<=query['events']<=p['detectionEvents']:raise ValueError('Invalid detection-count query')
        n=query['events'];ys,values,probs,cdf=profile(p);indices=detections(p,n);hist=[0]*51;expected=[0.]*51
        for i in indices:hist[min(50,i*51//1001)]+=1
        for i,prob in enumerate(probs):expected[min(50,i*51//1001)]+=prob
        mean=sum(ys[i] for i in indices)/n if n else 0.;ratio=(p['slitSeparation']+p['slitWidth'])**2/(p['wavelength']*p['screenDistance']);sn=p['wavelength']/p['slitWidth'];zero=p['screenDistance']*sn/math.sqrt(1-sn*sn)
        return dict(state=dict(events=n,mean_position=mean,histogram=hist),observables=dict(central_intensity=1.,central_fringe_spacing=p['wavelength']*p['screenDistance']/p['slitSeparation'],envelope_first_zero=zero,probability_sum=sum(probs),sample_count=n,sample_mean=mean,histogram_l1_error=sum(abs(hist[i]/n-expected[i]) for i in range(51)) if n else None,far_field_ratio=ratio,far_field_warning='Near validated far-field limit; idealized approximation' if ratio>.05 else 'Within prescribed far-field bound'))
