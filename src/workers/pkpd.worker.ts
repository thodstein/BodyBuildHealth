import { calculateConcentration } from '../engines/pharmacology.engine';
import type { CourseEntry, BayesianState } from '../core/types';
self.onmessage=(e:MessageEvent)=>{
  const{type,course,weeks,bayesian}=e.data;
  if(type==='CALCULATE_PKPD'){
    try{const res=calculateConcentration(course as CourseEntry[],weeks,bayesian as BayesianState); self.postMessage({type:'PKPD_RESULT',status:'success',data:res});}
    catch(err){self.postMessage({type:'PKPD_RESULT',status:'error',error:String(err)});}}};
export{};