(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,37002,t=>{t.v({button:"Button-module__L_RtHG__button",icon:"Button-module__L_RtHG__icon",pressed:"Button-module__L_RtHG__pressed"})},726027,t=>{"use strict";var e=t.i(843476),s=t.i(271645),n=t.i(37002);function o({title:t,systemImage:o,onClick:u,disabled:i=!1,className:l=""}){let[a,d]=(0,s.useState)(!1),c=t?.trim()!=="",r=`bi ${o}`;return(0,e.jsxs)("button",{className:`
        ${n.default.button}
        d-flex align-items-center justify-content-center gap-2
        ${a?n.default.pressed:""}
        ${i?n.default.disabled:""}
        ${l}
      `.trim().replace(/\s+/g," "),onClick:t=>{t.preventDefault(),t.stopPropagation(),i||(d(!0),u(),setTimeout(()=>d(!1),100))},type:"button",disabled:i,children:[(0,e.jsx)("i",{className:`${r} ${n.default.icon}`}),c&&(0,e.jsx)("span",{className:"fw-medium",children:t})]})}t.s(["default",()=>o])}]);