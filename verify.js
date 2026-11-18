// Bildegjenkjenning på telefonen (TensorFlow.js + COCO-SSD). Ingen API-nøkkel, ingen konto.
// Modellen lastes ned når du aktiverer vaktmodus, slik at den er klar når alarmen ringer.
// `fixed` = ting som ikke kan bæres med til sengs; de trekkes oftest.
const TARGETS = [
  { cls: 'refrigerator', no: 'et kjøleskap', fixed: true },
  { cls: 'sink',         no: 'en vask (kjøkken eller bad)', fixed: true },
  { cls: 'toilet',       no: 'et toalett', fixed: true },
  { cls: 'oven',         no: 'en stekeovn eller komfyr', fixed: true },
  { cls: 'microwave',    no: 'en mikrobølgeovn', fixed: true },
  { cls: 'spoon',        no: 'en skje' },
  { cls: 'fork',         no: 'en gaffel' },
  { cls: 'cup',          no: 'en kopp eller et krus' },
  { cls: 'bowl',         no: 'en bolle eller dyp tallerken' },
  { cls: 'bottle',       no: 'en flaske' },
  { cls: 'toothbrush',   no: 'en tannbørste' },
];

const Verify = (() => {
  const LIBS = [
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
  ];
  const MIN_SCORE = 0.35;
  let model = null, loading = null;

  const loadScript = src => new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error(src));
    document.head.appendChild(s);
  });

  // Returnerer true når modellen er klar. Kalles når du aktiverer vaktmodus.
  function load() {
    if (model) return Promise.resolve(true);
    loading = loading || (async () => {
      for (const l of LIBS) await loadScript(l);
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      return true;
    })().catch(e => { loading = null; return false; });
    return loading;
  }

  async function toCanvas(file, max = 640) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }

  // { ok } eller { ok:false, error }. Feil => alarmen fortsetter.
  async function matches(file, target) {
    if (!model && !(await load())) return { ok: false, error: 'Bildemodellen er ikke lastet.' };
    try {
      const preds = await model.detect(await toCanvas(file), 20, 0.2);
      const hit = preds.find(p => p.class === target.cls && p.score >= MIN_SCORE);
      return { ok: !!hit, seen: preds.slice(0, 3).map(p => p.class) };
    } catch (e) {
      return { ok: false, error: 'Kunne ikke analysere bildet.' };
    }
  }

  function pick(except) {
    let t;
    do {
      const pool = Math.random() < 0.6 ? TARGETS.filter(x => x.fixed) : TARGETS.filter(x => !x.fixed);
      t = pool[Math.floor(Math.random() * pool.length)];
    } while (t === except);
    return t;
  }
  return { load, matches, pick, ready: () => !!model };
})();
