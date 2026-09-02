import { mount, state } from "@rect/core";

function Counter() {
  const [count, setCount] = state(0);

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="rect-title">
        <p className="eyebrow">Experimental UI runtime</p>
        <h1 id="rect-title">Rect</h1>
        <p className="lede">
          A cheeky, modern-only React alternative exploring how small a component runtime can be when
          it skips legacy compatibility and updates dynamic DOM nodes directly.
        </p>
        <div className="actions">
          <a className="action primary" href="#live-demo">
            Try the runtime
          </a>
          <a className="action" href="https://github.com/moritzbrantner/rect">
            Read the source
          </a>
        </div>
      </section>

      <section className="demo" id="live-demo" aria-labelledby="demo-title">
        <p className="section-label">Live component</p>
        <div className="demo-card">
          <div>
            <h2 id="demo-title">One component. One signal. Direct updates.</h2>
            <p className="note">
              The component function runs to establish the DOM once. The count text subscribes to
              state and updates without re-running the whole component tree.
            </p>
          </div>
          <div className="counter-row">
            <p className="counter-value" aria-live="polite">
              {count}
            </p>
            <button type="button" onClick={() => setCount((value) => value + 1)}>
              Increment
            </button>
            <button type="button" onClick={() => setCount(0)}>
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="principles" aria-labelledby="principles-title">
        <p className="section-label">Design direction</p>
        <h2 id="principles-title">What Rect is testing</h2>
        <div className="grid">
          <article className="principle">
            <h3>Direct state edges</h3>
            <p>Dynamic DOM bindings subscribe to the state they read instead of diffing a new tree.</p>
          </article>
          <article className="principle">
            <h3>Modern-only semantics</h3>
            <p>There is no requirement to preserve decades of framework behavior or compatibility.</p>
          </article>
          <article className="principle">
            <h3>Measured claims</h3>
            <p>Runtime ideas earn their place through benchmarks and reproducible behavior tests.</p>
          </article>
          <article className="principle">
            <h3>Small public surface</h3>
            <p>The experiment starts with mount, JSX, and state before adding more abstractions.</p>
          </article>
        </div>
      </section>

      <section className="status" aria-labelledby="status-title">
        <p className="section-label">Current scope</p>
        <h2 id="status-title">Deliberately tiny</h2>
        <div className="status-line" aria-label="Current Rect capabilities">
          <span className="chip">JSX</span>
          <span className="chip">mount()</span>
          <span className="chip">state()</span>
          <span className="chip">DOM events</span>
          <span className="chip">benchmark harness</span>
        </div>
      </section>
    </main>
  );
}

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app mount point.");
}

mount(<Counter />, root);
