const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
function load(file, mocks, timers, fabric = true) {
    if (!compiled.has(file)) {
        compiled.set(file, babel.transformFileSync(path.join(root, file), {
            babelrc: false, configFile: false,
            plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
        }).code);
    }
    const exports = {};
    vm.runInNewContext(compiled.get(file), {
        exports, require: name => {
            if (Object.hasOwn(mocks, name)) return mocks[name];
            if (name === 'prop-types' || name === 'crypto-js/sha1') return require(name);
            throw new Error(`Missing mock: ${name}`);
        },
        global: {nativeFabricUIManager: fabric},
        setTimeout: fn => { const id = ++timers.id; timers.jobs.set(id, fn); return id; },
        clearTimeout: id => timers.jobs.delete(id),
    }, {filename: file});
    return exports.default;
}
function environment(os = 'ios', fabric = true, extra = {}) {
    const timers = {id: 0, jobs: new Map(), run() {
        const jobs = [...this.jobs.values()]; this.jobs.clear(); jobs.forEach(fn => fn());
    }};
    class Component {
        constructor(props) { this.props = props; }
        setState(update, callback) { Object.assign(this.state, update); callback?.(); }
    }
    const React = {Component, createElement: (type, props, ...children) => {
        assert.ok(type, 'element type must be defined');
        return {type, props: {...props, children}};
    }};
    const calls = [];
    const mocks = {
        react: React,
        'react-native': {Platform: {OS: os}, StyleSheet: {create: x => x},
            View: 'View', Text: 'Text', ScrollView: 'ScrollView', Image: {},
            requireNativeComponent: () => 'WindowsPDF'},
        'deprecated-react-native-prop-types': {ViewPropTypes: {}},
        './fabric/RNPDFPdfNativeComponent': {__esModule: true, default: 'NativePDF',
            Commands: {setNativePage: (...args) => calls.push(args)}},
        'react-native-blob-util': {},
        './PdfManager': {loadFile: async () => [1, 5, 100, 200], closeFile() {}},
        './PdfPageView': 'Page', './DoubleTapView': 'DoubleTap',
        './PinchZoomView': 'PinchZoom', './PdfViewFlatList': 'FlatList',
        ...extra,
    };
    let imports = 0;
    Object.defineProperty(mocks, './PdfView', {get() { imports++; return extra['./PdfView'] || 'JSPDF'; }});
    return {timers, mocks, calls, imports: () => imports,
        make(file, props = {}) {
            const Type = load(file, mocks, timers, fabric);
            return new Type({...Type.defaultProps, ...props});
        }};
}

for (const fabric of [true, false]) {
    for (const [os, props, js] of [
        ['android', {}, true], ['ios', {renderPageOverlay: () => null}, true],
        ['ios', {usePDFKit: false}, true], ['ios', {}, false],
        ['ios', {customFlatListWrapper() {}}, false], ['windows', {usePDFKit: false}, false],
    ]) {
        test(`cold routing and imperative dispatch: ${os} ${JSON.stringify(props)} Fabric=${fabric}`, () => {
            const env = environment(os, fabric);
            const pdf = env.make('index.js', props);
            Object.assign(pdf.state, {isDownloaded: true, path: '/document.pdf'});
            const tree = pdf.render();
            assert.equal(env.imports(), js ? 1 : 0);
            const host = tree.type === 'JSPDF' ? tree : tree.props.children[0];
            assert.equal(host.type, js ? 'JSPDF' : os === 'windows' ? 'WindowsPDF' : 'NativePDF');
            const navigation = [];
            const ref = {setPage: page => navigation.push(page), setNativeProps: props => navigation.push(props.page)};
            host.props.ref(ref);
            pdf.setPage(2);
            assert.equal(pdf.props.page, 1);
            if (js || !fabric) {
                assert.deepEqual(navigation, [2]); assert.equal(env.calls.length, 0);
            } else {
                assert.equal(navigation.length, 0); assert.equal(env.calls[0][0], ref); assert.equal(env.calls[0][1], 2);
            }
        });
    }
}

function layout(pdf, width = 600, height = 800) {
    pdf._onLayout({nativeEvent: {layout: {width, height}}});
}

async function viewer(props = {}) {
    const env = environment();
    const pdf = env.make('PdfView.js', props);
    const indices = [];
    layout(pdf);
    pdf.componentDidMount();
    await Promise.resolve();
    pdf._getRef({scrollToIndex: ({index}) => indices.push(index)});
    return {env, pdf, indices};
}

test('imperative navigation is independent of unchanged controlled page; latest request wins', async () => {
    const {env, pdf, indices} = await viewer();
    pdf.setPage(2); pdf.setPage(4); env.timers.run();
    assert.deepEqual(indices, [3]); assert.equal(pdf.props.page, 1);
    pdf.componentDidUpdate(pdf.props); env.timers.run();
    assert.deepEqual(indices, [3]);
    const previous = pdf.props; pdf.props = {...previous, page: 3};
    pdf.componentDidUpdate(previous); env.timers.run();
    assert.deepEqual(indices, [3, 2]);
});

test('navigation from onLoadComplete waits for list ref', async () => {
    const env = environment();
    const indices = [];
    const pdf = env.make('PdfView.js', {onLoadComplete: () => pdf.setPage(3)});
    layout(pdf);
    pdf.componentDidMount(); await Promise.resolve(); env.timers.run();
    assert.equal(env.timers.jobs.size, 0);
    pdf._getRef({scrollToIndex: ({index}) => indices.push(index)}); env.timers.run();
    assert.deepEqual(indices, [2]);
});

test('onLoadComplete navigation survives asynchronous state commit and delayed ref', async () => {
    const env = environment();
    const pdf = env.make('PdfView.js', {onLoadComplete: () => pdf.setPage(4)});
    layout(pdf);
    let commit;
    pdf.setState = (update, callback) => { commit = () => { Object.assign(pdf.state, update); callback?.(); }; };
    const indices = [];
    layout(pdf);
    pdf.componentDidMount(); await Promise.resolve();
    assert.equal(pdf.state.numberOfPages, 0);
    env.timers.run(); commit(); env.timers.run();
    pdf._getRef({scrollToIndex: ({index}) => indices.push(index)});
    env.timers.run(); assert.deepEqual(indices, [3]);
});

test('later controlled request supersedes pending imperative navigation', async () => {
    const {env, pdf, indices} = await viewer();
    pdf.setPage(4);
    const previous = pdf.props; pdf.props = {...previous, page: 2};
    pdf.componentDidUpdate(previous); env.timers.run();
    assert.deepEqual(indices, [1]);
    pdf.setPage(3); pdf._getRef(null); env.timers.run();
    assert.deepEqual(indices, [1]);
    pdf._getRef({scrollToIndex: ({index}) => indices.push(index)}); env.timers.run();
    assert.deepEqual(indices, [1, 2]);
});

test('request before document load survives a zero page count', async () => {
    let resolve;
    const env = environment('ios', true, {'./PdfManager': {
        loadFile: () => new Promise(r => resolve = r), closeFile() {},
    }});
    const pdf = env.make('PdfView.js'); const indices = [];
    layout(pdf);
    pdf.componentDidMount(); pdf._getRef({scrollToIndex: ({index}) => indices.push(index)});
    pdf.setPage(4); env.timers.run(); assert.deepEqual(indices, []);
    resolve([1, 5, 100, 200]); await Promise.resolve(); env.timers.run();
    assert.deepEqual(indices, [3]);
});

test('bounds, initial index, and invalid JS page requests', async () => {
    const {env, pdf, indices} = await viewer({page: 999});
    assert.equal(pdf._renderList().props.initialScrollIndex, 4);
    env.timers.run(); pdf.setPage(-1); env.timers.run(); pdf.setPage(999); env.timers.run();
    assert.deepEqual(indices, [4, 0, 4]);
    for (const page of [Infinity, -Infinity, NaN, 1.5, null, undefined, '2']) {
        assert.throws(() => pdf.setPage(page), /finite integer/);
    }
});

test('horizontal lists stay constrained inside the centered pinch container', async () => {
    const {env, pdf, indices} = await viewer({horizontal: true});
    const list = pdf._renderList();
    assert.equal(list.props.style[0].alignSelf, 'stretch');
    assert.equal(list.props.horizontal, true);
    pdf.setPage(2); env.timers.run();
    assert.deepEqual(indices, [1]);
    assert.equal(pdf._getItemLayout(null, 1).offset, pdf._getPageWidth() + pdf.props.spacing);
});

test('singlePage stays at index zero; unmount cancels pending navigation', async () => {
    const {env, pdf, indices} = await viewer({singlePage: true, page: 4});
    assert.equal(pdf._renderList().props.initialScrollIndex, 0);
    pdf.setPage(5); env.timers.run(); assert.deepEqual(indices, [0]);
    pdf.setPage(2); pdf.componentWillUnmount(); env.timers.run(); assert.deepEqual(indices, [0]);
});

test('custom wrapper receives navigation ref and retains pinch ownership', async () => {
    let listProps;
    const {env, pdf} = await viewer({customFlatListWrapper: props => {listProps = props; return 'wrapper';}});
    assert.equal(pdf._shouldEnablePinchZoom(), false);
    assert.equal(pdf._renderList(), 'wrapper');
    const indices = []; listProps.ref({scrollToIndex: ({index}) => indices.push(index)});
    pdf.setPage(2); env.timers.run(); assert.deepEqual(indices, [1]);
    pdf.props = {...pdf.props, customFlatListWrapper: undefined};
    assert.equal(pdf._shouldEnablePinchZoom(), true);
});

for (const scenario of ['success', 'http-error', 'copy-error']) {
    test(`shared download loader: ${scenario}`, async () => {
        const actions = []; const errors = [];
        const copyError = new Error('copy failed');
        const blob = {
            fs: {unlink: async p => actions.push(['unlink', p]), cp: async () => {
                actions.push(['copy']); if (scenario === 'copy-error') throw copyError;
            }},
            config: () => ({fetch: (...args) => {
                actions.push(['fetch', ...args]);
                const task = Promise.resolve({respInfo: {status: scenario === 'http-error' ? 404 : 200}});
                task.progress = () => task; return task;
            }}),
        };
        const env = environment('ios', true, {'react-native-blob-util': blob});
        const pdf = env.make('index.js', {onError: error => errors.push(error)});
        pdf._mounted = true;
        await pdf._downloadFile({uri: 'https://example.test/a.pdf'}, '/cache/a.pdf');
        assert.equal(actions[0][0], 'unlink'); assert.equal(actions[1][0], 'fetch');
        if (scenario === 'success') {
            assert.equal(pdf.state.path, '/cache/a.pdf'); assert.equal(pdf.state.isDownloaded, true);
            assert.deepEqual(errors, []);
        } else {
            assert.equal(errors.length, 1);
            if (scenario === 'http-error') assert.equal(errors[0].status, 404);
            else assert.equal(errors[0], copyError);
        }
    });
}

test('unmount preserves caller files and shared cache files', () => {
    const unlinks = [];
    const env = environment('ios', true, {'react-native-blob-util': {fs: {unlink: p => unlinks.push(p)}}});
    for (const [uri, localPath, cache] of [
        ['file:///document.pdf', '/document.pdf', false],
        ['https://example.test/document.pdf', '/cache/document.pdf', true],
    ]) {
        const pdf = env.make('index.js', {source: {uri, cache}});
        pdf.state.path = localPath; pdf.componentWillUnmount();
    }
    assert.deepEqual(unlinks, []);
});

test('pending navigation waits for usable layout and uses the final page geometry', async () => {
    const env = environment(); const pdf = env.make('PdfView.js');
    const offsets = [];
    pdf.componentDidMount(); await Promise.resolve();
    pdf._getRef({scrollToIndex: ({index}) => offsets.push(pdf._getItemLayout(null, index).offset)});
    pdf.setPage(3); env.timers.run(); assert.deepEqual(offsets, []);
    layout(pdf); env.timers.run();
    assert.deepEqual(offsets, [pdf._getItemLayout(null, 2).offset]);
    assert.ok(offsets[0] > 20);
    pdf.setPage(4); layout(pdf, 0, 0); env.timers.run(); assert.equal(offsets.length, 1);
    layout(pdf); env.timers.run(); assert.equal(offsets[1], pdf._getItemLayout(null, 3).offset);
});

test('legacy iOS keeps its fixed-size measuring wrapper', () => {
    const env = environment(); const style = {width: 300, height: 400};
    const pdf = env.make('index.js', {usePDFKit: false, style});
    pdf.state.isDownloaded = true;
    const tree = pdf.render();
    assert.equal(tree.type, 'View'); assert.equal(tree.props.style[0], style);
    assert.equal(tree.props.children[0].type, 'JSPDF');
});

test('actual public PDF ref reaches actual JS page navigation', async () => {
    const {env: innerEnv, pdf: inner, indices} = await viewer();
    const env = environment('android', true, {'./PdfView': inner.constructor});
    const outer = env.make('index.js'); outer.state.isDownloaded = true;
    const tree = outer.render(); assert.equal(tree.type, inner.constructor);
    tree.props.ref(inner); outer.setPage(3); innerEnv.timers.run();
    assert.deepEqual(indices, [2]); assert.equal(env.calls.length, 0);
    assert.equal(outer.props.page, 1); assert.equal(inner.props.page, 1);
});

test('download waits for temp-file deletion to finish before fetching', async () => {
    let finishUnlink; let fetched = false;
    const blob = {
        fs: {unlink: () => new Promise(resolve => {finishUnlink = resolve;}), cp: async () => {}},
        config: () => ({fetch: () => {
            fetched = true;
            const task = Promise.resolve({respInfo: {status: 200}}); task.progress = () => task; return task;
        }}),
    };
    const env = environment('ios', true, {'react-native-blob-util': blob});
    const pdf = env.make('index.js');
    const downloading = pdf._downloadFile({uri: 'https://example.test/a.pdf'}, '/cache/a.pdf');
    await Promise.resolve(); assert.equal(fetched, false);
    blob.fs.unlink = async () => {};
    finishUnlink(); await downloading; assert.equal(fetched, true);
});

test('fork API and Fabric page provider remain packaged', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    assert.equal(pkg.codegenConfig.ios.componentProvider.RNPDFPdfPageView, 'RNPDFPdfPageView');
    const types = fs.readFileSync(path.join(root, 'index.d.ts'), 'utf8');
    for (const prop of ['renderPageOverlay', 'customFlatListWrapper', 'onTextSelectionChange']) {
        assert.ok(types.includes(prop));
    }
});
