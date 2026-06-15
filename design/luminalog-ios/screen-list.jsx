// screen-list.jsx — Journal List: search, type filters, date grouping, states.

function FilterChip({ label, icon, active, onClick }) {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      padding: icon ? '7px 13px 7px 10px' : '7px 14px', borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${active ? 'transparent' : t.hairline}`,
      background: active ? t.accent : t.surface, color: active ? t.onAccent : t.text2,
      fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, letterSpacing: -0.1, whiteSpace: 'nowrap',
      boxShadow: active ? 'none' : t.shadowSoft, transition: 'all .15s' }}>
      {icon && <Icon name={icon} size={15} />}{label}
    </button>
  );
}

function JournalListScreen({ empty, loading, grouped, onToggleGroup, onOpenEntry, scrollRef, onScroll }) {
  const t = useTheme();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [searching, setSearching] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'text', label: 'Text', icon: 'text' },
    { key: 'voice', label: 'Voice', icon: 'mic' },
    { key: 'video', label: 'Video', icon: 'video' },
    { key: 'image', label: 'Image', icon: 'image' },
  ];

  const results = ENTRIES.filter(e => {
    if (filter !== 'all' && e.type !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q);
    }
    return true;
  });

  // group by label preserving order
  const groups = [];
  results.forEach(e => {
    const g = groupLabel(e.date);
    let last = groups[groups.length - 1];
    if (!last || last.label !== g) { last = { label: g, items: [] }; groups.push(last); }
    last.items.push(e);
  });

  const showSearchInput = searching || query;

  return (
    <Screen scrollRef={scrollRef} onScroll={onScroll}>
      <div style={{ padding: `8px ${PAD}px 0` }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontFamily: UI_FONT, fontSize: 34, fontWeight: 700, color: t.text, letterSpacing: -0.6 }}>Journal</h1>
          <button onClick={onToggleGroup} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent',
            cursor: 'pointer', color: t.accent, fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, paddingBottom: 4 }}>
            <Icon name="filter" size={17} /> {grouped ? 'Grouped' : 'Flat'}
          </button>
        </div>

        {/* search */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, background: t.surface,
          borderRadius: 13, padding: '0 12px', height: 40, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft }}>
          <Icon name="search" size={18} color={t.text3} />
          <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)}
            placeholder="Search your journal" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: UI_FONT, fontSize: 16, color: t.text, minWidth: 0 }} />
          {query && <button onClick={() => setQuery('')} style={{ border: 'none', background: t.surfaceAlt, borderRadius: '50%', width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.text3, padding: 0 }}>
            <Icon name="close" size={13} /></button>}
        </div>
      </div>

      {/* filter chips */}
      <div className="ll-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: `13px ${PAD}px 4px` }}>
        {filters.map(f => <FilterChip key={f.key} {...f} active={filter === f.key} onClick={() => setFilter(f.key)} />)}
      </div>

      <div style={{ padding: `8px ${PAD}px 0` }}>
        {loading ? (
          <div style={{ marginTop: 4 }}>{[0,1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</div>
        ) : empty ? (
          <ListEmpty />
        ) : results.length === 0 ? (
          <NoResults query={query} />
        ) : grouped ? (
          groups.map(g => (
            <div key={g.label} style={{ marginTop: 10 }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                color: t.text3, padding: '10px 0 2px' }}>{g.label}</div>
              {g.items.map((e, i) => <EntryRow key={e.id} e={e} showTime onOpen={onOpenEntry} last={i === g.items.length - 1} />)}
            </div>
          ))
        ) : (
          <div style={{ marginTop: 4 }}>
            {results.map((e, i) => <EntryRow key={e.id} e={e} showTime onOpen={onOpenEntry} last={i === results.length - 1} />)}
          </div>
        )}

        {/* infinite-scroll footer */}
        {!loading && !empty && results.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 0 4px', color: t.text3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: UI_FONT, fontSize: 13.5, fontWeight: 500 }}>
              <Spinner color={t.text3} size={16} /> Loading older entries…
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}

function ListEmpty() {
  const t = useTheme();
  return (
    <div style={{ marginTop: 64, textAlign: 'center', color: t.text3 }}>
      <div style={{ width: 80, height: 80, margin: '0 auto', borderRadius: '50%', background: t.accentTint, color: t.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="journal" size={36} /></div>
      <h2 style={{ margin: '20px 0 0', fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: t.text }}>No entries yet</h2>
      <p style={{ margin: '8px auto 0', maxWidth: 250, fontFamily: UI_FONT, fontSize: 15, lineHeight: 1.5, color: t.text2 }}>
        Tap the + button below to capture your first moment.
      </p>
    </div>
  );
}

function NoResults({ query }) {
  const t = useTheme();
  return (
    <div style={{ marginTop: 56, textAlign: 'center', color: t.text3 }}>
      <Icon name="search" size={40} color={t.text3} style={{ margin: '0 auto' }} />
      <h2 style={{ margin: '16px 0 0', fontFamily: UI_FONT, fontSize: 18, fontWeight: 600, color: t.text }}>No results</h2>
      <p style={{ margin: '6px auto 0', maxWidth: 260, fontFamily: UI_FONT, fontSize: 15, lineHeight: 1.5, color: t.text2 }}>
        Nothing matches {query ? `\u201c${query}\u201d` : 'that filter'}. Try a different word or type.
      </p>
    </div>
  );
}

Object.assign(window, { JournalListScreen, FilterChip });
