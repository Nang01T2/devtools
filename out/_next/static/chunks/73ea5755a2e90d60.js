(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,421072,e=>{"use strict";var t=e.i(843476);function s({children:e,gap:s="0",alignment:a="start",distribution:i="start",className:n="",style:c,width:d="100"}){let l=["d-flex flex-column","25"===d?"w-25":"50"===d?"w-50":"75"===d?"w-75":"100"===d?"w-100":"auto"===d?"w-auto":"",`gap-${s}`,`align-items-${a}`,`justify-content-${"between"===i?"between":"around"===i?"around":"evenly"===i?"evenly":i}`,n].filter(Boolean).join(" "),r={...c,..."string"==typeof d&&!["25","50","75","100","auto"].includes(d)?{width:d}:{}};return(0,t.jsx)("div",{className:l,style:r,children:e})}e.s(["default",()=>s])},439911,e=>{"use strict";var t=e.i(843476),s=e.i(421072);function a({children:e,style:a}){return(0,t.jsx)(s.default,{gap:"3",alignment:"start",className:"px-3 pb-3",style:a,children:e})}e.s(["default",()=>a])},426169,e=>{"use strict";var t=e.i(843476),s=e.i(271645),a=e.i(770703),i=e.i(439911);let n=(0,a.default)(()=>e.A(215481).then(e=>e.MdEditor),{loadableGenerated:{modules:[327359]},ssr:!1,loading:()=>(0,t.jsxs)("div",{className:"text-center py-5 my-5",children:[(0,t.jsx)("div",{className:"spinner-border text-primary mb-3",role:"status"}),(0,t.jsx)("p",{className:"text-muted",children:"Loading Markdown editor..."})]})});function c(){let[e,a]=(0,s.useState)(`# Welcome to Markdown Editor

This is a **real-time** Markdown editor with:

- Live preview
- Syntax highlighting
- Dark / Light mode (syncs with system / Bootstrap theme)
- Support for tables, code blocks, lists, images, etc.

## Example Table

| Feature          | Supported |
|------------------|-----------|
| Bold / Italic    | Yes       |
| Code blocks      | Yes       |
| Tables           | Yes       |
| Task lists       | Yes       |

Try editing this text!
`),[c,d]=(0,s.useState)("light");return(0,s.useEffect)(()=>{let e=()=>{d("dark"===document.documentElement.getAttribute("data-bs-theme")?"dark":"light")};e();let t=new MutationObserver(e);return t.observe(document.documentElement,{attributes:!0,attributeFilter:["data-bs-theme"]}),()=>t.disconnect()},[]),(0,t.jsx)(i.default,{children:(0,t.jsx)("div",{className:"w-100 row justify-content-center",children:(0,t.jsx)("div",{className:"col-12 col-xxl-11",children:(0,t.jsxs)("div",{className:"card shadow border-0 overflow-hidden",children:[(0,t.jsx)("div",{className:"card-header bg-body-tertiary border-bottom py-3",children:(0,t.jsx)("div",{className:"d-flex align-items-center justify-content-between",children:(0,t.jsxs)("button",{className:"btn btn-outline-success btn-sm d-flex align-items-center gap-2",onClick:()=>{let t=new Blob([e],{type:"text/markdown;charset=utf-8"}),s=URL.createObjectURL(t),a=document.createElement("a");a.href=s,a.download="my-document.md",document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(s)},title:"Save current content as .md file",children:[(0,t.jsx)("i",{className:"bi bi-floppy"}),"Save as"]})})}),(0,t.jsx)(n,{modelValue:e,onChange:a,theme:c,language:"en-US",previewTheme:"dark"===c?"cyanosis":"github",height:"80vh",placeholder:"Start writing in Markdown...",autoFocus:!0,showCodeRowNumber:!0,style:{border:"none"}})]})})})})}e.s(["default",()=>c])},215481,e=>{e.v(t=>Promise.all(["static/chunks/cef3e906d2bfdb56.js","static/chunks/49674d7459315221.js","static/chunks/1bb50053ff2c7264.js","static/chunks/86a8b083c237b120.js","static/chunks/15aac59396339d89.js","static/chunks/cf1209d93d1719f8.js","static/chunks/b47a686c6a4d1252.js","static/chunks/860eefc76a6da13f.js","static/chunks/f2b2890040274fad.js"].map(t=>e.l(t))).then(()=>t(327359)))}]);