(function(){
  function Emitter(){ this.listeners = {}; }
  Emitter.prototype.on = function(event, fn){
    (this.listeners[event] ||= new Set()).add(fn); return () => this.off(event, fn);
  };
  Emitter.prototype.off = function(event, fn){
    const set = this.listeners[event]; if (!set) return; set.delete(fn);
  };
  Emitter.prototype.emit = function(event, payload){
    const set = this.listeners[event]; if (!set) return; set.forEach(fn => { try{ fn(payload); }catch(_){} });
  };
  window.MVVM = window.MVVM || {}; window.MVVM.Emitter = Emitter;
})();


