(function(){
  function MeterState(values, names, icon, icons){
    this.values = Array.isArray(values) ? values.slice(0,6) : [];
    this.names = Array.isArray(names) ? names.slice(0,6) : ['','','','','',''];
    this.icon = icon || 'assets/icon.svg';
    // Per-index icons (optional). Falls back to single icon if not provided
    if (Array.isArray(icons)) {
      const arr = icons.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.icons = arr;
    } else {
      this.icons = [null, null, null, null, null, null];
    }
  }
  MeterState.prototype.clone = function(){ return new MeterState(this.values.slice(0,6), this.names.slice(0,6), this.icon, this.icons.slice(0,6)); };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterState = MeterState;
})();


