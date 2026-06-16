/* Kiteline — AI recipe assistant (server-backed OpenAI) */
(function () {
  'use strict';

  let configured = null;

  async function isConfigured() {
    if (configured !== null) return configured;
    try {
      const cfg = await fetch('/api/config').then((r) => r.json());
      configured = !!cfg.recipeAi;
    } catch {
      configured = false;
    }
    return configured;
  }

  async function call(action, body) {
    if (!window.Api || !window.Api.token()) {
      throw new Error('Sign in to use AI recipe tools');
    }
    return window.Api.recipeAi(action, body);
  }

  window.RecipeAi = {
    isConfigured,
    suggestIngredients: (payload) => call('ingredients', payload),
    parseIngredients: (payload) => call('parse-ingredients', payload),
    generateMethod: (payload) => call('method', payload),
    generateImage: (payload) => call('image', payload),
  };
})();
