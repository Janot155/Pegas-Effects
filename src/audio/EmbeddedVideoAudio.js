/* Pegas/Cutroom: keep a video's embedded audio on its own, normal-time clock.
   Video retiming is intentionally video-only. This module is loaded before index.html's app script. */
(function(){
  const players=new Map();
  function get(id,src,context,destination){
    let p=players.get(id);
    if(p && p.src!==src){dispose(id);p=null}
    if(!p){
      const el=new Audio();
      el.preload="auto"; el.playsInline=true; el.src=src;
      const source=context.createMediaElementSource(el);
      const gain=context.createGain();
      source.connect(gain); gain.connect(destination);
      p={el,source,gain,src}; players.set(id,p);
    }
    return p;
  }
  function sync(id,src,context,destination,time,playing,rate,volume){
    if(!context || !destination || !src) return;
    const p=get(id,src,context,destination), a=p.el;
    const target=Math.max(0,Number(time)||0), speed=Math.max(.0625,Math.min(16,Number(rate)||1));
    try{
      if(Math.abs((Number(a.currentTime)||0)-target)>.12 || a.readyState===0) a.currentTime=target;
    }catch(_){}
    if(a.playbackRate!==speed) a.playbackRate=speed;
    const v=Math.max(0,Math.min(1,Number(volume)||0));
    if(context.state==="running") p.gain.gain.setTargetAtTime(v,context.currentTime,.012);
    else p.gain.gain.value=v;
    if(playing){if(a.paused&&!p.pendingPlay){const task=Promise.resolve().then(()=>a.play()).catch(()=>{}).finally(()=>{if(p.pendingPlay===task)p.pendingPlay=null});p.pendingPlay=task}}
    else if(!a.paused) a.pause();
  }
  function stop(id){const p=players.get(id);if(p&&!p.el.paused)p.el.pause()}
  function dispose(id){const p=players.get(id);if(!p)return;try{p.el.pause();p.el.removeAttribute("src");p.el.load();p.source.disconnect();p.gain.disconnect()}catch(_){}players.delete(id)}
  async function primeAll(){await Promise.all([...players.values()].map(p=>p.pendingPlay).filter(Boolean))}
  window.CutroomEmbeddedAudio={sync,stop,dispose,primeAll,disposeAll(){for(const id of [...players.keys()])dispose(id)}};
})();