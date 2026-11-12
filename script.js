/* =====================================================================
   MBRHE Open Data page — tabs, filters, charts and feedback pop-up.
   No inline styles: bar sizes and dot positions are passed to CSS as
   custom properties (--h, --w, --x, --y) that style.css reads.

   PLACEHOLDER DATA: every number, area, project and list value below is
   sample data for the layout. Replace the PLACEHOLDER_* blocks with the
   values read from the Dubai Pulse datasets.

   DATA RULE: values from the datasets (gender, marital status, service
   type, status, area, project and style names, bedrooms) are shown
   exactly as written in the dataset — never translated or cleaned.
   Filter lists are built from the distinct values found in the data.
   ===================================================================== */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    // Numbers use Western digits.
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const NOT_AVAILABLE = '__NA__'; // internal key for an empty dataset value; shown as "Not available"
    const SHOW_ALL = ''; // value of every "Show all" option (the dataset itself may contain "All")
    const label = (v) => (v === NOT_AVAILABLE ? 'Not available' : v);

    /* ---------- Dubai Pulse links: each button opens its own dataset ----------
       Fill in the dataset page addresses (English and Arabic) from Dubai Pulse.
       Buttons in index.html carry data-dataset="<id>" and open in a new tab. */
    const DATASET_LINKS = {
        mrhe_land_grants: { en: '', ar: '' },
        mrhe_master_constructions: { en: '', ar: '' },
        // "Ready-made House Projects by Mohammed Bin Rashid Housing Establishment"
        mrhe_projects: { en: '', ar: '' },
        mrhe_projects_villas: { en: '', ar: '' }
    };

    function initDatasetLinks() {
        $$('[data-dataset]').forEach((link) => {
            const entry = DATASET_LINKS[link.dataset.dataset] || {};
            const url = entry[document.documentElement.lang] || entry.en;
            if (url) {
                link.href = url;
            } else {
                console.warn('Dubai Pulse address missing for dataset:', link.dataset.dataset);
            }
        });
    }

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    // Text that comes from a dataset: dir="auto" lets Arabic and English values read correctly.
    const dataEl = (tag, className, text) => {
        const node = el(tag, className, text);
        node.dir = 'auto';
        return node;
    };
    // Distinct values in the order they first appear; empty values become "Not available".
    const asPublished = (v) => (v === null || v === undefined || String(v).trim() === '' ? NOT_AVAILABLE : String(v));
    const distinct = (values) => Array.from(new Set(values.map(asPublished)));
    const fillSelect = (select, values, labelFn) => {
        values.forEach((v) => {
            const opt = new Option(labelFn ? labelFn(v) : label(v), v);
            opt.dir = 'auto';
            select.append(opt);
        });
    };

    // Small seeded generator so placeholder data stays the same on every load.
    function seeded(seed) {
        let s = Math.abs(seed) % 233280;
        return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }

    /* ---------- Shared chart builders ---------- */

    // items: [{ label, value, display, faded, dimmed, title }]
    function renderVBars(container, items) {
        const max = Math.max(1, ...items.map((i) => i.value));
        container.replaceChildren(...items.map((item) => {
            const col = el('div', 'od-vbar-col' + (item.dimmed ? ' is-dimmed' : ''));
            const plot = el('div', 'od-vbar-plot');
            const bar = el('div', 'od-vbar' + (item.faded ? ' is-faded' : ''));
            bar.style.setProperty('--h', (item.value / max) * 100 + '%');
            bar.title = item.title || label(item.label) + ': ' + (item.display ?? fmt(item.value));
            plot.append(bar);
            col.append(el('span', 'od-vbar-value', item.display ?? fmt(item.value)), plot, dataEl('span', 'od-vbar-label', label(item.label)));
            return col;
        }));
    }

    // items: [{ label, a, b, dimmed }]  (two bars per group)
    function renderGroupedBars(container, items, titles) {
        const max = Math.max(1, ...items.flatMap((i) => [i.a, i.b]));
        container.replaceChildren(...items.map((item) => {
            const col = el('div', 'od-vbar-col' + (item.dimmed ? ' is-dimmed' : ''));
            const plot = el('div', 'od-vbar-plot');
            const a = el('div', 'od-vbar od-vbar-pair');
            const b = el('div', 'od-vbar od-vbar-pair is-loan');
            a.style.setProperty('--h', (item.a / max) * 100 + '%');
            b.style.setProperty('--h', (item.b / max) * 100 + '%');
            a.title = titles[0] + ': AED ' + fmt(item.a) + 'M';
            b.title = titles[1] + ': AED ' + fmt(item.b) + 'M';
            plot.append(a, b);
            col.append(plot, el('span', 'od-vbar-label', item.label));
            return col;
        }));
    }

    // items: [{ label, value, display, dimmed }]
    function renderHBars(container, items) {
        const max = Math.max(1, ...items.map((i) => i.value));
        container.replaceChildren(...items.map((item) => {
            const row = el('div', 'od-hbar-row' + (item.dimmed ? ' is-dimmed' : ''));
            const track = el('div', 'od-hbar-track');
            const fill = el('div', 'od-hbar-fill');
            fill.style.setProperty('--w', (item.value / max) * 100 + '%');
            track.append(fill);
            row.append(dataEl('span', 'od-hbar-label', label(item.label)), track, el('span', 'od-hbar-value', item.display ?? fmt(item.value)));
            return row;
        }));
    }

    function setChipGroup(group, value) {
        $$('.od-chip', group).forEach((chip) => {
            const on = chip.dataset.value === value;
            chip.classList.toggle('active', on);
            chip.setAttribute('aria-pressed', String(on));
        });
    }

    /* =====================================================================
       LAND GRANTS — totals and charts only, never single records
       ===================================================================== */
    const PLACEHOLDER_LG = (() => {
        const years = [];
        for (let y = 1981; y <= 2025; y++) years.push(y); // full dataset span (~45 years)
        const r = seeded(4021);
        const grants = years.map((y, i) => Math.round(260 + i * 128 + r() * 420));
        return {
            years,
            grants,
            // Values exactly as written in the dataset, with each value's share of records.
            gender: [['Male', 0.55], ['Female', 0.44], ['', 0.01]],
            marital: [['Married', 0.74], ['Single', 0.14], ['Divorced', 0.05], ['Widowed', 0.03], ['', 0.04]],
            ageBands: [['18–29', 0.20], ['30–39', 0.36], ['40–49', 0.23], ['50–59', 0.11], ['60+', 0.06], [NOT_AVAILABLE, 0.04]],
            familySize: [['0', 0.03], ['1–2', 0.11], ['3–4', 0.32], ['5–6', 0.30], ['7–8', 0.16], ['9+', 0.08]]
        };
    })();
    const LG_MIN = PLACEHOLDER_LG.years[0];
    const LG_MAX = PLACEHOLDER_LG.years[PLACEHOLDER_LG.years.length - 1];
    const lg = { from: LG_MIN, to: LG_MAX, gender: SHOW_ALL, marital: SHOW_ALL };
    const shareOf = (list, value) => (value === SHOW_ALL ? 1 : (list.find((x) => asPublished(x[0]) === value) || [0, 0])[1]);

    function renderLandGrants() {
        const d = PLACEHOLDER_LG;
        const f = shareOf(d.gender, lg.gender) * shareOf(d.marital, lg.marital);
        const rows = d.years.map((y, i) => ({ y, v: d.grants[i] * f, inRange: y >= lg.from && y <= lg.to }));
        const inRange = rows.filter((r) => r.inRange);
        const total = inRange.reduce((s, r) => s + r.v, 0);
        const peak = inRange.reduce((a, r) => (r.v > a.v ? r : a), inRange[0]);
        const topAge = d.ageBands.filter((b) => b[0] !== NOT_AVAILABLE).reduce((a, b) => (b[1] > a[1] ? b : a));

        $('#lgRangeText').textContent = lg.from + ' – ' + lg.to;
        $('#lgTotal').textContent = fmt(total);
        $('#lgPeak').textContent = peak ? String(peak.y) : '—';
        $('#lgTopAge').textContent = topAge[0];

        renderVBars($('#lgYearChart'), rows.map((r) => ({ label: String(r.y), value: r.v, faded: !r.inRange })));
        renderHBars($('#lgAgeChart'), d.ageBands.map(([label, p]) => ({ label, value: total * p })));
        renderVBars($('#lgFamilyChart'), d.familySize.map(([label, p]) => ({ label, value: total * p })));
    }

    // Keep the selected range visible in the scrollable year chart.
    function scrollYearChartTo(year) {
        const scroller = $('#lgYearScroll');
        const col = $$('.od-vbar-col', $('#lgYearChart'))[year - LG_MIN];
        if (!col) return;
        const left = col.offsetLeft - scroller.offsetLeft;
        if (left < scroller.scrollLeft || left + col.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
            scroller.scrollLeft = left - scroller.clientWidth / 2;
        }
    }

    function initLandGrants() {
        const from = $('#lgFrom');
        const to = $('#lgTo');
        [from, to].forEach((input) => { input.min = LG_MIN; input.max = LG_MAX; });
        from.value = LG_MIN;
        to.value = LG_MAX;

        fillSelect($('#lgGender'), distinct(PLACEHOLDER_LG.gender.map((g) => g[0])));
        fillSelect($('#lgMarital'), distinct(PLACEHOLDER_LG.marital.map((m) => m[0])));

        from.addEventListener('input', () => {
            lg.from = Math.min(Number(from.value), lg.to);
            from.value = lg.from;
            renderLandGrants();
            scrollYearChartTo(lg.from);
        });
        to.addEventListener('input', () => {
            lg.to = Math.max(Number(to.value), lg.from);
            to.value = lg.to;
            renderLandGrants();
            scrollYearChartTo(lg.to);
        });
        $('#lgGender').addEventListener('change', (e) => { lg.gender = e.target.value; renderLandGrants(); });
        $('#lgMarital').addEventListener('change', (e) => { lg.marital = e.target.value; renderLandGrants(); });
        $('#lgReset').addEventListener('click', () => {
            Object.assign(lg, { from: LG_MIN, to: LG_MAX, gender: SHOW_ALL, marital: SHOW_ALL });
            from.value = LG_MIN;
            to.value = LG_MAX;
            $('#lgGender').value = SHOW_ALL;
            $('#lgMarital').value = SHOW_ALL;
            renderLandGrants();
        });
        renderLandGrants();
        // Open on the most recent years.
        const scroller = $('#lgYearScroll');
        scroller.scrollLeft = scroller.scrollWidth;
    }

    /* =====================================================================
       MASTER CONSTRUCTIONS — rows with no dates are left out of yearly figures
       ===================================================================== */
    const PLACEHOLDER_MC = (() => {
        // 16 service types and 23 statuses, as written in the dataset.
        // Note the dataset's own service type "All": it is a real value, not "Show all".
        const services = ['All'];
        for (let i = 2; i <= 16; i++) services.push('Service type ' + String(i).padStart(2, '0'));
        const statuses = [];
        for (let i = 1; i <= 23; i++) statuses.push('Status ' + String(i).padStart(2, '0'));
        const weights = (n, seed) => {
            const r = seeded(seed);
            const raw = Array.from({ length: n }, (_, i) => (n - i) * (0.6 + r()));
            const sum = raw.reduce((a, b) => a + b, 0);
            return raw.map((w) => w / sum);
        };
        const sW = weights(services.length, 77);
        const tW = weights(statuses.length, 91);
        return {
            totalRecords: 22953,
            years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
            contractValue: [410, 455, 480, 520, 560, 600, 540, 640, 700, 760, 810], // AED million
            loanValue: [300, 330, 350, 380, 410, 440, 395, 470, 515, 560, 595],     // AED million
            serviceShare: services.map((s, i) => [s, sW[i]]),
            statusShare: statuses.map((s, i) => [s, tW[i]]),
            completion: [['0–25%', 0.08], ['26–50%', 0.07], ['51–75%', 0.09], ['76–99%', 0.12], ['100%', 0.64]],
            singleYearShare: 0.09
        };
    })();
    const mc = { service: SHOW_ALL, status: SHOW_ALL, year: SHOW_ALL };

    function renderMasterConstructions() {
        const d = PLACEHOLDER_MC;
        const svcF = shareOf(d.serviceShare, mc.service);
        const stF = shareOf(d.statusShare, mc.status);
        const yearPicked = mc.year !== SHOW_ALL;
        const yrF = yearPicked ? d.singleYearShare : 1;
        const f = svcF * stF;
        const yearOn = (y) => !yearPicked || mc.year === String(y);

        const picked = d.years.map((y, i) => i).filter((i) => yearOn(d.years[i]));
        const cSum = picked.reduce((s, i) => s + d.contractValue[i] * f, 0);
        const lSum = picked.reduce((s, i) => s + d.loanValue[i] * f, 0);
        const contracts = d.totalRecords * f * yrF;
        const fully = d.completion.find((c) => c[0] === '100%')[1];

        $('#mcContracts').textContent = fmt(contracts);
        // Values are in AED million: show billions from 1,000M up, millions below.
        const aed = (m) => (m >= 1000 ? 'AED ' + (m / 1000).toFixed(1) + 'B' : 'AED ' + fmt(m) + 'M');
        $('#mcContractTotal').textContent = aed(cSum);
        $('#mcLoanTotal').textContent = aed(lSum);
        $('#mcDone').textContent = fmt(contracts * fully);
        $('#mcNoDateNote').classList.toggle('d-none', !yearPicked);

        renderGroupedBars($('#mcValueChart'), d.years.map((y, i) => ({
            label: String(y), a: d.contractValue[i] * f, b: d.loanValue[i] * f, dimmed: !yearOn(y)
        })), ['Contract value', 'Loan value']);
        renderVBars($('#mcCompletionChart'), d.completion.map(([label, p]) => ({ label, value: contracts * p })));
        renderHBars($('#mcStatusChart'), d.statusShare.map(([label, p]) => ({
            label, value: d.totalRecords * svcF * yrF * p, dimmed: mc.status !== SHOW_ALL && mc.status !== label
        })));
        $('#mcStatusCount').textContent = d.statusShare.length + ' statuses · scroll for more';
    }

    function initMasterConstructions() {
        const d = PLACEHOLDER_MC;
        fillSelect($('#mcService'), distinct(d.serviceShare.map((s) => s[0])));
        fillSelect($('#mcStatus'), distinct(d.statusShare.map((s) => s[0])));
        fillSelect($('#mcYear'), d.years.map(String));

        $('#mcService').addEventListener('change', (e) => { mc.service = e.target.value; renderMasterConstructions(); });
        $('#mcStatus').addEventListener('change', (e) => { mc.status = e.target.value; renderMasterConstructions(); });
        $('#mcYear').addEventListener('change', (e) => { mc.year = e.target.value; renderMasterConstructions(); });
        $('#mcReset').addEventListener('click', () => {
            Object.assign(mc, { service: SHOW_ALL, status: SHOW_ALL, year: SHOW_ALL });
            $('#mcService').value = SHOW_ALL;
            $('#mcStatus').value = SHOW_ALL;
            $('#mcYear').value = SHOW_ALL;
            renderMasterConstructions();
        });
        renderMasterConstructions();
    }

    /* =====================================================================
       PROJECTS & VILLAS — map → project → villa mix
       ===================================================================== */
    // mrhe_projects: area and project names exactly as in the dataset.
    // lat/lng/radius come from a lookup kept on the website (the dataset has
    // no coordinates): approximate centre and size of each community.
    const PLACEHOLDER_AREAS = [
        { id: 'twr', name: 'الطوار', projects: 2, lat: 25.2655, lng: 55.3840, radius: 1400 },
        { id: 'mhs', name: 'محيصنة', projects: 3, lat: 25.2700, lng: 55.4200, radius: 1600 },
        { id: 'mzr', name: 'المزهر', projects: 3, lat: 25.2440, lng: 55.4560, radius: 1600 },
        { id: 'khw', name: 'الخوانيج', projects: 4, lat: 25.2280, lng: 55.4980, radius: 2200 },
        { id: 'wrq', name: 'الورقاء', projects: 2, lat: 25.1930, lng: 55.4160, radius: 1800 },
        { id: 'nsb', name: 'ند الشبا', projects: 3, lat: 25.1650, lng: 55.3280, radius: 2000 },
        { id: 'awr', name: 'العوير', projects: 4, lat: 25.1700, lng: 55.5450, radius: 2600 },
        { id: 'brs', name: 'البرشاء جنوب', projects: 2, lat: 25.0700, lng: 55.2300, radius: 1600 },
        { id: 'yls', name: 'اليلايس', projects: 2, lat: 24.9700, lng: 55.3500, radius: 2600 },
        { id: 'ltf', name: 'مدينة لطيفة', projects: 3, lat: 25.0300, lng: 55.4200, radius: 2200 },
        { id: 'wam', name: 'وادي العمردي', projects: 2, lat: 25.1500, lng: 55.4900, radius: 2000 },
        { id: 'hta', name: 'حتا', projects: 3, lat: 24.8000, lng: 56.1200, radius: 3000 }
    ];
    const MAP_ID = 'DEMO_MAP_ID'; // replace with the site's Map ID from Google Cloud Console
    const UNASSIGNED_COUNT = 2;
    // mrhe_projects_villas: style names exactly as in the dataset.
    const VILLA_STYLES = ['حديث', 'تقليدي', 'معاصر'];

    // mrhe_projects (the projects on the map)
    const projects = [];
    PLACEHOLDER_AREAS.forEach((a) => {
        for (let i = 0; i < a.projects; i++) projects.push({ name: 'مشروع ' + a.name + ' ' + (i + 1), area: a.name, areaId: a.id });
    });
    for (let i = 0; i < UNASSIGNED_COUNT; i++) projects.push({ name: 'مشروع بدون منطقة ' + (i + 1), area: '', areaId: 'na' });

    // mrhe_projects_villas — keyed by project name. Some projects on the map have
    // no villa records, and some villa projects are not in the projects dataset.
    const NO_VILLA_PROJECTS = new Set([2, 9, 20]);          // sample: map projects without villa records
    const VILLA_ONLY_PROJECTS = ['مشروع القوز 1', 'مشروع الممزر 1'];  // sample: in villas dataset only
    const villasByProject = new Map();
    function makeVillas(seed) {
        const r = seeded(seed * 7919 + 13);
        const count = 18 + Math.floor(r() * 48);
        const list = [];
        for (let v = 0; v < count; v++) {
            const bedRoll = r();
            const bedrooms = bedRoll < 0.03 ? '' : String(2 + Math.floor(r() * 6)); // 2–7, a few empty
            const style = VILLA_STYLES[Math.floor(r() * VILLA_STYLES.length)];
            const plot = 5000 + r() * 9000;
            const built = r() < 0.07 ? null : plot * (0.3 + r() * 0.25);
            list.push({ bedrooms: asPublished(bedrooms), style, plot, built });
        }
        return list;
    }
    projects.forEach((p, i) => {
        p.idx = i;
        if (!NO_VILLA_PROJECTS.has(i)) villasByProject.set(p.name, makeVillas(i));
    });
    VILLA_ONLY_PROJECTS.forEach((name, i) => villasByProject.set(name, makeVillas(100 + i)));

    const villasOf = (name) => villasByProject.get(name) || [];
    const projectByName = new Map(projects.map((p) => [p.name, p]));
    // Bedroom values as they appear in the villas dataset (numbers sorted, "Not available" last).
    const BEDROOM_VALUES = distinct([...villasByProject.values()].flat().map((v) => v.bedrooms)).sort((a, b) => {
        if (a === NOT_AVAILABLE) return 1;
        if (b === NOT_AVAILABLE) return -1;
        return Number(a) - Number(b) || a.localeCompare(b);
    });

    const firstWithVillas = (areaId) => projects.find((p) => p.areaId === areaId && villasOf(p.name).length);
    const pv = { area: 'khw', query: '', project: firstWithVillas('khw').name, bed: 'All' };

    /* ---------- Google Map ---------- */
    const gmap = { map: null, markers: {}, circles: {}, emirateBounds: null };
    const CIRCLE_STYLE = {
        idle: { strokeColor: '#3F51B5', strokeOpacity: 0.55, strokeWeight: 1.5, fillColor: '#5C6BC0', fillOpacity: 0.14 },
        active: { strokeColor: '#0B5DA0', strokeOpacity: 0.9, strokeWeight: 2, fillColor: '#0B5DA0', fillOpacity: 0.24 }
    };

    async function initGoogleMap() {
        const container = $('#areaMap');
        try {
            if (!window.google || !google.maps || !google.maps.importLibrary) throw new Error('Google Maps loader missing');
            const { Map, Circle } = await google.maps.importLibrary('maps');
            const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
            const { LatLngBounds } = await google.maps.importLibrary('core');

            gmap.map = new Map(container, {
                mapId: MAP_ID,
                center: { lat: 25.05, lng: 55.6 },
                zoom: 9,
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
                gestureHandling: 'cooperative',
                clickableIcons: false
            });

            // Default view covers the whole emirate of Dubai, Hatta included.
            gmap.emirateBounds = new LatLngBounds();
            PLACEHOLDER_AREAS.forEach((a) => {
                const position = { lat: a.lat, lng: a.lng };
                gmap.emirateBounds.extend(position);

                gmap.circles[a.id] = new Circle({
                    map: gmap.map, center: position, radius: a.radius, clickable: true, ...CIRCLE_STYLE.idle
                });
                gmap.circles[a.id].addListener('click', () => selectArea(a.id));

                const pill = el('div', 'od-map-pill');
                pill.dataset.mapArea = a.id;
                pill.append(dataEl('span', null, a.name), el('span', 'od-map-badge', String(a.projects)));

                const marker = new AdvancedMarkerElement({
                    map: gmap.map,
                    position,
                    content: pill,
                    title: a.name + ': ' + a.projects + ' projects',
                    gmpClickable: true
                });
                marker.addEventListener('gmp-click', () => selectArea(a.id));
                gmap.markers[a.id] = marker;
            });

            gmap.map.fitBounds(gmap.emirateBounds, 48);
            renderAreaState();
        } catch (err) {
            console.error(err);
            container.classList.add('d-none');
            $('#mapFallback').classList.remove('d-none');
        }
    }

    // Zoom to the selected area, or back to the whole emirate.
    function focusMapOn(areaId) {
        if (!gmap.map) return;
        const area = PLACEHOLDER_AREAS.find((a) => a.id === areaId);
        if (area) {
            gmap.map.panTo({ lat: area.lat, lng: area.lng });
            gmap.map.setZoom(13);
        } else {
            gmap.map.fitBounds(gmap.emirateBounds, 48);
        }
    }

    function renderAreaSelect() {
        const select = $('#areaSelect');
        select.append(new Option('All areas', 'all'));
        PLACEHOLDER_AREAS.forEach((a) => {
            const opt = new Option(a.name + ' (' + a.projects + ')', a.id);
            opt.dir = 'auto';
            select.append(opt);
        });
        select.append(new Option('Area not specified' + ' (' + UNASSIGNED_COUNT + ')', 'na'));
    }

    // Every project in the villas dataset, grouped by area where the projects
    // dataset gives one, and "Not in the projects dataset" otherwise.
    function renderProjectSelect() {
        const select = $('#projectSelect');
        const groups = new Map();
        [...villasByProject.keys()].forEach((name) => {
            const p = projectByName.get(name);
            let group = 'Not in the projects dataset';
            if (p) group = p.area || 'Area not specified';
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group).push(name);
        });
        groups.forEach((names, label) => {
            const og = document.createElement('optgroup');
            og.label = label;
            fillSelect(og, names);
            select.append(og);
        });
    }

    function renderBedFilter() {
        const group = $('#bedFilter');
        const chip = (value, label) => {
            const btn = el('button', 'btn od-chip', label);
            btn.type = 'button';
            btn.dataset.value = value;
            btn.dir = 'auto';
            return btn;
        };
        group.replaceChildren(chip('All', 'Show all'), ...BEDROOM_VALUES.map((v) => chip(v, label(v))));
        setChipGroup(group, pv.bed);
    }

    function renderAreaState() {
        $('#areaSelect').value = pv.area;
        $$('[data-area]').forEach((btn) => {
            const on = !pv.query && btn.dataset.area === pv.area;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
        });
        Object.entries(gmap.markers).forEach(([id, marker]) => {
            const on = !pv.query && id === pv.area;
            marker.content.classList.toggle('active', on);
            marker.zIndex = on ? 10 : 1;
            gmap.circles[id].setOptions(on ? CIRCLE_STYLE.active : CIRCLE_STYLE.idle);
        });
    }

    function renderProjectList() {
        const q = pv.query.trim().toLowerCase();
        const inArea = (p) => pv.area === 'all' || p.areaId === pv.area;
        const listed = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects.filter(inArea);
        const area = PLACEHOLDER_AREAS.find((a) => a.id === pv.area);

        let title = area ? area.name : (pv.area === 'na' ? 'Area not specified' : 'All projects');
        if (q) title = 'Search results';
        const titleEl = $('#listTitle');
        titleEl.textContent = title;
        titleEl.dir = 'auto';
        $('#listCount').textContent = listed.length === 1 ? '1 project' : listed.length + ' projects';
        $('#noResults').classList.toggle('d-none', listed.length > 0);

        $('#projectList').replaceChildren(...listed.map((p) => {
            const li = el('li');
            const count = villasOf(p.name).length;
            const text = el('span');
            // Dataset value (area) and page text (record count) sit in separate spans so mixed Arabic/English reads in order.
            const meta = el('span', 'od-project-meta');
            meta.append(
                p.area ? dataEl('bdi', null, p.area) : el('span', null, 'Area not specified'),
                el('span', null, ' · ' + (count ? fmt(count) + ' villa records' : 'No villa records'))
            );
            text.append(dataEl('span', 'od-project-name', p.name), meta);

            if (!count) {
                // No villa records: shown for completeness, without a "Villa mix" link.
                const row = el('div', 'od-project-item is-static');
                row.append(text);
                li.append(row);
                return li;
            }
            const selected = p.name === pv.project;
            const btn = el('button', 'btn od-project-item' + (selected ? ' active' : ''));
            btn.type = 'button';
            btn.dataset.project = p.name;
            btn.setAttribute('aria-pressed', String(selected));
            btn.append(text, el('span', 'od-project-cta', 'Villa mix →'));
            li.append(btn);
            return li;
        }));
    }

    function renderVillaMix() {
        const name = pv.project;
        const villas = villasOf(name);
        const p = projectByName.get(name);
        const filtered = pv.bed === 'All' ? villas : villas.filter((v) => v.bedrooms === pv.bed);
        const styles = distinct(villas.map((v) => v.style));
        const styleCounts = styles.map((s) => [s, filtered.filter((v) => v.style === s).length]);
        const top = styleCounts.reduce((a, c) => (c[1] > a[1] ? c : a), ['—', 0]);
        const missingBuilt = filtered.filter((v) => v.built === null).length;

        $('#villaTitle').textContent = name;
        $('#villaTitle').dir = 'auto';
        $('#villaArea').textContent = p ? (p.area || 'Area not specified') : 'Not in the projects dataset';
        $('#villaArea').dir = 'auto';
        $('#projectSelect').value = name;
        $('#villaCount').textContent = fmt(villas.length);
        $('#villaShown').textContent = fmt(filtered.length);
        $('#villaTopStyle').textContent = top[1] ? top[0] : '—';
        $('#villaTopStyle').dir = 'auto';
        $('#villaNA').textContent = fmt(missingBuilt);

        renderVBars($('#villaBedChart'), BEDROOM_VALUES.map((b) => {
            const n = villas.filter((v) => v.bedrooms === b).length;
            return { label: b, value: n, display: String(n), faded: pv.bed !== 'All' && pv.bed !== b };
        }));
        renderHBars($('#villaStyleChart'), styleCounts.map(([label, c]) => ({ label, value: c, display: String(c) })));

        // Scatter: plot size (x) against built size (y). Empty built size = "Not available", not plotted.
        // Axes are scaled to every villa in the project (with headroom), so they stay put while filtering.
        const plotted = filtered.filter((v) => v.built !== null);
        const withBuilt = villas.filter((v) => v.built !== null);
        const range = (vals) => {
            const lo = Math.min(...vals);
            const hi = Math.max(...vals);
            const pad = (hi - lo || hi || 1) * 0.08;
            return [lo - pad, hi + pad];
        };
        const [xLo, xHi] = withBuilt.length ? range(withBuilt.map((v) => v.plot)) : [0, 1];
        const [yLo, yHi] = withBuilt.length ? range(withBuilt.map((v) => v.built)) : [0, 1];
        const empty = $('#villaScatterEmpty');
        empty.classList.toggle('d-none', plotted.length > 0);
        $('#villaScatter').replaceChildren(empty, ...plotted.map((v) => {
            const dot = el('span', 'od-dot');
            dot.style.setProperty('--x', ((v.plot - xLo) / (xHi - xLo)) * 100 + '%');
            dot.style.setProperty('--y', ((v.built - yLo) / (yHi - yLo)) * 100 + '%');
            dot.title = 'Plot size ' + fmt(v.plot) + ' · Built size ' + fmt(v.built);
            return dot;
        }));
        $('#villaScatterCount').textContent = fmt(plotted.length) + ' plotted · ' + fmt(missingBuilt) + ' built size not available';
    }

    function selectArea(id) {
        pv.area = id;
        pv.query = '';
        $('#projectSearch').value = '';
        const first = firstWithVillas(id);
        if (first) pv.project = first.name; // otherwise keep the current villa mix
        focusMapOn(id);
        renderAreaState();
        renderProjectList();
        renderVillaMix();
    }

    function selectProject(name) {
        pv.project = name;
        if (!BEDROOM_VALUES.includes(pv.bed)) pv.bed = 'All';
        renderProjectList();
        renderVillaMix();
    }

    function initProjectsVillas() {
        $('#naCount').textContent = String(UNASSIGNED_COUNT);
        renderAreaSelect();
        renderProjectSelect();
        renderBedFilter();
        initGoogleMap();
        $('#areaSelect').addEventListener('change', (e) => selectArea(e.target.value));

        document.addEventListener('click', (e) => {
            const areaBtn = e.target.closest('[data-area]');
            if (areaBtn) { selectArea(areaBtn.dataset.area); return; }
            const projectBtn = e.target.closest('[data-project]');
            if (projectBtn) selectProject(projectBtn.dataset.project);
        });
        $('#projectSearch').addEventListener('input', (e) => {
            pv.query = e.target.value;
            renderAreaState();
            renderProjectList();
        });
        $('#projectSelect').addEventListener('change', (e) => selectProject(e.target.value));
        $('#bedFilter').addEventListener('click', (e) => {
            const chip = e.target.closest('.od-chip');
            if (!chip) return;
            pv.bed = chip.dataset.value;
            setChipGroup($('#bedFilter'), pv.bed);
            renderVillaMix();
        });

        renderAreaState();
        renderProjectList();
        renderVillaMix();
    }

    /* =====================================================================
       FEEDBACK POP-UP — opens once per visit; "Give feedback" reopens it
       ===================================================================== */
    function initFeedback() {
        const modalEl = $('#feedbackModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        const KEY = 'mbrheOpenDataFeedbackShown';

        let shown = false;
        try { shown = sessionStorage.getItem(KEY) === '1'; } catch (err) { /* storage blocked: show once per page load */ }
        if (!shown) {
            modal.show();
            try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* ignore */ }
        }

        const msg = $('#fbMessage');
        const counter = $('#fbCounter');
        msg.addEventListener('input', () => { counter.textContent = msg.value.length + ' / 200'; });

        $('#feedbackForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            // TODO: post to the existing feedback endpoint, then close.
            modal.hide();
            form.reset();
            form.classList.remove('was-validated');
            counter.textContent = '0 / 200';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initDatasetLinks();
        initLandGrants();
        initMasterConstructions();
        initProjectsVillas();
        initFeedback();
    });
})();
