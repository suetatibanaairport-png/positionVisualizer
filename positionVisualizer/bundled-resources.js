// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: 2025-12-22T10:16:13.299Z

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
  "app.js": `class B{constructor(q="app",Q={}){this.namespace=q,this.options={useSessionStorage:!1,encrypt:!1,compressLargeValues:!1,logErrors:!0,...Q},this.storage=this.options.useSessionStorage?sessionStorage:localStorage,this._checkStorageAvailability()}_getNamespacedKey(q){return\`\${this.namespace}.\${q}\`}_checkStorageAvailability(){try{let q=\`__test_\${Date.now()}__\`;return this.storage.setItem(q,"test"),this.storage.removeItem(q),!0}catch(q){if(this.options.logErrors)console.error("LocalStorage is not available:",q);return!1}}getItem(q,Q=null){try{let Z=this._getNamespacedKey(q),_=this.storage.getItem(Z);if(_===null)return Q;try{return JSON.parse(_)}catch($){return _}}catch(Z){if(this.options.logErrors)console.error(\`LocalStorage getItem error for key \${q}:\`,Z);return Q}}setItem(q,Q){try{let Z=this._getNamespacedKey(q),_=typeof Q==="object"&&Q!==null?JSON.stringify(Q):String(Q);return this.storage.setItem(Z,_),!0}catch(Z){if(this.options.logErrors)console.error(\`LocalStorage setItem error for key \${q}:\`,Z);return!1}}removeItem(q){try{let Q=this._getNamespacedKey(q);return this.storage.removeItem(Q),!0}catch(Q){if(this.options.logErrors)console.error(\`LocalStorage removeItem error for key \${q}:\`,Q);return!1}}clear(){try{let q=\`\${this.namespace}.\`,Q=[];for(let Z=0;Z<this.storage.length;Z++){let _=this.storage.key(Z);if(_&&_.startsWith(q))Q.push(_)}return Q.forEach((Z)=>{this.storage.removeItem(Z)}),!0}catch(q){if(this.options.logErrors)console.error("LocalStorage clear error:",q);return!1}}getAllKeys(){try{let q=\`\${this.namespace}.\`,Q=[];for(let Z=0;Z<this.storage.length;Z++){let _=this.storage.key(Z);if(_&&_.startsWith(q))Q.push(_.substring(q.length))}return Q}catch(q){if(this.options.logErrors)console.error("LocalStorage getAllKeys error:",q);return[]}}getAllItems(){try{let q=this.getAllKeys(),Q={};return q.forEach((Z)=>{Q[Z]=this.getItem(Z)}),Q}catch(q){if(this.options.logErrors)console.error("LocalStorage getAllItems error:",q);return{}}}size(){try{return this.getAllKeys().length}catch(q){if(this.options.logErrors)console.error("LocalStorage size error:",q);return 0}}hasItem(q){try{let Q=this._getNamespacedKey(q);return this.storage.getItem(Q)!==null}catch(Q){if(this.options.logErrors)console.error(\`LocalStorage hasItem error for key \${q}:\`,Q);return!1}}setItems(q){try{return Object.entries(q).forEach(([Q,Z])=>{this.setItem(Q,Z)}),!0}catch(Q){if(this.options.logErrors)console.error("LocalStorage setItems error:",Q);return!1}}exportToJSON(){try{let q=this.getAllItems();return JSON.stringify(q)}catch(q){if(this.options.logErrors)console.error("LocalStorage exportToJSON error:",q);return"{}"}}importFromJSON(q,Q=!0){try{let Z=JSON.parse(q);if(Q)this.clear();return this.setItems(Z)}catch(Z){if(this.options.logErrors)console.error("LocalStorage importFromJSON error:",Z);return!1}}}class D{constructor(q,Q={}){if(this.url=q,this.options={reconnectInterval:1000,maxReconnectAttempts:5,debug:!1,autoConnect:!1,connectTimeout:5000,...Q},this.socket=null,this.connected=!1,this.connecting=!1,this.reconnectAttempts=0,this.reconnectTimer=null,this.connectTimeoutTimer=null,this.listeners=new Map,this.options.autoConnect)this.connect()}connect(){return new Promise((q,Q)=>{if(this.connecting||this.connected){q(this.connected);return}this.connecting=!0,this.connectTimeoutTimer=setTimeout(()=>{if(!this.connected&&this.connecting){if(this.connecting=!1,this._log("Connection timeout"),this.socket)this.socket.close();Q(Error("Connection timeout"))}},this.options.connectTimeout);try{this.socket=new WebSocket(this.url),this.socket.onopen=()=>{clearTimeout(this.connectTimeoutTimer),this.connected=!0,this.connecting=!1,this.reconnectAttempts=0,this._log(\`Connected to \${this.url}\`),this._emitEvent("connect",{}),q(!0)},this.socket.onmessage=(Z)=>{this._handleMessage(Z)},this.socket.onerror=(Z)=>{if(this._log("WebSocket error:",Z),this._emitEvent("error",{error:Z}),this.connecting)clearTimeout(this.connectTimeoutTimer),this.connecting=!1,Q(Z)},this.socket.onclose=(Z)=>{clearTimeout(this.connectTimeoutTimer);let _=this.connected;if(this.connected=!1,this.connecting=!1,this._log(\`Disconnected: \${Z.code} - \${Z.reason}\`),_)this._emitEvent("disconnect",{code:Z.code,reason:Z.reason,wasClean:Z.wasClean});this._attemptReconnect()}}catch(Z){clearTimeout(this.connectTimeoutTimer),this.connecting=!1,this._log("Connection error:",Z),Q(Z)}})}disconnect(q=1000,Q="Normal closure"){if(!this.socket)return;if(this.reconnectTimer)clearTimeout(this.reconnectTimer),this.reconnectTimer=null;try{this.socket.close(q,Q),this._log(\`Manually disconnected: \${q} - \${Q}\`)}catch(Z){this._log("Error during disconnect:",Z)}this.connected=!1,this.connecting=!1,this.socket=null}on(q,Q){if(!this.listeners.has(q))this.listeners.set(q,new Set);return this.listeners.get(q).add(Q),()=>this.off(q,Q)}once(q,Q){let Z=(_)=>{this.off(q,Z),Q(_)};return this.on(q,Z)}off(q,Q){if(!this.listeners.has(q))return;if(Q){if(this.listeners.get(q).delete(Q),this.listeners.get(q).size===0)this.listeners.delete(q)}else this.listeners.delete(q)}send(q){if(!this.connected||!this.socket)return!1;try{let Q=typeof q==="string"?q:JSON.stringify(q);return this.socket.send(Q),!0}catch(Q){return this._log("Send error:",Q),this._emitEvent("error",{error:Q,context:"send"}),!1}}_handleMessage(q){let Q=q.data;if(typeof Q==="string")try{if(Q=JSON.parse(Q),Q.type||Q.event){let Z=Q.type||Q.event;this._emitEvent(Z,Q)}}catch(Z){}this._emitEvent("message",Q)}_attemptReconnect(){if(this.reconnectTimer)clearTimeout(this.reconnectTimer);if(this.reconnectAttempts>=this.options.maxReconnectAttempts){this._log("Max reconnect attempts reached"),this._emitEvent("reconnect_failed",{attempts:this.reconnectAttempts});return}this.reconnectAttempts++,this.reconnectTimer=setTimeout(()=>{this._log(\`Reconnect attempt \${this.reconnectAttempts}...\`),this._emitEvent("reconnecting",{attempt:this.reconnectAttempts}),this.connect().catch((q)=>{this._log("Reconnect failed:",q)})},this.options.reconnectInterval)}_emitEvent(q,Q){if(this.listeners.has(q))this.listeners.get(q).forEach((Z)=>{try{Z(Q)}catch(_){console.error(\`Error in \${q} event handler:\`,_)}})}_log(...q){if(this.options.debug)console.log("[WebSocketClient]",...q)}getStatus(){return{connected:this.connected,connecting:this.connecting,url:this.url,reconnectAttempts:this.reconnectAttempts}}}class T{constructor(q,Q=null){this.id=q,this.name=Q||\`デバイス \${q}\`,this.connected=!1,this.iconUrl=null,this.lastSeen=Date.now(),this.metadata={}}connect(){this.connected=!0,this.lastSeen=Date.now()}disconnect(){this.connected=!1}setName(q){if(q&&typeof q==="string")this.name=q}setIcon(q){this.iconUrl=q}updateLastSeen(){this.lastSeen=Date.now()}updateMetadata(q={}){this.metadata={...this.metadata,...q}}isResponsiveWithin(q){return Date.now()-this.lastSeen<q}toJSON(){return{id:this.id,name:this.name,connected:this.connected,iconUrl:this.iconUrl,lastSeen:this.lastSeen,metadata:this.metadata}}static fromJSON(q){let Q=new T(q.id,q.name);return Q.connected=q.connected||!1,Q.iconUrl=q.iconUrl||null,Q.lastSeen=q.lastSeen||Date.now(),Q.metadata=q.metadata||{},Q}}class C{async getAll(){throw Error("Not implemented")}async getAllConnected(){throw Error("Not implemented")}async getById(q){throw Error("Not implemented")}async findByCondition(q){throw Error("Not implemented")}async save(q){throw Error("Not implemented")}async saveAll(q){throw Error("Not implemented")}async remove(q){throw Error("Not implemented")}async reset(){throw Error("Not implemented")}async exists(q){throw Error("Not implemented")}async count(){throw Error("Not implemented")}async persist(){throw Error("Not implemented")}}var P={TRACE:0,DEBUG:1,INFO:2,WARN:3,ERROR:4,FATAL:5,NONE:6};class L{constructor(q="app",Q={}){this.name=q,this.options={level:P.INFO,useColors:!0,includeTimestamp:!0,persistLogs:!1,maxLogSize:1000,consoleOutput:!0,...Q},this.logs=[],this.levelNames={[P.TRACE]:"TRACE",[P.DEBUG]:"DEBUG",[P.INFO]:"INFO",[P.WARN]:"WARN",[P.ERROR]:"ERROR",[P.FATAL]:"FATAL"},this.colors={[P.TRACE]:"color: #6c757d",[P.DEBUG]:"color: #17a2b8",[P.INFO]:"color: #28a745",[P.WARN]:"color: #ffc107",[P.ERROR]:"color: #dc3545",[P.FATAL]:"color: #dc3545; font-weight: bold"}}setLevel(q){if(typeof q==="number"&&q>=P.TRACE&&q<=P.NONE)this.options.level=q}trace(...q){this._log(P.TRACE,...q)}debug(...q){this._log(P.DEBUG,...q)}info(...q){this._log(P.INFO,...q)}warn(...q){this._log(P.WARN,...q)}error(...q){this._log(P.ERROR,...q)}fatal(...q){this._log(P.FATAL,...q)}_log(q,...Q){if(q<this.options.level)return;let Z=this._createLogInfo(q,Q);if(this.options.persistLogs)this._persistLog(Z);if(this.options.consoleOutput)this._consoleOutput(q,Z)}_createLogInfo(q,Q){return{timestamp:new Date,level:q,levelName:this.levelNames[q]||"UNKNOWN",name:this.name,message:Q.map((_)=>{if(_ instanceof Error)return\`\${_.message}
\${_.stack}\`;else if(typeof _==="object")try{return JSON.stringify(_)}catch($){return String(_)}else return String(_)}).join(" "),args:Q}}_consoleOutput(q,Q){let Z="";if(this.options.includeTimestamp)Z+=\`[\${Q.timestamp.toISOString()}] \`;Z+=\`[\${Q.name}] [\${Q.levelName}]\`;let _;switch(q){case P.TRACE:case P.DEBUG:_=console.debug;break;case P.INFO:_=console.info;break;case P.WARN:_=console.warn;break;case P.ERROR:case P.FATAL:_=console.error;break;default:_=console.log}if(this.options.useColors&&typeof window<"u"){let $=this.colors[q]||"";_(\`%c\${Z}\`,$,...Q.args)}else _(Z,...Q.args)}_persistLog(q){if(this.logs.push(q),this.logs.length>this.options.maxLogSize)this.logs=this.logs.slice(-this.options.maxLogSize)}getLogs(q=0,Q=P.INFO){let Z=this.logs.filter((_)=>_.level>=Q);if(q<=0||q>=Z.length)return Z;else return Z.slice(-q)}clearLogs(){this.logs=[]}exportLogs(q="json"){if(q==="json")return JSON.stringify(this.logs,null,2);else return this.logs.map((Q)=>{return\`[\${Q.timestamp.toISOString()}] [\${Q.name}] [\${Q.levelName}] \${Q.message}\`}).join(\`
\`)}createLogger(q){let Q=\`\${this.name}.\${q}\`;return new L(Q,this.options)}}var Y=new L;class h extends C{constructor(q){super();this.storageAdapter=q,this.devices=new Map,this.STORAGE_KEY="devices",this.logger=Y.createLogger("DeviceRepository"),this._loadFromStorage()}_loadFromStorage(){try{let q=this.storageAdapter.getItem(this.STORAGE_KEY,[]);this.logger.debug(\`Loading \${q.length} devices from storage\`),this.devices.clear(),q.forEach((Q)=>{let Z=T.fromJSON(Q);this.devices.set(Z.id,Z)}),this.logger.info(\`Loaded \${this.devices.size} devices from storage\`)}catch(q){this.logger.error("Error loading devices from storage:",q),this.devices.clear()}}_saveToStorage(){try{let q=Array.from(this.devices.values()).map((Q)=>Q.toJSON());return this.storageAdapter.setItem(this.STORAGE_KEY,q),this.logger.debug(\`Saved \${q.length} devices to storage\`),!0}catch(q){return this.logger.error("Error saving devices to storage:",q),!1}}async getAll(){return Array.from(this.devices.values())}async getAllConnected(){return Array.from(this.devices.values()).filter((q)=>q.connected)}async getById(q){return this.devices.get(q)||null}async findByCondition(q){if(typeof q!=="function")return[];return Array.from(this.devices.values()).filter((Q)=>q(Q))}async save(q){if(!q||!q.id)return this.logger.warn("Attempted to save invalid device:",q),!1;this.devices.set(q.id,q);let Q=this._saveToStorage();if(Q)this.logger.debug(\`Device saved: \${q.id}\`);return Q}async saveAll(q){if(!Array.isArray(q))return this.logger.warn("Attempted to save non-array devices:",q),!1;let Q=!1;if(q.forEach((_)=>{if(!_||!_.id){this.logger.warn("Invalid device in saveAll:",_),Q=!0;return}this.devices.set(_.id,_)}),Q)this.logger.warn("Some devices were invalid and not saved");let Z=this._saveToStorage();if(Z)this.logger.debug(\`Saved \${q.length} devices\`);return Z}async remove(q){if(!q||!this.devices.has(q))return this.logger.debug(\`Attempted to remove non-existent device: \${q}\`),!1;this.devices.delete(q);let Q=this._saveToStorage();if(Q)this.logger.debug(\`Device removed: \${q}\`);return Q}async reset(){this.devices.clear();let q=this._saveToStorage();if(q)this.logger.info("All devices reset");return q}async exists(q){return this.devices.has(q)}async count(){return this.devices.size}async persist(){return this._saveToStorage()}}class j{constructor(q,Q,Z=null,_=Date.now()){this.deviceId=q,this.rawValue=Q,this.normalizedValue=Z!==null?Z:j.normalize(Q),this.timestamp=_}static normalize(q,Q=0,Z=100){if(q===null||q===void 0)return null;if(Q===Z)return 50;let _=(q-Q)/(Z-Q)*100;return Math.max(0,Math.min(100,_))}isWithinThreshold(q){if(!this.normalizedValue)return!1;return this.normalizedValue>=0&&this.normalizedValue<=q}changeRateFrom(q){if(!q||q.normalizedValue===null||this.normalizedValue===null)return 0;return Math.abs(this.normalizedValue-q.normalizedValue)/100}isStale(q){return Date.now()-this.timestamp>q}toJSON(){return{deviceId:this.deviceId,rawValue:this.rawValue,normalizedValue:this.normalizedValue,timestamp:this.timestamp}}static fromJSON(q){return new j(q.deviceId,q.rawValue,q.normalizedValue,q.timestamp||Date.now())}}class E{async getCurrentValue(q){throw Error("Not implemented")}async getAllCurrentValues(){throw Error("Not implemented")}async saveValue(q,Q){throw Error("Not implemented")}async getValueHistory(q,Q=100,Z=0){throw Error("Not implemented")}async getValuesByTimeRange(q,Q,Z){throw Error("Not implemented")}async clearHistory(q){throw Error("Not implemented")}async clearAllHistory(){throw Error("Not implemented")}async calculateStatistics(q,Q=3600000){throw Error("Not implemented")}async pruneOldData(q){throw Error("Not implemented")}subscribeToValueChanges(q,Q){throw Error("Not implemented")}}class a{constructor(){this.listeners=new Map,this.maxListeners=10,this.debug=!1}setDebug(q){this.debug=Boolean(q)}setMaxListeners(q){if(typeof q==="number"&&q>0)this.maxListeners=q}on(q,Q){if(!this.listeners.has(q))this.listeners.set(q,new Set);let Z=this.listeners.get(q);if(Z.size>=this.maxListeners)this._debugLog(\`Warning: Event '\${q}' has exceeded max listeners (\${this.maxListeners})\`);return Z.add(Q),()=>this.off(q,Q)}once(q,Q){let Z=(..._)=>{this.off(q,Z),Q(..._)};return this.on(q,Z)}off(q,Q){if(!this.listeners.has(q))return;if(Q){if(this.listeners.get(q).delete(Q),this.listeners.get(q).size===0)this.listeners.delete(q)}else this.listeners.delete(q)}emit(q,Q){if(this._debugLog(\`Event emitted: \${q}\`,Q),this.listeners.has(q))this._executeListeners(q,Q);if(q!=="*"&&this.listeners.has("*"))this._executeListeners("*",{event:q,data:Q})}_executeListeners(q,Q){let Z=Array.from(this.listeners.get(q));for(let _ of Z)try{_(Q)}catch($){this._debugLog(\`Error in event listener for \${q}:\`,$),console.error(\`イベントリスナー実行エラー (\${q}):\`,$)}}clear(){this.listeners.clear()}listenerCount(q){return this.listeners.has(q)?this.listeners.get(q).size:0}eventNames(){return Array.from(this.listeners.keys())}_debugLog(...q){if(this.debug)console.log("[EventEmitter]",...q)}}var H=new a;class k extends E{constructor(q,Q={}){super();if(this.storageAdapter=q,this.options={historySize:50,persistValues:!0,maxHistoryAge:3600000,...Q},this.currentValues=new Map,this.valueHistory=new Map,this.listeners=new Map,this.logger=Y.createLogger("ValueRepository"),this.options.persistValues)this._loadFromStorage()}_loadFromStorage(){try{let q=this.storageAdapter.getItem("device_values",{}),Q=this.storageAdapter.getItem("value_history",{});this.logger.debug(\`Loading values for \${Object.keys(q).length} devices\`),Object.entries(q).forEach(([Z,_])=>{if(_)this.currentValues.set(Z,j.fromJSON(_))}),Object.entries(Q).forEach(([Z,_])=>{if(Array.isArray(_))this.valueHistory.set(Z,_.map(($)=>j.fromJSON($)))}),this._cleanupOldData(),this.logger.info(\`Loaded values for \${this.currentValues.size} devices with history\`)}catch(q){this.logger.error("Error loading device values from storage:",q),this.currentValues.clear(),this.valueHistory.clear()}}_saveToStorage(){if(!this.options.persistValues)return!0;try{let q={};this.currentValues.forEach((Z,_)=>{q[_]=Z.toJSON()}),this.storageAdapter.setItem("device_values",q);let Q={};return this.valueHistory.forEach((Z,_)=>{Q[_]=Z.map(($)=>$.toJSON())}),this.storageAdapter.setItem("value_history",Q),!0}catch(q){return this.logger.error("Error saving device values to storage:",q),!1}}async getCurrentValue(q){return this.currentValues.get(q)||null}async getAllCurrentValues(){let q={};return this.currentValues.forEach((Q,Z)=>{q[Z]=Q}),q}async saveValue(q,Q){if(!q)return!1;let Z;if(Q instanceof j)Z=Q;else if(Q&&typeof Q==="object"){let{rawValue:$,normalizedValue:J,timestamp:W}=Q;Z=new j(q,$!==void 0?$:null,J!==void 0?J:null,W||Date.now())}else Z=new j(q,typeof Q==="number"?Q:null);let _=this.currentValues.get(q);if(this.currentValues.set(q,Z),this._addToHistory(q,Z),this.options.persistValues)this._saveToStorage();return this._notifyValueChange(q,Z,_),!0}_addToHistory(q,Q){if(!this.valueHistory.has(q))this.valueHistory.set(q,[]);let Z=this.valueHistory.get(q);if(Z.push(Q),Z.length>this.options.historySize)Z.shift()}_notifyValueChange(q,Q,Z){if(this.listeners.has(q))this.listeners.get(q).forEach((_)=>{try{_(Q,Z)}catch($){this.logger.error(\`Error in value change listener for \${q}:\`,$)}});H.emit("deviceValueChanged",{deviceId:q,value:Q,previousValue:Z})}async getValueHistory(q,Q=100,Z=0){if(!this.valueHistory.has(q))return[];let _=this.valueHistory.get(q);if(Z>=_.length)return[];let $=Math.max(0,_.length-Z-Q),J=Math.max(0,_.length-Z);return _.slice($,J).reverse()}async getValuesByTimeRange(q,Q,Z){if(!this.valueHistory.has(q))return[];return this.valueHistory.get(q).filter(($)=>{return $.timestamp>=Q&&$.timestamp<=Z})}async clearHistory(q){if(this.valueHistory.has(q)){if(this.valueHistory.set(q,[]),this.options.persistValues)return this._saveToStorage()}return!0}async clearAllHistory(){if(this.valueHistory.clear(),this.options.persistValues)return this._saveToStorage();return!0}async calculateStatistics(q,Q=3600000){let Z=Date.now(),_=Z-Q,$=await this.getValuesByTimeRange(q,_,Z);if($.length===0)return{count:0,min:null,max:null,average:null,current:null,timestamp:Z};let J=$.map((F)=>F.normalizedValue).filter((F)=>F!==null&&F!==void 0),W=Math.min(...J),G=Math.max(...J),O=J.reduce((F,z)=>F+z,0)/J.length,U=this.currentValues.get(q);return{count:$.length,min:W,max:G,average:O,current:U?U.normalizedValue:null,timestamp:Z}}async pruneOldData(q=null){let Q=q||this.options.maxHistoryAge,Z=Date.now()-Q,_=0;if(this.valueHistory.forEach(($,J)=>{let W=$.filter((G)=>G.timestamp>=Z);_+=$.length-W.length,this.valueHistory.set(J,W)}),_>0&&this.options.persistValues)this._saveToStorage();return _}_cleanupOldData(){this.pruneOldData().then((q)=>{if(q>0)this.logger.debug(\`Cleaned up \${q} old history entries\`)})}subscribeToValueChanges(q,Q){if(!this.listeners.has(q))this.listeners.set(q,[]);return this.listeners.get(q).push(Q),()=>{if(!this.listeners.has(q))return;let Z=this.listeners.get(q),_=Z.indexOf(Q);if(_!==-1){if(Z.splice(_,1),Z.length===0)this.listeners.delete(q)}}}}class R{constructor(q={}){this.maxDevices=q.maxDevices||6,this.deviceTimeoutMs=q.deviceTimeoutMs||1e4,this.defaultDeviceIcon=q.defaultDeviceIcon||null,this.meterType=q.meterType||"circular",this.showValues=q.showValues!==void 0?q.showValues:!0,this.showIcons=q.showIcons!==void 0?q.showIcons:!0,this.showNames=q.showNames!==void 0?q.showNames:!0,this.theme=q.theme||"light",this.interpolationEnabled=q.interpolationEnabled!==void 0?q.interpolationEnabled:!0,this.interpolationTimeMs=q.interpolationTimeMs||200,this.pollingIntervalMs=q.pollingIntervalMs||100,this.loggingEnabled=q.loggingEnabled!==void 0?q.loggingEnabled:!1,this.logLevelVerbose=q.logLevelVerbose!==void 0?q.logLevelVerbose:!1,this.customSettings=q.customSettings||{}}updateSetting(q,Q){if(this.hasOwnProperty(q))return this[q]=Q,!0;else if(q.includes("."))try{let Z=q.split(".");if(Z[0]==="customSettings"){let _=this;for(let $=0;$<Z.length-1;$++){if(_[Z[$]]===void 0)_[Z[$]]={};_=_[Z[$]]}return _[Z[Z.length-1]]=Q,!0}}catch(Z){return!1}return!1}updateSettings(q={}){Object.keys(q).forEach((Q)=>{this.updateSetting(Q,q[Q])})}getSetting(q,Q=null){if(this.hasOwnProperty(q))return this[q];else if(q.includes("."))try{let Z=q.split("."),_=this;for(let $=0;$<Z.length;$++){if(_[Z[$]]===void 0)return Q;_=_[Z[$]]}return _}catch(Z){return Q}return Q}toJSON(){return{maxDevices:this.maxDevices,deviceTimeoutMs:this.deviceTimeoutMs,defaultDeviceIcon:this.defaultDeviceIcon,meterType:this.meterType,showValues:this.showValues,showIcons:this.showIcons,showNames:this.showNames,theme:this.theme,interpolationEnabled:this.interpolationEnabled,interpolationTimeMs:this.interpolationTimeMs,pollingIntervalMs:this.pollingIntervalMs,loggingEnabled:this.loggingEnabled,logLevelVerbose:this.logLevelVerbose,customSettings:this.customSettings}}static fromJSON(q){return new R(q)}}class f{async getAll(){throw Error("Not implemented")}async get(q,Q=null){throw Error("Not implemented")}async set(q,Q){throw Error("Not implemented")}async setAll(q){throw Error("Not implemented")}async remove(q){throw Error("Not implemented")}async reset(){throw Error("Not implemented")}async has(q){throw Error("Not implemented")}async keys(){throw Error("Not implemented")}async exportSettings(q="json"){throw Error("Not implemented")}async importSettings(q,Q="json",Z=!1){throw Error("Not implemented")}watchSettings(q){throw Error("Not implemented")}}class V extends f{constructor(q,Q={}){super();this.storageAdapter=q,this.options={settingsKey:"app_settings",autoSave:!0,...Q},this.settings=new R,this.watchers=[],this.logger=Y.createLogger("SettingsRepository"),this._loadFromStorage()}_loadFromStorage(){try{let q=this.storageAdapter.getItem(this.options.settingsKey);if(q)this.settings=R.fromJSON(q),this.logger.debug("Settings loaded from storage");else this.logger.debug("No stored settings found, using defaults")}catch(q){this.logger.error("Error loading settings from storage:",q),this.settings=new R}}_saveToStorage(){try{return this.storageAdapter.setItem(this.options.settingsKey,this.settings.toJSON()),this.logger.debug("Settings saved to storage"),!0}catch(q){return this.logger.error("Error saving settings to storage:",q),!1}}_notifyChange(q,Q,Z){for(let _ of this.watchers)try{_({key:q,value:Q,oldValue:Z})}catch($){this.logger.error("Error in settings watcher:",$)}H.emit("settingsChanged",{key:q,value:Q,oldValue:Z})}async getAll(){return this.settings.toJSON()}async get(q,Q=null){return this.settings.getSetting(q,Q)}async set(q,Q){let Z=this.settings.getSetting(q);if(Z===Q)return!0;if(!this.settings.updateSetting(q,Q))return this.logger.warn(\`Failed to update setting: \${q}\`),!1;if(this._notifyChange(q,Q,Z),this.options.autoSave)return this._saveToStorage();return!0}async setAll(q){if(!q||typeof q!=="object")return!1;let Q=[];for(let[Z,_]of Object.entries(q)){let $=this.settings.getSetting(Z);if($===_)continue;if(this.settings.updateSetting(Z,_))Q.push({key:Z,value:_,oldValue:$});else this.logger.warn(\`Failed to update setting: \${Z}\`)}for(let Z of Q)this._notifyChange(Z.key,Z.value,Z.oldValue);if(Q.length>0&&this.options.autoSave)return this._saveToStorage();return!0}async remove(q){let Q=this.settings.getSetting(q);if(Q===null)return!0;if(this.settings.updateSetting(q,null)){if(this._notifyChange(q,null,Q),this.options.autoSave)return this._saveToStorage();return!0}return!1}async reset(){let q=this.settings.toJSON();if(this.settings=new R,this._notifyChange("*",this.settings.toJSON(),q),this.options.autoSave)return this._saveToStorage();return!0}async has(q){return this.settings.getSetting(q)!==null}async keys(){let q=this.settings.toJSON();return Object.keys(q)}async exportSettings(q="json"){let Q=this.settings.toJSON();switch(q.toLowerCase()){case"json":return JSON.stringify(Q,null,2);default:return this.logger.warn(\`Unsupported export format: \${q}, using JSON\`),JSON.stringify(Q,null,2)}}async importSettings(q,Q="json",Z=!1){try{let _;switch(Q.toLowerCase()){case"json":_=JSON.parse(q);break;default:return this.logger.warn(\`Unsupported import format: \${Q}\`),!1}let $=this.settings.toJSON();if(Z)this.settings=R.fromJSON(_);else Object.entries(_).forEach(([J,W])=>{this.settings.updateSetting(J,W)});if(this._notifyChange("*",this.settings.toJSON(),$),this.options.autoSave)return this._saveToStorage();return!0}catch(_){return this.logger.error("Error importing settings:",_),!1}}watchSettings(q){if(typeof q!=="function")return()=>{};return this.watchers.push(q),()=>{let Q=this.watchers.indexOf(q);if(Q!==-1)this.watchers.splice(Q,1)}}async persist(){return this._saveToStorage()}}class A{constructor(q,Q=new Date){this.deviceId=q,this.timestamp=Q,this.eventType=this.constructor.name}toJSON(){return{deviceId:this.deviceId,timestamp:this.timestamp,eventType:this.eventType}}}class x extends A{constructor(q,Q={}){super(q);this.deviceInfo=Q}toJSON(){return{...super.toJSON(),deviceInfo:this.deviceInfo}}}class w extends A{constructor(q,Q={}){super(q);this.connectionInfo=Q}toJSON(){return{...super.toJSON(),connectionInfo:this.connectionInfo}}}class y extends A{constructor(q,Q="unknown"){super(q);this.reason=Q}toJSON(){return{...super.toJSON(),reason:this.reason}}}class m extends A{constructor(q,Q,Z=null){super(q);this.value=Q,this.previousValue=Z}calculateChangeRate(){if(!this.previousValue||!this.value||this.value.normalizedValue===null||this.previousValue.normalizedValue===null)return 0;return Math.abs(this.value.normalizedValue-this.previousValue.normalizedValue)/100}toJSON(){return{...super.toJSON(),value:this.value,previousValue:this.previousValue,changeRate:this.calculateChangeRate()}}}class b extends A{constructor(q,Q={}){super(q);this.changes=Q}toJSON(){return{...super.toJSON(),changes:this.changes}}}class g extends A{constructor(q,Q,Z=""){super(q);this.errorCode=Q,this.errorMessage=Z,this.handled=!1}markAsHandled(){this.handled=!0}toJSON(){return{...super.toJSON(),errorCode:this.errorCode,errorMessage:this.errorMessage,handled:this.handled}}}class I extends A{constructor(q="system"){super("all");this.initiator=q}toJSON(){return{...super.toJSON(),initiator:this.initiator}}}class p{constructor(q,Q,Z={}){if(this.deviceRepository=q,this.valueRepository=Q,this.options={maxDevices:6,deviceTimeoutMs:1e4,autoConnect:!0,...Z},this.timeoutCheckTimer=null,this.logger=Y.createLogger("DeviceService"),this.options.deviceTimeoutMs>0)this._startTimeoutCheck()}async registerDevice(q,Q={}){if(!q)throw Error("Device ID is required");this.logger.debug(\`Registering device: \${q}\`);let Z=await this.deviceRepository.getById(q),_=!1;if(!Z){if(await this.deviceRepository.count()>=this.options.maxDevices)throw this.logger.warn(\`Maximum device limit reached (\${this.options.maxDevices})\`),Error(\`Maximum device limit reached (\${this.options.maxDevices})\`);_=!0;let J=Q.name||\`Device \${q}\`;Z=new T(q,J),H.emit("deviceDiscovered",new x(q,Q)),this.logger.info(\`New device created: \${q} (\${J})\`)}if(!Z.connected)Z.connect(),H.emit("deviceConnected",new w(q,{timestamp:Date.now(),isNew:_})),this.logger.info(\`Device connected: \${q}\`);if(Q&&typeof Q==="object")Z.updateMetadata(Q);return await this.deviceRepository.save(Z),Z}async connectDevice(q){let Q=await this.deviceRepository.getById(q);if(!Q)return this.logger.warn(\`Cannot connect non-existent device: \${q}\`),!1;if(Q.connected)return!0;return Q.connect(),H.emit("deviceConnected",new w(q,{timestamp:Date.now(),isReconnect:!0})),await this.deviceRepository.save(Q),this.logger.info(\`Device connected: \${q}\`),!0}async disconnectDevice(q,Q="manual"){let Z=await this.deviceRepository.getById(q);if(!Z)return this.logger.warn(\`Cannot disconnect non-existent device: \${q}\`),!1;if(!Z.connected)return!0;return Z.disconnect(),H.emit("deviceDisconnected",new y(q,Q)),await this.deviceRepository.save(Z),this.logger.info(\`Device disconnected: \${q} (reason: \${Q})\`),!0}async setDeviceName(q,Q){if(!Q||typeof Q!=="string")return this.logger.warn(\`Invalid device name: \${Q}\`),!1;let Z=await this.deviceRepository.getById(q);if(!Z)return this.logger.warn(\`Cannot set name for non-existent device: \${q}\`),!1;let _=Z.name;return Z.setName(Q),H.emit("deviceUpdated",new b(q,{name:{old:_,new:Q}})),await this.deviceRepository.save(Z),this.logger.info(\`Device name updated: \${q} (\${_} -> \${Q})\`),!0}async setDeviceIcon(q,Q){let Z=await this.deviceRepository.getById(q);if(!Z)return this.logger.warn(\`Cannot set icon for non-existent device: \${q}\`),!1;let _=Z.iconUrl;return Z.setIcon(Q),H.emit("deviceUpdated",new b(q,{iconUrl:{old:_,new:Q}})),await this.deviceRepository.save(Z),this.logger.info(\`Device icon updated: \${q}\`),!0}async setDeviceValue(q,Q){let Z=await this.deviceRepository.getById(q);if(!Z)return this.logger.warn(\`Cannot set value for non-existent device: \${q}\`),!1;if(!Z.connected&&this.options.autoConnect)await this.connectDevice(q);let _;if(Q instanceof j)_=Q;else if(typeof Q==="number")_=new j(q,Q);else if(Q&&typeof Q==="object"){let{rawValue:$,normalizedValue:J,timestamp:W}=Q;_=new j(q,$!==void 0?$:null,J!==void 0?J:null,W||Date.now())}else return this.logger.warn(\`Invalid value format for device \${q}\`),!1;return await this.valueRepository.saveValue(q,_),Z.updateLastSeen(),await this.deviceRepository.save(Z),!0}async resetAllDevices(){return await this.deviceRepository.reset(),await this.valueRepository.clearAllHistory(),H.emit("devicesReset",new I),this.logger.info("All devices have been reset"),!0}async getAllDevices(q=!1){if(q)return await this.deviceRepository.getAllConnected();else return await this.deviceRepository.getAll()}async getDeviceInfo(q){let Q=await this.deviceRepository.getById(q);if(!Q)return null;let Z=await this.valueRepository.getCurrentValue(q);return{device:Q,value:Z,lastUpdated:Date.now()}}_startTimeoutCheck(){if(this.timeoutCheckTimer)clearInterval(this.timeoutCheckTimer);let q=Math.max(1000,this.options.deviceTimeoutMs/4);this.timeoutCheckTimer=setInterval(()=>{this._checkDeviceTimeouts().catch((Q)=>{this.logger.error("Error checking device timeouts:",Q)})},q),this.logger.debug(\`Device timeout checker started (interval: \${q}ms)\`)}async _checkDeviceTimeouts(){let q=await this.deviceRepository.getAllConnected();for(let Q of q)if(!Q.isResponsiveWithin(this.options.deviceTimeoutMs)){this.logger.debug(\`Device \${Q.id} timed out (\${this.options.deviceTimeoutMs}ms)\`),await this.disconnectDevice(Q.id,"timeout");let Z=new g(Q.id,"timeout",\`Device timed out after \${this.options.deviceTimeoutMs}ms\`);H.emit("deviceError",Z)}}dispose(){if(this.timeoutCheckTimer)clearInterval(this.timeoutCheckTimer),this.timeoutCheckTimer=null;this.logger.debug("DeviceService disposed")}}class u{constructor(q,Q,Z={}){this.deviceRepository=q,this.valueRepository=Q,this.options={monitoringInterval:100,useWebSocketUpdates:!0,adaptivePolling:!0,minPollingInterval:50,maxPollingInterval:1000,valueChangeThreshold:5,...Z},this.monitoring=!1,this.monitoringTimer=null,this.deviceUpdateTimes=new Map,this.devicePollingIntervals=new Map,this.logger=Y.createLogger("MonitorValuesUseCase")}async monitorDeviceValue(q){try{let Q=await this.deviceRepository.getById(q);if(!Q)return this.logger.debug(\`Device not found: \${q}\`),null;if(!Q.connected)return this.logger.debug(\`Device not connected: \${q}\`),null;let Z=await this.valueRepository.getCurrentValue(q),_=await this.valueRepository.getCurrentValue(q);if(_){if(this.deviceUpdateTimes.set(q,Date.now()),Z&&this._shouldNotifyValueChange(Z,_)){let $=new m(q,_,Z);H.emit("deviceValueUpdated",$)}if(this.options.adaptivePolling)this._adjustPollingInterval(q,Z,_);return _}return null}catch(Q){return this.logger.error(\`Error monitoring device \${q}:\`,Q),null}}async monitorAllDevices(){try{let q=await this.deviceRepository.getAllConnected(),Q=[];for(let Z of q){let _=await this.monitorDeviceValue(Z.id);if(_)Q.push({deviceId:Z.id,value:_})}return Q}catch(q){return this.logger.error("Error monitoring all devices:",q),[]}}startMonitoring(q=null){if(this.monitoring)return this.logger.debug("Monitoring already started"),!1;let Q=q||this.options.monitoringInterval;return this.monitoring=!0,this.logger.info(\`Starting monitoring with interval: \${Q}ms\`),this.monitoringTimer=setInterval(()=>{this.monitorAllDevices().catch((Z)=>{this.logger.error("Error in monitoring loop:",Z)})},Q),H.emit("monitoringStarted",{interval:Q}),!0}stopMonitoring(){if(!this.monitoring)return this.logger.debug("Monitoring not running"),!1;if(this.monitoring=!1,this.monitoringTimer)clearInterval(this.monitoringTimer),this.monitoringTimer=null;return this.logger.info("Monitoring stopped"),H.emit("monitoringStopped",{}),!0}getMonitoringStatus(){return{monitoring:this.monitoring,interval:this.options.monitoringInterval,deviceCount:this.deviceUpdateTimes.size}}handleWebSocketUpdate(q,Q){if(!q||!Q)return;this.valueRepository.saveValue(q,Q).catch((Z)=>{this.logger.error(\`Error saving WebSocket update for device \${q}:\`,Z)})}_shouldNotifyValueChange(q,Q){if(!q||!Q)return!0;let Z=q.normalizedValue,_=Q.normalizedValue;if(Z===null||_===null)return!0;return Math.abs(_-Z)>=this.options.valueChangeThreshold}_adjustPollingInterval(q,Q,Z){if(!Q||!Z)return;let _=this.devicePollingIntervals.get(q)||this.options.monitoringInterval,$=0;if(Q.normalizedValue!==null&&Z.normalizedValue!==null)$=Math.abs(Z.normalizedValue-Q.normalizedValue)/100;let J;if($>0.1)J=this.options.minPollingInterval;else if($>0.05)J=Math.max(this.options.minPollingInterval,this.options.monitoringInterval*0.75);else if($>0.01)J=this.options.monitoringInterval;else J=Math.min(this.options.maxPollingInterval,_*1.25);J=Math.max(this.options.minPollingInterval,Math.min(J,this.options.maxPollingInterval)),this.devicePollingIntervals.set(q,J)}}class l{constructor(q,Q,Z={}){this.sessionRepository=q,this.valueRepository=Q,this.options={autoSave:!0,maxRecordingTime:3600000,maxEntries:1e4,compressionEnabled:!1,...Z},this.isRecording=!1,this.currentSessionId=null,this.startTime=null,this.entries=[],this.autoStopTimer=null,this.deviceValueSubscriptions=new Map,this.logger=Y.createLogger("RecordSessionUseCase")}async startRecording(q={}){if(this.isRecording)return this.logger.warn("Recording already in progress"),!1;let Q=\`session_\${Date.now()}\`;if(this.currentSessionId=Q,this.isRecording=!0,this.startTime=Date.now(),this.entries=[],this.logger.info(\`Starting recording session: \${Q}\`),q&&Object.keys(q).length>0)for(let Z in q){let _=q[Z];this.recordDeviceData(Z,_)}return this._subscribeToDeviceValues(),this._setupAutoStop(),H.emit("recordingStarted",{sessionId:Q,startTime:this.startTime}),!0}async stopRecording(q=!0){if(!this.isRecording)return this.logger.warn("No active recording to stop"),[];this.isRecording=!1;let Q=[...this.entries],Z=this.currentSessionId,_=Date.now(),$=_-this.startTime;if(this.logger.info(\`Stopping recording session: \${Z} (duration: \${$}ms, entries: \${Q.length})\`),this.autoStopTimer)clearTimeout(this.autoStopTimer),this.autoStopTimer=null;if(this._unsubscribeFromDeviceValues(),q&&this.options.autoSave&&Z)await this.sessionRepository.saveSession(Z,{startTime:this.startTime,endTime:_,duration:$,entryCount:Q.length,entries:Q}),this.logger.info(\`Saved recording session: \${Z}\`);return H.emit("recordingStopped",{sessionId:Z,duration:$,entriesCount:Q.length}),this.currentSessionId=null,this.startTime=null,this.entries=[],Q}recordDeviceData(q,Q){if(!this.isRecording)return this.logger.debug("Cannot record data: no active recording session"),!1;if(!q)return this.logger.warn("Invalid device ID for recording"),!1;if(this.entries.length>=this.options.maxEntries)return this.logger.warn(\`Maximum entries (\${this.options.maxEntries}) reached, stopping recording\`),this.stopRecording().catch((J)=>{this.logger.error("Error stopping recording:",J)}),!1;let Z=Date.now(),_=Z-this.startTime,$={deviceId:q,value:Q,timestamp:Z,relativeTime:_};return this.entries.push($),H.emit("entryRecorded",{entry:$,sessionId:this.currentSessionId,entriesCount:this.entries.length}),!0}getRecordingStatus(){return{isRecording:this.isRecording,sessionId:this.currentSessionId,startTime:this.startTime,recordCount:this.entries.length,elapsedTime:this.startTime?Date.now()-this.startTime:0,maxEntries:this.options.maxEntries,maxRecordingTime:this.options.maxRecordingTime}}async saveRecordedData(q=null,Q=null){let Z=q||this.entries;if(!Z.length)return this.logger.warn("No data to save"),!1;let $=\`recording_\${new Date().toISOString().replace(/[:.]/g,"-")}.json\`,J=Q||$;try{let W={metadata:{version:"1.0",createdAt:new Date().toISOString(),deviceCount:new Set(Z.map((X)=>X.deviceId)).size,entriesCount:Z.length,startTime:this.startTime,endTime:Date.now()},entries:this._formatEntriesForExport(Z)},G=await this.sessionRepository.exportSession(W,J);if(G)this.logger.info(\`Recording saved to \${J} (\${Z.length} entries)\`),H.emit("recordingSaved",{filename:J,entriesCount:Z.length});else this.logger.error(\`Failed to save recording to \${J}\`);return G}catch(W){return this.logger.error("Failed to save recording:",W),!1}}async getRecordedSessions(q=10){try{return await this.sessionRepository.getSessions(q)}catch(Q){return this.logger.error("Error getting recorded sessions:",Q),[]}}async loadSession(q){try{return await this.sessionRepository.getSession(q)}catch(Q){return this.logger.error(\`Error loading session \${q}:\`,Q),null}}_subscribeToDeviceValues(){this._unsubscribeFromDeviceValues(),H.on("deviceValueChanged",this._handleDeviceValueChanged.bind(this))}_unsubscribeFromDeviceValues(){H.off("deviceValueChanged",this._handleDeviceValueChanged.bind(this)),this.deviceValueSubscriptions.forEach((q)=>{q()}),this.deviceValueSubscriptions.clear()}_handleDeviceValueChanged(q){if(!q||!q.deviceId||!q.value)return;this.recordDeviceData(q.deviceId,q.value)}_formatEntriesForExport(q){return q.map((Q)=>({deviceId:Q.deviceId,value:this._extractValueForExport(Q.value),timestamp:Q.timestamp,relativeTime:Q.relativeTime}))}_extractValueForExport(q){if(!q)return null;if(q.toJSON&&typeof q.toJSON==="function")return q.toJSON();if(q.rawValue!==void 0||q.normalizedValue!==void 0)return{raw:q.rawValue!==void 0?q.rawValue:null,normalized:q.normalizedValue!==void 0?q.normalizedValue:null,timestamp:q.timestamp||null};if(typeof q==="number")return{raw:q,normalized:null};return q}_setupAutoStop(){if(this.autoStopTimer)clearTimeout(this.autoStopTimer);this.autoStopTimer=setTimeout(()=>{if(this.isRecording)this.logger.warn(\`Maximum recording time (\${this.options.maxRecordingTime}ms) reached, stopping recording\`),this.stopRecording().catch((q)=>{this.logger.error("Error during auto-stop:",q)})},this.options.maxRecordingTime)}}class c{constructor(q,Q,Z={}){this.sessionRepository=q,this.valueRepository=Q,this.options={autoRewind:!0,replaySpeedMultiplier:1,liveMode:!1,...Z},this.isPlaying=!1,this.isPaused=!1,this.currentSessionId=null,this.sessionData=null,this.currentIndex=0,this.startTime=null,this.playbackTimer=null,this.nextEntryTimeout=null,this.logger=Y.createLogger("ReplaySessionUseCase")}async loadSession(q){try{if(this.isPlaying)this.stop();this.logger.info(\`Loading session: \${q}\`);let Q=await this.sessionRepository.getSession(q);if(!Q||!Q.entries||!Q.entries.length)return this.logger.warn(\`No valid data in session: \${q}\`),!1;let Z=[...Q.entries].sort((_,$)=>{return _.relativeTime-$.relativeTime});return this.currentSessionId=q,this.sessionData={...Q,entries:Z},this.currentIndex=0,this.startTime=null,this.logger.info(\`Loaded session with \${Z.length} entries\`),H.emit("sessionLoaded",{sessionId:q,entryCount:Z.length,duration:this.getSessionDuration()}),!0}catch(Q){return this.logger.error(\`Error loading session \${q}:\`,Q),!1}}play(){if(!this.sessionData||this.sessionData.entries.length===0)return this.logger.warn("No session data loaded"),!1;if(this.isPlaying&&!this.isPaused)return!0;if(this.isPlaying&&this.isPaused)return this.isPaused=!1,this.startTime=Date.now()-this._getAdjustedTimeForCurrentIndex(),this.logger.info(\`Resuming playback at index \${this.currentIndex}\`),this._scheduleNextEntry(),H.emit("playbackResumed",{sessionId:this.currentSessionId,currentIndex:this.currentIndex,progress:this._calculateProgress()}),!0;if(this.currentIndex>=this.sessionData.entries.length)this.rewind();return this.isPlaying=!0,this.isPaused=!1,this.startTime=Date.now(),this.logger.info(\`Starting playback from index \${this.currentIndex}\`),this._scheduleNextEntry(),H.emit("playbackStarted",{sessionId:this.currentSessionId,entryCount:this.sessionData.entries.length}),!0}pause(){if(!this.isPlaying||this.isPaused)return!1;if(this.isPaused=!0,this.nextEntryTimeout)clearTimeout(this.nextEntryTimeout),this.nextEntryTimeout=null;return this.logger.info(\`Paused playback at index \${this.currentIndex}\`),H.emit("playbackPaused",{sessionId:this.currentSessionId,currentIndex:this.currentIndex,progress:this._calculateProgress()}),!0}stop(){if(!this.isPlaying)return!1;if(this.nextEntryTimeout)clearTimeout(this.nextEntryTimeout),this.nextEntryTimeout=null;let q=this.isPlaying;if(this.isPlaying=!1,this.isPaused=!1,q)this.logger.info("Stopped playback"),H.emit("playbackStopped",{sessionId:this.currentSessionId,currentIndex:this.currentIndex,progress:this._calculateProgress()});return!0}rewind(){if(!this.sessionData)return!1;let q=this.isPlaying&&!this.isPaused;if(q)this.stop();if(this.currentIndex=0,this.startTime=null,this.logger.info("Rewound playback to beginning"),H.emit("playbackRewound",{sessionId:this.currentSessionId}),q)return this.play();return!0}seekToPosition(q){if(!this.sessionData||!this.sessionData.entries.length)return!1;q=Math.max(0,Math.min(1,q));let Q=this.isPlaying&&!this.isPaused;if(Q)this.stop();let _=this.getSessionDuration()*q,$=0;for(let J=0;J<this.sessionData.entries.length;J++)if(this.sessionData.entries[J].relativeTime<=_)$=J;else break;if(this.currentIndex=$,this.logger.info(\`Seeked to position \${q.toFixed(2)} (index: \${$})\`),H.emit("playbackSeeked",{sessionId:this.currentSessionId,currentIndex:this.currentIndex,position:q,time:_}),Q)return this.play();return!0}setPlaybackSpeed(q){if(q<=0)return!1;let Q=this.options.replaySpeedMultiplier;if(this.options.replaySpeedMultiplier=q,this.isPlaying&&!this.isPaused){let _=this._getAdjustedTimeForCurrentIndex();this.stop(),this.startTime=Date.now()-_,this.play()}return this.logger.info(\`Playback speed changed from \${Q}x to \${q}x\`),H.emit("playbackSpeedChanged",{sessionId:this.currentSessionId,oldSpeed:Q,newSpeed:q}),!0}setLiveMode(q){let Q=this.options.liveMode;return this.options.liveMode=Boolean(q),this.logger.info(\`Live mode \${q?"enabled":"disabled"}\`),H.emit("liveModeChanged",{sessionId:this.currentSessionId,enabled:this.options.liveMode}),Q!==this.options.liveMode}getPlaybackStatus(){if(!this.sessionData)return{loaded:!1,isPlaying:!1,isPaused:!1,sessionId:null,entryCount:0,currentIndex:0,progress:0,speed:this.options.replaySpeedMultiplier,liveMode:this.options.liveMode};return{loaded:!0,isPlaying:this.isPlaying,isPaused:this.isPaused,sessionId:this.currentSessionId,entryCount:this.sessionData.entries.length,currentIndex:this.currentIndex,progress:this._calculateProgress(),currentTime:this._getAdjustedTimeForCurrentIndex(),totalDuration:this.getSessionDuration(),speed:this.options.replaySpeedMultiplier,liveMode:this.options.liveMode}}getSessionDuration(){if(!this.sessionData||!this.sessionData.entries.length)return 0;return this.sessionData.entries[this.sessionData.entries.length-1].relativeTime||0}_scheduleNextEntry(){if(!this.isPlaying||this.isPaused||!this.sessionData)return;if(this.nextEntryTimeout)clearTimeout(this.nextEntryTimeout),this.nextEntryTimeout=null;if(this.currentIndex>=this.sessionData.entries.length){this._handlePlaybackComplete();return}let q=this.sessionData.entries[this.currentIndex],Q=Date.now()-this.startTime,Z=q.relativeTime/this.options.replaySpeedMultiplier,_=Math.max(0,Z-Q);this.nextEntryTimeout=setTimeout(()=>{this._playEntry(q),this.currentIndex++,this._scheduleNextEntry()},_)}_playEntry(q){if(!q||!q.deviceId)return;try{let Q=this.options.liveMode?Date.now():q.timestamp;if(this._sendValueToDevice(q.deviceId,q.value,Q),H.emit("entryPlayed",{deviceId:q.deviceId,value:q.value,index:this.currentIndex,progress:this._calculateProgress(),timestamp:Q}),this.currentIndex%10===0||this.currentIndex===this.sessionData.entries.length-1)H.emit("playbackProgress",{sessionId:this.currentSessionId,currentIndex:this.currentIndex,totalEntries:this.sessionData.entries.length,progress:this._calculateProgress()})}catch(Q){this.logger.error(\`Error playing entry at index \${this.currentIndex}:\`,Q)}}_sendValueToDevice(q,Q,Z){let _=this._normalizeValue(Q);this.valueRepository.saveValue(q,{..._,timestamp:Z}).catch(($)=>{this.logger.error(\`Error sending value to device \${q}:\`,$)})}_normalizeValue(q){if(!q)return{rawValue:null,normalizedValue:null};if(q.rawValue!==void 0||q.normalizedValue!==void 0)return{rawValue:q.rawValue!==void 0?q.rawValue:null,normalizedValue:q.normalizedValue!==void 0?q.normalizedValue:null};if(q.raw!==void 0||q.normalized!==void 0)return{rawValue:q.raw!==void 0?q.raw:null,normalizedValue:q.normalized!==void 0?q.normalized:null};if(typeof q==="number")return{rawValue:q,normalizedValue:q};return{rawValue:null,normalizedValue:null,...q}}_calculateProgress(){if(!this.sessionData||!this.sessionData.entries.length)return 0;if(this.currentIndex>=this.sessionData.entries.length)return 1;return this.currentIndex/this.sessionData.entries.length}_getAdjustedTimeForCurrentIndex(){if(!this.sessionData||!this.sessionData.entries.length||this.currentIndex===0)return 0;if(this.currentIndex>=this.sessionData.entries.length)return this.getSessionDuration()/this.options.replaySpeedMultiplier;return this.sessionData.entries[this.currentIndex].relativeTime/this.options.replaySpeedMultiplier}_handlePlaybackComplete(){if(this.isPlaying=!1,this.isPaused=!1,this.logger.info("Playback completed"),H.emit("playbackCompleted",{sessionId:this.currentSessionId,entryCount:this.sessionData.entries.length}),this.options.autoRewind)this.logger.info("Auto-rewinding playback"),setTimeout(()=>{this.rewind()},500)}}class s{constructor(q={}){this.options={maxDevices:6,interpolationTime:200,iconVisibilityTimeout:5000,...q},this.logger=Y.createLogger("MeterViewModel"),this.state={values:Array(this.options.maxDevices).fill(null),names:Array(this.options.maxDevices).fill(null),icons:Array(this.options.maxDevices).fill(null),connected:Array(this.options.maxDevices).fill(!1),iconVisible:Array(this.options.maxDevices).fill(!1),lastUpdate:Array(this.options.maxDevices).fill(null)},this.deviceMapping=new Map,this._targetValues=Array(this.options.maxDevices).fill(null),this._startValues=Array(this.options.maxDevices).fill(null),this._startTime=Array(this.options.maxDevices).fill(null),this._interpolating=Array(this.options.maxDevices).fill(!1),this._iconTimers=Array(this.options.maxDevices).fill(null),this._setupInterpolationLoop(),this.logger.debug("MeterViewModel initialized")}getOrAssignDeviceIndex(q){if(!q)return-1;if(this.deviceMapping.has(q))return this.deviceMapping.get(q);for(let Q=0;Q<this.options.maxDevices;Q++)if(!this.state.connected[Q])return this.deviceMapping.set(q,Q),this.logger.debug(\`Assigned device \${q} to index \${Q}\`),Q;return this.logger.warn(\`No available slots for device \${q}\`),-1}getDeviceIndex(q){return this.deviceMapping.has(q)?this.deviceMapping.get(q):-1}getDeviceIdByIndex(q){if(q<0||q>=this.options.maxDevices)return null;for(let[Q,Z]of this.deviceMapping.entries())if(Z===q)return Q;return null}setValue(q,Q,Z=!0){if(q<0||q>=this.options.maxDevices)return!1;if(this.state.connected[q]!==Z){if(this.state.connected[q]=Z,this.state.lastUpdate[q]=Z?Date.now():null,!Z)return this._setValueDirectly(q,null),this._hideIcon(q),!0}if(Q===null||Q===void 0)return!1;if(this.state.values[q]===null||Math.abs((this.state.values[q]||0)-Q)<1)return this._setValueDirectly(q,Q),!0;return this._startInterpolation(q,Q),!0}setName(q,Q){if(q<0||q>=this.options.maxDevices)return!1;if(this.state.names[q]!==Q)return this.state.names[q]=Q,this.state.lastUpdate[q]=Date.now(),this._notifyChange(),!0;return!1}setIcon(q,Q){if(q<0||q>=this.options.maxDevices)return!1;if(this.state.icons[q]!==Q)return this.state.icons[q]=Q,this.state.lastUpdate[q]=Date.now(),this._showIcon(q),!0;return!1}_showIcon(q){if(q<0||q>=this.options.maxDevices)return;if(this._iconTimers[q])clearTimeout(this._iconTimers[q]),this._iconTimers[q]=null;if(this.state.iconVisible[q]=!0,this._notifyChange(),this.options.iconVisibilityTimeout>0)this._iconTimers[q]=setTimeout(()=>{this._hideIcon(q)},this.options.iconVisibilityTimeout)}_hideIcon(q){if(q<0||q>=this.options.maxDevices)return;if(this._iconTimers[q])clearTimeout(this._iconTimers[q]),this._iconTimers[q]=null;if(this.state.iconVisible[q])this.state.iconVisible[q]=!1,this._notifyChange()}reset(){return this._iconTimers.forEach((q,Q)=>{if(q)clearTimeout(q),this._iconTimers[Q]=null}),this.state.values=Array(this.options.maxDevices).fill(null),this.state.connected=Array(this.options.maxDevices).fill(!1),this.state.iconVisible=Array(this.options.maxDevices).fill(!1),this.state.lastUpdate=Array(this.options.maxDevices).fill(null),this.state.names=Array(this.options.maxDevices).fill(null),this.state.icons=Array(this.options.maxDevices).fill(null),this.deviceMapping.clear(),this._targetValues=Array(this.options.maxDevices).fill(null),this._startValues=Array(this.options.maxDevices).fill(null),this._startTime=Array(this.options.maxDevices).fill(null),this._interpolating=Array(this.options.maxDevices).fill(!1),this.logger.debug("MeterViewModel reset"),this._notifyChange(),!0}onChange(q){return H.on("meterViewModel:change",q)}getConnectedDeviceIndices(){return this.state.connected.map((q,Q)=>q?Q:-1).filter((q)=>q!==-1)}_setValueDirectly(q,Q){if(this.state.values[q]!==Q)this.state.values[q]=Q,this.state.lastUpdate[q]=Date.now(),this._interpolating[q]=!1,this._notifyChange()}_startInterpolation(q,Q){this._startValues[q]=this.state.values[q]||0,this._targetValues[q]=Q,this._startTime[q]=performance.now(),this._interpolating[q]=!0,this.state.lastUpdate[q]=Date.now()}_setupInterpolationLoop(){let q=()=>{let Q=performance.now(),Z=!1;for(let _=0;_<this.options.maxDevices;_++){if(!this._interpolating[_])continue;let $=Q-this._startTime[_],J=Math.min($/this.options.interpolationTime,1);if(J>=1)this.state.values[_]=this._targetValues[_],this._interpolating[_]=!1;else this.state.values[_]=this._startValues[_]+(this._targetValues[_]-this._startValues[_])*J;Z=!0}if(Z)this._notifyChange();requestAnimationFrame(q)};requestAnimationFrame(q)}_notifyChange(){H.emit("meterViewModel:change",{...this.state})}dispose(){this._iconTimers.forEach((q,Q)=>{if(q)clearTimeout(q),this._iconTimers[Q]=null}),this.logger.debug("MeterViewModel disposed")}}class r{constructor(q,Q={}){this.container=q,this.svgNamespace="http://www.w3.org/2000/svg",this.svg=null,this.config={size:Q.size||500,padding:Q.padding||20,centerRadius:Q.centerRadius||40,trackWidth:Q.trackWidth||50,trackGap:Q.trackGap||10,textOffset:Q.textOffset||15,iconSize:Q.iconSize||20,...Q},this.laneConfig={colors:Q.colors||["#4CAF50","#2196F3","#FFC107","#E91E63","#9C27B0","#FF5722"],positions:[]},this.logger=Y.createLogger("MeterRenderer"),this._initialize()}_initialize(){if(this.container)this.container.innerHTML="";if(this.svg=document.createElementNS(this.svgNamespace,"svg"),this.svg.setAttribute("width",this.config.size),this.svg.setAttribute("height",this.config.size),this.svg.setAttribute("viewBox",\`0 0 \${this.config.size} \${this.config.size}\`),this.svg.setAttribute("data-meter","true"),this.svg.setAttribute("role","img"),this.svg.setAttribute("aria-label","デバイス値表示メーター"),this._createBackground(),this.container)this.container.appendChild(this.svg);this.logger.debug("MeterRenderer initialized")}_createBackground(){let q=this.config.size/2,Q=this.config.size/2,Z=document.createElementNS(this.svgNamespace,"circle");Z.setAttribute("cx",q),Z.setAttribute("cy",Q),Z.setAttribute("r",q-this.config.padding),Z.setAttribute("fill","#f5f5f5"),Z.setAttribute("stroke","#e0e0e0"),Z.setAttribute("stroke-width","1");let _=document.createElementNS(this.svgNamespace,"circle");_.setAttribute("cx",q),_.setAttribute("cy",Q),_.setAttribute("r",this.config.centerRadius),_.setAttribute("fill","#e0e0e0"),_.setAttribute("stroke","#d0d0d0"),_.setAttribute("stroke-width","1"),this.svg.appendChild(Z),this.svg.appendChild(_)}update(q){if(!q)return;let Q=this.config.size/2,Z=this.config.size/2;this._clearLanes();let _=q.connected.map((W,G)=>W?G:-1).filter((W)=>W!==-1),$=_.length,J=$>0?2*Math.PI/$:0;_.forEach((W,G)=>{let X=q.values[W];if(X===null||X===void 0)return;let O=q.names[W],U=q.icons[W],F=q.iconVisible[W],z=G*J-Math.PI/2,K=this.laneConfig.colors[W%this.laneConfig.colors.length];if(this._drawLane(Q,Z,z,X,O,K,W),U&&F)this._drawIcon(Q,Z,z,X,U,W)}),this.logger.debug("MeterRenderer updated")}_drawLane(q,Q,Z,_,$,J,W){let G=Math.max(0,Math.min(100,_))/100,X=q-this.config.padding-this.config.trackWidth/2,O=1.8*Math.PI,U=Z-O/2,F=U+O*G,z=this._createArcPath(q,Q,X,U,F,this.config.trackWidth),K=document.createElementNS(this.svgNamespace,"path");K.setAttribute("d",z),K.setAttribute("fill","none"),K.setAttribute("stroke",J),K.setAttribute("stroke-width",this.config.trackWidth),K.setAttribute("stroke-linecap","round"),K.setAttribute("data-device-index",W);let N=document.createElementNS(this.svgNamespace,"text");if(N.setAttribute("x",q+X*Math.cos(Z)),N.setAttribute("y",Q+X*Math.sin(Z)+this.config.textOffset),N.setAttribute("text-anchor","middle"),N.setAttribute("fill","#333"),N.setAttribute("font-size","16"),N.textContent=Math.round(_),$){let M=document.createElementNS(this.svgNamespace,"text");M.setAttribute("x",q+X*Math.cos(Z)),M.setAttribute("y",Q+X*Math.sin(Z)-5),M.setAttribute("text-anchor","middle"),M.setAttribute("fill","#666"),M.setAttribute("font-size","14"),M.textContent=$,this.svg.appendChild(M)}this.svg.appendChild(K),this.svg.appendChild(N)}_drawIcon(q,Q,Z,_,$,J){let W=Math.max(0,Math.min(100,_))/100,G=q-this.config.padding-this.config.trackWidth/2,X=1.8*Math.PI,O=Z-X/2+X*W,U=q+G*Math.cos(O),F=Q+G*Math.sin(O),z=document.createElementNS(this.svgNamespace,"g");z.setAttribute("transform",\`translate(\${U},\${F})\`),z.setAttribute("data-device-index",J),z.setAttribute("class","device-icon");let K=document.createElementNS(this.svgNamespace,"circle");K.setAttribute("r","15"),K.setAttribute("fill","white"),K.setAttribute("stroke","#ccc"),K.setAttribute("stroke-width","1");let N=document.createElementNS(this.svgNamespace,"image");N.setAttribute("x","-10"),N.setAttribute("y","-10"),N.setAttribute("width","20"),N.setAttribute("height","20"),N.setAttribute("href",$),N.setAttribute("preserveAspectRatio","xMidYMid meet"),z.appendChild(K),z.appendChild(N),this.svg.appendChild(z)}_createArcPath(q,Q,Z,_,$,J){let W=Z-J/2,G=Z+J/2,X=q+W*Math.cos(_),O=Q+W*Math.sin(_),U=q+W*Math.cos($),F=Q+W*Math.sin($),z=q+G*Math.cos(_),K=Q+G*Math.sin(_),N=q+G*Math.cos($),M=Q+G*Math.sin($),d=$-_<=Math.PI?0:1;return["M",X,O,"A",W,W,0,d,1,U,F,"L",N,M,"A",G,G,0,d,0,z,K,"Z"].join(" ")}_clearLanes(){[...this.svg.querySelectorAll("path"),...this.svg.querySelectorAll("text[data-device-index]"),...this.svg.querySelectorAll("text:not([data-device-index])"),...this.svg.querySelectorAll(".device-icon"),...this.svg.querySelectorAll("g[data-device-index]")].forEach((Q)=>{Q.remove()})}getSVGElement(){return this.svg}resize(q,Q){if(!this.svg)return;let Z=Math.min(q,Q);this.config.size=Z,this.svg.setAttribute("width",Z),this.svg.setAttribute("height",Z),this.svg.setAttribute("viewBox",\`0 0 \${Z} \${Z}\`),this._clearLanes(),this._createBackground(),this.logger.debug(\`MeterRenderer resized to \${Z}x\${Z}\`)}dispose(){if(this.container&&this.svg)this.container.removeChild(this.svg);this.svg=null,this.logger.debug("MeterRenderer disposed")}}class v{constructor(q){this.monitorUseCase=q.monitorUseCase,this.deviceService=q.deviceService,this.meterViewModel=q.meterViewModel,this.meterRenderer=q.meterRenderer,this.webSocketClient=q.webSocketClient,this.storageAdapter=q.storageAdapter,this.recordSessionUseCase=q.recordSessionUseCase||null,this.replaySessionUseCase=q.replaySessionUseCase||null,this.settingsRepository=q.settingsRepository||null,this.updateInterval=null,this.monitoringEnabled=!1,this.recordingEnabled=!1,this.replayingEnabled=!1,this.logger=Y.createLogger("AppController"),this.options={monitorInterval:100,webSocketUrl:q.webSocketUrl||"ws://localhost:8123",autoConnect:!0,...q.options},this._setupEventHandlers(),this.logger.debug("AppController initialized")}async start(){this.logger.info("Starting application...");try{if(this._setupViewModelBinding(),this.options.autoConnect&&this.webSocketClient)await this._connectWebSocket();if(this.monitorUseCase)this.startMonitoring();return H.emit("appStarted",{timestamp:Date.now()}),this.logger.info("Application started successfully"),!0}catch(q){return this.logger.error("Error starting application:",q),!1}}_setupViewModelBinding(){if(this.meterViewModel&&this.meterRenderer)this.meterViewModel.onChange((q)=>{this.meterRenderer.update(q)}),this.logger.debug("ViewModel binding setup complete")}async _connectWebSocket(){if(!this.webSocketClient){this.logger.warn("WebSocketClient not available");return}try{await this.webSocketClient.connect(),this.logger.info("WebSocket connected successfully"),this.webSocketClient.subscribe("device",this._handleDeviceMessage.bind(this)),this.webSocketClient.subscribe("device_disconnected",this._handleDeviceDisconnected.bind(this))}catch(q){throw this.logger.error("WebSocket connection error:",q),q}}_handleDeviceMessage(q){if(!q||!q.device_id||!q.data){this.logger.debug("Invalid device message received");return}let{device_id:Q,data:Z}=q;this.logger.debug(\`Device message received from \${Q}:\`,Z),this.deviceService.registerDevice(Q,{name:q.name}).then((_)=>{let $=this.meterViewModel.getOrAssignDeviceIndex(Q);if($>=0){if(_.name)this.meterViewModel.setName($,_.name);if(_.iconUrl)this.meterViewModel.setIcon($,_.iconUrl);let J=null;if(typeof Z.value==="number")J=Z.value;else if(typeof Z.smoothed==="number")J=Z.smoothed;else if(typeof Z.raw==="number")J=Z.raw;else if(typeof Z.calibrated_value==="number")J=Z.calibrated_value;if(J!==null){if(this.meterViewModel.setValue($,J,!0),this.recordingEnabled&&this.recordSessionUseCase)this.recordSessionUseCase.recordDeviceData(Q,{rawValue:J})}}}).catch((_)=>{this.logger.error(\`Error handling device message for \${Q}:\`,_)})}_handleDeviceDisconnected(q){if(!q||!q.device_id){this.logger.debug("Invalid device disconnection message received");return}let Q=q.device_id;this.logger.debug(\`Device disconnected: \${Q}\`);let Z=this.meterViewModel.getDeviceIndex(Q);if(Z>=0)this.meterViewModel.setValue(Z,null,!1),this.deviceService.disconnectDevice(Q,"websocket_disconnect").catch((_)=>{this.logger.error(\`Error disconnecting device \${Q}:\`,_)})}_setupEventHandlers(){if(H.on("deviceConnected",this._handleDeviceConnected.bind(this)),H.on("deviceDisconnected",this._handleDeviceDisconnected.bind(this)),H.on("deviceUpdated",this._handleDeviceUpdated.bind(this)),H.on("deviceValueUpdated",this._handleDeviceValueUpdated.bind(this)),H.on("deviceError",this._handleDeviceError.bind(this)),H.on("devicesReset",this._handleDevicesReset.bind(this)),typeof window<"u")window.addEventListener("resize",this._handleWindowResize.bind(this));this.logger.debug("Event handlers setup complete")}_handleDeviceConnected(q){let{deviceId:Q}=q;this.logger.debug(\`Device connected event: \${Q}\`),this.deviceService.getDeviceInfo(Q).then((Z)=>{if(!Z||!Z.device)return;let _=Z.device,$=this.meterViewModel.getOrAssignDeviceIndex(Q);if($>=0){if(this.meterViewModel.setName($,_.name),_.iconUrl)this.meterViewModel.setIcon($,_.iconUrl);if(Z.value){let J=Z.value.normalizedValue||Z.value.rawValue;if(J!==null&&J!==void 0)this.meterViewModel.setValue($,J,!0)}}}).catch((Z)=>{this.logger.error(\`Error handling device connected event for \${Q}:\`,Z)})}_handleDeviceDisconnected(q){let{deviceId:Q}=q;this.logger.debug(\`Device disconnected event: \${Q}\`);let Z=this.meterViewModel.getDeviceIndex(Q);if(Z>=0)this.meterViewModel.setValue(Z,null,!1)}_handleDeviceUpdated(q){let{deviceId:Q,device:Z}=q;if(this.logger.debug(\`Device updated event: \${Q}\`),!Z)return;let _=this.meterViewModel.getDeviceIndex(Q);if(_>=0){if(Z.name)this.meterViewModel.setName(_,Z.name);if(Z.iconUrl)this.meterViewModel.setIcon(_,Z.iconUrl)}}_handleDeviceValueUpdated(q){let{deviceId:Q,value:Z}=q;if(!Z)return;let _=this.meterViewModel.getDeviceIndex(Q);if(_>=0){let $=Z.normalizedValue!==void 0?Z.normalizedValue:null,J=Z.rawValue!==void 0?Z.rawValue:null;if($!==null)this.meterViewModel.setValue(_,$,!0);else if(J!==null)this.meterViewModel.setValue(_,J,!0)}}_handleDeviceError(q){let{deviceId:Q,errorType:Z,errorMessage:_}=q;if(this.logger.warn(\`Device error: \${Q} - \${Z}: \${_}\`),Z==="timeout"){let $=this.meterViewModel.getDeviceIndex(Q);if($>=0)this.meterViewModel.setValue($,null,!1)}}_handleDevicesReset(){this.logger.debug("Devices reset event received"),this.meterViewModel.reset()}_handleWindowResize(){if(this.meterRenderer&&this.meterRenderer.resize){let q=this.meterRenderer.container;if(q){let{clientWidth:Q,clientHeight:Z}=q;this.meterRenderer.resize(Q,Z)}}}startMonitoring(){if(this.monitoringEnabled||!this.monitorUseCase)return!1;return this.monitoringEnabled=!0,this.logger.info("Starting device monitoring"),this.monitorUseCase.startMonitoring(this.options.monitorInterval),H.emit("monitoringStarted",{interval:this.options.monitorInterval}),!0}stopMonitoring(){if(!this.monitoringEnabled||!this.monitorUseCase)return!1;return this.monitoringEnabled=!1,this.logger.info("Stopping device monitoring"),this.monitorUseCase.stopMonitoring(),H.emit("monitoringStopped",{}),!0}async startRecording(){if(this.recordingEnabled||!this.recordSessionUseCase)return!1;this.logger.info("Starting recording session");let q={},Q=await this.deviceService.getAllDevices(!0);for(let _ of Q){let $=await this.deviceService.getDeviceInfo(_.id);if($&&$.value)q[_.id]=$.value}if(await this.recordSessionUseCase.startRecording(q))return this.recordingEnabled=!0,this.logger.info("Recording started successfully"),!0;else return this.logger.warn("Failed to start recording"),!1}async stopRecording(){if(!this.recordingEnabled||!this.recordSessionUseCase)return!1;this.logger.info("Stopping recording session");let q=await this.recordSessionUseCase.stopRecording();if(this.recordingEnabled=!1,q.length>0)return this.logger.info(\`Recording stopped with \${q.length} entries\`),!0;else return this.logger.warn("Recording stopped with no entries"),!1}async startReplay(q){if(this.replayingEnabled||!this.replaySessionUseCase)return!1;this.logger.info(\`Starting replay for session: \${q}\`);let Q=this.monitoringEnabled;if(Q)this.stopMonitoring();if(await this.replaySessionUseCase.loadSession(q))return this.replaySessionUseCase.play(),this.replayingEnabled=!0,this.logger.info("Replay started successfully"),!0;else{if(Q)this.startMonitoring();return this.logger.warn(\`Failed to load session: \${q}\`),!1}}stopReplay(){if(!this.replayingEnabled||!this.replaySessionUseCase)return!1;return this.logger.info("Stopping replay"),this.replaySessionUseCase.stop(),this.replayingEnabled=!1,this.startMonitoring(),!0}async setDeviceName(q,Q){if(!q||!Q)return!1;if(this.logger.debug(\`Setting device name: \${q} -> \${Q}\`),await this.deviceService.setDeviceName(q,Q)){let _=this.meterViewModel.getDeviceIndex(q);if(_>=0)this.meterViewModel.setName(_,Q);return!0}return!1}async setDeviceIcon(q,Q){if(!q||!Q)return!1;if(this.logger.debug(\`Setting device icon: \${q} -> \${Q}\`),await this.deviceService.setDeviceIcon(q,Q)){let _=this.meterViewModel.getDeviceIndex(q);if(_>=0)this.meterViewModel.setIcon(_,Q);return!0}return!1}async resetDevices(){if(this.logger.info("Resetting all devices"),await this.deviceService.resetAllDevices())return this.meterViewModel.reset(),!0;return!1}dispose(){if(this.logger.info("Disposing application resources"),this.monitoringEnabled)this.stopMonitoring();if(this.recordingEnabled&&this.recordSessionUseCase)this.recordSessionUseCase.stopRecording().catch((q)=>{this.logger.error("Error stopping recording during cleanup:",q)});if(this.replayingEnabled&&this.replaySessionUseCase)this.replaySessionUseCase.stop();if(this.webSocketClient)this.webSocketClient.disconnect();if(this.meterViewModel)this.meterViewModel.dispose();if(this.meterRenderer)this.meterRenderer.dispose();if(H.off("deviceConnected",this._handleDeviceConnected.bind(this)),H.off("deviceDisconnected",this._handleDeviceDisconnected.bind(this)),H.off("deviceUpdated",this._handleDeviceUpdated.bind(this)),H.off("deviceValueUpdated",this._handleDeviceValueUpdated.bind(this)),H.off("deviceError",this._handleDeviceError.bind(this)),H.off("devicesReset",this._handleDevicesReset.bind(this)),typeof window<"u")window.removeEventListener("resize",this._handleWindowResize.bind(this));this.logger.info("Application disposed successfully")}}class o{constructor(q={}){this.options={webSocketUrl:q.webSocketUrl||"ws://localhost:8123",appNamespace:q.appNamespace||"positionVisualizer",maxDevices:q.maxDevices||6,monitorInterval:q.monitorInterval||100,containerId:q.containerId||"app-container",autoStart:q.autoStart||!0,...q},this.app=null,this.logger=Y.createLogger("AppBootstrap")}async initialize(){this.logger.info("Initializing application...");try{let q=this._initializeInfrastructureLayer(),Q=this._initializeApplicationLayer(q),Z=this._initializePresentationLayer(q,Q);if(this.app=this._createAppController(q,Q,Z),this.options.autoStart)await this.app.start();return this.logger.info("Application initialization complete"),this.app}catch(q){throw this.logger.error("Error initializing application:",q),q}}_initializeInfrastructureLayer(){this.logger.debug("Initializing infrastructure layer");let q=new B(this.options.appNamespace),Q=new D(this.options.webSocketUrl,{reconnectInterval:2000,maxReconnectAttempts:5}),Z=new h(q),_=new k(q),$=new V(q);return{storageAdapter:q,webSocketClient:Q,deviceRepository:Z,valueRepository:_,settingsRepository:$,eventBus:H}}_initializeApplicationLayer(q){this.logger.debug("Initializing application layer");let Q=new p(q.deviceRepository,q.valueRepository,{maxDevices:this.options.maxDevices,deviceTimeoutMs:1e4,autoConnect:!0}),Z=new u(q.deviceRepository,q.valueRepository,{monitoringInterval:this.options.monitorInterval}),_=new l(q.sessionRepository||{saveSession:async()=>!0,getSessions:async()=>[],getSession:async()=>null,exportSession:async()=>!0},q.valueRepository),$=new c(q.sessionRepository||{getSession:async()=>null},q.valueRepository,{autoRewind:!0,replaySpeedMultiplier:1});return{deviceService:Q,monitorUseCase:Z,recordSessionUseCase:_,replaySessionUseCase:$}}_initializePresentationLayer(q,Q){this.logger.debug("Initializing presentation layer");let Z=null;if(typeof document<"u"){if(Z=document.getElementById(this.options.containerId),!Z)this.logger.debug(\`Container element "\${this.options.containerId}" not found, creating it\`),Z=document.createElement("div"),Z.id=this.options.containerId,document.body.appendChild(Z)}let _=new s({maxDevices:this.options.maxDevices,interpolationTime:200}),$=Z?new r(Z,{size:Math.min(Z.clientWidth||500,Z.clientHeight||500)}):null;return{meterViewModel:_,meterRenderer:$}}_createAppController(q,Q,Z){return this.logger.debug("Creating application controller"),new v({webSocketClient:q.webSocketClient,storageAdapter:q.storageAdapter,settingsRepository:q.settingsRepository,deviceService:Q.deviceService,monitorUseCase:Q.monitorUseCase,recordSessionUseCase:Q.recordSessionUseCase,replaySessionUseCase:Q.replaySessionUseCase,meterViewModel:Z.meterViewModel,meterRenderer:Z.meterRenderer,webSocketUrl:this.options.webSocketUrl,options:{monitorInterval:this.options.monitorInterval,autoConnect:!0}})}async start(){if(!this.app)await this.initialize();return await this.app.start()}stop(){if(this.app)this.app.dispose(),this.app=null}}document.addEventListener("DOMContentLoaded",async()=>{try{let q=window.location.search.includes("overlay");console.log(\`Initializing Position Visualizer \${q?"Overlay":"Application"}...\`);let Q=window.APP_CONFIG?.webSocketUrl||"ws://localhost:8123",Z=q?"meter-container":window.APP_CONFIG?.containerId||"meter-container",$=await new o({webSocketUrl:Q,containerId:Z,maxDevices:window.APP_CONFIG?.maxDevices||6,autoStart:!0,isOverlay:q}).initialize();if(window.appController=$,q)document.body.classList.add("overlay-mode"),i(),qq($),Zq($);else e($),Qq($);await $.start(),console.log(\`\${q?"Overlay":"Application"} started successfully\`),n("接続済み",q)}catch(q){console.error(\`Failed to start \${window.APP_CONFIG?.isOverlay?"overlay":"application"}:\`,q),n("接続エラー",window.APP_CONFIG?.isOverlay),t("アプリケーションの起動に失敗しました",window.APP_CONFIG?.isOverlay)}});function i(){document.querySelectorAll(".controls, .range-settings-section, .log-sections").forEach(($)=>{if($)$.style.display="none"});let Q=document.getElementById("meter-container");if(Q){Q.classList.add("fullscreen");let $=Q.parentElement;if($)$.style.width="100vw",$.style.height="100vh",$.style.padding="0",$.style.margin="0",$.style.overflow="hidden"}document.querySelectorAll(".visualizer-header *:not(.overlay-button)").forEach(($)=>{if($&&!$.classList.contains("overlay-button"))$.style.display="none"});let _=document.querySelector(".header-buttons");if(_&&!document.getElementById("chroma-key-btn")){let $=document.createElement("button");$.id="chroma-key-btn",$.className="overlay-button",$.textContent="クロマキーオン",$.title="クロマキー背景を切り替え",_.appendChild($)}}function e(q){let Q=document.getElementById("reset-devices");if(Q)Q.addEventListener("click",async()=>{if(await q.resetDevices())S("デバイスをリセットしました")});let Z=document.getElementById("start-record"),_=document.getElementById("stop-record");if(Z&&_)Z.addEventListener("click",async()=>{if(await q.startRecording())document.getElementById("log-record-status").textContent="記録中...",S("記録を開始しました")}),_.addEventListener("click",async()=>{if(await q.stopRecording())document.getElementById("log-record-status").textContent="停止中",S("記録を停止しました")});let $=document.getElementById("play-log"),J=document.getElementById("stop-log");if($&&J)$.addEventListener("click",()=>{let G=document.getElementById("log-file");if(G&&G.files.length>0){let X=G.files[0],O=new FileReader;O.onload=async(U)=>{try{let F=JSON.parse(U.target.result);await q.playLog(F),S("ログ再生を開始しました")}catch(F){console.error("Error playing log:",F),t("ログの読み込みに失敗しました")}},O.readAsText(X)}else t("ログファイルを選択してください")}),J.addEventListener("click",async()=>{await q.stopPlayback(),S("ログ再生を停止しました")});let W=document.getElementById("open-overlay");if(W)W.addEventListener("click",function(){window.open("?overlay","overlay_window","width=800,height=600,menubar=no,toolbar=no,location=no,status=no")})}function qq(q){let Q=document.getElementById("chroma-key-btn");if(Q)Q.addEventListener("click",()=>{let Z=document.body;if(Z.classList.toggle("chroma-key"),Z.classList.contains("chroma-key"))Q.textContent="クロマキーオフ",S("クロマキーモードをオンにしました",!0);else Q.textContent="クロマキーオン",S("クロマキーモードをオフにしました",!0)})}function Qq(q){let Q=document.getElementById("device-list"),Z=document.getElementById("device-count");if(!Q)return;setInterval(async()=>{try{let _=await q.getAllDevices(!0);if(Z)Z.textContent=\`\${_.length} デバイス\`;_q(Q,_)}catch(_){console.error("Failed to update device list:",_)}},1000)}function Zq(q){setInterval(async()=>{try{await q.getAllDevices(!0)}catch(Q){console.error("Failed to update overlay display:",Q)}},100)}function _q(q,Q){if(q.innerHTML="",!Q||Q.length===0){let Z=document.createElement("li");Z.className="device-item empty",Z.textContent="デバイスが見つかりません",q.appendChild(Z);return}Q.forEach((Z)=>{let _=document.createElement("li");_.className="device-item";let $=Z.value||{},J=$.normalizedValue!==void 0?$.normalizedValue:$.rawValue!==void 0?$.rawValue:null;_.innerHTML=\`
      <div class="device-icon" style="background-image: url(\${Z.iconUrl||"assets/icon.svg"})"></div>
      <div class="device-info">
        <div class="device-name">\${Z.name||"デバイス "+Z.id}</div>
        <div class="device-value">\${J!==null?J.toFixed(1):"-"}</div>
      </div>
      <div class="device-status \${Z.connected?"status-connected":"status-disconnected"}"></div>
    \`,q.appendChild(_)})}function n(q,Q=!1){let Z=document.getElementById(Q?"overlay-status":"connection-status");if(Z)Z.textContent=q}function t(q,Q=!1){let Z=document.createElement("div");Z.className=Q?"overlay-error":"error-message",Z.textContent=q,document.body.appendChild(Z),setTimeout(()=>{Z.remove()},5000)}function S(q,Q=!1){let Z=document.createElement("div");Z.className=Q?"overlay-notification":"notification",Z.textContent=q,document.body.appendChild(Z),setTimeout(()=>{Z.style.opacity="0",setTimeout(()=>{Z.remove()},500)},3000)}

//# debugId=8F8199B93DE28F7164756E2164756E21
//# sourceMappingURL=app.js.map
`,
  "assets/icon.svg": `<?xml version="1.0" encoding="UTF-8"?>
<svg id="_レイヤー_2" data-name="レイヤー 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 331.07 331.07">
  <defs>
    <style>
      .cls-1 {
        fill: #323333;
      }
    </style>
  </defs>
  <g id="_レイヤー_1-2" data-name="レイヤー 1">
    <path class="cls-1" d="M165.53,0C74.26,0,0,74.26,0,165.53s74.26,165.54,165.53,165.54,165.54-74.26,165.54-165.54S256.81,0,165.53,0ZM13.71,199.35c-2.42-10.89-3.71-22.21-3.71-33.82C10,79.77,79.77,10,165.53,10s155.54,69.77,155.54,155.53c0,11.61-1.29,22.93-3.71,33.82H13.71Z"/>
  </g>
</svg>`,
  "css/overlay.css": `/* オーバーレイモード用のスタイル */

/* オーバーレイモード基本スタイル */
body.overlay-mode {
  margin: 0;
  padding: 0;
  background-color: #222;
  overflow: hidden;
  box-sizing: border-box;
}

/* クロマキーモード（緑背景） */
body.overlay-mode.chroma-key {
  background-color: #00ff00; /* Green for chroma key */
}

/* オーバーレイモードのコンテナ */
body.overlay-mode .container {
  padding: 0;
  margin: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
}

/* オーバーレイモードのメーターコンテナ */
body.overlay-mode .meter-container {
  width: 100%;
  height: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* オーバーレイモードでは他のコンポーネントを隠す */
body.overlay-mode .controls,
body.overlay-mode .range-settings-section,
body.overlay-mode .log-sections {
  display: none !important;
}

/* オーバーレイモードのビジュアライザー */
body.overlay-mode .visualizer {
  width: 100%;
  height: 100%;
  max-width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* オーバーレイモードのヘッダー */
body.overlay-mode .visualizer-header {
  position: absolute;
  top: 10px;
  right: 10px;
  width: auto;
  margin: 0;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 5px;
  z-index: 100;
}

body.overlay-mode .visualizer-title {
  display: none;
}

/* オーバーレイモードのボタン */
body.overlay-mode .overlay-button {
  background-color: rgba(51, 65, 85, 0.8);
  font-size: 12px;
  padding: 6px 10px;
  min-width: 100px;
}

body.overlay-mode .overlay-button:hover {
  background-color: rgba(30, 41, 59, 0.9);
}

/* 通知とエラーメッセージ */
.overlay-notification,
.overlay-error {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  z-index: 1000;
  font-size: 14px;
  transition: opacity 0.5s ease;
}

.overlay-error {
  background-color: rgba(220, 38, 38, 0.9);
}

/* フルスクリーンメーター */
#meter-container.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 50;
}`,
  "css/style.css": `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: fot-udkakugoc80-pro, sans-serif;
  background: linear-gradient(135deg, #0b0d12 0%, #1a1d29 100%);
  color: #e5e7eb;
  font-weight: 400;
  font-style: normal;
  min-height: 100vh;
  padding: 20px;
}

.container {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  align-items: flex-start;
  align-content: flex-start;
}

/* 上段左: デバイス設定 */
.controls {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

/* 上段右: プレビュー */
.visualizer {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

.range-settings-section {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

.log-sections {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

/* コントロールパネルと履歴パネル */
.controls,
.history-panel {
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.controls:hover,
.history-panel:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.controls h2,
.history-panel h3,
.visualizer-title {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #f1f5f9;
  font-weight: 700;
  border-bottom: 2px solid #334155;
  padding-bottom: 12px;
}

.controls h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* ビジュアライザー */
.visualizer {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.meter-container {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #00ff00; /* Green for chroma key */
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1e293b;
}

#icons-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* モードセレクター */
.mode-selector {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  border: 1px solid #334155;
}

.mode-selector label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 400;
  transition: color 0.2s ease;
}

.mode-selector label:hover {
  color: #f1f5f9;
}

/* カスタムチェックボックス */
.mode-selector input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #475569;
  border-radius: 6px;
  background: #0b1220;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-selector input[type="checkbox"]:hover {
  border-color: #64748b;
  background: #1e293b;
}

.mode-selector input[type="checkbox"]:checked {
  background: #5FADCF;
  border-color: #7F57B8;
}

.mode-selector input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
}

/* デバイス入力 */
.device-inputs {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.device-group label {
  font-size: 13px;
  margin-bottom: 4px;
}

.device-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  gap: 8px;
}

.device-group label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}


/* 手動操作セクション */
#manual-controls {
  flex: 1 1 100%;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  margin-top: 0;
}

.manual-controls-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

/* 値の範囲設定セクション */
.range-settings-section {
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.input-description {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  line-height: 1.3;
}

.range-settings-section h3 {
  grid-column: 1 / -1;
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* 値の範囲設定セクションの入力欄 */
.range-settings-section .device-group input[type="number"],
.range-settings-section .device-group input[type="text"] {
  margin-top: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  font-family: inherit;
  width: 100%;
}

.range-settings-section .device-group input[type="number"]:focus,
.range-settings-section .device-group input[type="text"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.range-settings-section .device-group input[type="number"]:hover,
.range-settings-section .device-group input[type="text"]:hover {
  border-color: #475569;
}

.range-settings-section .device-group input[type="text"]::placeholder {
  color: #64748b;
}

/* 数値入力のスピナーボタンのスタイル */
.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  cursor: pointer;
  height: 20px;
}

.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button:hover,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button:hover {
  opacity: 0.8;
}

/* ログ再生セクション */
.log-replay-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.log-replay-section label,
.log-record-section label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.log-replay-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-replay-buttons button {
  flex: 1;
}

/* ログ記録セクション */
.log-record-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-record-status {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.log-record-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-record-buttons button {
  flex: 1;
}

#manual-controls .device-group {
  margin-bottom: 0;
}

#manual-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

#manual-controls label span {
  color: #5FADCF;
  font-weight: 700;
  font-size: 16px;
}

/* カスタムスライダー */
input[type="range"] {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
}

/* ボタン */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
  flex: 1;
  min-width: 80px;
}

button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button:disabled:hover {
  background: #334155;
  transform: none;
}

/* ステータス */
.status {
  margin-top: 16px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status input[type="number"] {
  width: 80px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  transition: all 0.2s ease;
}

.status input[type="number"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* アイコンファイル入力（ボタンのみ） */
.icon-file-button {
  position: relative;
  display: block;
  width: 100%;
  height: 36px;
  cursor: pointer;
}

.icon-file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.icon-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #334155;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}

.icon-file-button:hover .icon-button-text {
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  color: #f1f5f9;
  border-color: #475569;
}

.icon-file-input:focus + .icon-button-text {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* 登録済み状態（アイコンが設定されている場合） */
.icon-file-button.has-icon .icon-button-text {
  border-color: #5FADCF;
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  color: #fff;
}

.icon-file-button.has-icon:hover .icon-button-text {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  border-color: #7F57B8;
}

/* ログ再生のファイル入力 */
.log-replay-section input[type="file"] {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.log-replay-section input[type="file"]:hover {
  border-color: #475569;
  background: #0f172a;
}

.log-replay-section input[type="file"]:focus {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.log-replay-section input[type="file"]::file-selector-button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  font-family: inherit;
}

.log-replay-section input[type="file"]::file-selector-button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(127, 87, 184, 0.3);
}

/* 履歴パネル */
#history-content {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;
}

#history-content::-webkit-scrollbar {
  width: 6px;
}

#history-content::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

#history-content > div {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  font-size: 13px;
  font-weight: 400;
  color: #cbd5e1;
  transition: all 0.2s ease;
  line-height: 1.5;
}

#history-content > div:hover {
  background: rgba(15, 23, 42, 0.7);
  border-color: #475569;
}

#history-content > div:first-child {
  background: rgba(95, 173, 207, 0.1);
  border-color: #5FADCF;
}

/* ヘッダーボタン用スタイル */
.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  width: 100%;
  flex-wrap: wrap;
  gap: 10px;
}

.header-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.overlay-button {
  background-color: #334155;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  white-space: nowrap;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.overlay-button:hover {
  background-color: #1e293b;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.reset-button {
  background-color: #9c4221;
}

.reset-button:hover {
  background-color: #7b341e;
}

/* スクロールバーのスタイル */
.controls::-webkit-scrollbar {
  width: 8px;
}

.controls::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* レスポンシブデザイン */
@media (max-width: 1200px) {
  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    flex: 1 1 100%;
    max-width: 100%;
  }
  
  .log-sections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  body {
    padding: 12px;
  }

  .container {
    gap: 16px;
  }

  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    min-width: 100%;
  }

  .history-panel,
  .visualizer {
    padding: 16px;
  }

  button {
    width: 100%;
  }
  
  .range-grid {
    grid-template-columns: 1fr;
  }
}
`,
  "index.html": `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>positionVisualizer</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/overlay.css">
    <link rel="preload" href="assets/icon.svg" as="image" type="image/svg+xml">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      /* Fallback styles */
      .container{
        display:flex;
        flex-wrap:wrap;
        gap:20px;
        align-items:flex-start;
        justify-content:center;
        padding:10px;
        max-width:100%;
        min-height:calc(100vh - 40px);
        margin:0 auto;
        box-sizing: border-box;
      }
      .controls{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px}
      .visualizer{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px;min-height:400px;display:flex;flex-direction:column}
      .range-settings-section{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;border:1px solid #334155;padding:16px;border-radius:16px}
      .log-sections{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;border:1px solid #334155;padding:16px;border-radius:16px}
      .meter-container{position:relative;width:100%;max-width:980px;margin:0 auto;aspect-ratio:16/9;flex:1}
      #icons-container{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
      button{cursor:pointer}

      /* オーバーレイボタン用スタイル */
      .visualizer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        width: 100%;
        flex-wrap: wrap;
        gap: 10px;
      }
      .visualizer-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        flex: 1;
        min-width: 120px;
      }
      .overlay-button {
        background-color: #334155;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 14px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        white-space: nowrap;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 140px;
      }
      .overlay-button:hover {
        background-color: #1e293b;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }

      /* レスポンシブ対応 */
      @media (max-width: 768px) {
        .container {
          padding: 8px;
          gap: 12px;
        }
      }

      @media (max-width: 500px) {
        .visualizer-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .visualizer-title {
          margin-bottom: 8px;
        }
        .overlay-button {
          width: 100%;
        }
        .visualizer, .controls, .range-settings-section, .log-sections {
          padding: 15px;
        }
      }
    </style>
    <script>
      // キャッシュクリア用のビルドクエリ
      window.__buildTs = Date.now();
    </script>
</head>
<body>
    <div class="container">
        <div class="controls">
            <h2>デバイス設定</h2>
            <div class="device-inputs">
                <div class="device-group">
                    <label>デバイス1</label>
                    <label class="icon-file-button" for="device1-icon">
                        <input type="file" id="device1-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス2</label>
                    <label class="icon-file-button" for="device2-icon">
                        <input type="file" id="device2-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス3</label>
                    <label class="icon-file-button" for="device3-icon">
                        <input type="file" id="device3-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス4</label>
                    <label class="icon-file-button" for="device4-icon">
                        <input type="file" id="device4-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス5</label>
                    <label class="icon-file-button" for="device5-icon">
                        <input type="file" id="device5-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス6</label>
                    <label class="icon-file-button" for="device6-icon">
                        <input type="file" id="device6-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
            </div>
        </div>

        <div class="visualizer">
            <div class="visualizer-header">
                <h2 class="visualizer-title">プレビュー</h2>
                <div class="header-buttons">
                    <button id="reset-devices" class="overlay-button reset-button" title="デバイスリストをリセット">
                        レバー表示をリセット
                    </button>
                    <button id="open-overlay" class="overlay-button" title="オーバーレイウィンドウを開く">
                        オーバーレイを開く
                    </button>
                </div>
            </div>
            <div class="meter-container" id="meter-container">
                <div id="icons-container"></div>
            </div>
        </div>
        <div class="range-settings-section">
            <h3>値の範囲設定</h3>
            <div class="range-grid">
                <div class="device-group">
                    <label>最小値</label>
                    <input type="number" id="min-value" value="0" step="0.1">
                </div>
                <div class="device-group">
                    <label>最大値</label>
                    <input type="number" id="max-value" value="100" step="0.1">
                </div>
                <div class="device-group">
                    <label>単位</label>
                    <input type="text" id="value-unit" value="%" placeholder="例: %, °, kg">
                </div>
                <div class="device-group">
                    <label>最大デバイス数</label>
                    <input type="number" id="max-devices" value="6" min="1" max="20" step="1">
                    <span class="input-description">表示するレバーデバイスの最大数</span>
                </div>
            </div>
        </div>
        
        <div class="log-sections">
            <div class="log-replay-section">
                <label>ログ再生</label>
                <input type="file" id="log-file" accept="application/json,.json">
                <div class="log-replay-buttons">
                    <button id="play-log">再生</button>
                    <button id="stop-log">停止</button>
                </div>
            </div>
            <div class="log-record-section">
                <label>ログ記録</label>
                <div class="log-record-status" id="log-record-status">停止中</div>
                <div class="log-record-buttons">
                    <button id="start-record">記録開始</button>
                    <button id="stop-record">記録終了</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // グローバル設定
        window.APP_CONFIG = {
            webSocketUrl: 'ws://localhost:8123',
            containerId: 'meter-container',
            maxDevices: 6
        };
    </script>
    <script src="app.js"></script>
</body>
</html>


`,
  "overlay.html": `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeverScope - Overlay</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      html,body{margin:0;padding:0;background:#00ff00;overflow:hidden} /* Green for chroma key */
      .overlay-root{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#00ff00} /* Green for chroma key */
      .meter-only{width:100%;max-width:1920px;padding:120px;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center} /* Increased padding to prevent icon clipping */
      #meter-container{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
      #meter-container svg{display:block;margin:0 auto}
      /* Optional safe padding for cropping */
      .pad{padding:0}
    </style>
</head>
<body>
  <div class="overlay-root">
    <div id="meter-container" class="meter-only"></div>
  </div>

  <script>
    // グローバル設定
    window.APP_CONFIG = {
      webSocketUrl: 'ws://localhost:8123',
      containerId: 'meter-container',
      maxDevices: 6,
      isOverlay: true
    };
  </script>
  <script src="overlay.bundle.js"></script>
</body>
</html>


`,
};

// MIMEタイプのマッピング
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// パスに対するMIMEタイプを取得
function getMimeType(path) {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// リソースをUint8Arrayとして取得
function getResource(path) {
  // 先頭のスラッシュを削除し、正規化
  path = path.startsWith('/') ? path.substring(1) : path;

  // 空のパスまたはルートはindex.htmlにデフォルト
  if (path === '' || path === '/') {
    path = 'index.html';
  }

  // リソースを取得
  const resource = resources[path];

  if (!resource) {
    return null;
  }

  // タイプに基づいてUint8Arrayに変換
  if (typeof resource === 'string') {
    // テキストリソース
    return new TextEncoder().encode(resource);
  } else if (resource.base64) {
    // バイナリリソース（base64エンコード）
    const binary = atob(resource.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return null;
}

// 利用可能なすべてのリソースをリスト
function listResources() {
  return Object.keys(resources);
}

export {
  resources,
  getResource,
  getMimeType,
  listResources
};
