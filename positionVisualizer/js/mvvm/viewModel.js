(function(){
  const Emitter = (window.MVVM && window.MVVM.Emitter);
  const MeterState = (window.MVVM && window.MVVM.MeterState);

  function MeterViewModel(initial){
    this.emitter = new Emitter();
    this.state = initial instanceof MeterState ? initial : new MeterState();
    this.running = false;
    this.mockMode = true;
    this.pollIntervalMs = 200;
    this._timer = null;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
  }

  MeterViewModel.prototype.onChange = function(fn){ return this.emitter.on('change', fn); };
  MeterViewModel.prototype._notify = function(){ this.emitter.emit('change', this.state.clone()); };

  MeterViewModel.prototype.setMockMode = function(v){ this.mockMode = !!v; };
  MeterViewModel.prototype.setPollInterval = function(ms){ this.pollIntervalMs = Math.max(50, Number(ms) || 200); };
  MeterViewModel.prototype.setMinValue = function(v){ 
    let min = Number(v);
    if (!isNaN(min)) {
      if (min < 0) min = 0;
      if (min > 100) min = 100;
      if (min >= this.maxValue) {
        if (this.maxValue < 100) {
          this.maxValue = Math.min(100, min + 1);
        } else {
          min = Math.max(0, this.maxValue - 1);
        }
      }
      this.minValue = min;
      this._notify();
    }
  };
  MeterViewModel.prototype.setMaxValue = function(v){ 
    let max = Number(v);
    if (!isNaN(max)) {
      if (max < 0) max = 0;
      if (max > 100) max = 100;
      if (max <= this.minValue) {
        if (this.minValue > 0) {
          this.minValue = Math.max(0, max - 1);
        } else {
          max = Math.min(100, this.minValue + 1);
        }
      }
      this.maxValue = max;
      this._notify();
    }
  };
  MeterViewModel.prototype.setUnit = function(v){ 
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };
  
  // Convert actual value to percentage (0-100) for meter position calculation
  MeterViewModel.prototype.normalizeValue = function(actualValue){
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };
  
  // Convert percentage (0-100) back to actual value
  MeterViewModel.prototype.denormalizeValue = function(percentage){
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };
  MeterViewModel.prototype.setName = function(index, name){
    if (index < 0 || index > 5) return; this.state.names[index] = String(name || '').trim() || this.state.names[index]; this._notify();
  };
  MeterViewModel.prototype.setValue = function(index, value){
    if (index < 0 || index > 5) return; 
    // Store actual value, but normalize to 0-100 for internal state
    const actualValue = Number(value) || 0;
    const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
    const normalized = this.normalizeValue(clamped);
    this.state.values[index] = normalized; 
    this._notify();
  };
  
  // Get actual value (not normalized) for display
  MeterViewModel.prototype.getActualValue = function(index){
    if (index < 0 || index > 5) return 0;
    return this.denormalizeValue(this.state.values[index]);
  };
  
  // Get all actual values
  MeterViewModel.prototype.getActualValues = function(){
    return this.state.values.map((v, i) => this.denormalizeValue(v));
  };
  MeterViewModel.prototype.setIcon = function(path){ if (path) { this.state.icon = path; this._notify(); } };
  MeterViewModel.prototype.setIconAt = function(index, path){
    if (index < 0 || index > 3) return;
    this.state.icons[index] = String(path || '');
    this._notify();
  };

  MeterViewModel.prototype.setState = function(next){
    if (!next) return;
    if (!(next instanceof MeterState)) next = new MeterState(next.values, next.names, next.icon, next.icons);
    this.state = next;
    this._notify();
  };

  MeterViewModel.prototype.toJSON = function(){
    return { values: this.state.values.slice(0,6), names: this.state.names.slice(0,6), icon: this.state.icon, icons: this.state.icons.slice(0,6) };
  };

  MeterViewModel.prototype.start = function(){
    if (this.running) return; this.running = true;
    if (this.mockMode) { this._notify(); return; }
    const tick = () => {
      const range = this.maxValue - this.minValue;
      const values = [0,0,0,0].map(() => this.minValue + Math.random() * range);
      for (let i=0;i<6;i++) {
        const actualValue = values[i];
        const normalized = this.normalizeValue(actualValue);
        this.state.values[i] = normalized;
      }
      this._notify();
    };
    this._timer = setInterval(tick, this.pollIntervalMs);
  };

  MeterViewModel.prototype.stop = function(){
    if (!this.running) return; this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterViewModel = MeterViewModel;
})();


