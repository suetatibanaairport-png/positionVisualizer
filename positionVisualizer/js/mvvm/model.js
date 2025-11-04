(function(){
  function MeterState(values, names, icon, icons){
    this.values = Array.isArray(values) ? values.slice(0,4) : [20,45,75,45];
    this.names = Array.isArray(names) ? names.slice(0,4) : ['出演者1','出演者2','出演者3','出演者4'];
    this.icon = icon || 'assets/icon.svg';
    // Per-index icons (optional). Falls back to single icon if not provided
    if (Array.isArray(icons)) {
      const arr = icons.slice(0,4);
      while (arr.length < 4) arr.push(null);
      this.icons = arr;
    } else {
      this.icons = [null, null, null, null];
    }
  }
  MeterState.prototype.clone = function(){ return new MeterState(this.values.slice(0,4), this.names.slice(0,4), this.icon, this.icons.slice(0,4)); };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterState = MeterState;
})();


