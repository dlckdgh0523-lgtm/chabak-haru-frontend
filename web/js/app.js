"use strict";

(() => {
  const root=document.querySelector(".ch-design-frame");
  if (!root) return;
  const screen=document.body.dataset.screen;
  const type=document.body.dataset.kind;
  const width=Number(document.body.dataset.width);
  const height=Number(document.body.dataset.height);
  const slot=document.querySelector(".ch-frame-slot");
  const query=new URLSearchParams(location.search);
  const fixed=query.has("qa");
  const integration=window.ChabakIntegration;
  const {make,message,panel,textField,selectField,checkField}=window.ChabakWidgets;
  const params=query.get("mode")==="live"?"?mode=live":"";
  const host=window.ChabakNative?.postMessage;
  if (host) document.body.dataset.native="android";

  function fitFrame() {
    const scale=type==="cid"?Math.min(innerWidth/width,innerHeight/height):
      type==="mobile"?Math.min(1,innerWidth/width):1;
    const size=fixed?1:scale;
    slot.style.width=(width*size)+"px";
    const mockBar=host&&type==="mobile"?root.querySelector("[data-system-bar]"):null;
    const inset=mockBar?mockBar.offsetHeight:0;
    slot.style.height=((height-inset)*size)+"px";
    root.style.setProperty("--ch-frame-scale",size);
    root.style.setProperty("--ch-native-frame-y",(-inset*size)+"px");
  }
  fitFrame();
  window.addEventListener("resize",fitFrame,{passive:true});

  function load(key,otherwise) {
    try { const stored=sessionStorage.getItem("chabak-haru:"+key); return stored?JSON.parse(stored):otherwise; }
    catch { return otherwise; }
  }
  function save(key,value) {
    try { sessionStorage.setItem("chabak-haru:"+key,JSON.stringify(value)); } catch { /* Proceed in memory. */ }
  }
  const settings={
    "heating":17,"wake-time":372,"sleep-music":30,illuminance:12,
    "climate-mode":"sleep","power-mode":"standard",
    "doors-locked":true,"approach-detection":true,"fire-detection":true,"wake-enabled":true,"weather-contact-notifications":true,
    "heating-enabled":true,"sleep-music-enabled":true,"illuminance-enabled":true,"climate-enabled":true,"power-saving-enabled":true,
    ...(fixed?{}:load("settings",{})), // ?qa는 저장된 상태 없이 Figma 기본값
  };
  const options={
    "climate-mode":[["sleep","취침"],["airflow","환기"],["automatic","자동"]],
    "power-mode":[["standard","기본"],["balanced","균형"],["saving","절전"]],
  };
  const ranges={heating:[16,30,1],"wake-time":[0,1439,1],"sleep-music":[0,90,5],illuminance:[0,50,1]};
  const defaults={
    "heating":17,"wake-time":372,"sleep-music":30,illuminance:12,"climate-mode":"sleep","power-mode":"standard",
    "doors-locked":true,"approach-detection":true,"fire-detection":true,"wake-enabled":true,"weather-contact-notifications":true,
    "heating-enabled":true,"sleep-music-enabled":true,"illuminance-enabled":true,"climate-enabled":true,"power-saving-enabled":true,
  };
  const bindings=new Map();
  for (const node of root.querySelectorAll("[data-bind]")) {
    const values=bindings.get(node.dataset.bind)||[];
    values.push(node);
    bindings.set(node.dataset.bind,values);
  }
  function display(key,value) {
    for(const node of bindings.get(key)||[]) {
      const spans=[...node.children];
      // 부모 <p>가 font-size:0이라 span을 지우면 글자가 사라짐 → span 구조 유지, 스타일이 다른 꼬리(단위·"초 뒤…")는 남김
      if(spans.length&&spans.every(el=>el.tagName==="SPAN")){
        const last=spans.at(-1);
        const tail=last!==spans[0]&&last.className!==spans[0].className&&value.endsWith(last.textContent)?last:null;
        spans[0].textContent=tail?value.slice(0,value.length-tail.textContent.length):value;
        for(const span of spans.slice(1))if(span!==tail)span.textContent="";
      } else node.textContent=value;
    }
  }
  function clock(minute) {
    const value=((Number(minute)%1440)+1440)%1440;
    return [Math.floor(value/60),value%60].map(n=>String(n).padStart(2,"0")).join(":");
  }
  function valueText(key,value) {
    if (key==="wake-time") return clock(value);
    if (key==="heating") return value+"°C";
    if (key==="sleep-music") return value+"분";
    if (key==="illuminance") return value+" lux";
    if (options[key]) return options[key].find(([id])=>id===value)?.[1] || "";
    return value?"ON":"OFF";
  }
  function setSetting(key,value) {
    if (!(key in settings)) return;
    settings[key]=value;
    display(key,valueText(key,value));
    for (const button of root.querySelectorAll('[data-action="toggle-setting"]')) {
      if(button.dataset.value===key) button.setAttribute("aria-checked",String(value));
    }
    if(integration.demo)save("settings",settings);
  }
  if(integration.demo)for(const key of Object.keys(defaults))if(settings[key]!==defaults[key])setSetting(key,settings[key]);
  const prefix=type==="cid"?"cid-":"mobile-";
  const go=target=>location.assign(target+".html"+params);
  const goLocal=target=>go(prefix+target);
  const sequence=type==="cid"?["vehicle","consent","pair","contacts"]:["vehicle","consent","scan","contacts"];
  function nextOnboarding() {
    const current=screen.split("-").at(-1);
    const following=sequence[sequence.indexOf(current)+1];
    if(current==="pair"||current==="scan")save("paired",true);
    if(following)goLocal("onboarding-"+following);
  }

  // 화면 흐름 상태(데모 세션). ?qa는 Figma 비교용이라 적용하지 않는다
  const flash=text=>save("flash",text); // 다음 화면에서 한 번 보여줄 안내
  if(!fixed){
    const pending=load("flash",null);
    if(pending){save("flash",null);setTimeout(()=>message(pending),300);}
    // 경로 확인 질문은 한 번만 묻는다(S1a)
    if(screen.endsWith("route-confirmation")&&load("route-answered",false)){
      root.querySelector("[data-route-overlay]")?.setAttribute("hidden","");
      for(const timer of bindings.get("route-countdown")||[])timer.hidden=true;
    }
    // 비교에서 바꾼 목적지를 브리핑에 반영(S1b → S1). 후기·사진은 Figma에 솔내 해변 노지만 있음
    const destination=load("destination",null);
    if(screen.endsWith("destination-briefing")&&destination?.name&&destination.id!=="solnae"){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      for(let node=walker.nextNode();node;node=walker.nextNode())
        if(node.nodeValue.includes("솔내 해변 노지"))node.nodeValue=node.nodeValue.replace("솔내 해변 노지",destination.name);
    }
    // 일출 모드를 끈 경우 기상 화면에서 일출 안내를 뺀다(S5a 아니요)
    if(screen.endsWith("sunrise-alarm")&&load("sunrise",true)===false){
      const note=root.querySelector('[data-figma-node="29262:7562"]');
      if(note)note.innerHTML="일출 모드를 꺼 두었어요.<br>설정한 시각에 맞춰 깨워드려요.";
      for(const timer of bindings.get("sunrise-remaining")||[])timer.parentElement.style.visibility="hidden";
      root.querySelector('[data-figma-node="29396:5498"]')?.parentElement?.parentElement?.style.setProperty("visibility","hidden");
    }
    // 휴대폰 연결을 건너뛰었으면 밤 화면에서 알린다(O4)
    if(load("paired",true)===false&&/cabin|sleep-mode/.test(screen))
      setTimeout(()=>message("휴대폰이 연결돼 있지 않아요. 밤사이 경보가 휴대폰으로 가지 않아요."),pending?4000:900);
  }
  const agreements=[...root.querySelectorAll('[data-action="consent-toggle"]')];
  const consentAll=root.querySelector('[data-action="consent-all"]');
  const consentNext=root.querySelector('[data-action="onboarding-next"]');
  let consentSet=new Set();
  function refreshConsents(changed) {
    for(const button of agreements) {
      button.setAttribute("aria-checked",String(consentSet.has(button.dataset.value)));
      if(changed||!integration.demo)button.dataset.changed="true";
    }
    if(consentAll) {
      consentAll.setAttribute("aria-checked",consentSet.size===0?"false":consentSet.size===agreements.length?"true":"mixed");
      if(changed||!integration.demo)consentAll.dataset.changed="true";
    }
    if(consentNext&&agreements.length) {
      const valid=agreements.filter(b=>b.dataset.consentRequired==="true").every(b=>consentSet.has(b.dataset.value));
      consentNext.setAttribute("aria-disabled",String(!valid));
      if(changed)consentNext.dataset.touched="true";
    }
  }
  refreshConsents(false);

  const cardNames={najeong:"나정 모래 해변",bukhang:"북항 방파제 공터",galma:"갈마 솔숲 쉼터",solnae:"솔내 해변 노지"};
  const cards=[...root.querySelectorAll("[data-destination-card]")];
  let selectedPlace=type==="cid"?(cards.at(-1)?.dataset.destinationCard||"najeong"):"najeong";
  const filters=new Set([...root.querySelectorAll('[data-action="filter-toggle"][aria-pressed="true"]')].map(x=>x.dataset.value));
  const bookmarks=new Set(fixed?[]:load("bookmarks",[]));

  function keyOfPlace(value) {
    return Object.keys(cardNames).find(k=>k===value||cardNames[k]===value) || selectedPlace;
  }
  function updateFilters(touched) {
    for (const el of root.querySelectorAll('[data-action="filter-toggle"]')) {
      el.setAttribute("aria-pressed",String(filters.has(el.dataset.value)));
      if(touched)el.dataset.changed="true";
    }
  }
  for(const b of root.querySelectorAll('[data-action="bookmark-toggle"]')) {
    if(b.dataset.value&&bookmarks.has(keyOfPlace(b.dataset.value))){
      b.setAttribute("aria-pressed","true");
      b.dataset.changed="true";
    }
  }
  function filterPanel() {
    const fields=["거리순","20km 반경","조용함","추천순","일출 잘 보임","야영 가능","취사 가능"].map(name=>[name,checkField(name,filters.has(name))]);
    panel("차박지 검색 조건",fields.map(([,field])=>field.wrapper),[{label:"적용",run:async()=>{
      const next=fields.filter(([,field])=>field.input.checked).map(([name])=>name);
      const result=await request("places.filters",{filters:next});
      filters.clear(); next.forEach(f=>filters.add(f)); updateFilters(true); displayPlaces(result);
      message("검색 조건을 적용했어요.");
    }}]);
  }
  function displayPlaces(result) {
    if (!Array.isArray(result.placeIds)) return;
    const known=new Set(result.placeIds);
    for(const card of cards) card.hidden=!known.has(card.dataset.destinationCard);
  }

  function mountCarousels() {
    if(fixed)return;
    for(const track of root.querySelectorAll("[data-carousel]")){
      const slides=[...track.querySelectorAll(":scope > [data-slide]")];
      let index=Number(track.dataset.carouselIndex);
      let pointerStart=null;
      const render=target=>{
        if(!slides.length)return;
        let next=Math.max(0,Math.min(slides.length-1,target));
        while(slides[next]?.hidden&&next+Math.sign(target-index)>=0&&next+Math.sign(target-index)<slides.length&&next!==index) next+=Math.sign(target-index);
        if(slides[next]?.hidden)return;
        index=next;
        track.dataset.carouselActive=String(index);
        slides.forEach((slide,i)=>{slide.inert=index!==i;});
        track.style.translate=((Number(track.dataset.carouselIndex)-index)*292)+"px 0";
        if(slides[index].dataset.destinationCard)selectedPlace=slides[index].dataset.destinationCard;
      };
      track.addEventListener("pointerdown",e=>{if(e.isPrimary)pointerStart=e.clientX;});
      const finish=e=>{
        if(pointerStart===null)return;
        const distance=e.clientX-pointerStart;
        pointerStart=null;
        const scale=parseFloat(root.style.getPropertyValue("--ch-frame-scale"))||1;
        if(Math.abs(distance)>35*scale){
          render(index+(distance>0?-1:1));
          const prevent=event=>{event.preventDefault();event.stopImmediatePropagation();};
          track.addEventListener("click",prevent,{once:true,capture:true});
          setTimeout(()=>track.removeEventListener("click",prevent,true),180);
        }
      };
      track.addEventListener("pointerup",finish);
      track.addEventListener("pointercancel",()=>{pointerStart=null;});
      track.addEventListener("keydown",e=>{
        if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
        e.preventDefault();render(index+(e.key==="ArrowLeft"?-1:1));
      });
      render(index);
    }
  }
  mountCarousels();

  const request=(event,payload)=>integration.request(event,payload);
  const previewMessage=text=>message(integration.demo?"미리보기 · "+text:text);
  const simpleNavigation={
    "utility-enable":["vehicle.utility.enable",type==="cid"?"cabin-ready":"cabin-settings"],
  };
  const links=(pairs)=>pairs.map(([id,title])=>make("a",{href:prefix+id+".html"+params},title));
  // 데모 이벤트(D1 데모 패널): 밤사이 모의 경보·기상으로 들어가는 진입점
  const demoEvents=()=>panel("데모 이벤트",links([["approach-alert","차량 접근 경보"],["weather-alert","호우 경보"],
    [type==="cid"?"cabin-overheat":"v2l-overheat","V2L 과열"],...(type==="cid"?[]:[["battery-warning","배터리 잔량 경고"]]),["sunrise-alarm","기상 알람"]]));
  const handlers={
    async "menu-open"() {
      panel("차박 내비게이션",[...links([["destination-briefing","차박지 브리핑"],["destination-comparison","근처 차박지 비교"],
        ["charging-detour","충전 경유"],["sunrise-parking","일출 주차"],["utility-mode","유틸리티 모드"],["cabin-ready","차량 설정(취침 확인)"],
        ["sleep-mode","수면 모드"]]),make("button",{type:"button",onclick:demoEvents},"데모 이벤트…")]);
    },
    async "route-accept"() {
      await request("route.accept",{});
      save("route-answered",true);
      goLocal("destination-briefing");
    },
    async "route-start"() {
      await request("route.start",{});
      save("route-answered",true);
      goLocal("destination-briefing");
    },
    async "route-dismiss"() {
      await request("route.dismiss",{});
      save("route-answered",true);
      root.querySelector("[data-route-overlay]")?.setAttribute("hidden","");
      for(const timer of bindings.get("route-countdown")||[])timer.hidden=true;
    },
    async "detour-accept"() {
      await request("route.detour",{enabled:true});
      flash("고속도로 휴게소 급속충전을 경유지로 등록했어요.");
      goLocal("sunrise-parking");
    },
    async "detour-skip"() {
      await request("route.detour",{enabled:false});
      flash("충전 없이 가요. 오늘 밤 전력이 10% 모자랄 수 있어요.");
      goLocal("sunrise-parking");
    },
    async "sunrise-confirm"() {
      await request("parking.sunrise",{enabled:true});
      save("sunrise",true);
      goLocal("utility-mode");
    },
    async "sunrise-skip"() {
      await request("parking.sunrise",{enabled:false});
      save("sunrise",false);
      flash("일출 모드를 껐어요. 기상 알람만 울려요.");
      goLocal("utility-mode");
    },
    async "sleep-stop"() {
      await request("vehicle.sleep.stop",{});
      goLocal("sunrise-alarm"); // S7 "수면 모드 끝내기" → 바로 S9 기상 요약
    },
    // 모바일 "후기보기"는 후기를 바로 연다
    "place-briefing":()=>handlers["reviews-open"](),
    "place-comparison":()=>goLocal("destination-comparison"),
    async "place-call"() {
      const result=await request("place.phone",{placeId:"solnae"});
      const phone=result.phone;
      if(typeof phone==="string"&&/^\+?[0-9-]{7,20}$/.test(phone)) {
        panel("차박지 전화번호",make("a",{href:"tel:"+phone},phone));
      }else previewMessage("차박지 연락처를 요청했어요.");
    },
    async "reviews-open"() {
      const result=await request("place.reviews",{placeId:"solnae"});
      const reviews=Array.isArray(result.reviews)?result.reviews:[];
      panel("전체 후기",reviews.length?reviews.filter(x=>typeof x==="string").map(x=>make("p",{},x)):"등록된 후기가 없어요.");
    },
    // 비교의 닫기는 왔던 브리핑으로, 브리핑의 닫기는 주행 계속 → 다음 단계인 전력 확인(PRD S1→S3)
    "screen-close":()=>goLocal(screen.endsWith("comparison")?"destination-briefing":"charging-detour"),
    "map-open":()=>goLocal("route-confirmation"),
    "filters-open":filterPanel,
    async "filter-toggle"(button,value) {
      const next=new Set(filters);
      if(value==="거리순"||value==="추천순") {
        const alternate=value==="거리순"?"추천순":"거리순";
        next.delete(alternate);
      }
      if(next.has(value))next.delete(value);else next.add(value);
      const result=await request("places.filters",{filters:[...next]});
      filters.clear(); for(const item of next)filters.add(item);
      updateFilters(true); displayPlaces(result);
    },
    async "bookmark-toggle"(button,value) {
      const placeId=keyOfPlace(value);
      const saved=button.getAttribute("aria-pressed")!=="true";
      await request("places.bookmark",{placeId,saved});
      if(saved)bookmarks.add(placeId);else bookmarks.delete(placeId);
      for(const other of root.querySelectorAll('[data-action="bookmark-toggle"]')){
        if(other===button||(other.dataset.value&&keyOfPlace(other.dataset.value)===placeId)){
          other.setAttribute("aria-pressed",String(saved));
          other.dataset.changed="true";
        }
      }
      if(integration.demo)save("bookmarks",[...bookmarks]);
      previewMessage(saved?"차박지를 저장했어요.":"저장을 해제했어요.");
    },
    async "place-select"(button,value) {
      const placeId=keyOfPlace(value);
      const result=await request("route.destination",{placeId});
      selectedPlace=placeId;
      if(integration.demo)save("destination",{id:placeId,name:cardNames[placeId]});
      if(result.next==="charging")goLocal("charging-detour");
      else goLocal("destination-briefing");
    },
    "setting-info"(button,key) {
      const info={
        "doors-locked":["문 잠금 및 창문","문과 창문이 모두 닫혀 있는지 확인해요. 열려 있으면 잠들기 전에 알려드려요."],
        "approach-detection":["접근 감지","누군가 차량 주변에 10초 이상 머무르면 차량 화면과 휴대폰으로 알려드려요."],
        "fire-detection":["화재 감지","실내 온도가 갑자기 오르는 등 화재 위험이 감지되면 바로 알려드려요."],
      }[key];
      if(info)panel(info[0],info[1]);
    },
    "quick-menu"(button,key) {
      if(key==="wake-time")return handlers["alarm-edit"]();
      const [min,max,step]=ranges[key];
      const label=button.getAttribute("aria-label").replace(/ 세부 설정$/,"");
      const unit={heating:"°C","sleep-music":"분",illuminance:"lux"}[key];
      const field=textField(label+" ("+unit+")",{type:"number",min,max,step,value:settings[key],required:true});
      panel(label+" 설정",field.wrapper,[{label:"저장",run:async()=>{
        if(!field.input.reportValidity())return false;
        const value=Number(field.input.value);
        const result=await request("vehicle.setting",{key,value});
        setSetting(key,typeof result.value==="number"&&Number.isFinite(result.value)?result.value:value);
      }}]);
    },
    "settings-open"() {
      const climate=selectField("공조 모드",options["climate-mode"],settings["climate-mode"]);
      const power=selectField("절전 모드",options["power-mode"],settings["power-mode"]);
      const checks=[["approach-detection","접근 감지"],["fire-detection","화재 감지"],["wake-enabled","기상 알람"]].map(([key,label])=>[key,checkField(label,settings[key])]);
      panel("전체 설정",[climate.wrapper,power.wrapper,...checks.map(([,f])=>f.wrapper)],[{label:"적용",run:async()=>{
        const next={"climate-mode":climate.input.value,"power-mode":power.input.value,...Object.fromEntries(checks.map(([key,f])=>[key,f.input.checked]))};
        for(const [key,value] of Object.entries(next)){
          if(settings[key]===value)continue;
          const result=await request("vehicle.setting",{key,value});
          setSetting(key,result.value??value);
        }
        previewMessage("설정을 적용했어요.");
      }}]);
    },
    async "pair-qr"() {
      if(!integration.demo){message("휴대폰의 차박하루 앱에서 ‘차량 연결’을 눌러 이 QR을 비춰 주세요.");return;}
      panel("휴대폰 연결","미리보기에서는 휴대폰 스캔 없이 연결된 것으로 보고 다음 단계로 넘어갈 수 있어요.",[{label:"연결된 것으로 보기",run:()=>nextOnboarding()}]);
    },
    "utility-help":()=>panel("유틸리티 모드 안내","차량에 따라 유틸리티 모드를 켜는 방법이 달라요. 차량의 설정에서 유틸리티 모드 메뉴를 확인해 주세요."),
    async "toggle-setting"(button,key) {
      // D6: 창문은 항상 닫힘 고정. 끌 수 없음
      if(key==="doors-locked"){message("문과 창문은 항상 닫혀 있어요. 환기는 공조 외기 유입으로 해요.");return;}
      const enabled=button.getAttribute("aria-checked")!=="true";
      const result=await request("vehicle.setting",{key,value:enabled});
      setSetting(key,typeof result.value==="boolean"?result.value:enabled);
      // D7: 환기는 끌 수 없음. 공조를 꺼도 외기 유입은 유지
      if(key==="climate-enabled"&&!settings[key])message("공조를 꺼도 환기(외기 유입)는 계속 켜져 있어요.");
    },
    async step(button,value) {
      const [key,direction]=value.split(":");
      const [min,max,increment]=ranges[key];
      let amount=settings[key]+Number(direction)*increment;
      amount=key==="wake-time"?((amount+1440)%1440):Math.max(min,Math.min(max,amount));
      const result=await request("vehicle.setting",{key,value:amount});
      setSetting(key,typeof result.value==="number"&&Number.isFinite(result.value)?result.value:amount);
    },
    "cab-mode"(button,key) {
      const field=selectField(key==="power-mode"?"절전 모드":"공조 모드",options[key],settings[key]);
      panel("차량 모드 설정",field.wrapper,[{label:"적용",run:async()=>{
        const result=await request("vehicle.setting",{key,value:field.input.value});
        setSetting(key,result.value||field.input.value);
      }}]);
    },
    async "settings-save"() {
      await request("vehicle.settings.save",{settings});
      goLocal("sleep-mode");
    },
    async "sleep-start"() {
      await request("vehicle.sleep.start",{settings});
      goLocal("sleep-mode");
    },
    "alarm-edit"() {
      const field=textField("기상 시각",{type:"time",value:clock(settings["wake-time"]),required:true});
      panel("기상 시각 바꾸기",field.wrapper,[{label:"저장",run:async()=>{
        if(!field.input.reportValidity())return false;
        const [h,m]=field.input.value.split(":").map(Number);
        const result=await request("alarm.set",{hour:h,minute:m});
        setSetting("wake-time",typeof result.minutes==="number"?result.minutes:h*60+m);
        previewMessage("기상 시각을 저장했어요.");
      }}]);
    },
    async "alarm-snooze"() {
      await request("alarm.snooze",{minutes:10});
      goLocal("sleep-mode");
    },
    async "alarm-stop"() {
      await request("alarm.stop",{});
      // 아침 요약 + 한 줄 후기(S9→S10, prompts/07). 여정을 마치면 지도(경로 질문 없이)로
      const review=textField("어젯밤 어땠어요? (선택)",{type:"text",maxLength:80,placeholder:"예: 조용했는데 좀 추웠어요"});
      const finish=()=>{save("route-answered",true);goLocal("route-confirmation");};
      panel("좋은 아침이에요",[make("p",{},"밤사이 실내 온도 15.2°C~25°C를 유지했고, 환기 3번, 결로 제거를 마쳤어요."),review.wrapper],[
        {label:"후기 남기고 마치기",run:async()=>{
          const text=review.input.value.trim();
          if(text)await request("reviews.create",{placeId:load("destination",{id:"solnae"}).id,text});
          flash(text?"후기를 남겼어요. 다음 차박에 도움이 돼요.":"여정을 마쳤어요.");
          finish();
        }},
      ]);
    },
    "dismiss-warning"() {
      root.querySelector('[data-overlay="battery"]')?.setAttribute("hidden","");
      setAlertOverlay(false);
    },
    async "v2l-details"() {
      const result=await request("vehicle.v2l.details",{normal:screen.endsWith("cabin-ready")});
      const parts=[result.label,result.temperature==null?"":("온도 "+result.temperature+"°C"),result.observedAt&&("감지 시각 "+result.observedAt)].filter(Boolean);
      const overlay=root.querySelector('[data-overlay="overheat"]');
      const acknowledge=overlay?async()=>{
        await request("safety.acknowledge",{type:"v2l-overheat"});
        overlay.hidden=true;
        setAlertOverlay(false);
      }:screen==="cid-cabin-overheat"?async()=>{
        await request("safety.acknowledge",{type:"v2l-overheat"});
        flash("과열 경고를 확인했어요. 해당 포트 전원은 차단된 상태예요.");
        goLocal("cabin-ready");
      }:null;
      panel("V2L 연결 기기",parts.join("\n")||"기기 상태를 불러올 수 없어요.",acknowledge?[{label:"경고 확인",run:acknowledge}]:[]);
    },
    async "evacuation-route"() {
      const result=await request("safety.evacuation.route",{});
      const guide=typeof result.instructions==="string"?result.instructions:"하천에서 멀리, 높은 곳으로 이동하세요.";
      // D10: 휴대폰 호우 경보는 119. Figma에 버튼 자리가 없어 대피 안내 창에 둔다(다이얼만)
      if(type==="mobile")panel("대피 안내",[make("p",{},guide),make("a",{href:"tel:119"},"119에 전화 걸기")]);
      else if(typeof result.instructions==="string")panel("대피 경로",result.instructions);
      else previewMessage("대피 경로를 요청했어요.");
    },
    async "alert-acknowledge"() {
      await request("safety.acknowledge",{type:screen.includes("weather")?"weather":"approach"});
      goLocal("sleep-mode");
    },
    "vehicle-alert"() {
      panel("차량 비상등과 경적","차량의 비상등과 경적 작동을 요청해요.",[{label:"작동 요청",run:async()=>{
        await request("safety.vehicleSignal",{hazardLights:true,horn:true});
        previewMessage("비상등과 경적을 요청했어요.");
      }}]);
    },
    "sos-open"() {
      // D10: 휴대폰 접근 경보는 112(다이얼만). 차량은 기존 SOS 연결(prompts/08)
      if(type==="mobile"){panel("112 신고",[make("p",{},"차 주변 위협이 계속되면 112에 신고하세요."),make("a",{href:"tel:112"},"112에 전화 걸기")]);return;}
      panel("긴급 호출","차량 또는 앱의 긴급 호출 서비스를 열어요.",[{label:"긴급 호출 열기",run:async()=>{
        await request("safety.sos",{});
        previewMessage("긴급 호출을 요청했어요.");
      }}]);
    },
    "onboarding-start":()=>goLocal("onboarding-vehicle"),
    async "onboarding-next"() {
      if(agreements.length) {
        if(consentNext.getAttribute("aria-disabled")==="true"){
          consentNext.dataset.touched="true";
          message("필수 약관에 모두 동의해 주세요.");
          return;
        }
        await request("terms.accept",{agreed:[...consentSet]});
      }
      if(screen.endsWith("-scan")) {
        if(integration.demo){nextOnboarding();return;}
        await startScan();
        return;
      }
      nextOnboarding();
    },
    "consent-toggle"(button,value) {
      if(consentSet.has(value))consentSet.delete(value);else consentSet.add(value);
      refreshConsents(true);
    },
    "consent-all"() {
      consentSet=consentSet.size===agreements.length?new Set():new Set(agreements.map(b=>b.dataset.value));
      refreshConsents(true);
    },
    async "consent-details"(button,value) {
      const title=(button.getAttribute("aria-label")||"약관").replace(/ 전문 보기$/,"");
      const result=await request("terms.document",{id:value});
      panel(title,result.text||"약관 전문을 불러올 수 없어요.");
    },
    "scan-start":()=>startScan(),
    async "pair-skip"() {
      await request("pairing.skip",{});
      nextOnboarding();
      save("paired",false); // nextOnboarding이 연결됨으로 저장한 뒤 덮어쓴다
    },
    "contacts-edit":()=>editContacts(),
    "contacts-reorder":()=>reorderContacts(),
    "contacts-test":(button,value)=>confirmContactTest(value),
    async "contacts-done"() {
      await request("contacts.finish",{contactIds:contactRows().map(c=>contactIds[c.dataset.contactCard])});
      goLocal("route-confirmation");
    },
    "voice-toggle":()=>toggleVoice(),
  };

  function contactRows() {return [...root.querySelectorAll("[data-contact-card]")];}
  const contactIds={first:"first",second:"second"};
  const testsByRow={first:"이차박",second:"이하루"};
  function contactFields() {
    return ["first","second"].flatMap((key,i)=>[
      textField((i+1)+"번 연락처 이름",{type:"text",maxLength:24,value:testsByRow[key],autocomplete:"off"}),
      textField((i+1)+"번 전화번호",{type:"tel",inputMode:"tel",maxLength:16,autocomplete:"off",placeholder:"01012345678"}),
    ]);
  }
  function applyContacts(items) {
    if(!Array.isArray(items))return;
    for(const [i,key] of ["first","second"].entries()) {
      const item=items[i];
      const card=contactRows().find(c=>c.dataset.contactCard===key);
      if(!item||!card)continue;
      const name=card.querySelector("[data-contact-name]");
      const phone=card.querySelector("[data-contact-phone]");
      if(name&&typeof item.name==="string") {name.textContent=item.name;testsByRow[key]=item.name;}
      if(phone&&typeof item.maskedPhone==="string")phone.textContent=item.maskedPhone;
      if(typeof item.id==="string")contactIds[key]=item.id;
    }
  }
  function editContacts() {
    const fields=contactFields();
    panel("비상연락처 입력",fields.map(f=>f.wrapper),[{label:"저장",run:async()=>{
      const items=[];
      for(let i=0;i<fields.length;i+=2) {
        const key=i===0?"first":"second";
        const name=fields[i].input.value.trim();
        const phone=fields[i+1].input.value.replace(/[ -]/g,"");
        if(phone&&!/^\+?[0-9]{8,15}$/.test(phone)) {message("전화번호를 확인해 주세요.");return false;}
        if(phone&&!name){message("연락처 이름을 입력해 주세요.");return false;}
        if(name)items.push({id:contactIds[key],name,...(phone?{phone}:{})});
      }
      if(!items.length){message("연락처를 입력해 주세요.");return false;}
      const result=await request("contacts.update",{contacts:items});
      const fallback=items.map(x=>({id:x.id,name:x.name,maskedPhone:x.phone?"•••• "+x.phone.slice(-4):null}));
      applyContacts(result.contacts||(integration.demo?fallback:null));
      previewMessage("연락처를 저장했어요.");
    }}]);
  }
  function reorderContacts() {
    panel("비상연락처 순서","첫 번째 연락처와 두 번째 연락처의 순서를 바꿔요.",[{label:"순서 변경",run:async()=>{
      const rows=contactRows();
      if(rows.length!==2)return false;
      const next=[rows[1],rows[0]];
      await request("contacts.reorder",{contactIds:next.map(c=>contactIds[c.dataset.contactCard])});
      const swapBounds=(element,other)=>{
        for(const prop of ["top","left","right","bottom","translate"]){
          const value=getComputedStyle(other)[prop]; if(value&&value!=="auto"&&value!=="none")element.style[prop]=value;
        }
      };
      const parent=rows[0].parentElement;
      if(parent===rows[1].parentElement){
        if(getComputedStyle(rows[0]).position==="absolute"&&getComputedStyle(rows[1]).position==="absolute"){
          const a=getComputedStyle(rows[0]);
          const pos=Object.fromEntries(["top","left","right","bottom","translate"].map(k=>[k,a[k]]));
          swapBounds(rows[0],rows[1]); Object.assign(rows[1].style,pos);
        }
        parent.insertBefore(rows[1],rows[0]);
      }
      for(const [index,card] of contactRows().entries()) {
        const nr=card.querySelector("[data-contact-order]");
        if(nr)nr.textContent=String(index+1);
      }
      previewMessage("발송 순서를 바꿨어요.");
    }}]);
  }
  function confirmContactTest(value) {
    const key=value==="second"?"second":"first";
    panel("테스트 문자 발송",testsByRow[key]+"님에게 테스트 문자를 요청해요.",[{label:"요청",run:async()=>{
      await request("contacts.test",{contactId:contactIds[key]});
      previewMessage("테스트 문자 발송을 요청했어요.");
    }}]);
  }
  if(screen.endsWith("-contacts")&&!fixed&&!integration.demo)request("contacts.list",{}).then(x=>applyContacts(x.contacts)).catch(e=>message(e.message));

  let scannerActive=false;
  async function startScan() {
    if(scannerActive)return;
    if(integration.demo){panel("휴대폰 카메라","미리보기에서는 ‘다음’으로 비상연락처 화면을 볼 수 있어요.");return;}
    const container=root.querySelector("[data-scanner]");
    if(!container)throw new Error("QR 스캔 영역을 찾을 수 없어요.");
    scannerActive=true;
    try {
      await window.ChabakScanner.open(container,async code=>{
        scannerActive=false;
        const result=await request("pairing.confirm",{code});
        if(result.status==="paired")nextOnboarding();
        else message("차량 연결이 완료되지 않았어요.");
      },error=>{scannerActive=false;message(error.message);});
    }catch(error) {scannerActive=false;throw error;}
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)scannerActive=false;});
  const qr=root.querySelector("[data-pair-qr]");
  if(qr&&!fixed&&!integration.demo) {
    for(const image of qr.querySelectorAll("img"))image.hidden=true;
    request("pairing.begin",{}).then(({sessionId,qrImageUrl})=>{
      if(typeof sessionId!=="string"||typeof qrImageUrl!=="string")throw new Error("연결용 QR을 받지 못했어요.");
      const target=qr.querySelector("img");
      if(!target)throw new Error("연결용 QR 표시 영역을 찾을 수 없어요.");
      if(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(qrImageUrl)&&qrImageUrl.length<240000) {
        target.src=qrImageUrl;
      } else {
        const url=new URL(qrImageUrl,location.href);
        if(url.protocol!=="https:"||url.username||url.password)throw new Error("연결용 QR 주소가 올바르지 않아요.");
        target.src=url.href;
      }
      target.hidden=false;
      let attempts=0;
      const poll=async()=>{
        const result=await request("pairing.status",{sessionId});
        if(result.status==="paired"){nextOnboarding();return;}
        if(result.status==="expired"||++attempts>=60) {message("연결 시간이 만료되었어요.");return;}
        if(!document.hidden)setTimeout(()=>poll().catch(e=>message(e.message)),2000);
        else document.addEventListener("visibilitychange",()=>poll().catch(e=>message(e.message)),{once:true});
      };
      return poll();
    }).catch(error=>message(error.message));
  }

  // 브리핑 알약(.ch-voice-briefing)은 음성 인식·브리핑 중(data-active)에만 펼친다. ?qa는 Figma 비교용으로 펼친 상태 고정
  const briefingPills=[...root.querySelectorAll(".ch-voice-briefing")];
  const briefingSeconds=30;
  let speechRunning=false;
  let speechUtterance;
  let briefingTimer=0;
  function setBriefing(active,label="브리핑 중") {
    speechRunning=active;
    clearInterval(briefingTimer);
    for(const b of root.querySelectorAll('[data-action="voice-toggle"]'))b.setAttribute("aria-pressed",String(active));
    for(const pill of briefingPills)pill.toggleAttribute("data-active",active);
    if(!active||!integration.demo)return;
    display("briefing-state",label);
    const start=Date.now();
    const tick=()=>{
      const s=Math.min(briefingSeconds,Math.floor((Date.now()-start)/1000));
      display("briefing-time","0:"+String(s).padStart(2,"0")+" / 0:"+briefingSeconds);
      if(s>=briefingSeconds)stopSpeech();
    };
    tick();
    briefingTimer=setInterval(tick,1000);
  }
  function stopSpeech() {
    speechUtterance=null;
    window.speechSynthesis?.cancel();
    setBriefing(false);
  }
  if(fixed)for(const pill of briefingPills)pill.toggleAttribute("data-active",true);
  window.addEventListener("pagehide",()=>clearInterval(briefingTimer));
  function toggleVoice() {
    const opening=!speechRunning;
    if(!integration.demo)return request(opening?"voice.start":"voice.stop",{}).then(result=>{
      setBriefing(opening);
      if(opening)display("briefing-state",result.status==="listening"?"듣는 중":"브리핑 중");
    });
    if(!opening){stopSpeech();return;}
    setBriefing(true);
    // 음성 합성이 없는 브라우저에서도 알약·타이머는 동작, 소리만 생략
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
    speechSynthesis.cancel();
    const spoken=new SpeechSynthesisUtterance(document.title.split(" · 차박하루")[0]+"을 안내해 드릴게요.");
    spoken.lang="ko-KR";
    speechUtterance=spoken;
    speechSynthesis.speak(spoken);
  }

  let overlayActive=false;
  function setAlertOverlay(active) {
    const overlay=root.querySelector("[data-overlay]");
    if(!overlay||active===overlayActive)return;
    overlayActive=active;
    if(active) {
      for(const button of root.querySelectorAll("button"))if(!overlay.contains(button))button.inert=true;
      overlay.setAttribute("role","region");
    } else {
      for(const button of root.querySelectorAll("button"))button.inert=false;
    }
  }
  if(root.querySelector("[data-overlay]"))setAlertOverlay(true);

  root.addEventListener("click",async event=>{
    const button=event.target.closest("[data-action]");
    if(!button&&event.target.closest(".ch-voice-briefing[data-active]")&&!fixed){
      if(integration.demo)stopSpeech();else toggleVoice();
      return;
    }
    if(!button||!root.contains(button)||button.disabled)return;
    const name=button.dataset.action;
    const value=button.dataset.value;
    const navigation=simpleNavigation[name];
    const handle=handlers[name];
    if(!handle&&!navigation)return;
    if(button.dataset.busy)return;
    button.dataset.busy="true";
    try{
      if(handle)await handle(button,value||"");
      else {
        const [action,route,enabled]=navigation;
        await request(action,enabled==null?{}:{enabled});
        if(route)goLocal(route);else previewMessage("경로 확인을 닫았어요.");
      }
    }catch(error) {message(error.message || "요청을 처리할 수 없어요.");}
    finally {delete button.dataset.busy;}
  });

  const phases={
    "weather-response":{seconds:47,delta:-1,kind:"weather"},
    "approach-elapsed":{seconds:14,delta:1,kind:"approach"},
    "sunrise-remaining":{seconds:1080,delta:-1,kind:"sunrise"},
    "route-countdown":{seconds:7,delta:-1,kind:"route-preview"},
    "sleep-display-countdown":{seconds:10,delta:-1,kind:"sleep-display"},
  };
  const countText=(key,seconds)=>{
    if(key==="route-countdown")return seconds+"초 뒤 기본 화면";
    if(key==="sleep-display-countdown")return seconds+"초 뒤 다시 화면이 꺼져요.";
    return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
  };
  function pauseDisplay() {
    const overlay=make("button",{className:"ch-sleep-screen-off",type:"button"},"화면 켜기");
    overlay.addEventListener("click",()=>overlay.remove(),{once:true});
    document.body.append(overlay);overlay.focus();
  }
  for(const [key,{seconds,delta,kind}] of Object.entries(phases)){
    if(!bindings.has(key)||fixed||!integration.demo)continue;
    const start=Date.now();
    const timer=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-start)/1000);
      const current=Math.max(0,seconds+delta*elapsed);
      display(key,countText(key,current));
      if(!current){
        clearInterval(timer);
        if(kind==="weather")message("미리보기 · 응답 시간을 초과했어요.");
        if(kind==="route-preview"){
          const popup=root.querySelector("[data-route-overlay]");
          if(popup)popup.hidden=true;
          for(const timer of bindings.get(key)||[])timer.hidden=true;
        }
        if(kind==="sleep-display")pauseDisplay();
      }
    },1000);
    window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
  }

  // 수면 화면 길게 누르기(0.7초) → 데모 이벤트. 화면에 버튼을 더하지 않으려고 제스처로 둔다
  if(screen.endsWith("sleep-mode")&&integration.demo&&!fixed){
    let press=0;
    root.addEventListener("pointerdown",e=>{if(!e.target.closest("[data-action]"))press=setTimeout(demoEvents,700);});
    for(const name of ["pointerup","pointercancel","pointerleave"])root.addEventListener(name,()=>clearTimeout(press));
  }
  // D5: 취침 확인은 30초 동안 손대지 않으면 화면을 끄고 수면 모드로. 무엇이든 만지면 30초 다시
  if(screen==="cid-cabin-ready"&&integration.demo&&!fixed){
    let left=30;
    for(const name of ["pointerdown","keydown"])document.addEventListener(name,()=>{left=30;},{capture:true});
    const idle=setInterval(()=>{
      if(document.querySelector("dialog[open]")){left=30;return;}
      left-=1;
      if(left===10)message("10초 뒤 화면을 끄고 수면 모드로 들어가요.");
      if(left<=0){clearInterval(idle);handlers["sleep-start"]();}
    },1000);
    window.addEventListener("pagehide",()=>clearInterval(idle),{once:true});
  }

  const publicFields=new Set([
    "route-arrival","route-duration","route-distance","vehicle-range","cabin-temperature","cabin-co2",
    "briefing-state","briefing-time","weather-response","approach-elapsed","sunrise-remaining","route-countdown",
    "vehicle-soc","vehicle-reserve","place-name","alert-title","alert-description","sunrise-time","sleep-display-countdown",
    "clock-hours","clock-minutes","clock-time",
  ]);
  function applyState(event,payload) {
    if(event==="ui.state") {
      for(const [name,val] of Object.entries(payload.values||{})){
        if(!publicFields.has(name))continue;
        if(typeof val==="string"||typeof val==="number")display(name,String(val));
      }
    }
    if(event==="vehicle.settings") {
      for(const [name,val] of Object.entries(payload.settings||{}))
        if(Object.hasOwn(defaults,name)&&typeof val===typeof defaults[name])setSetting(name,val);
    }
    if(event==="places.results") displayPlaces(payload);
    if(event==="map.updated"&&typeof payload.imageUrl==="string"){
      const layer=root.querySelector("[data-live-map]");
      const key=payload.imageUrl;
      const image=layer?.querySelector("img");
      const dataImage = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(key) && key.length < 3500000;
      const sameOrigin = key.startsWith(location.origin + "/") && ["https:","http:"].includes(location.protocol);
      if (layer && (dataImage || sameOrigin)) {
        if (type === "cid" && image) image.src = key;
        else {
          const next = make("img", {src:key,alt:"차박 경로 지도",className:"ch-live-map-image"});
          layer.replaceChildren(next);
        }
        layer.dataset.live = "true";
      }
    }
    if(event==="voice.state"&&typeof payload.active==="boolean") {
      setBriefing(payload.active);
      if(payload.active&&typeof payload.status==="string")display("briefing-state",payload.status==="listening"?"듣는 중":"브리핑 중");
    }
    if(event==="contacts.updated") applyContacts(payload.contacts);
    if(event==="pairing.paired"&&screen.endsWith("-pair")) nextOnboarding();
  }
  integration.subscribe(applyState);
  function loadInitialState() {
    if(integration.demo||fixed)return;
    request("ui.ready",{}).then(data=>{
      for(const update of data.state||[])if(update?.event&&update.payload)applyState(update.event,update.payload);
    }).catch(()=>{ /* Existing apps may supply state exclusively through push events. */ });
  }
  if(host)loadInitialState();
  window.addEventListener("chabak-adapter-ready",loadInitialState);
})();
