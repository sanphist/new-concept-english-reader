(() => {
  const data = window.NCE_VOCAB;
  if (!data) return;
  const $ = (id) => document.getElementById(id);
  const state = {list: 'proper', shown: 90, current: null};
  const storageKey = 'nce-vocabulary-known-v1';
  let known;
  try { known = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
  catch { known = new Set(); }
  const labels = {proper:'专有名词',extra:'其他超纲词',missing:'牛津3000未覆盖'};
  const items = (list) => data[list];
  const idOf = (item) => `${state.list}:${item[0]}`;
  const bookNames = ['一','二','三','四'];
  const booksOf = (item) => item.slice(3,7).map((n,i) => n ? `${bookNames[i]}册 ${n}` : '').filter(Boolean).join(' · ');
  const metaOf = (item) => state.list === 'missing'
    ? `${item[1]} · 牛津3000未覆盖`
    : `${item[1]} · 出现 ${item[2]} 次${booksOf(item) ? ' · '+booksOf(item) : ''}`;

  function saveKnown() {
    try { localStorage.setItem(storageKey, JSON.stringify([...known])); } catch { /* Browser storage may be disabled. */ }
  }
  function speak(word) {
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音朗读。'); return; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }
  function filtered() {
    const query = $('wordSearch').value.trim().toLocaleLowerCase();
    const category = $('wordFilter').value;
    const hide = $('hideKnown').checked;
    return items(state.list).filter(item =>
      item[0].toLocaleLowerCase().includes(query)
      && (category === 'all' || item[1] === category)
      && (!hide || !known.has(idOf(item)))
    );
  }
  function toggleKnown(item) {
    const id = idOf(item);
    if (known.has(id)) known.delete(id); else known.add(id);
    saveKnown();
    updateStudy();
    render();
  }
  function render() {
    const matches = filtered();
    const list = $('wordList');
    list.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = '没有符合条件的词。';
      list.append(empty);
    }
    for (const item of matches.slice(0,state.shown)) {
      const li = document.createElement('li');
      li.className = 'word-item' + (known.has(idOf(item)) ? ' is-known' : '');
      const label = document.createElement('span');
      label.className = 'word-text';
      const word = document.createElement('strong');
      word.textContent = item[0];
      const meta = document.createElement('small');
      meta.textContent = metaOf(item);
      label.append(word,meta);
      const play = document.createElement('button');
      play.type = 'button';
      play.textContent = '▶';
      play.title = `朗读 ${item[0]}`;
      play.setAttribute('aria-label',play.title);
      play.addEventListener('click',() => speak(item[0]));
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.textContent = known.has(idOf(item)) ? '✓' : '○';
      mark.title = known.has(idOf(item)) ? '取消已掌握' : '标记已掌握';
      mark.setAttribute('aria-label',`${mark.title}：${item[0]}`);
      mark.addEventListener('click',() => toggleKnown(item));
      li.append(label,play,mark);
      list.append(li);
    }
    $('resultCount').textContent = `筛选结果 ${matches.length} 条 · 已显示 ${Math.min(matches.length,state.shown)}`;
    $('learnedCount').textContent = `本词表已掌握 ${items(state.list).filter(item => known.has(idOf(item))).length} / ${items(state.list).length}`;
    $('loadMore').hidden = matches.length <= state.shown;
  }
  function updateStudy() {
    const item = state.current;
    $('studyCard').hidden = !item;
    if (!item) return;
    $('studyWord').textContent = item[0];
    $('studyMeta').textContent = metaOf(item);
    $('studyKnown').textContent = known.has(idOf(item)) ? '取消已掌握' : '标记已掌握';
  }
  function randomWord() {
    const candidates = filtered();
    state.current = candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : null;
    updateStudy();
    if (state.current) $('studyCard').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function switchList(list) {
    state.list = list;
    state.shown = 90;
    state.current = null;
    $('wordSearch').value = '';
    $('hideKnown').checked = false;
    const select = $('wordFilter');
    select.replaceChildren(new Option('全部类别','all'));
    const categories = [...new Set(items(list).map(item => item[1]))];
    for (const category of categories) select.add(new Option(category,category));
    $('listIntro').textContent = list === 'proper'
      ? `四册课文中的 ${items(list).length} 条专有名词及名称；含完整名称、单独出现的名称、月份和称谓后的姓氏。`
      : list === 'extra'
        ? `课文中出现但不在 Oxford 3000（美式英语版）的 ${items(list).length} 个其他词形。按实际词形列出，数字为正文出现次数。`
        : `属于 Oxford 3000、但四册课文正文未覆盖的 ${items(list).length} 个词条；按 CEFR 等级筛选。`;
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const selected = tab.dataset.list === list;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    $('panel-list').setAttribute('aria-labelledby',`tab-${list}`);
    updateStudy();
    render();
  }

  $('properTotal').textContent = data.proper.length;
  $('extraTotal').textContent = data.extra.length;
  $('missingTotal').textContent = data.missing.length;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab,index) => {
    tab.addEventListener('click',() => switchList(tab.dataset.list));
    tab.addEventListener('keydown',(event) => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      switchList(next.dataset.list);
      next.focus();
    });
  });
  for (const id of ['wordSearch','wordFilter','hideKnown']) {
    $(id).addEventListener(id === 'wordSearch' ? 'input' : 'change',() => {
      state.shown = 90;
      state.current = null;
      updateStudy();
      render();
    });
  }
  $('loadMore').addEventListener('click',() => { state.shown += 90; render(); });
  $('randomWord').addEventListener('click',randomWord);
  $('studyNext').addEventListener('click',randomWord);
  $('studySpeak').addEventListener('click',() => state.current && speak(state.current[0]));
  $('studyKnown').addEventListener('click',() => state.current && toggleKnown(state.current));
  let theme = 'light';
  try { theme = localStorage.getItem('nce-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { /* Use light theme. */ }
  document.documentElement.dataset.theme = theme;
  $('themeToggle').addEventListener('click',() => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('nce-theme',next); } catch { /* Keep current session theme. */ }
  });
  switchList('proper');
})();
