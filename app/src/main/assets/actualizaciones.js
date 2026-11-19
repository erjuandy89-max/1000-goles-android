/* 1000 Goles: actualizaciones del catalogo sin reinstalar el APK.
 * Solo acepta datos JSON (nunca ejecuta codigo remoto).
 * Catalogo: https://api.github.com/repos/erjuandy89-max/1000-goles-android/contents/catalogo/actualizaciones.json?ref=main
 */
(() => {
  'use strict';

  const REMOTE_URL = 'https://api.github.com/repos/erjuandy89-max/1000-goles-android/contents/catalogo/actualizaciones.json?ref=main';
  const CACHE_KEY = '1000-goles-actualizaciones-catalogo-v1';
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const originalClubs = clone(CLUBS_DB);
  const originalLevels = {
    aficionado: [...CLUB_LEVELS.aficionado.ids],
    medio: [...CLUB_LEVELS.medio.ids]
  };
  let currentRevision = 0;
  let cachedDoc = null;

  const status = document.createElement('div');
  status.id = 'catalogo-actualizaciones-estado';
  status.setAttribute('role', 'status');
  status.style.cssText = 'font-size:11px;color:#a5b6ce;margin-top:6px;line-height:1.4';
  const counter = document.getElementById('db-count');
  if (counter) counter.insertAdjacentElement('afterend', status);
  else document.body.appendChild(status);
  const notify = message => { status.textContent = '☁️ Catálogo: ' + message; };

  function validDoc(doc) {
    if (!doc || typeof doc !== 'object' || doc.schemaVersion !== 1 ||
        !Number.isSafeInteger(doc.revision) || doc.revision < 1 ||
        !Array.isArray(doc.clubs) || doc.clubs.length > 350) {
      throw Error('Formato de actualización no válido');
    }
    for (const c of doc.clubs) {
      if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{2,100}$/.test(c.id)) {
        throw Error('ID de club no válido');
      }
      if (own(c, 'players') && (!Array.isArray(c.players) || c.players.length > 1000)) {
        throw Error('Listado de futbolistas no válido');
      }
      if (own(c, 'levels') && (!Array.isArray(c.levels) ||
          c.levels.some(x => !['aficionado', 'medio', 'experto'].includes(x)))) {
        throw Error('Niveles de club no válidos');
      }
      for (const p of (c.players || [])) {
        if (!p || typeof p.name !== 'string' || p.name.trim().length < 2 || p.name.length > 110) {
          throw Error('Nombre de futbolista no válido');
        }
        for (const key of ['clubGoals', 'careerGoals']) {
          if (own(p, key) && p[key] !== null &&
              (!Number.isInteger(p[key]) || p[key] < 0 || p[key] > 2500)) {
            throw Error('Goles fuera del rango permitido');
          }
        }
      }
    }
    return doc;
  }

  function cleanText(x, max = 150) {
    return typeof x === 'string' ? x.trim().slice(0, max) : '';
  }
  function validSource(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) { return ''; }
  }
  function officialProof(p) {
    return p && p.status === 'source_checked' && Boolean(validSource(p.sourceUrl));
  }

  function mergePlayer(base, incoming, clubId) {
    const p = base ? { ...base } : {
      id: 'remoto_' + clubId + '_' + compact(incoming.name),
      name: incoming.name.trim(), pos: '—', era: 'Pendiente de revisar',
      clubGoals: null, careerGoals: null,
      clubGoalVerification: { status: 'pending' },
      careerGoalVerification: { status: 'pending' },
      catalogStatus: 'Catálogo remoto · pendiente de comprobar'
    };
    for (const field of ['pos', 'era', 'catalogStatus', 'currentSquadName']) {
      if (own(incoming, field) && typeof incoming[field] === 'string') {
        p[field] = cleanText(incoming[field], 250);
      }
    }
    if (own(incoming, 'clubGoals')) {
      const currentOfficial = officialProof(p.clubGoalVerification);
      const newOfficial = officialProof(incoming.clubGoalVerification);
      if (!currentOfficial || newOfficial) {
        p.clubGoals = incoming.clubGoals;
        p.clubGoalVerification = newOfficial ? {
          status: 'source_checked',
          scope: 'official_first_team_all_competitions',
          sourceUrl: validSource(incoming.clubGoalVerification.sourceUrl),
          sourceTitle: cleanText(incoming.clubGoalVerification.sourceTitle, 160),
          checkedAt: cleanText(incoming.clubGoalVerification.checkedAt, 30),
          note: cleanText(incoming.clubGoalVerification.note, 400)
        } : { status: 'legacy_unaudited' };
      }
    }
    if (own(incoming, 'careerGoals')) {
      p.careerGoals = incoming.careerGoals;
      p.careerGoalVerification = { status: 'legacy_unaudited' };
    }
    return p;
  }

  function apply(doc) {
    validDoc(doc);
    // No modificar cifras mientras haya una partida en curso.
    if (game && !game.finished) {
      notify('revisión ' + doc.revision + ' descargada; se aplicará al volver a abrir el juego');
      return false;
    }
    const clubs = clone(originalClubs);
    const levels = { aficionado: [...originalLevels.aficionado], medio: [...originalLevels.medio] };
    let changedPlayers = 0;
    for (const patch of doc.clubs) {
      let club = clubs.find(c => c.id === patch.id);
      if (!club) {
        const name = cleanText(patch.name, 110);
        if (!name) continue;
        club = { id: patch.id, name, country: '', primary: '#274c62',
          secondary: '#1e9a83', hint: '', players: [], currentSquad: { sourceUrl: '' } };
        clubs.push(club);
      }
      for (const field of ['name', 'country', 'primary', 'secondary', 'hint']) {
        if (own(patch, field) && typeof patch[field] === 'string') {
          club[field] = cleanText(patch[field], 150);
        }
      }
      if (patch.currentSquad && typeof patch.currentSquad === 'object') {
        club.currentSquad = { ...(club.currentSquad || {}),
          sourceUrl: validSource(patch.currentSquad.sourceUrl) || (club.currentSquad?.sourceUrl || '') };
      }
      if (own(patch, 'levels')) {
        for (const lvl of ['aficionado', 'medio']) {
          levels[lvl] = levels[lvl].filter(id => id !== club.id);
        }
        if (patch.levels.includes('aficionado')) levels.aficionado.push(club.id);
        if (patch.levels.includes('medio') || patch.levels.includes('aficionado')) levels.medio.push(club.id);
      }
      for (const incoming of (patch.players || [])) {
        const nameKey = compact(incoming.name);
        const i = club.players.findIndex(p => compact(p.name) === nameKey);
        const updated = mergePlayer(i >= 0 ? club.players[i] : null, incoming, club.id);
        if (i < 0) club.players.push(updated);
        else club.players[i] = updated;
        changedPlayers++;
      }
      if (Array.isArray(patch.removedPlayers)) {
        const removed = new Set(patch.removedPlayers.filter(n => typeof n === 'string').map(compact));
        club.players = club.players.filter(p => !removed.has(compact(p.name)));
      }
    }
    CLUBS_DB.splice(0, CLUBS_DB.length, ...clubs);
    CLUB_LEVELS.aficionado.ids = [...new Set(levels.aficionado)];
    CLUB_LEVELS.medio.ids = [...new Set(levels.medio)];
    if (typeof BS_CLUBS !== 'undefined' && typeof BS_IDS !== 'undefined') {
      BS_CLUBS.clear(); BS_IDS.clear();
      for (const club of CLUBS_DB) { BS_IDS.add(club.id); BS_CLUBS.set(plain(club.name), club.id); }
    }
    const roster = document.getElementById('roster-club');
    if (roster) {
      const oldId = roster.value;
      roster.replaceChildren();
      for (const c of [...CLUBS_DB].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
        roster.add(new Option(c.name, c.id));
      }
      if (CLUBS_DB.some(c => c.id === oldId)) roster.value = oldId;
      if (typeof displayRoster === 'function') displayRoster();
    }
    if (typeof updateCoverage === 'function') {
      updateCoverage();
      const summary = document.getElementById('coverage-summary');
      if (summary) summary.textContent = summary.textContent.replace(/\/ 70\./, '/ ' + CLUBS_DB.length + '.');
    }
    if (typeof updateWdCounters === 'function') updateWdCounters();
    const stats = document.getElementById('db-count');
    if (stats) {
      const count = CLUBS_DB.reduce((n, c) => n + c.players.length, 0);
      const verified = CLUBS_DB.reduce((n, c) => n + c.players.filter(verifiedClubGoals).length, 0);
      stats.textContent = CLUBS_DB.length + ' clubes · ' + count + ' registros base · ' +
        verified + ' cifras de club contrastadas · revisión remota ' + doc.revision;
    }
    if (typeof syncVerificationSetting === 'function') syncVerificationSetting();
    currentRevision = doc.revision;
    notify('revisión ' + doc.revision + ' cargada (' + changedPlayers + ' fichas revisadas)');
    return true;
  }

  async function download() {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await fetch(REMOTE_URL, { signal: abort.signal, cache: 'no-store' });
      if (!response.ok) throw Error('GitHub HTTP ' + response.status);
      const file = await response.json();
      if (file.encoding !== 'base64' || typeof file.content !== 'string') {
        throw Error('El catálogo supera el límite o no está disponible');
      }
      const decoded = atob(file.content.replace(/\s/g, ''));
      const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
      return validDoc(JSON.parse(new TextDecoder().decode(bytes)));
    } finally { clearTimeout(timer); }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved) { cachedDoc = validDoc(saved); apply(cachedDoc); }
    else notify('comprobando actualizaciones…');
  } catch (e) { console.warn('1000 Goles: copia de catálogo inválida', e); }

  download().then(doc => {
    if (cachedDoc && doc.revision < cachedDoc.revision) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(doc)); } catch (_) { /* Sin espacio de caché */ }
    if (doc.revision !== currentRevision || !cachedDoc) apply(doc);
    else notify('revisión ' + doc.revision + ' al día');
  }).catch(err => {
    console.warn('1000 Goles: no se pudo consultar el catálogo', err);
    notify(cachedDoc ? 'sin conexión; usando datos guardados (revisión ' + cachedDoc.revision + ')'
                     : 'sin conexión; usando los datos incluidos en el APK');
  });
})();
