import {useStore} from 'zustand';
import content from '../../../shared/education.json' with {type:'json'};
import {useLanguageStore} from '../stores/languageStore';
export function Education({id}:{id:string}){const language=useLanguageStore(s=>s.language),data=(content as Record<string,Record<string,Record<string,string>>>)[id][language];const labels=language==='zh-CN'?['实验概览','科学背景','学习目标','关键方程','初始设置','操作步骤','观察问题','预期行为','常见误区','向 AI 提问']:['Overview','Scientific background','Learning objectives','Key equations','Initial setup','Instructions','Observation prompts','Expected behavior','Common misconceptions','AI question'];
 return <section className="lab-education"><h2>{language==='zh-CN'?'实验学习指南':'Experiment learning guide'}</h2><div>{Object.entries(data).map(([key,value],i)=><details key={key} open={i===0}><summary>{labels[i]}</summary><p>{value}</p></details>)}</div></section>;}
