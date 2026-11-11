/* =====================================================================
   MBRHE Open Data page — tabs, filters, charts and feedback pop-up.
   No inline styles: bar sizes and dot positions are passed to CSS as
   custom properties (--h, --w, --x, --y) that style.css reads.

   PLACEHOLDER DATA: every number, area and project name below is sample
   data for the layout. Replace the PLACEHOLDER_* blocks with the values
   read from the Dubai Pulse datasets, shown as published.
   ===================================================================== */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    /* ---------- Shared chart builders ---------- */

    // items: [{ label, value, display, faded, dimmed, title }]
    function renderVBars(container, items) {
        const max = Math.max(1, ...items.map((i) => i.value));
        container.replaceChildren(...items.map((item) => {
            const col = el('div', 'od-vbar-col' + (item.dimmed ? ' is-dimmed' : ''));
            const plot = el('div', 'od-vbar-plot');
            const bar = el('div', 'od-vbar' + (item.faded ? ' is-faded' : ''));
            bar.style.setProperty('--h', (item.value / max) * 100 + '%');
            if (item.title) bar.title = item.title;
            plot.append(bar);
            col.append(el('span', 'od-vbar-value', item.display ?? fmt(item.value)), plot, el('span', 'od-vbar-label', item.label));
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
            row.append(el('span', 'od-hbar-label', item.label), track, el('span', 'od-hbar-value', item.display ?? fmt(item.value)));
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
    const PLACEHOLDER_LG = {
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
        grants: [3120, 3480, 3950, 4410, 4870, 5230, 4680, 5560, 6010, 6340, 6620],
        genderShare: { All: 1, Male: 0.56, Female: 0.44 },
        maritalShare: { All: 1, Married: 0.78, Single: 0.14, Divorced: 0.05, Widowed: 0.03 },
        ageBands: [['18–29', 0.21], ['30–39', 0.38], ['40–49', 0.24], ['50–59', 0.11], ['60+', 0.06]],
        familySize: [['1–2', 0.12], ['3–4', 0.33], ['5–6', 0.31], ['7–8', 0.16], ['9+', 0.08]]
    };
    const lg = { from: 2015, to: 2025, gender: 'All', marital: 'All' };

    function renderLandGrants() {
        const d = PLACEHOLDER_LG;
        const f = d.genderShare[lg.gender] * d.maritalShare[lg.marital];
        const rows = d.years.map((y, i) => ({ y, v: d.grants[i] * f, inRange: y >= lg.from && y <= lg.to }));
        const inRange = rows.filter((r) => r.inRange);
        const total = inRange.reduce((s, r) => s + r.v, 0);
        const peak = inRange.reduce((a, r) => (r.v > a.v ? r : a), inRange[0]);
        const topAge = d.ageBands.reduce((a, b) => (b[1] > a[1] ? b : a));

        $('#lgRangeText').textContent = lg.from + ' – ' + lg.to;
        $('#lgTotal').textContent = fmt(total);
        $('#lgPeak').textContent = peak ? String(peak.y) : '—';
        $('#lgTopAge').textContent = topAge[0];

        renderVBars($('#lgYearChart'), rows.map((r) => ({ label: String(r.y), value: r.v, faded: !r.inRange })));
        renderHBars($('#lgAgeChart'), d.ageBands.map(([label, p]) => ({ label, value: total * p })));
        renderVBars($('#lgFamilyChart'), d.familySize.map(([label, p]) => ({ label, value: total * p })));
    }

    function initLandGrants() {
        const from = $('#lgFrom');
        const to = $('#lgTo');
        from.addEventListener('input', () => {
            lg.from = Math.min(Number(from.value), lg.to);
            from.value = lg.from;
            renderLandGrants();
        });
        to.addEventListener('input', () => {
            lg.to = Math.max(Number(to.value), lg.from);
            to.value = lg.to;
            renderLandGrants();
        });
        $('#lgGender').addEventListener('click', (e) => {
            const chip = e.target.closest('.od-chip');
            if (!chip) return;
            lg.gender = chip.dataset.value;
            setChipGroup($('#lgGender'), lg.gender);
            renderLandGrants();
        });
        $('#lgMarital').addEventListener('change', (e) => {
            lg.marital = e.target.value;
            renderLandGrants();
        });
        $('#lgReset').addEventListener('click', () => {
            Object.assign(lg, { from: 2015, to: 2025, gender: 'All', marital: 'All' });
            from.value = 2015;
            to.value = 2025;
            $('#lgMarital').value = 'All';
            setChipGroup($('#lgGender'), 'All');
            renderLandGrants();
        });
        renderLandGrants();
    }

    /* =====================================================================
       MASTER CONSTRUCTIONS — rows with no dates are left out of yearly charts
       ===================================================================== */
    const PLACEHOLDER_MC = {
        totalRecords: 22953,
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
        contractValue: [410, 455, 480, 520, 560, 600, 540, 640, 700, 760, 810], // AED million
        loanValue: [300, 330, 350, 380, 410, 440, 395, 470, 515, 560, 595],     // AED million
        serviceShare: { All: 1, 'Construction loan': 0.38, 'Construction grant': 0.27, 'Maintenance loan': 0.21, 'Extension grant': 0.14 },
        statusShare: [['Completed', 0.62], ['In progress', 0.24], ['Not started', 0.09], ['On hold', 0.05]],
        completion: [['0–25%', 0.08], ['26–50%', 0.07], ['51–75%', 0.09], ['76–99%', 0.12], ['100%', 0.64]],
        singleYearShare: 0.09
    };
    const mc = { service: 'All', status: 'All', year: 'All' };

    function renderMasterConstructions() {
        const d = PLACEHOLDER_MC;
        const svcF = d.serviceShare[mc.service];
        const stF = mc.status === 'All' ? 1 : d.statusShare.find((s) => s[0] === mc.status)[1];
        const yrF = mc.year === 'All' ? 1 : d.singleYearShare;
        const f = svcF * stF;
        const yearOn = (y) => mc.year === 'All' || mc.year === String(y);

        const picked = d.years.map((y, i) => i).filter((i) => yearOn(d.years[i]));
        const cSum = picked.reduce((s, i) => s + d.contractValue[i] * f, 0);
        const lSum = picked.reduce((s, i) => s + d.loanValue[i] * f, 0);
        const contracts = d.totalRecords * f * yrF;

        $('#mcContracts').textContent = fmt(contracts);
        $('#mcContractTotal').textContent = 'AED ' + (cSum / 1000).toFixed(1) + 'B';
        $('#mcLoanTotal').textContent = 'AED ' + (lSum / 1000).toFixed(1) + 'B';
        $('#mcDone').textContent = mc.status === 'All' || mc.status === 'Completed' ? '64%' : '0%';

        renderGroupedBars($('#mcValueChart'), d.years.map((y, i) => ({
            label: String(y), a: d.contractValue[i] * f, b: d.loanValue[i] * f, dimmed: !yearOn(y)
        })), ['Contract value', 'Loan value']);
        renderVBars($('#mcCompletionChart'), d.completion.map(([label, p]) => ({ label, value: contracts * p })));
        renderHBars($('#mcStatusChart'), d.statusShare.map(([label, p]) => ({
            label, value: d.totalRecords * svcF * yrF * p, dimmed: mc.status !== 'All' && mc.status !== label
        })));
    }

    function initMasterConstructions() {
        const yearSelect = $('#mcYear');
        PLACEHOLDER_MC.years.forEach((y) => yearSelect.append(new Option(String(y), String(y))));

        $('#mcService').addEventListener('change', (e) => { mc.service = e.target.value; renderMasterConstructions(); });
        $('#mcStatus').addEventListener('change', (e) => { mc.status = e.target.value; renderMasterConstructions(); });
        yearSelect.addEventListener('change', (e) => { mc.year = e.target.value; renderMasterConstructions(); });
        $('#mcReset').addEventListener('click', () => {
            Object.assign(mc, { service: 'All', status: 'All', year: 'All' });
            $('#mcService').value = 'All';
            $('#mcStatus').value = 'All';
            yearSelect.value = 'All';
            renderMasterConstructions();
        });
        renderMasterConstructions();
    }

    /* =====================================================================
       PROJECTS & VILLAS — map → project → villa mix
       ===================================================================== */
    // Area lookup kept on the website (the datasets have no coordinates).
    // lat/lng = approximate centre of each community, used only to place the
    // area marker. `radius` (metres) draws a soft outline around the area.
    // `outlying: true` keeps an area (Hatta) out of the initial map view so the
    // city areas stay readable; selecting it pans the map there.
    const PLACEHOLDER_AREAS = [
        { id: 'twr', name: 'Al Twar', projects: 2, lat: 25.2655, lng: 55.3840, radius: 1400 },
        { id: 'mhs', name: 'Muhaisnah', projects: 3, lat: 25.2700, lng: 55.4200, radius: 1600 },
        { id: 'mzr', name: 'Al Mizhar', projects: 3, lat: 25.2440, lng: 55.4560, radius: 1600 },
        { id: 'khw', name: 'Al Khawaneej', projects: 4, lat: 25.2280, lng: 55.4980, radius: 2200 },
        { id: 'wrq', name: 'Al Warqa', projects: 2, lat: 25.1930, lng: 55.4160, radius: 1800 },
        { id: 'nsb', name: 'Nad Al Sheba', projects: 3, lat: 25.1650, lng: 55.3280, radius: 2000 },
        { id: 'awr', name: 'Al Awir', projects: 4, lat: 25.1700, lng: 55.5450, radius: 2600 },
        { id: 'brs', name: 'Al Barsha South', projects: 2, lat: 25.0700, lng: 55.2300, radius: 1600 },
        { id: 'yls', name: 'Al Yalayis', projects: 2, lat: 24.9700, lng: 55.3500, radius: 2600 },
        { id: 'ltf', name: 'Latifa City', projects: 3, lat: 25.0300, lng: 55.4200, radius: 2200 },
        { id: 'wam', name: 'Wadi Al Amardi', projects: 2, lat: 25.1500, lng: 55.4900, radius: 2000 },
        { id: 'hta', name: 'Hatta', projects: 3, lat: 24.8000, lng: 56.1200, radius: 3000, outlying: true }
    ];
    const MAP_ID = 'DEMO_MAP_ID'; // replace with the site's Map ID from Google Cloud Console
    const UNASSIGNED_COUNT = 2;
    const VILLA_STYLES = ['Modern', 'Traditional', 'Contemporary'];

    // Simple seeded generator so the sample villa data stays stable per project.
    function seeded(seed) {
        let s = Math.abs(seed) % 233280;
        return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }

    const projects = [];
    PLACEHOLDER_AREAS.forEach((a) => {
        for (let i = 0; i < a.projects; i++) projects.push({ name: a.name + ' – Project ' + (i + 1), area: a.name, areaId: a.id });
    });
    for (let i = 0; i < UNASSIGNED_COUNT; i++) projects.push({ name: 'Unassigned – Project ' + (i + 1), area: 'Area not specified', areaId: 'na' });
    projects.forEach((p, i) => {
        p.idx = i;
        const r = seeded(i * 7919 + 13);
        const count = 18 + Math.floor(r() * 48);
        p.villas = [];
        for (let v = 0; v < count; v++) {
            const bedrooms = 3 + Math.floor(r() * 4);
            const style = VILLA_STYLES[Math.floor(r() * 3)];
            const plot = 5000 + r() * 9000;
            const builtMissing = r() < 0.07;
            const built = builtMissing ? null : plot * (0.3 + r() * 0.25);
            p.villas.push({ bedrooms, style, plot, built });
        }
    });

    const pv = { area: 'khw', query: '', project: projects.find((p) => p.areaId === 'khw').idx, bed: 'All' };

    /* ---------- Google Map ---------- */
    const gmap = { map: null, markers: {}, circles: {}, cityBounds: null };
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
                center: { lat: 25.15, lng: 55.38 },
                zoom: 11,
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
                gestureHandling: 'cooperative',
                clickableIcons: false
            });

            gmap.cityBounds = new LatLngBounds();
            PLACEHOLDER_AREAS.forEach((a) => {
                const position = { lat: a.lat, lng: a.lng };
                if (!a.outlying) gmap.cityBounds.extend(position);

                gmap.circles[a.id] = new Circle({
                    map: gmap.map, center: position, radius: a.radius, clickable: true, ...CIRCLE_STYLE.idle
                });
                gmap.circles[a.id].addListener('click', () => selectArea(a.id));

                const pill = el('div', 'od-map-pill');
                pill.dataset.mapArea = a.id;
                pill.append(el('span', null, a.name), el('span', 'od-map-badge', String(a.projects)));

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

            gmap.map.fitBounds(gmap.cityBounds, 40);
            renderAreaState();
        } catch (err) {
            console.error(err);
            container.classList.add('d-none');
            $('#mapFallback').classList.remove('d-none');
        }
    }

    // Pan to the selected area, or back to the whole city when nothing is selected.
    function focusMapOn(areaId) {
        if (!gmap.map) return;
        const area = PLACEHOLDER_AREAS.find((a) => a.id === areaId);
        if (area) {
            gmap.map.panTo({ lat: area.lat, lng: area.lng });
            if (area.outlying || gmap.map.getZoom() < 12) gmap.map.setZoom(13);
        } else {
            gmap.map.fitBounds(gmap.cityBounds, 40);
        }
    }

    function renderProjectSelect() {
        const select = $('#projectSelect');
        const groups = [...PLACEHOLDER_AREAS.map((a) => [a.id, a.name]), ['na', 'Area not specified']];
        groups.forEach(([id, label]) => {
            const og = document.createElement('optgroup');
            og.label = label;
            projects.filter((p) => p.areaId === id).forEach((p) => og.append(new Option(p.name, String(p.idx))));
            select.append(og);
        });
    }

    function renderAreaSelect() {
        const select = $('#areaSelect');
        select.append(new Option('All areas', 'all'));
        PLACEHOLDER_AREAS.forEach((a) => select.append(new Option(a.name + ' (' + a.projects + ')', a.id)));
        select.append(new Option('Area not specified (' + UNASSIGNED_COUNT + ')', 'na'));
    }

    function renderAreaState() {
        $('#areaSelect').value = pv.area;
        $$('[data-area]').forEach((btn) => {
            const on = !pv.query && btn.dataset.area === pv.area;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
        });
        // Map markers and outlines
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
        $('#listTitle').textContent = title;
        $('#listCount').textContent = listed.length + (listed.length === 1 ? ' project' : ' projects');
        $('#noResults').classList.toggle('d-none', listed.length > 0);

        $('#projectList').replaceChildren(...listed.map((p) => {
            const li = el('li');
            const btn = el('button', 'btn od-project-item' + (p.idx === pv.project ? ' active' : ''));
            btn.type = 'button';
            btn.dataset.project = String(p.idx);
            btn.setAttribute('aria-pressed', String(p.idx === pv.project));
            const text = el('span');
            text.append(el('span', 'od-project-name', p.name), el('span', 'od-project-meta', p.area + ' · ' + p.villas.length + ' villas'));
            btn.append(text, el('span', 'od-project-cta', 'Villa mix →'));
            li.append(btn);
            return li;
        }));
    }

    function renderVillaMix() {
        const p = projects[pv.project];
        const filtered = pv.bed === 'All' ? p.villas : p.villas.filter((v) => String(v.bedrooms) === pv.bed);
        const styleCounts = VILLA_STYLES.map((s) => [s, filtered.filter((v) => v.style === s).length]);
        const top = styleCounts.reduce((a, c) => (c[1] > a[1] ? c : a));

        $('#villaTitle').textContent = p.name;
        $('#villaArea').textContent = p.area;
        $('#projectSelect').value = String(p.idx);
        $('#villaCount').textContent = fmt(p.villas.length);
        $('#villaShown').textContent = fmt(filtered.length);
        $('#villaTopStyle').textContent = filtered.length ? top[0] : '—';
        $('#villaNA').textContent = String(filtered.filter((v) => v.built === null).length);

        renderVBars($('#villaBedChart'), [3, 4, 5, 6].map((b) => ({
            label: b + ' BR',
            value: p.villas.filter((v) => v.bedrooms === b).length,
            display: String(p.villas.filter((v) => v.bedrooms === b).length),
            faded: pv.bed !== 'All' && pv.bed !== String(b)
        })));
        renderHBars($('#villaStyleChart'), styleCounts.map(([label, c]) => ({ label, value: c, display: String(c) })));

        // Scatter: plot size (x) against built size (y); missing built size is not plotted.
        $('#villaScatter').replaceChildren(...filtered.filter((v) => v.built !== null).map((v) => {
            const dot = el('span', 'od-dot');
            dot.style.setProperty('--x', ((v.plot - 4000) / 11000) * 100 + '%');
            dot.style.setProperty('--y', ((v.built - 1000) / 5000) * 100 + '%');
            dot.title = 'Plot ' + fmt(v.plot) + ' · Built ' + fmt(v.built);
            return dot;
        }));
    }

    function selectArea(id) {
        pv.area = id;
        pv.query = '';
        $('#projectSearch').value = '';
        const first = projects.find((p) => p.areaId === id);
        if (first) pv.project = first.idx; // "All areas" keeps the current project
        focusMapOn(id);
        renderAreaState();
        renderProjectList();
        renderVillaMix();
    }

    function initProjectsVillas() {
        $('#naCount').textContent = String(UNASSIGNED_COUNT);
        renderAreaSelect();
        renderProjectSelect();
        initGoogleMap();
        $('#areaSelect').addEventListener('change', (e) => selectArea(e.target.value));

        document.addEventListener('click', (e) => {
            const areaBtn = e.target.closest('[data-area]');
            if (areaBtn) { selectArea(areaBtn.dataset.area); return; }
            const projectBtn = e.target.closest('[data-project]');
            if (projectBtn) {
                pv.project = Number(projectBtn.dataset.project);
                renderProjectList();
                renderVillaMix();
            }
        });
        $('#projectSearch').addEventListener('input', (e) => {
            pv.query = e.target.value;
            renderAreaState();
            renderProjectList();
        });
        $('#projectSelect').addEventListener('change', (e) => {
            pv.project = Number(e.target.value);
            renderProjectList();
            renderVillaMix();
        });
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
        initLandGrants();
        initMasterConstructions();
        initProjectsVillas();
        initFeedback();
    });
})();