/* Kiteline — AI recipe assistant (per-company billing or BYOK) */
(function () {
  'use strict';

  let statusCache = null;

  async function refreshStatus() {
    if (!window.Api || !window.Api.token()) {
      statusCache = { enabled: false, mode: 'none', message: 'Sign in to use AI recipe tools' };
      return statusCache;
    }
    try {
      statusCache = await window.Api.recipeAiStatus();
    } catch {
      statusCache = { enabled: false, mode: 'none', message: 'Could not load Recipe AI status' };
    }
    return statusCache;
  }

  async function isConfigured() {
    const st = await refreshStatus();
    return !!st.enabled;
  }

  async function call(action, body) {
    if (!window.Api || !window.Api.token()) {
      throw new Error('Sign in to use AI recipe tools');
    }
    return window.Api.recipeAi(action, body);
  }

  window.RecipeAi = {
    refreshStatus,
    isConfigured,
    getStatus: refreshStatus,
    suggestIngredients: (payload) => call('ingredients', payload),
    parseIngredients: (payload) => call('parse-ingredients', payload),
    generateMethod: (payload) => call('method', payload),
    generateImage: (payload) => call('image', payload),
  };
})();
