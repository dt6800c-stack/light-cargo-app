/**
 * API通信モジュール
 * GAS WebアプリへのHTTP通信を管理
 */
const Api = (() => {
  'use strict';

  /**
   * 業務記録をAPIに送信する
   * 1) 通常fetch（GASがCORS対応の場合レスポンス読み取り可能）
   * 2) 失敗時は no-cors フォールバック
   * @param {Object} data - 送信データ
   * @returns {Promise<Object>} レスポンス
   */
  async function sendRecord(data) {
    const config = Config.get();
    const endpoint = config.apiEndpoint;

    // APIエンドポイント未設定の場合はデモモード
    if (!endpoint) {
      return simulateResponse(data);
    }

    const jsonBody = JSON.stringify(data);
    console.log('[API] 送信データ:', jsonBody);

    // --- 方式1: 通常fetch（CORS対応時はレスポンス読み取り可能）---
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonBody,
        redirect: 'follow',
      });

      // レスポンスが読めた場合はパース
      if (response.ok || response.status === 200) {
        try {
          const result = await response.json();
          console.log('[API] レスポンス:', result);
          return result;
        } catch (parseErr) {
          // JSONパース失敗でもHTTP成功なら記録されたとみなす
          console.warn('[API] レスポンスパース失敗（記録は成功の可能性あり）:', parseErr);
          return {
            status: 'success',
            message: `${data.event_type} を記録しました`,
          };
        }
      }

      // opaqueレスポンス（no-corsリダイレクト結果）の場合
      if (response.type === 'opaque' || response.status === 0) {
        console.log('[API] opaqueレスポンス - 送信成功とみなします');
        return {
          status: 'success',
          message: `${data.event_type} を記録しました`,
        };
      }

      // その他のHTTPエラー
      console.warn('[API] HTTPエラー:', response.status, response.statusText);
      return {
        status: 'error',
        message: `サーバーエラー (${response.status})`,
      };

    } catch (corsError) {
      console.warn('[API] 通常fetch失敗（CORSの可能性）、no-corsで再試行:', corsError.message);
    }

    // --- 方式2: no-cors フォールバック ---
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonBody,
        mode: 'no-cors',
      });

      console.log('[API] no-cors送信完了 - 送信成功とみなします');
      return {
        status: 'success',
        message: `${data.event_type} を記録しました`,
      };
    } catch (error) {
      console.error('[API] 送信完全失敗:', error);
      return {
        status: 'error',
        message: '記録に失敗しました。通信状態を確認してください。',
      };
    }
  }

  /**
   * デモモード: API未設定時のシミュレーション
   * @param {Object} data - 送信データ
   * @returns {Promise<Object>}
   */
  function simulateResponse(data) {
    return new Promise((resolve) => {
      console.log('[デモモード] 送信データ:', JSON.stringify(data, null, 2));
      setTimeout(() => {
        resolve({
          status: 'success',
          message: `[デモ] ${data.event_type} を記録しました`,
        });
      }, 800);
    });
  }

  return { sendRecord };
})();
