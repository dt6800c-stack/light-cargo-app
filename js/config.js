/**
 * 設定管理モジュール
 * ドライバー名・車両番号・APIエンドポイントを管理
 */
const Config = (() => {
  'use strict';

  const STORAGE_KEY = 'light_cargo_config';

  // デフォルト設定
  const DEFAULTS = {
    driverName: '',
    vehicleId: '',
    apiEndpoint: '', // GAS WebアプリのデプロイURL
  };

  /**
   * 設定を取得する
   * @returns {Object} 設定オブジェクト
   */
  function get() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULTS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('設定の読み込みに失敗:', e);
    }
    return { ...DEFAULTS };
  }

  /**
   * 設定を保存する
   * @param {Object} config - 保存する設定
   */
  function save(config) {
    try {
      const current = get();
      const updated = { ...current, ...config };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('設定の保存に失敗:', e);
      return false;
    }
  }

  /**
   * 初期設定が完了しているか確認
   * @returns {boolean}
   */
  function isConfigured() {
    const config = get();
    return !!(config.driverName && config.vehicleId);
  }

  return { get, save, isConfigured };
})();
