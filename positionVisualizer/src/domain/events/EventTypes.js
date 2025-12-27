/**
 * EventTypes.js
 * アプリケーション全体で使用されるイベントタイプの定義
 * イベント名を一元管理し、タイプミスや重複を防止する
 */

/**
 * イベントタイプの定義
 * 命名規則: [プレフィックス]:[ドメイン]:[アクション]
 * プレフィックス:
 * - event: 状態変更の通知（過去形で記述）
 * - command: アクションの実行要求
 * - query: データの要求
 * - response: データの応答
 */
export const EventTypes = {
  // デバイス関連イベント
  DEVICE_CONNECTED: 'event:device:connected',
  DEVICE_DISCONNECTED: 'event:device:disconnected',
  DEVICE_DISCOVERED: 'event:device:discovered',
  DEVICE_UPDATED: 'event:device:updated',
  DEVICE_VALUE_UPDATED: 'event:device:value:updated',
  DEVICE_VALUE_REPLAYED: 'event:device:value:replayed', // 再生データから来た値の更新
  DEVICE_ERROR: 'event:device:error',
  DEVICES_RESET: 'event:devices:reset',

  // 表示状態関連イベント
  DEVICE_VISIBILITY_CHANGED: 'event:device:visibility:changed',
  DEVICE_NAME_CHANGED: 'event:device:name:changed',
  DEVICE_ICON_CHANGED: 'event:device:icon:changed',
  DEVICE_ICON_ERROR: 'event:device:icon:error',

  // 記録・再生関連イベント
  RECORDING_STARTED: 'event:recording:started',
  RECORDING_STOPPED: 'event:recording:stopped',
  REPLAY_STARTED: 'event:replay:started',
  REPLAY_STOPPED: 'event:replay:stopped',
  REPLAY_PAUSED: 'event:replay:paused',
  REPLAY_RESUMED: 'event:replay:resumed',

  // アプリケーション状態関連イベント
  APP_STARTED: 'event:app:started',
  MONITORING_STARTED: 'event:monitoring:started',
  MONITORING_STOPPED: 'event:monitoring:stopped',

  // コマンド（アクション要求）
  COMMAND_SET_DEVICE_VISIBILITY: 'command:device:setVisibility',
  COMMAND_SET_DEVICE_NAME: 'command:device:setName',
  COMMAND_SET_DEVICE_ICON: 'command:device:setIcon',
  COMMAND_RESET_DEVICES: 'command:devices:reset',

  // クエリ（データ要求）
  QUERY_ALL_DEVICES: 'query:devices:getAll',
  QUERY_DEVICE_INFO: 'query:device:getInfo',

  // レスポンス（クエリの応答）
  RESPONSE_ALL_DEVICES: 'response:devices:all',
  RESPONSE_DEVICE_INFO: 'response:device:info'
};

export default EventTypes;