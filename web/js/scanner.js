"use strict";

(() => {
  const valid = text => typeof text === "string" && text.trim().length > 0 && text.length <= 2048;
  let active, loader;

  function stop() {
    if (!active) return;
    active.stream.getTracks().forEach(t => t.stop());
    active.video.remove();
    clearTimeout(active.frame);
    active=null;
  }

  function loadDecoder() {
    if (window.jsQR) return Promise.resolve();
    if (!loader) loader=new Promise((resolve,reject) => {
      const script=document.createElement("script");
      script.src="../assets/vendor/jsQR.js";
      script.onload=resolve;
      script.onerror=() => { loader=null; reject(new Error("QR 분석 모듈을 불러오지 못했어요.")); };
      document.head.append(script);
    });
    return loader;
  }

  async function open(container,onCode,onError) {
    if (active) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("카메라를 사용할 수 있는 환경에서 열어 주세요.");
    let detector;
    if ("BarcodeDetector" in window) {
      try {
        if ((await BarcodeDetector.getSupportedFormats()).includes("qr_code")) detector=new BarcodeDetector({formats:["qr_code"]});
      } catch { /* Software decoder is available below. */ }
    }
    if (!detector) await loadDecoder();
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:960}},audio:false});
    if (!container.isConnected||document.hidden) {
      stream.getTracks().forEach(t=>t.stop());
      throw new Error("스캔 화면에서 카메라를 다시 시작해 주세요.");
    }
    const video=document.createElement("video");
    video.className="ch-scanner-video";
    video.muted=true;
    video.playsInline=true;
    video.srcObject=stream;
    container.append(video);
    active={video,stream};
    const running=active;
    try { await video.play(); }
    catch(error){stop();throw error;}
    const canvas=document.createElement("canvas");
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context) { stop(); throw new Error("QR 분석 화면을 열 수 없어요."); }
    async function detect() {
      if(active!==running)return;
      try {
        let result;
        if (video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
          if (detector) result=(await detector.detect(video))[0]?.rawValue;
          else {
            const scale=Math.min(1,640/video.videoWidth);
            canvas.width=Math.round(video.videoWidth*scale);
            canvas.height=Math.round(video.videoHeight*scale);
            context.drawImage(video,0,0,canvas.width,canvas.height);
            const image=context.getImageData(0,0,canvas.width,canvas.height);
            result=await decodeImageData(image);
          }
        }
        if (active!==running) return;
        if (valid(result)) { stop(); await onCode(result.trim()); return; }
        active.frame=setTimeout(detect,180);
      } catch(error) { stop(); onError(error); }
    }
    await detect();
  }

  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
  window.addEventListener("pagehide",stop);
  async function decodeImageData(image) {
    await loadDecoder();
    return window.jsQR(image.data,image.width,image.height,{inversionAttempts:"dontInvert"})?.data || null;
  }
  window.ChabakScanner=Object.freeze({open,stop,decodeImageData});
})();
