// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppDialog } from "../src/ui/app-dialog";

let root: Root, host: HTMLDivElement, launch: HTMLButtonElement;
let originalShow: PropertyDescriptor | undefined;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,"showModal");
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,writable:true,value:function(this:HTMLDialogElement){this.setAttribute("open","");}});
  document.documentElement.style.overflow="clip";
  launch=document.createElement("button");document.body.append(launch);launch.focus();
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async () => {
  await act(async()=>root.unmount());host.remove();launch.remove();document.documentElement.style.overflow="";
  if(originalShow)Object.defineProperty(HTMLDialogElement.prototype,"showModal",originalShow);else Reflect.deleteProperty(HTMLDialogElement.prototype,"showModal");
  vi.unstubAllGlobals();
});
function Nested({ startOpen=false }: {startOpen?:boolean}) {
  const [child,setChild]=useState(startOpen),[parent,setParent]=useState(true);
  if(!parent)return <p>親も閉じました</p>;
  return <AppDialog label="選手の操作" onClose={()=>setParent(false)}><button onClick={()=>setChild(true)}>整理</button>{child&&<AppDialog label="コレクション" onClose={()=>setChild(false)}>選手一覧</AppDialog>}</AppDialog>;
}
it("restores the original page scroll when navigation unmounts nested dialogs together",async()=>{
  await act(async()=>root.render(<Nested startOpen/>));expect(document.querySelectorAll("dialog[open]")).toHaveLength(2);expect(document.documentElement.style.overflow).toBe("hidden");
  await act(async()=>root.render(<p>次の画面</p>));expect(document.querySelectorAll("dialog[open]")).toHaveLength(0);expect(document.documentElement.style.overflow).toBe("clip");
});
it("keeps the outer sheet locked and returns focus after closing the inner picker",async()=>{
  await act(async()=>root.render(<Nested/>));const organize=document.querySelector<HTMLButtonElement>('dialog[aria-label="選手の操作"] button')!;organize.focus();
  await act(async()=>organize.click());const picker=document.querySelector('dialog[aria-label="コレクション"]')!;
  await act(async()=>picker.dispatchEvent(new Event("close")));expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);expect(document.documentElement.style.overflow).toBe("hidden");expect(document.activeElement).toBe(organize);
  await act(async()=>root.render(null));expect(document.documentElement.style.overflow).toBe("clip");expect(document.activeElement).toBe(launch);
});
