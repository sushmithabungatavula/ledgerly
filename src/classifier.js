// Ledgerly classifier: Multinomial Naive Bayes, written from scratch.
// index.html inlines this same code so the app runs as one file.
// This copy exists so you can read and test the model on its own.
"use strict";
const CATS=["Groceries","Dining","Transport","Housing","Utilities","Shopping","Entertainment","Health","Travel","Subscriptions"];
const col=(i,a)=>a==null?`var(--c${i})`:`color-mix(in srgb,var(--c${i}) ${Math.round(a*100)}%,transparent)`;
const ci=c=>CATS.indexOf(c);

/* Seed data: the model's starting knowledge */
const SEED=[
["whole foods market",62,"Groceries"],["trader joes",48,"Groceries"],["safeway",71,"Groceries"],["kroger groceries",55,"Groceries"],["costco wholesale",140,"Groceries"],["qfc grocery",38,"Groceries"],["instacart order",84,"Groceries"],["aldi",42,"Groceries"],
["starbucks coffee",6,"Dining"],["chipotle",13,"Dining"],["mcdonalds",9,"Dining"],["doordash order",31,"Dining"],["uber eats",27,"Dining"],["pizza place",24,"Dining"],["sushi restaurant",46,"Dining"],["blue bottle coffee",7,"Dining"],["taco bell",11,"Dining"],["thai kitchen restaurant",34,"Dining"],
["uber trip",18,"Transport"],["lyft ride",22,"Transport"],["shell gas station",45,"Transport"],["chevron fuel",52,"Transport"],["orca card metro transit",20,"Transport"],["parking garage",15,"Transport"],["bp gas",40,"Transport"],["car wash",14,"Transport"],
["rent payment",2100,"Housing"],["mortgage payment",2400,"Housing"],["hoa dues",320,"Housing"],["renters insurance",18,"Housing"],["home depot repair",86,"Housing"],
["seattle city light",74,"Utilities"],["puget sound energy",88,"Utilities"],["comcast xfinity internet",79,"Utilities"],["t-mobile phone bill",65,"Utilities"],["water sewer bill",96,"Utilities"],["verizon wireless",70,"Utilities"],
["amazon purchase",36,"Shopping"],["target store",54,"Shopping"],["best buy electronics",220,"Shopping"],["nordstrom",130,"Shopping"],["ikea furniture",260,"Shopping"],["uniqlo clothing",60,"Shopping"],["walmart",44,"Shopping"],
["amc movie tickets",32,"Entertainment"],["ticketmaster concert tickets",140,"Entertainment"],["steam game",29,"Entertainment"],["bowling alley",38,"Entertainment"],["museum admission",25,"Entertainment"],
["cvs pharmacy",18,"Health"],["walgreens prescription",22,"Health"],["dentist visit",150,"Health"],["gym membership",45,"Health"],["doctor copay",30,"Health"],["physical therapy",60,"Health"],
["alaska airlines flight",310,"Travel"],["delta airlines",420,"Travel"],["marriott hotel",240,"Travel"],["airbnb stay",380,"Travel"],["expedia booking",290,"Travel"],["hertz car rental",180,"Travel"],
["netflix",15.49,"Subscriptions"],["spotify premium",11.99,"Subscriptions"],["apple icloud storage",2.99,"Subscriptions"],["youtube premium",13.99,"Subscriptions"],["adobe creative cloud",59.99,"Subscriptions"],["chatgpt plus",20,"Subscriptions"],["hulu",17.99,"Subscriptions"],["amazon prime membership",14.99,"Subscriptions"]
];

/* Sample month: realistic bank strings, some the model has never seen */
const SAMPLE=[
["SQ *BLUE MOON CAFE",8.5,"Dining"],["PCC COMMUNITY MARKETS",64.2,"Groceries"],["RENT PAYMENT SEPT",2100,"Housing"],["WSDOT GOOD TO GO TOLL",6.1,"Transport"],
["AMAZON MKTPL*2K4",23.9,"Shopping"],["SQ *BLUE MOON CAFE",11.25,"Dining"],["PELOTON MEMBERSHIP",44,"Subscriptions"],["TRADER JOES #130",52.7,"Groceries"],
["PCC COMMUNITY MARKETS",41.8,"Groceries"],["REI CO-OP",118,"Shopping"],["ZIPCAR TRIP",27.5,"Transport"],["SEATTLE CITY LIGHT",81.3,"Utilities"],
["WSDOT GOOD TO GO TOLL",6.1,"Transport"],["NETFLIX.COM",15.49,"Subscriptions"],["SQ *BLUE MOON CAFE",7.75,"Dining"],["PELOTON MEMBERSHIP",44,"Subscriptions"],
["ZIPCAR TRIP",31,"Transport"],["SIFF CINEMA",16,"Entertainment"],["SIFF CINEMA",16,"Entertainment"],["ALASKA AIR 0272",289,"Travel"],
["ZOCDOC URGENT CARE",75,"Health"],["REI CO-OP",64,"Shopping"],["UBER *EATS",29.4,"Dining"],["UBER *TRIP",19.2,"Transport"],["SHELL OIL 5744",47.9,"Transport"]
];


/* ---------- Tokenizer and Naive Bayes ---------- */
function bucket(a){a=+a||0;return a<10?"xs":a<30?"s":a<80?"m":a<200?"l":a<600?"xl":"xxl"}
const STOP=new Set(["the","and","of","sq","tst","pos","com","inc","llc","co","www","purchase","payment","card"]);
function tokens(desc,amt){
  const w=String(desc).toLowerCase().replace(/[^a-z0-9]+/g," ").split(" ").filter(t=>t.length>1&&!/\d/.test(t));
  const base=w.filter(t=>!STOP.has(t)).length?w.filter(t=>!STOP.has(t)):w;
  const out=base.slice();
  for(let i=0;i<base.length-1;i++)out.push(base[i]+" "+base[i+1]);
  out.push("amt:"+bucket(amt));
  return out;
}
function train(examples){
  const m={cnt:CATS.map(()=>new Map()),tot:CATS.map(()=>0),docs:CATS.map(()=>0),vocab:new Set(),n:0};
  for(const ex of examples){
    const c=ci(ex.cat);if(c<0)continue;const w=ex.w||1;
    m.docs[c]+=w;m.n+=w;
    for(const t of tokens(ex.desc,ex.amt)){
      m.cnt[c].set(t,(m.cnt[c].get(t)||0)+w);m.tot[c]+=w;m.vocab.add(t);
    }
  }
  return m;
}
function predict(m,desc,amt){
  const toks=tokens(desc,amt),V=m.vocab.size+1;
  const logs=CATS.map((_,c)=>{
    let s=Math.log((m.docs[c]+1)/(m.n+CATS.length));
    for(const t of toks){
      const k=m.cnt[c].get(t)||0;
      // Amount token counts less than words
      const wt=t.startsWith("amt:")?0.5:1;
      s+=wt*Math.log((k+1)/(m.tot[c]+V));
    }
    return s;
  });
  const mx=Math.max(...logs),ex=logs.map(l=>Math.exp(l-mx)),z=ex.reduce((a,b)=>a+b,0);
  const probs=ex.map(e=>e/z);
  const order=probs.map((p,i)=>[p,i]).sort((a,b)=>b[0]-a[0]);
  // Evidence: known tokens that most push toward the winner
  const win=order[0][1];
  const ev=toks.filter(t=>!t.startsWith("amt:")&&m.vocab.has(t)).map(t=>{
    const pw=((m.cnt[win].get(t)||0)+1)/(m.tot[win]+V);
    let other=0;for(let c=0;c<CATS.length;c++)if(c!==win)other+=((m.cnt[c].get(t)||0)+1)/(m.tot[c]+V);
    return [t,Math.log(pw/(other/(CATS.length-1)))];
  }).filter(x=>x[1]>0.5).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const known=toks.some(t=>!t.startsWith("amt:")&&m.vocab.has(t));
  return {cat:CATS[win],conf:order[0][0],top:order.slice(0,4).map(([p,i])=>({cat:CATS[i],p})),ev,known};
}



/* ---------- Icons ---------- */
const P={
  Groceries:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/>',
  Dining:'<path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v3M12 3v3"/>',
  Transport:'<path d="M5 17v-5l2-5.5h10L19 12v5"/><rect x="3" y="12" width="18" height="5" rx="1.5"/><path d="M6 17v2M18 17v2"/>',
  Housing:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  Utilities:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  Shopping:'<path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  Entertainment:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M3 14.5h18M8 5v4.5M16 5v4.5M8 14.5V19M16 14.5V19"/>',
  Health:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  Travel:'<path d="M10.5 13.5L3 11l1.5-1.5 7 1 4.5-4.5a2 2 0 0 1 3 3L14.5 13.5l1 7L14 22l-2.5-7.5L8 18v2.5L6.5 22 5 19l-3-1.5L3.5 16H6z"/>',
  Subscriptions:'<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 3.5v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20.5v-5h5"/>',
  overview:'<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  transactions:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  insights:'<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  model:'<rect x="5" y="5" width="14" height="14" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  wallet:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h15a3 3 0 0 1 3 3v0"/><circle cx="16.5" cy="14.5" r="1"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
};
const icon=(k,extra)=>`<svg class="i"${extra||""} viewBox="0 0 24 24">${P[k]||""}</svg>`;
const av=c=>{const i=ci(c);return `<div class="av" style="background:${col(i,.14)};color:${col(i)}">${icon(c)}</div>`};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"$"+(+n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const money0=n=>"$"+Math.round(+n).toLocaleString();
const pct=v=>v==null?"n/a":Math.round(v*100)+"%";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const ym=d=>d.slice(0,7);
const monthName=m=>new Date(m+"-15T12:00:00").toLocaleDateString(undefined,{month:"long",year:"numeric"});
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);


module.exports = { CATS, SEED, SAMPLE, tokens, bucket, train, predict };
