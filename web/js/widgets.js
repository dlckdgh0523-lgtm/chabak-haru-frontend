"use strict";

(() => {
  const make = (tag, props, text) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (text != null) node.textContent = text;
    return node;
  };

  let toast, toastTimer, dialog, returnFocus;
  function message(text) {
    if (!toast) {
      toast = make("output",{className:"ch-toast"});
      toast.setAttribute("role","status");
      document.body.append(toast);
    }
    toast.hidden=false;
    toast.textContent=text;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(() => { toast.hidden=true; }, 3400);
  }

  function panel(title, content, actions = []) {
    if (!dialog) {
      dialog = make("dialog",{className:"ch-overlay-panel"});
      dialog.setAttribute("aria-labelledby","ch-panel-title");
      dialog.addEventListener("close", () => {
        if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
        returnFocus = null;
      });
      document.body.append(dialog);
    }
    if (!dialog.open) returnFocus = document.activeElement;
    const heading = make("h2",{id:"ch-panel-title"},title);
    const body = make("div",{className:"ch-overlay-content"});
    body.append(...(Array.isArray(content) ? content : [typeof content==="string" ? make("p",{},content) : content]));
    const controls = make("div",{className:"ch-overlay-actions"});
    const close=make("button",{type:"button",className:"ch-ui-button ch-ui-button--secondary"},"닫기");
    close.addEventListener("click", () => dialog.close());
    controls.append(close);
    for (const {label,run} of actions) {
      const button = make("button",{type:"button",className:"ch-ui-button"},label);
      button.addEventListener("click",async () => {
        button.disabled=true;
        try { if(await run() !== false) dialog.close(); }
        catch(error) { message(error.message || "요청을 처리할 수 없어요."); }
        finally { button.disabled=false; }
      });
      controls.append(button);
    }
    dialog.replaceChildren(heading,body,controls);
    if (!dialog.open) dialog.showModal();
    const firstField=body.querySelector("input,select");
    firstField?.focus();
    return dialog;
  }

  function textField(label, props) {
    const input=make("input",props);
    const wrapper=make("label",{},label);
    wrapper.append(input);
    return {wrapper,input};
  }

  function selectField(label, values, value) {
    const input=make("select",{});
    for (const [id,text] of values) input.append(make("option",{value:id},text));
    input.value=value;
    const wrapper=make("label",{},label);
    wrapper.append(input);
    return {wrapper,input};
  }

  function checkField(label, checked) {
    const input=make("input",{type:"checkbox",checked});
    const wrapper=make("label",{});
    wrapper.append(input,document.createTextNode(label));
    return {wrapper,input};
  }

  window.ChabakWidgets=Object.freeze({make,message,panel,textField,selectField,checkField});
})();
