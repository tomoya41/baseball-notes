import { readHistoricalProduct } from "../infrastructure/providers/historical-product-reader";
import { formIndexSchema, formMonthSchema, formMonths, evaluateHistoricalForm, type FormCategory, type FormIndex, type FormMode, type FormMonth } from "../domain/historical-form";
import type { BattingView } from "../domain/player-display-role";

export async function readHistoricalForm(input:{index:FormIndex;asOf:string;days:7|14|30;mode:FormMode;category:FormCategory;names:ReadonlyMap<string,string>;view:BattingView}, read=readHistoricalProduct) {
  const index=formIndexSchema.parse(input.index),needed=formMonths(index,input.asOf,input.days,input.mode);
  if(needed.length>3)throw Error("Form monthly fetch budget exceeded");
  const base=`${index.competitionType==="postseason"?"postseason/":""}exploration/form/${index.season}/`;
  const months=await Promise.all(needed.map(async m=>formMonthSchema.parse(await read<FormMonth>(`${base}${m}.json`))));
  const started=performance.now();
  return {...evaluateHistoricalForm(index,months,input.names,input.asOf,input.days,input.mode,input.category,input.view),fetches:needed.length,evaluationMs:performance.now()-started};
}
