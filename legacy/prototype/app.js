/* The state model is shared by the browser interface and the local Node tests. */
(function () {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'dofus-stuffer.priorities.v1';
  const MAX_LEVELS = 12;
  const MAX_CRITERIA = 40;
  const catalog = Object.freeze({
    spell: { label: 'Flèche punitive', short: 'Dégâts d’un sort', y: 1154, value: 1800 },
    pa: { label: 'Points d’action', short: 'PA', y: 243, value: 12 },
    pm: { label: 'Points de mouvement', short: 'PM', y: 50, value: 6 },
    po: { label: 'Portée', short: 'PO', y: 126, value: 5 },
    force: { label: 'Force', short: 'Force', y: 430, value: 1000 },
    vita: { label: 'Vitalité', short: 'Vitalité', y: 317, value: 4000 },
    price: { label: 'Prix du stuff', short: 'Budget', value: 30 },
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  function initialState() {
    return { version: VERSION, groups: [
      { id: 'g1', items: [{ id: 's1', type: 'spell', value: 1800, mode: 'crit', basis: 'min', strict: false }] },
      { id: 'g2', items: [{ id: 's2', type: 'pa', value: 12, strict: false }, { id: 's3', type: 'pm', value: 6, strict: false }] },
      { id: 'g3', items: [{ id: 's4', type: 'price', value: 30, strict: false }] },
    ] };
  }
  function validItem(item) {
    return item && /^s[\w-]+$/.test(item.id) && Object.hasOwn(catalog, item.type)
      && Number.isFinite(item.value) && item.value >= 0 && item.value <= 100000000
      && typeof item.strict === 'boolean'
      && (item.type === 'price' || Number.isInteger(item.value))
      && (item.type !== 'spell' || (['normal', 'crit'].includes(item.mode) && ['min', 'avg', 'max'].includes(item.basis)));
  }
  function validate(state) {
    if (!state || state.version !== VERSION || !Array.isArray(state.groups) || !state.groups.length || state.groups.length > MAX_LEVELS) return false;
    const ids = new Set();
    let count = 0;
    for (const group of state.groups) {
      if (!group || !/^g[\w-]+$/.test(group.id) || ids.has(group.id) || !Array.isArray(group.items)) return false;
      ids.add(group.id);
      for (const item of group.items) {
        if (!validItem(item) || ids.has(item.id)) return false;
        ids.add(item.id);
        count += 1;
      }
    }
    return count <= MAX_CRITERIA;
  }
  function find(state, id) {
    for (const group of state.groups) {
      const item = group.items.find(entry => entry.id === id);
      if (item) return { item, group };
    }
    return null;
  }
  function weights(state) {
    const populated = state.groups.filter(group => group.items.length);
    return Object.fromEntries(state.groups.map(group => [group.id, group.items.length ? populated.length - populated.indexOf(group) : 0]));
  }
  function relocate(state, itemId, groupId) {
    const found = find(state, itemId);
    const destination = state.groups.find(group => group.id === groupId);
    if (!found || !destination || found.group === destination) return false;
    found.group.items = found.group.items.filter(item => item.id !== itemId);
    destination.items.push(found.item);
    state.groups = state.groups.filter(group => group.items.length || group !== found.group);
    return true;
  }
  function reorder(state, groupId, offset) {
    const from = state.groups.findIndex(group => group.id === groupId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= state.groups.length || ![-1, 1].includes(offset)) return false;
    [state.groups[from], state.groups[to]] = [state.groups[to], state.groups[from]];
    return true;
  }
  const model = { initialState, validate, find, weights, relocate, reorder, catalog };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof document === 'undefined') return;

  const root = document.getElementById('stuff-priorities-preview');
  if (!root) return;
  let state = initialState();
  let editing = null;
  let dragging = null;
  let storageAvailable = true;
  let counter = 0;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (validate(parsed)) state = clone(parsed);
      else storageAvailable = false;
    }
  } catch (_) { storageAvailable = false; }
  const uid = prefix => prefix + Date.now().toString(36) + (++counter).toString(36);
  const format = number => Number(number).toLocaleString('fr-FR');
  const icon = type => type === 'price'
    ? '<span class="sp-kama" aria-hidden="true">K</span>'
    : `<span class="sp-icon" aria-hidden="true" style="background-position:-97px -${catalog[type].y}px"></span>`;
  const target = item => `${item.type === 'price' ? '≤' : '≥'} ${format(item.value)}${item.type === 'price' ? ' M kamas' : item.type === 'spell' ? ` dégâts · ${item.mode === 'normal' ? 'normal' : 'critique'} · jet ${item.basis === 'max' ? 'max.' : item.basis === 'avg' ? 'moyen' : 'min.'}` : ''}${item.strict ? ' · Obligatoire' : ''}`;
  function announce(message) { root.querySelector('.sp-live').textContent = message; }
  function storageLabel() {
    root.querySelector('.sp-storage').textContent = storageAvailable
      ? 'Enregistré dans ce navigateur'
      : 'Sauvegarde indisponible · conserver cette fenêtre ouverte';
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; }
    catch (_) { storageAvailable = false; }
    storageLabel();
  }
  function closeEditor() {
    editing = null;
    root.querySelector('.sp-editor').hidden = true;
    root.querySelectorAll('[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }
  function render() {
    const weight = weights(state);
    const count = state.groups.reduce((sum, group) => sum + group.items.length, 0);
    root.querySelector('.sp-picker').innerHTML = Object.entries(catalog).map(([type, entry]) =>
      `<button type="button" data-add="${type}" aria-label="Ajouter ${entry.label}" ${count >= MAX_CRITERIA ? 'disabled' : ''}>${icon(type)}${entry.short}<span aria-hidden="true">+</span></button>`).join('');
    root.querySelector('.sp-list').innerHTML = state.groups.map((group, index) =>
      `<section class="sp-group"><div class="sp-group-head"><span class="sp-rank">${index + 1}</span><span class="sp-group-label">${index === 0 ? 'Priorité la plus haute' : `Priorité ${index + 1}`}</span><span class="sp-weight">${weight[group.id] ? `Poids ×${weight[group.id]}` : 'Niveau vide'}</span><span class="sp-order"><button type="button" data-up="${group.id}" aria-label="Monter le niveau ${index + 1}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-down="${group.id}" aria-label="Descendre le niveau ${index + 1}" ${index === state.groups.length - 1 ? 'disabled' : ''}>↓</button>${group.items.length ? '' : `<button type="button" data-delete-group="${group.id}" aria-label="Supprimer le niveau vide ${index + 1}" ${state.groups.length === 1 ? 'disabled' : ''}>×</button>`}</span></div><div class="sp-drop" data-group="${group.id}">${group.items.length ? group.items.map(item =>
        `<div class="sp-row" data-item="${item.id}" draggable="true"><span class="sp-grip" aria-hidden="true">⠿</span><button type="button" class="sp-edit" data-edit="${item.id}" aria-label="Modifier ${catalog[item.type].label}" aria-expanded="false">${icon(item.type)}<span><span class="sp-name">${catalog[item.type].label}</span><span class="sp-target">${target(item)}</span></span></button><select class="sp-to" data-move="${item.id}" aria-label="Niveau de ${catalog[item.type].label}">${state.groups.map((other, position) => `<option value="${other.id}" ${group.id === other.id ? 'selected' : ''}>Niveau ${position + 1}</option>`).join('')}${state.groups.length < MAX_LEVELS ? '<option value="new">Nouveau niveau</option>' : ''}</select><button type="button" class="sp-remove" data-remove="${item.id}" aria-label="Supprimer ${catalog[item.type].label}">×</button></div>`).join('') : '<div class="sp-empty">Déposer un critère ici, ou choisir ce niveau à l’ajout</div>'}</div></section>`).join('');
    root.querySelector('.sp-count').textContent = `${count} critères · ${state.groups.length} niveaux`;
    root.querySelector('[data-action="new"]').disabled = state.groups.length >= MAX_LEVELS;
    storageLabel();
  }
  function openEditor(type, id) {
    const found = id ? find(state, id) : null;
    if (id && !found) return;
    const item = found ? found.item : { type, value: catalog[type].value, mode: 'crit', basis: 'min', strict: false };
    editing = { id, type };
    const form = root.querySelector('.sp-editor');
    const weight = weights(state);
    form.hidden = false;
    form.innerHTML = `<h3>${icon(type)} ${catalog[type].label}</h3><div class="sp-fields"><label>${type === 'price' ? 'Budget visé (M kamas)' : 'Valeur visée, au moins'}<input name="value" type="number" min="0" max="100000000" step="${type === 'price' ? '0.1' : '1'}" value="${item.value}" required></label><label>Niveau de priorité<select name="group">${state.groups.map((group, index) => `<option value="${group.id}" ${group.id === found?.group.id ? 'selected' : ''}>Niveau ${index + 1}${weight[group.id] ? ` · poids ×${weight[group.id]}` : ''}</option>`).join('')}</select></label>${type === 'spell' ? `<label>Type de coup<select name="mode"><option value="crit" ${item.mode === 'crit' ? 'selected' : ''}>Critique</option><option value="normal" ${item.mode === 'normal' ? 'selected' : ''}>Normal</option></select></label><label>Jet visé<select name="basis"><option value="min" ${item.basis === 'min' ? 'selected' : ''}>Minimum</option><option value="avg" ${item.basis === 'avg' ? 'selected' : ''}>Moyen</option><option value="max" ${item.basis === 'max' ? 'selected' : ''}>Maximum</option></select></label>` : ''}</div><div class="sp-actions"><label class="sp-strict"><input name="strict" type="checkbox" ${item.strict ? 'checked' : ''}> Obligatoire</label><button type="button" data-action="cancel">Annuler</button><button type="submit" class="sp-save">${id ? 'Enregistrer' : 'Ajouter'}</button></div>`;
    form.querySelector('input').focus();
    if (id) root.querySelector(`[data-edit="${id}"]`).setAttribute('aria-expanded', 'true');
  }
  function commit(message, focusId) {
    closeEditor(); render(); save(); announce(message);
    if (focusId) root.querySelector(`[data-edit="${focusId}"]`)?.focus();
  }
  function move(id, destinationId) {
    if (destinationId === 'new') {
      if (state.groups.length >= MAX_LEVELS) return;
      destinationId = uid('g');
      state.groups.push({ id: destinationId, items: [] });
    }
    if (relocate(state, id, destinationId)) commit('Niveau du critère modifié', id);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.add) openEditor(data.add);
    if (data.edit) { const found = find(state, data.edit); if (found) openEditor(found.item.type, data.edit); }
    if (data.remove) {
      const found = find(state, data.remove);
      if (found) {
        found.group.items = found.group.items.filter(item => item.id !== data.remove);
        state.groups = state.groups.filter(group => group.items.length || group !== found.group);
        if (!state.groups.length) state.groups.push({ id: uid('g'), items: [] });
        commit('Critère supprimé');
      }
    }
    if (data.up || data.down) {
      if (reorder(state, data.up || data.down, data.up ? -1 : 1)) commit('Priorités réordonnées');
    }
    if (data.deleteGroup && state.groups.length > 1) {
      state.groups = state.groups.filter(group => group.id !== data.deleteGroup || group.items.length);
      commit('Niveau vide supprimé');
    }
    if (data.action === 'cancel') closeEditor();
    if (data.action === 'new' && state.groups.length < MAX_LEVELS) {
      state.groups.push({ id: uid('g'), items: [] }); commit('Niveau ajouté');
    }
  });
  root.addEventListener('change', event => { if (event.target.dataset.move) move(event.target.dataset.move, event.target.value); });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') closeEditor(); });
  root.querySelector('.sp-editor').addEventListener('submit', event => {
    event.preventDefault();
    if (!editing || !event.target.reportValidity()) return;
    const fields = new FormData(event.target);
    const group = state.groups.find(entry => entry.id === fields.get('group'));
    if (!group) return;
    const item = { id: editing.id || uid('s'), type: editing.type, value: Number(fields.get('value')), mode: fields.get('mode') || 'crit', basis: fields.get('basis') || 'min', strict: fields.get('strict') === 'on' };
    if (!validItem(item)) return;
    const old = editing.id ? find(state, editing.id) : null;
    if (old && old.group === group) {
      group.items[group.items.findIndex(entry => entry.id === item.id)] = item;
    } else {
      if (old) old.group.items = old.group.items.filter(entry => entry.id !== editing.id);
      group.items.push(item);
      if (old) state.groups = state.groups.filter(entry => entry.items.length || entry !== old.group);
    }
    commit('Critère enregistré', item.id);
  });
  root.addEventListener('dragstart', event => {
    const row = event.target.closest('[data-item]');
    if (!row) return;
    dragging = row.dataset.item;
    event.dataTransfer.setData('text/plain', dragging);
    event.dataTransfer.effectAllowed = 'move';
  });
  root.addEventListener('dragover', event => {
    const zone = event.target.closest('[data-group]');
    if (zone && dragging) { event.preventDefault(); zone.classList.add('sp-over'); }
  });
  root.addEventListener('dragleave', event => {
    const zone = event.target.closest('[data-group]');
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('sp-over');
  });
  function clearDrag() { dragging = null; root.querySelectorAll('.sp-over').forEach(zone => zone.classList.remove('sp-over')); }
  root.addEventListener('drop', event => {
    const zone = event.target.closest('[data-group]');
    if (zone && dragging) { event.preventDefault(); move(dragging, zone.dataset.group); }
    clearDrag();
  });
  root.addEventListener('dragend', clearDrag);
  render();
})();
